import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The database's guarantees, and the application's.
 *
 * ## Why this reads SQL
 *
 * Because that is where the guarantees are. "A receptionist cannot read
 * somebody's notifications" is not a property of any TypeScript in this
 * repository — it is a property of there being no policy admitting them — and
 * a test that exercised the application layer would prove only that the
 * application does not currently ask.
 *
 * `docs/QA_STRATEGY.md` records the same reasoning for the Phase 10-14
 * structural suites. What this cannot do is prove the migration was applied,
 * or that PostgreSQL behaves as the SQL says; that is verified against a live
 * project and recorded in `docs/progress/progress_phase_15.md`.
 */

const MIGRATION_PATH = new URL(
  "../../supabase/migrations/20260926120000_notifications.sql",
  import.meta.url,
);

const MIGRATION = readFileSync(MIGRATION_PATH, "utf8");

/**
 * The grants fix.
 *
 * `20260926120000` protects the processor with `revoke ... from public`, which
 * is what every phase since 08 has written and which is **not sufficient**:
 * Supabase's default privileges grant `execute` to `anon`, `authenticated` and
 * `service_role` **by name** at creation time, and revoking PUBLIC leaves those
 * in place. A live run found every processor function callable by any
 * signed-in user.
 *
 * Earlier phases survived it only because each of their functions calls an
 * authorization gate as its first statement, so the refusal came from the
 * body rather than from the privilege system.
 *
 * Both files are asserted below, because the first one's grants are no longer
 * the whole truth and a reader who checked only it would conclude the wrong
 * thing.
 */
const GRANTS_FIX = readFileSync(
  new URL(
    "../../supabase/migrations/20260926130000_notification_function_grants_fix.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * The audience migration.
 *
 * `20260930120000` **drops and recreates** `create_notification`,
 * `notification_link_path` and `notification_recipient_for_resource` so they
 * can take an audience. PostgreSQL cannot change a signature in place, and
 * `docs/DATABASE.md` section 12 forbids editing an applied migration.
 *
 * Every assertion about those three has to be made against this file, not the
 * original: the original's definitions are no longer installed, so a test that
 * went on reading them would pass while describing SQL that does not exist.
 * That is precisely the failure the grants fix recorded above, one migration
 * later.
 */
const AUDIENCE_MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260930120000_doctor_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The three functions whose current definition lives in the newest file. */
const REDEFINED = [
  "create_notification",
  "notification_link_path",
  "notification_recipient_for_resource",
] as const;

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

const NOTIFICATION_TABLES = [
  "notifications",
  "notification_outbox",
  "notification_deliveries",
  "notification_preferences",
] as const;

/** Every function body in a migration, keyed by name. */
function functionBodies(sql: string = MIGRATION): Map<string, string> {
  const bodies = new Map<string, string>();
  const pattern =
    /create function public\.([a-z_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?as \$\$([\s\S]*?)\$\$;/g;

  for (const match of sql.matchAll(pattern)) {
    bodies.set(match[1] ?? "", `${match[2] ?? ""}||${match[3] ?? ""}`);
  }

  return bodies;
}

/**
 * The body of a function as it is **currently defined**.
 *
 * The newest definition wins, so an assertion about `create_notification`
 * describes the one that is installed rather than the one it replaced.
 */
function currentBody(name: string): string {
  return (
    functionBodies(AUDIENCE_MIGRATION).get(name) ??
    functionBodies().get(name) ??
    ""
  );
}

/**
 * Source with comments removed.
 *
 * Several assertions below ask whether a module *does* something. A docblock
 * that explains why it deliberately does not would fail such a check, which
 * would teach the next author to stop explaining.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("the migration under test", () => {
  it("is the file this suite thinks it is", () => {
    expect(MIGRATION.length).toBeGreaterThan(20_000);
    expect(functionBodies().size).toBeGreaterThan(10);
  });
});

/* ------------------------------------------------------------------------ */
/* Row-level security                                                        */
/* ------------------------------------------------------------------------ */

describe("row-level security", () => {
  it.each(NOTIFICATION_TABLES)("is enabled on %s", (table) => {
    expect(MIGRATION).toContain(
      `alter table public.${table} enable row level security`,
    );
  });

  it("has no blanket policy anywhere", () => {
    // `phase_15.md` section 54, and the rule every phase since 08 has held:
    // a policy that admits every signed-in user to a sensitive table is not
    // a policy.
    expect(MIGRATION).not.toMatch(/using \(true\)/i);
    expect(MIGRATION).not.toMatch(/auth\.uid\(\) is not null/i);
  });

  it("scopes the notifications policy to the caller and to released rows", () => {
    const policy =
      /create policy notifications_select_own[\s\S]*?using \(([\s\S]*?)\);/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(policy).toContain("recipient_user_id = (select auth.uid())");
    // The half that makes a scheduled reminder invisible to the patient it
    // is for: a predicate on the row, not a filter a query could forget.
    expect(policy).toContain("status = 'active'");
  });

  it("scopes the preferences policy to the caller", () => {
    const policy =
      /create policy notification_preferences_select_own[\s\S]*?using \(([\s\S]*?)\);/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(policy).toContain("user_id = (select auth.uid())");
  });

  it("gives the outbox and the delivery table no policy at all", () => {
    // Stronger than a predicate that evaluates to false: a predicate can be
    // weakened by an edit and an absent policy cannot.
    expect(MIGRATION).not.toMatch(
      /create policy \w+\s+on public\.notification_outbox/,
    );
    expect(MIGRATION).not.toMatch(
      /create policy \w+\s+on public\.notification_deliveries/,
    );
  });

  it("creates no insert, update or delete policy on any table", () => {
    // Every change goes through a definer function that takes no user id.
    for (const verb of ["insert", "update", "delete"]) {
      expect(MIGRATION, `a ${verb} policy exists`).not.toMatch(
        new RegExp(`create policy[\\s\\S]{0,200}for ${verb}`, "i"),
      );
    }
  });

  it("drops no policy from an earlier phase", () => {
    // Phase 07's ownership policies, Phase 10's operational ones, Phase 11's
    // care-scoped ones and Phase 13's patient ones all still say what they
    // said.
    expect(MIGRATION).not.toMatch(/drop policy/i);
  });
});

/* ------------------------------------------------------------------------ */
/* Grants                                                                    */
/* ------------------------------------------------------------------------ */

describe("grants", () => {
  it.each(NOTIFICATION_TABLES)(
    "revokes everything from anon on %s",
    (table) => {
      const revoke = new RegExp(
        `revoke all on public\\.${table} from [^;]*anon`,
      );
      expect(MIGRATION).toMatch(revoke);
    },
  );

  it("grants no write on any notification table", () => {
    for (const table of NOTIFICATION_TABLES) {
      for (const verb of ["insert", "update", "delete"]) {
        expect(MIGRATION, `${verb} granted on ${table}`).not.toMatch(
          new RegExp(`grant ${verb}[^;]*public\\.${table}`, "i"),
        );
      }
    }
  });

  it("grants nothing at all on the two internal queues", () => {
    // Not even to `service_role`: the processor reaches them only through
    // definer functions, so there is no path by which a stray query touches
    // a queue directly.
    expect(MIGRATION).toMatch(
      /revoke all on public\.notification_outbox from anon, authenticated, service_role/,
    );
    expect(MIGRATION).toMatch(
      /revoke all on public\.notification_deliveries from anon, authenticated, service_role/,
    );
    expect(MIGRATION).not.toMatch(
      /grant select[^;]*public\.notification_outbox/,
    );
    expect(MIGRATION).not.toMatch(
      /grant select[^;]*public\.notification_deliveries/,
    );
  });

  it("grants the notification columns one by one", () => {
    const grant =
      /grant select \(([\s\S]*?)\) on public\.notifications to authenticated;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(grant.length).toBeGreaterThan(20);

    // The machinery is not the message.
    expect(grant).not.toContain("dedupe_key");
    expect(grant).not.toContain("reminder_offset_minutes");
    expect(grant).not.toContain("cancelled_at");
  });

  it("grants the processor's functions to service_role and to nobody else", () => {
    const processorFunctions = [
      "create_notification",
      "plan_appointment_reminders",
      "cancel_appointment_reminders",
      "release_due_reminders",
      "claim_notification_outbox",
      "complete_notification_outbox",
      "enqueue_notification_delivery",
      "claim_notification_deliveries",
      "record_notification_delivery_result",
      "notification_appointment_context",
      "notification_prescription_context",
      "notification_treatment_plan_context",
    ];

    for (const name of processorFunctions) {
      const grants = [
        ...MIGRATION.matchAll(
          new RegExp(
            `grant execute on function public\\.${name}\\([^)]*\\)[\\s\\S]{0,120}?to (\\w+);`,
            "g",
          ),
        ),
      ].map((match) => match[1]);

      expect(grants, `${name} is not granted to service_role`).toContain(
        "service_role",
      );
      expect(grants, `${name} is granted to authenticated`).not.toContain(
        "authenticated",
      );
    }
  });

  it("never grants the recipient resolver or the preference reader to a client", () => {
    // Both take an identifier rather than reading `auth.uid()`, so a client
    // holding execute on either could ask about somebody else.
    for (const name of [
      "notification_recipient_for_resource",
      "notification_preference_enabled",
      "emit_notification_event",
    ]) {
      expect(MIGRATION, `${name} is granted to a client role`).not.toMatch(
        new RegExp(
          `grant execute on function public\\.${name}[\\s\\S]{0,160}?to (authenticated|anon|service_role)`,
        ),
      );
    }
  });
});

/* ------------------------------------------------------------------------ */
/* The grants fix                                                            */
/* ------------------------------------------------------------------------ */

describe("the processor is unreachable from a client role", () => {
  const PROCESSOR_FUNCTIONS = [
    "emit_notification_event",
    "notification_recipient_for_resource",
    "notification_preference_enabled",
    "notification_appointment_context",
    "notification_prescription_context",
    "notification_treatment_plan_context",
    "create_notification",
    "plan_appointment_reminders",
    "cancel_appointment_reminders",
    "release_due_reminders",
    "claim_notification_outbox",
    "complete_notification_outbox",
    "enqueue_notification_delivery",
    "claim_notification_deliveries",
    "record_notification_delivery_result",
  ];

  /**
   * The one function that is deliberately **not** gated, and why.
   *
   * `emit_notification_event` is called by the three domain triggers, which
   * run as whichever role performed the domain write. A gate there would make
   * a patient's own booking fail. Its grant is revoked, which is the whole of
   * what it needs: a client that reached it could write a duplicate-keyed
   * outbox row and nothing else.
   *
   * It is named here rather than pattern-matched around, so adding a second
   * exception is a deliberate edit to a test that says why the first exists.
   */
  const UNGATED_BY_DESIGN = ["emit_notification_event"];

  /** Functions the gate belongs in. */
  const GATED = PROCESSOR_FUNCTIONS.filter(
    (name) => !UNGATED_BY_DESIGN.includes(name),
  );

  /**
   * The gate arrived in two migrations: fourteen functions in the first, and
   * `notification_preference_enabled` in a follow-up, because it was
   * `language sql` and had been left protected by its grant alone. It takes
   * another account's id, which is exactly the shape that deserves the
   * strongest treatment, so "it was inconvenient to rewrite" was not a
   * security argument.
   */
  const GATE_MIGRATIONS = [
    GRANTS_FIX,
    readFileSync(
      new URL(
        "../../supabase/migrations/20260926140000_notification_preference_reader_gate.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ];

  const ALL_GATE_SQL = GATE_MIGRATIONS.join("\n");

  it("revokes every processor function from anon and authenticated BY NAME", () => {
    // `from public` alone is what let this through: Supabase's default
    // privileges grant `execute` to those roles **by name** at creation
    // time, and revoking PUBLIC leaves the named grants in place.
    for (const name of PROCESSOR_FUNCTIONS) {
      const pattern = new RegExp(
        String.raw`revoke all on function public\.${name}\([\s\S]{0,400}?from public, anon, authenticated`,
      );

      expect(
        GRANTS_FIX,
        `${name} is not revoked from the named client roles`,
      ).toMatch(pattern);
    }
  });

  it("gates every function a client could otherwise reach", () => {
    // Defence in depth. Restoring a grant by accident — a later
    // `alter default privileges`, a careless migration, a platform change —
    // must not restore the hole.
    for (const name of GATED) {
      const pattern = new RegExp(
        String.raw`create or replace function public\.${name}\([\s\S]*?as \$\$([\s\S]*?)\$\$;`,
      );
      const body = pattern.exec(ALL_GATE_SQL)?.[1];

      expect(body, `${name} was not replaced with a gated body`).toBeDefined();
      expect(body, `${name} does not call the gate`).toContain(
        "perform public.assert_notification_worker()",
      );
    }
  });

  it("does not gate the trigger helper, which would refuse an ordinary booking", () => {
    // `emit_notification_event` is called by the three domain triggers, which
    // run as whichever role performed the domain write. A gate there would
    // make a patient's own booking fail.
    const pattern = new RegExp(
      String.raw`create or replace function public\.emit_notification_event`,
    );

    expect(GRANTS_FIX).not.toMatch(pattern);
  });

  it("re-issues the grants after replacing a function", () => {
    // `create or replace` resets a function's privileges to the defaults for
    // a newly created one — the very thing this migration exists to correct —
    // so every revoke has to be repeated afterwards.
    for (const sql of GATE_MIGRATIONS) {
      const replaced = [
        ...sql.matchAll(/create or replace function public\.([a-z_]+)/g),
      ].map((match) => match[1] ?? "");

      if (replaced.length === 0) continue;

      const tail = sql.slice(sql.lastIndexOf("create or replace function"));

      for (const name of replaced) {
        const pattern = new RegExp(
          String.raw`revoke all on function public\.${name}\(`,
        );

        expect(
          tail,
          `${name} is replaced but not re-revoked afterwards`,
        ).toMatch(pattern);
      }
    }
  });

  it("grants the gate itself to nobody", () => {
    expect(GRANTS_FIX).toMatch(
      String.raw`revoke all on function public.assert_notification_worker()`,
    );
    expect(GRANTS_FIX).not.toMatch(
      new RegExp(
        String.raw`grant execute on function public\.assert_notification_worker`,
      ),
    );
  });

  it("denies the two client roles rather than allow-listing service_role", () => {
    // The set of legitimate non-client contexts is open: a migration, psql, an
    // in-database `pg_cron` job, a future worker with its own role. An
    // allow-list would refuse all of them the first time one appeared.
    const pattern = new RegExp(
      String.raw`create function public\.assert_notification_worker\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;`,
    );
    const body = pattern.exec(GRANTS_FIX)?.[1] ?? "";

    expect(body).toContain("auth.role()");
    expect(body).toContain("'anon'");
    expect(body).toContain("'authenticated'");
    expect(body).not.toMatch(/=\s*'service_role'/);
  });
});

/* ------------------------------------------------------------------------ */
/* No recipient, no content, no link from a caller                           */
/* ------------------------------------------------------------------------ */

describe("no recipient parameter exists", () => {
  /**
   * The one function that takes a user id, and why it is safe.
   *
   * `notification_preference_enabled` answers "has this account switched
   * this channel off?", which the delivery claim needs while holding a
   * notification it has already resolved. It is **revoked from every client
   * role** — `grants > never grants the recipient resolver or the preference
   * reader to a client` asserts that — and is reachable only from inside
   * another definer function, where the current user is the function owner.
   *
   * It is listed here by name rather than pattern-matched around, so adding
   * a second exception is a deliberate edit to a test that says why the
   * first one exists.
   */
  const INTERNAL_FUNCTIONS_TAKING_A_USER_ID = [
    "notification_preference_enabled",
  ];

  it("nowhere in the migration", () => {
    // Sections 54, 72, 73, 110, and example 9. The strongest form of "never
    // trust a client-supplied recipient" is having no parameter for one.
    const bodies = functionBodies();

    for (const [name, body] of bodies) {
      if (INTERNAL_FUNCTIONS_TAKING_A_USER_ID.includes(name)) continue;

      const params = body.split("||")[0] ?? "";
      expect(params.toLowerCase(), `${name} takes a recipient`).not.toMatch(
        /p_recipient|p_user_id|p_email|p_phone|p_to\b/,
      );
    }
  });

  it("not even in the one internal function that takes a user id", () => {
    // It takes one, so the protection has to be the grant. Asserted here as
    // well as under `grants`, because this is where somebody reading about
    // the exception will be.
    for (const name of INTERNAL_FUNCTIONS_TAKING_A_USER_ID) {
      expect(MIGRATION, `${name} is executable by a client role`).not.toMatch(
        new RegExp(
          `grant execute on function public\\.${name}[\\s\\S]{0,200}?to (authenticated|anon|service_role)`,
        ),
      );
    }
  });

  it("and create_notification resolves one instead", () => {
    const body = currentBody("create_notification");

    expect(body).toContain("notification_recipient_for_resource");
    expect(body).toContain("PV050");
  });

  it("and create_notification derives the link rather than accepting it", () => {
    // Section 19: do not accept arbitrary URLs from notification payloads.
    const body = currentBody("create_notification");
    const params = body.split("||")[0] ?? "";

    expect(params).not.toMatch(/p_link|p_url|p_path/);
    expect(body).toContain("public.notification_link_path(");
  });

  it("and an audience is not a recipient", () => {
    // `p_audience` is the one parameter the signature gained when staff
    // notifications arrived. It takes two values — `patient` and
    // `practitioner` — and neither names anybody: the account is still
    // resolved from the resource.
    const params = currentBody("create_notification").split("||")[0] ?? "";

    expect(params).toContain("p_audience public.notification_audience");
    expect(params).not.toMatch(
      /p_recipient|p_user_id|p_profile_id|p_practitioner_id|p_patient_id/,
    );

    const declared =
      /create type public\.notification_audience as enum \(([^)]*)\)/.exec(
        AUDIENCE_MIGRATION,
      )?.[1] ?? "";

    expect(
      [...declared.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort(),
    ).toEqual(["patient", "practitioner"]);
  });
});

describe("no client can create a notification", () => {
  it("and no client function writes to the notifications table", () => {
    const clientFunctions = [
      "mark_notification_read",
      "mark_all_notifications_read",
      "set_notification_preference",
    ];

    const bodies = functionBodies();

    for (const name of clientFunctions) {
      const body = bodies.get(name) ?? "";
      expect(body.length, `${name} not found`).toBeGreaterThan(20);
      expect(body).not.toMatch(/insert into public\.notifications/);
      expect(body).not.toMatch(/insert into public\.notification_deliveries/);
      expect(body).not.toMatch(/insert into public\.notification_outbox/);
    }
  });

  it("and every client function scopes by auth.uid() rather than a parameter", () => {
    // Sections 16, 54, 97, 98.
    const bodies = functionBodies();

    for (const name of [
      "mark_notification_read",
      "mark_all_notifications_read",
      "set_notification_preference",
    ]) {
      const body = bodies.get(name) ?? "";
      expect(body, `${name} does not read auth.uid()`).toContain("auth.uid()");
    }
  });
});

/* ------------------------------------------------------------------------ */
/* Notifications own no domain state                                         */
/* ------------------------------------------------------------------------ */

describe("notifications never own domain state", () => {
  it("writes to no domain table", () => {
    // Section 2, and the core principle of the phase. The arrow points one
    // way: a domain row changes, and a row appears here.
    const domainTables = [
      "appointments",
      "prescriptions",
      "prescription_items",
      "treatment_plans",
      "treatment_plan_items",
      "clinical_records",
      "patients",
      "patient_documents",
      "user_roles",
      "profiles",
      "practitioners",
    ];

    for (const table of domainTables) {
      for (const verb of ["insert into", "update", "delete from"]) {
        const pattern = new RegExp(`${verb} public\\.${table}\\b`, "i");
        expect(
          MIGRATION,
          `the notification migration performs "${verb} ${table}"`,
        ).not.toMatch(pattern);
      }
    }
  });

  it("adds no column to any domain table", () => {
    expect(MIGRATION).not.toMatch(/alter table public\.\w+\s+add column/i);
  });

  it("replaces no function from an earlier phase", () => {
    // The Phase 09-14 write functions stay byte-identical, so their mirror
    // tests still describe what is installed.
    expect(MIGRATION).not.toMatch(/create or replace function/i);
  });

  it("emits events from triggers rather than from an application call", () => {
    // Sections 7 and 8: the row is written in the same transaction as the
    // domain change, so a confirmed appointment that produced no event is
    // not a state the database can be in.
    for (const table of ["appointments", "prescriptions", "treatment_plans"]) {
      expect(MIGRATION).toMatch(
        new RegExp(
          `create trigger ${table}_emit_notification_events[\\s\\S]{0,120}on public\\.${table}`,
        ),
      );
    }
  });

  it("emits a prescription event only on the transition into issued", () => {
    const body =
      functionBodies().get("prescriptions_emit_notification_events") ?? "";

    expect(body).toContain("new.status = 'issued'");
    expect(body).toContain("old.status is distinct from 'issued'");
  });

  it("emits no event for an appointment that is merely requested", () => {
    // A request is not an agreement. Section 25 is about the confirmation.
    const body =
      functionBodies().get("appointments_emit_notification_events") ?? "";

    expect(body).not.toContain("'requested'");
  });
});

/* ------------------------------------------------------------------------ */
/* The audience migration                                                    */
/* ------------------------------------------------------------------------ */

describe("the practitioner's notifications", () => {
  it("is the file this suite thinks it is", () => {
    expect(AUDIENCE_MIGRATION.length).toBeGreaterThan(5_000);
    expect(functionBodies(AUDIENCE_MIGRATION).size).toBe(REDEFINED.length);
  });

  it("re-revokes and re-gates every function it recreates", () => {
    // `create function` takes Supabase's default named grants at creation
    // time — the whole discovery of `20260926130000`. A migration that drops
    // and recreates a processor function re-opens the hole unless it repeats
    // both the revoke and the gate.
    for (const name of REDEFINED) {
      expect(
        AUDIENCE_MIGRATION,
        `${name} is recreated but not revoked from the named client roles`,
      ).toMatch(
        new RegExp(
          String.raw`revoke all on function public\.${name}\([\s\S]{0,400}?from public, anon, authenticated`,
        ),
      );
    }

    // `create_notification` is the one of the three that can write, so it is
    // the one that carries the gate. The other two are pure lookups revoked
    // from every client role, exactly as before.
    expect(currentBody("create_notification")).toContain(
      "perform public.assert_notification_worker()",
    );
  });

  it("grants the creator to service_role and to nobody else", () => {
    const grants = [
      ...AUDIENCE_MIGRATION.matchAll(
        /grant execute on function public\.create_notification\([\s\S]{0,400}?to (\w+);/g,
      ),
    ].map((match) => match[1]);

    expect(grants).toEqual(["service_role"]);
  });

  it("never grants the recipient resolver to a client role", () => {
    // It takes no user id, but it answers "whose account is this resource?",
    // which is not a question a client may ask.
    expect(AUDIENCE_MIGRATION).not.toMatch(
      /grant execute on function public\.notification_recipient_for_resource[\s\S]{0,300}?to (authenticated|anon|service_role)/,
    );
  });

  it("writes to no domain table, and adds no column to one", () => {
    // Section 2 still holds. The one column this migration adds is on
    // `public.notifications`, which is this feature's own table.
    const domainTables = [
      "appointments",
      "prescriptions",
      "prescription_items",
      "treatment_plans",
      "treatment_plan_items",
      "clinical_records",
      "patients",
      "patient_documents",
      "user_roles",
      "profiles",
      "practitioners",
    ];

    for (const table of domainTables) {
      for (const verb of ["insert into", "update", "delete from"]) {
        expect(
          AUDIENCE_MIGRATION,
          `the audience migration performs "${verb} ${table}"`,
        ).not.toMatch(new RegExp(`${verb} public\\.${table}\\b`, "i"));
      }

      expect(
        AUDIENCE_MIGRATION,
        `the audience migration alters public.${table}`,
      ).not.toMatch(new RegExp(`alter table public\\.${table}\\b`, "i"));
    }
  });

  it("changes no trigger and writes no second outbox row", () => {
    // One domain fact, one event. Who is told is decided by the processor
    // afterwards, so the outbox stays a log of what happened to the clinic
    // rather than a log of messages somebody intends to send.
    expect(AUDIENCE_MIGRATION).not.toMatch(/create trigger/i);
    expect(AUDIENCE_MIGRATION).not.toMatch(/drop trigger/i);
    expect(AUDIENCE_MIGRATION).not.toMatch(
      /_emit_notification_events\s*\(\)\s*returns trigger/i,
    );
    expect(AUDIENCE_MIGRATION).not.toMatch(
      /insert into public\.notification_outbox/i,
    );
  });

  it("touches no policy", () => {
    // A practitioner reads their notifications through the policy a patient
    // already had: `recipient_user_id = auth.uid() and status = 'active'`.
    // No second policy, and nothing widened.
    expect(AUDIENCE_MIGRATION).not.toMatch(/create policy/i);
    expect(AUDIENCE_MIGRATION).not.toMatch(/drop policy/i);
    expect(AUDIENCE_MIGRATION).not.toMatch(/alter policy/i);
  });

  it("does not grant the audience column to a client role", () => {
    // Machinery rather than message, like `dedupe_key`. The row carries the
    // title and body that were rendered for its audience, and those are what
    // a reader sees.
    expect(AUDIENCE_MIGRATION).not.toMatch(
      /grant select[\s\S]{0,200}?audience[\s\S]{0,200}?on public\.notifications/i,
    );
  });

  it("pins search_path on every function it defines", () => {
    const declarations = [
      ...AUDIENCE_MIGRATION.matchAll(
        /create function public\.([a-z_]+)[\s\S]*?(?=\bas \$\$)/g,
      ),
    ];

    expect(declarations.length).toBe(REDEFINED.length);

    for (const declaration of declarations) {
      expect(
        declaration[0],
        `${declaration[1]} does not pin search_path`,
      ).toContain("set search_path = ''");
    }
  });

  it("resolves a practitioner from the appointment and from nothing else", () => {
    const body = currentBody("notification_recipient_for_resource");

    expect(body).toContain("public.practitioners");
    expect(body).toContain("a.practitioner_id = pr.id");
    // Only appointments. A prescription or a plan resolves to nobody for a
    // practitioner, which create_notification turns into a skip.
    expect(body).toContain("p_resource_type = 'appointment'");
  });

  it("gives a practitioner a doctor route and never a patient one", () => {
    const body = currentBody("notification_link_path");
    const practitionerBranch =
      /when p_audience = 'practitioner' then([\s\S]*?)\bend\b/.exec(
        body,
      )?.[1] ?? "";

    expect(practitionerBranch.length).toBeGreaterThan(20);
    expect(practitionerBranch).toContain("'/doctor/appointments/'");
    expect(practitionerBranch).not.toContain("/patient/");
    expect(practitionerBranch).toContain("else null");
  });
});

/* ------------------------------------------------------------------------ */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------ */

describe("reminders", () => {
  it("are only planned for a confirmed appointment that has not started", () => {
    // Sections 68 and 69: cancelled, completed and no-show produce an empty
    // desired set, which cancels everything scheduled.
    const body = functionBodies().get("plan_appointment_reminders") ?? "";

    expect(body).toContain("appointment_status = 'confirmed'");
    expect(body).toContain("appointment_starts_at > now()");
    expect(body).toContain("set status = 'cancelled'");
  });

  it("take the schedule from configuration rather than from a caller", () => {
    const body = functionBodies().get("plan_appointment_reminders") ?? "";
    const params = body.split("||")[0] ?? "";

    expect(params).not.toContain("p_offsets");
    expect(body).toContain("public.notification_reminder_offsets()");
  });

  it("re-read the authoritative appointment when they fall due", () => {
    // Section 67 and 102, and the second of the two reads. A reschedule the
    // processor never saw is caught here.
    const body = functionBodies().get("release_due_reminders") ?? "";

    expect(body).toContain("a.status = 'confirmed'");
    expect(body).toContain("a.starts_at > now()");
    // The exact-match check: the appointment must still start at the instant
    // this reminder was computed from.
    expect(body).toContain("make_interval(mins => n.reminder_offset_minutes)");
  });

  it("key a reminder on the appointment, the offset and the start instant", () => {
    // Section 121, and what makes a reschedule self-invalidating.
    const body = functionBodies().get("plan_appointment_reminders") ?? "";

    expect(body).toContain("':reminder:'");
    expect(body).toContain("extract(epoch from appointment_starts_at)");
  });
});

/* ------------------------------------------------------------------------ */
/* Idempotency and integrity                                                 */
/* ------------------------------------------------------------------------ */

describe("idempotency", () => {
  it("makes the outbox key unique", () => {
    expect(MIGRATION).toContain(
      "constraint notification_outbox_dedupe_key_unique unique (dedupe_key)",
    );
  });

  it("makes the notification key unique", () => {
    expect(MIGRATION).toContain(
      "constraint notifications_dedupe_key_unique unique (dedupe_key)",
    );
  });

  it("makes one delivery per notification per channel", () => {
    expect(MIGRATION).toContain(
      "constraint notification_deliveries_unique unique (notification_id, channel)",
    );
  });

  it("discards a duplicate rather than raising", () => {
    const emit = functionBodies().get("emit_notification_event") ?? "";
    const create = functionBodies().get("create_notification") ?? "";

    expect(emit).toContain("on conflict (dedupe_key) do nothing");
    expect(create).toContain("on conflict (dedupe_key) do nothing");
  });

  it("claims work with `for update skip locked`", () => {
    // Two concurrent workers — a cron run overlapping an opportunistic drain
    // — take disjoint batches rather than racing over the same rows.
    for (const name of [
      "claim_notification_outbox",
      "claim_notification_deliveries",
      "release_due_reminders",
    ]) {
      expect(
        functionBodies().get(name) ?? "",
        `${name} does not skip locked rows`,
      ).toContain("for update skip locked");
    }
  });

  it("bounds every claim", () => {
    for (const name of [
      "claim_notification_outbox",
      "claim_notification_deliveries",
      "release_due_reminders",
    ]) {
      expect(functionBodies().get(name) ?? "").toContain("least(greatest(");
    }
  });
});

describe("integrity", () => {
  it("bounds the stored text", () => {
    expect(MIGRATION).toContain("constraint notifications_title_length");
    expect(MIGRATION).toContain("constraint notifications_body_length");
  });

  it("refuses an uncontrolled link path", () => {
    // Section 19, a second time, against any writer — including one that
    // skipped `create_notification`.
    const constraint =
      /constraint notifications_link_path_shape check \(([\s\S]*?)\n  \),/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(constraint).toContain("^/(patient|doctor|receptionist)/");
    expect(constraint).toContain("not like '%..%'");
    expect(constraint).toContain("not like '//%'");
  });

  it("keeps in-app delivery out of the delivery table", () => {
    expect(MIGRATION).toContain(
      "constraint notification_deliveries_external_only check (channel <> 'in_app')",
    );
  });

  it("requires a scheduled notification to say when", () => {
    expect(MIGRATION).toContain("constraint notifications_scheduled_has_time");
  });

  it("stores no provider payload", () => {
    // Section 10. A provider message id and a short code, and nothing else.
    const table =
      /create table public\.notification_deliveries \(([\s\S]*?)\n\);/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(table).not.toMatch(/\bresponse\b|\bpayload\b|\bbody\b|\braw\b/i);
  });

  it("stores no recipient address or phone number anywhere", () => {
    // Section 80's data minimization, at its strongest: the address is read
    // from `auth.users` for one send and is never copied into this schema.
    for (const table of NOTIFICATION_TABLES) {
      const definition =
        new RegExp(
          `create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`,
        ).exec(MIGRATION)?.[1] ?? "";

      expect(definition.length, `${table} not found`).toBeGreaterThan(20);
      expect(definition, `${table} holds an address`).not.toMatch(
        /\bemail\b|\bphone\b|\bmobile\b|\baddress\b/i,
      );
    }
  });

  it("holds no clinical column", () => {
    // Sections 80, 81. There is nothing to leak because there is nowhere to
    // put it.
    const notifications =
      /create table public\.notifications \(([\s\S]*?)\n\);/.exec(
        MIGRATION,
      )?.[1] ?? "";

    for (const word of [
      "diagnosis",
      "symptom",
      "assessment",
      "medicine",
      "dose",
      "prescription_id",
      "clinical",
      "document",
      "reason",
    ]) {
      expect(notifications, `notifications holds ${word}`).not.toContain(word);
    }
  });
});

describe("function hygiene", () => {
  it("pins search_path on every function", () => {
    // A definer function with a mutable search_path is a privilege
    // escalation waiting for somebody to create a schema.
    const declarations = [
      ...MIGRATION.matchAll(
        /create function public\.([a-z_]+)[\s\S]*?(?=\bas \$\$)/g,
      ),
    ];

    expect(declarations.length).toBeGreaterThan(10);

    for (const declaration of declarations) {
      expect(
        declaration[0],
        `${declaration[1]} does not pin search_path`,
      ).toContain("set search_path = ''");
    }
  });

  it("makes every function that touches a queue a definer", () => {
    const definerRequired = [
      "create_notification",
      "claim_notification_outbox",
      "claim_notification_deliveries",
      "record_notification_delivery_result",
      "mark_notification_read",
      "set_notification_preference",
    ];

    for (const name of definerRequired) {
      const declaration = new RegExp(
        `create function public\\.${name}[\\s\\S]*?(?=\\bas \\$\\$)`,
      ).exec(MIGRATION)?.[0];

      expect(declaration, `${name} not found`).toBeDefined();
      expect(declaration, `${name} is not a definer`).toContain(
        "security definer",
      );
    }
  });
});

/* ------------------------------------------------------------------------ */
/* The application layer                                                     */
/* ------------------------------------------------------------------------ */

describe("the application layer", () => {
  const notificationSources = sourceFiles(
    join(SRC, "features", "notifications"),
  );

  it("was actually found", () => {
    expect(notificationSources.length).toBeGreaterThan(5);
  });

  it("writes through no table client", () => {
    // Every write is an RPC. `.insert()`, `.update()` and `.delete()` on a
    // notification table would be refused at runtime anyway — the generated
    // types make them a compile error too — but the absence is the point.
    for (const file of notificationSources) {
      const source = readFileSync(file, "utf8");

      expect(source, `${file} writes through a table client`).not.toMatch(
        /\.(insert|update|upsert|delete)\(/,
      );
    }
  });

  it("uses the service-role client only in the processor", () => {
    // `docs/DATABASE.md` section 6.4. Phase 14 was the first feature to use
    // it at all; this is the second, and it is confined to the worker.
    for (const file of notificationSources) {
      const source = readFileSync(file, "utf8");
      const usesAdmin = source.includes("createSupabaseAdminClient");

      if (usesAdmin) {
        expect(file).toMatch(/processor\.ts$/);
      }
    }
  });

  it("checks a permission on every exported read", () => {
    const queries = readFileSync(
      join(SRC, "features", "notifications", "queries.ts"),
      "utf8",
    );

    const exported = [...queries.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1],
    );

    expect(exported.length).toBeGreaterThan(2);
    expect(queries).toContain('assertPermission("notifications.read.self")');
    expect(queries).toContain('assertPermission("notifications.write.self")');
  });

  it("never selects everything from a notification table", () => {
    const queries = readFileSync(
      join(SRC, "features", "notifications", "queries.ts"),
      "utf8",
    );

    expect(queries).not.toMatch(/\.select\(\s*["'`]\*/);
  });

  it("logs no notification content", () => {
    // Sections 77 and 78. Asserted against the source rather than only
    // behaviourally, so a log call added later is caught at the same place.
    for (const file of notificationSources) {
      const source = readFileSync(file, "utf8");

      for (const call of source.matchAll(/logger\.\w+\(([\s\S]{0,400}?)\);/g)) {
        const args = call[1] ?? "";

        for (const forbidden of [
          "title",
          "body",
          "recipient",
          "email",
          "linkPath",
          "actionUrl",
          "practitionerName",
        ]) {
          expect(
            args,
            `a log call in ${file} carries ${forbidden}`,
          ).not.toContain(forbidden);
        }
      }
    }
  });

  it("has no arbitrary notification-sending surface", () => {
    // Section 109. The strongest form is having nothing to expose: no
    // action, no route handler and no RPC grant by which a signed-in person
    // can cause a message to reach anybody.
    const actions = readFileSync(
      join(SRC, "features", "notifications", "actions.ts"),
      "utf8",
    );

    const exported = [...actions.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1] ?? "",
    );

    // `openNotificationAction` (the bell's preview) marks one of the caller's
    // own notifications read and redirects to its stored link. It sends
    // nothing, and the scans below hold it to that like the rest.
    expect(exported.sort()).toEqual([
      "markAllNotificationsReadAction",
      "markNotificationReadAction",
      "openNotificationAction",
      "setNotificationPreferenceAction",
    ]);

    // Against the **code**, not the prose. The module's docblock names these
    // functions deliberately, to say that nothing here calls them — scanning
    // the comments would make the file fail for explaining itself.
    const code = stripComments(actions);

    expect(code).not.toContain("create_notification");
    expect(code).not.toContain("enqueue_notification_delivery");
    expect(code).not.toContain("claim_notification");
  });

  it("exposes exactly one notification route handler, and it is a POST", () => {
    const route = readFileSync(
      join(SRC, "app", "api", "notifications", "process", "route.ts"),
      "utf8",
    );

    expect(route).toContain("export const POST");
    expect(route).not.toMatch(/export const GET/);
    // An endpoint that drains a queue and sends email must never default to
    // open because a variable is missing.
    expect(route).toContain("getNotificationsWorkerSecret");
    expect(route).toContain("timingSafeEqual");
  });
});

describe("no channel is pretended into existence", () => {
  it("ships no SMS or WhatsApp adapter", () => {
    // Section 14. Not a stub, not a to-do, not an implementation that logs
    // and returns success.
    const channelDir = join(SRC, "lib", "notifications");
    const files = sourceFiles(channelDir);

    for (const file of files) {
      expect(file.toLowerCase()).not.toMatch(/sms|whatsapp|twilio|gupshup/);
    }
  });

  it("keeps provider credentials server-side", () => {
    // Section 76. `env.server.ts` imports `server-only`, so a client
    // component reaching for one is a build error.
    const provider = readFileSync(
      join(SRC, "lib", "notifications", "providers", "emailjs.ts"),
      "utf8",
    );

    expect(provider).toContain('import "server-only"');
    expect(provider).toContain("getNotificationEmailConfig");
    expect(provider).not.toMatch(/NEXT_PUBLIC_/);
  });

  it("never logs a provider response", () => {
    const provider = readFileSync(
      join(SRC, "lib", "notifications", "providers", "emailjs.ts"),
      "utf8",
    );

    expect(provider).not.toMatch(/logger\./);
    expect(provider).not.toMatch(/console\./);
  });
});
