import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level guarantees of prescriptions and treatment plans.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the
 * *database*, not of the application: a doctor reads what they wrote and
 * nobody else's, a patient reads their own **and only once it is issued**, a
 * receptionist reads none at all, an issued prescription cannot be edited,
 * a consultation holds at most one live prescription, and a prescription
 * cannot name a patient its consultation does not. None of that can be proved
 * by stubbing a Supabase client — a stub will happily answer whatever it is
 * told to.
 *
 * Running real PostgreSQL in this suite would mean a database in CI, which
 * `docs/QA_STRATEGY.md` section 1.1 has deliberately avoided since Phase 01.
 * So this file does the next most useful thing: it asserts that the migration
 * **says** what the design requires. It is a structural check, not a
 * behavioural one, and it catches the failure that actually happens — a
 * policy, a grant, a constraint or an allowlist weakened in a later edit
 * without anybody noticing.
 *
 * The behavioural half must be verified against a live project, and
 * `docs/progress/progress_phase_13.md` records exactly which checks are
 * outstanding. **Both halves are needed**, and neither substitutes for the
 * other.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 12's, for the clinical guarantees this phase must not weaken. */
const CLINICAL = readFileSync(
  new URL(
    "../../supabase/migrations/20260923120000_clinical_records.sql",
    import.meta.url,
  ),
  "utf8",
);

function sqlWithoutComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

function tsWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const SQL = sqlWithoutComments(MIGRATION);

function source(path: string): string {
  return tsWithoutComments(
    readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8"),
  );
}

const PRESCRIPTION_QUERIES = source("features/prescriptions/queries.ts");
const PRESCRIPTION_ACTIONS = source("features/prescriptions/actions.ts");
const PLAN_QUERIES = source("features/treatment-plans/queries.ts");
const PLAN_ACTIONS = source("features/treatment-plans/actions.ts");

const TABLES = [
  "prescriptions",
  "prescription_items",
  "treatment_plans",
  "treatment_plan_items",
] as const;

const WRITE_FUNCTIONS = [
  "create_prescription",
  "save_prescription_draft",
  "issue_prescription",
  "cancel_prescription",
  "create_treatment_plan",
  "save_treatment_plan_draft",
  "activate_treatment_plan",
  "complete_treatment_plan",
  "cancel_treatment_plan",
] as const;

const ALL_FUNCTIONS = [
  ...WRITE_FUNCTIONS,
  "search_prescribed_medicines",
  "prescription_belongs_to_current_practitioner",
  "prescription_is_visible_to_current_patient",
  "treatment_plan_belongs_to_current_practitioner",
  "treatment_plan_is_visible_to_current_patient",
  "prescriptions_guard_update",
  "prescription_items_guard_write",
  "treatment_plans_guard_update",
  "treatment_plan_items_guard_write",
] as const;

function functionBody(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  ).exec(SQL);

  if (!match) throw new Error(`No such function in the migration: ${name}`);
  return match[0];
}

/* ---------------------------------------------------------------------------
 * Row-level security
 * ------------------------------------------------------------------------ */

describe("row-level security", () => {
  it("is enabled on all four tables", () => {
    for (const table of TABLES) {
      expect(SQL).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });

  it("adds exactly eight policies, and every one is a select policy", () => {
    const policies = [...SQL.matchAll(/create policy (\w+)/g)].map(
      (match) => match[1],
    );

    expect(policies.sort()).toEqual(
      [
        "prescription_items_select_author",
        "prescription_items_select_patient",
        "prescriptions_select_author",
        "prescriptions_select_patient",
        "treatment_plan_items_select_author",
        "treatment_plan_items_select_patient",
        "treatment_plans_select_author",
        "treatment_plans_select_patient",
      ].sort(),
    );

    for (const policy of policies) {
      expect(SQL).toMatch(
        new RegExp(`create policy ${policy}[\\s\\S]*?for select`),
      );
    }
  });

  it("scopes every policy by a relationship, not by a role alone", () => {
    // `docs/SECURITY.md` section 6 and `phase_13.md` section 55. Holding the
    // doctor role, or the patient role, must reach nothing on its own.
    const predicates = [
      ...SQL.matchAll(/create policy (\w+)[\s\S]*?using \(([\s\S]*?)\);/g),
    ];

    expect(predicates).toHaveLength(8);

    for (const [, name, predicate] of predicates) {
      expect(predicate, `${name} names no role`).toMatch(/has_app_role\(/);
      expect(predicate, `${name} is not scoped by a relationship`).toMatch(
        /current_practitioner_id\(\)|current_patient_id\(\)|belongs_to_current_practitioner|is_visible_to_current_patient/,
      );
    }
  });

  it("makes a draft invisible to a patient in the policy itself", () => {
    // **The patient-visibility guarantee** (sections 34, 60 and example 4).
    // Not a query filter somebody could forget — a predicate on the row.
    expect(SQL).toMatch(
      /create policy prescriptions_select_patient[\s\S]*?using \([\s\S]*?status <> 'draft'[\s\S]*?\);/,
    );
    expect(SQL).toMatch(
      /create policy treatment_plans_select_patient[\s\S]*?using \([\s\S]*?status <> 'draft'[\s\S]*?\);/,
    );

    // And for the items, through the definer predicate.
    expect(
      functionBody("prescription_is_visible_to_current_patient"),
    ).toContain("status <> 'draft'");
    expect(
      functionBody("treatment_plan_is_visible_to_current_patient"),
    ).toContain("status <> 'draft'");
  });

  it("has no blanket policy anywhere", () => {
    expect(SQL).not.toMatch(/using \(\s*true\s*\)/);
    expect(SQL).not.toMatch(/auth\.uid\(\) is not null/);
    expect(SQL).not.toMatch(/for all/);
  });

  it("adds no insert, update or delete policy for any role", () => {
    for (const operation of ["insert", "update", "delete"]) {
      expect(SQL).not.toMatch(
        new RegExp(`create policy[\\s\\S]*?for ${operation}`),
      );
    }
  });

  it("gives a receptionist and an administrator no policy at all", () => {
    // Stronger than a predicate that evaluates to false: a predicate can be
    // weakened by an edit, an absent policy cannot. `docs/SECURITY.md`
    // section 6's hard boundary, and `phase_13.md` sections 36-37.
    expect(SQL).not.toMatch(/has_app_role\('receptionist'\)/);
    expect(SQL).not.toMatch(/has_app_role\('admin'\)/);
  });

  it("drops no existing policy", () => {
    expect(SQL).not.toMatch(/drop policy/);
  });
});

/* ---------------------------------------------------------------------------
 * Grants
 * ------------------------------------------------------------------------ */

describe("grants", () => {
  it("revokes everything from anon and authenticated before granting", () => {
    for (const table of TABLES) {
      expect(SQL).toMatch(
        new RegExp(`revoke all on public\\.${table} from anon, authenticated;`),
      );
    }
  });

  it("grants no insert, update or delete on any table to any client role", () => {
    for (const operation of ["insert", "update", "delete"]) {
      expect(SQL).not.toMatch(
        new RegExp(`grant ${operation}[\\s\\S]{0,200}on public\\.`),
      );
    }
  });

  it("grants nothing at all to anon", () => {
    expect(SQL).not.toMatch(/grant[\s\S]{0,200}to anon/);
  });

  it("keeps every actor column out of the select grant", () => {
    // A column privilege belongs to a database role, and a patient and a
    // doctor are both `authenticated` — so a column readable by one is
    // readable by the other (the trap Phase 10 recorded about
    // `internal_note`). Nothing on a screen needs these, so nothing reads
    // them: they are an audit trail for Phase 19.
    const grants = [
      ...SQL.matchAll(/grant select \(([\s\S]*?)\) on public\.(\w+)/g),
    ];

    expect(grants.length).toBeGreaterThanOrEqual(2);

    for (const [, columns, table] of grants) {
      for (const actor of [
        "created_by",
        "issued_by",
        "cancelled_by",
        "activated_by",
        "completed_by",
      ]) {
        expect(columns, `${table} grants ${actor}`).not.toContain(actor);
      }
    }
  });
});

/* ---------------------------------------------------------------------------
 * The functions
 * ------------------------------------------------------------------------ */

describe("the security definer functions", () => {
  it("pin their search path", () => {
    for (const name of ALL_FUNCTIONS) {
      expect(functionBody(name), `${name} does not pin search_path`).toContain(
        "set search_path = ''",
      );
    }
  });

  it("authorize before they read or write anything", () => {
    // `phase_13.md` section 54's sequence, and Phase 11's gate reused
    // unchanged: it refuses no session, a non-doctor and a doctor with no
    // practitioner record, and *returns* the practitioner id — so there is
    // nothing to accept.
    for (const name of [...WRITE_FUNCTIONS, "search_prescribed_medicines"]) {
      // From `begin`, so the `declare` block's `auth.uid()` lookup — which
      // reads nothing protected — is not mistaken for a read of the data the
      // gate exists to protect.
      const body = functionBody(name).slice(
        functionBody(name).indexOf("\nbegin"),
      );
      const gate = body.indexOf("public.assert_care_practitioner()");
      const firstRead = Math.min(
        ...["select ", "insert into", "update public.", "delete from"]
          .map((keyword) => body.indexOf(keyword))
          .filter((index) => index >= 0),
      );

      expect(gate, `${name} does not call the gate`).toBeGreaterThan(0);
      expect(gate, `${name} reads before it authorizes`).toBeLessThan(
        firstRead,
      );
    }
  });

  it("have no patient, practitioner, doctor, appointment or status parameter", () => {
    // Sections 31, 33, 58 and 59, and example 2. The argument list *is* the
    // allowlist, and this is the assertion that keeps it one.
    for (const name of ALL_FUNCTIONS) {
      const signature = /\(([\s\S]*?)\)\s*returns/.exec(
        functionBody(name),
      )?.[1];

      for (const forbidden of [
        "p_patient_id",
        "p_practitioner_id",
        "p_doctor_id",
        "p_appointment_id",
        "p_status",
        "p_role",
        "p_issued_at",
        "p_created_by",
      ]) {
        expect(signature ?? "", `${name} accepts ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it("resolve every row by id *and* by the caller's own practitioner", () => {
    // Section 56: another practitioner's prescription must be
    // indistinguishable from one that does not exist.
    for (const name of [
      "save_prescription_draft",
      "issue_prescription",
      "cancel_prescription",
    ]) {
      expect(functionBody(name)).toMatch(
        /where p\.id = p_prescription_id\s*\n\s*and p\.practitioner_id = practitioner/,
      );
    }

    for (const name of [
      "save_treatment_plan_draft",
      "activate_treatment_plan",
      "complete_treatment_plan",
      "cancel_treatment_plan",
    ]) {
      expect(functionBody(name)).toMatch(
        /where p\.id = p_treatment_plan_id\s*\n\s*and p\.practitioner_id = practitioner/,
      );
    }
  });

  it("derive the patient, the practitioner and the appointment from the consultation", () => {
    // Example 2 and section 79: the doctor does not re-enter them, and a
    // request cannot supply them. They come out of a clinical record that was
    // itself resolved by the caller's own practitioner id.
    for (const name of ["create_prescription", "create_treatment_plan"]) {
      const body = functionBody(name);

      expect(body).toMatch(
        /from public\.clinical_records cr\s*\n\s*where cr\.id = p_clinical_record_id\s*\n\s*and cr\.practitioner_id = practitioner/,
      );
      expect(body).toContain("rec.patient_id");
      expect(body).toContain("rec.practitioner_id");
      expect(body).toContain("rec.appointment_id");
    }
  });

  it("apply the optimistic lock in the update statement itself", () => {
    // Not only in an `if` above it: two concurrent saves must not both pass a
    // check and both write (section 72).
    for (const name of [
      "save_prescription_draft",
      "issue_prescription",
      "cancel_prescription",
      "save_treatment_plan_draft",
      "activate_treatment_plan",
      "complete_treatment_plan",
      "cancel_treatment_plan",
    ]) {
      expect(functionBody(name)).toMatch(
        /update public\.\w+ p\s*\n\s*set[\s\S]*?where[\s\S]*?p\.version = p_expected_version/,
      );
    }
  });

  it("issue with no clinical content at all", () => {
    // Sections 15-16 and example 3, at the database boundary this time.
    const signature = /\(([\s\S]*?)\)\s*returns/.exec(
      functionBody("issue_prescription"),
    )?.[1];

    expect(signature?.trim()).toBe(
      "p_prescription_id uuid,\n  p_expected_version integer",
    );
  });

  it("never write a status parameter, because there is not one", () => {
    // Each transition is its own function. `phase_13.md` section 59: the
    // server controls status transitions.
    expect(functionBody("issue_prescription")).toContain(
      "set status = 'issued'",
    );
    expect(functionBody("cancel_prescription")).toContain(
      "set status = 'cancelled'",
    );
    expect(functionBody("activate_treatment_plan")).toContain(
      "set status = 'active'",
    );
  });

  it("grants execute to authenticated and to nobody else", () => {
    for (const name of [...WRITE_FUNCTIONS, "search_prescribed_medicines"]) {
      expect(SQL).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
      expect(SQL).toMatch(
        new RegExp(
          `grant execute on function public\\.${name}\\([\\s\\S]{0,200}?to authenticated`,
        ),
      );
    }
  });

  it("keeps the four policy predicates ungranted", () => {
    // They exist for row-level security and are not an API.
    for (const name of [
      "prescription_belongs_to_current_practitioner",
      "prescription_is_visible_to_current_patient",
      "treatment_plan_belongs_to_current_practitioner",
      "treatment_plan_is_visible_to_current_patient",
    ]) {
      expect(SQL).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\(uuid\\) from public`,
        ),
      );
      expect(SQL).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}`),
      );
    }
  });

  it("replaces no existing function", () => {
    expect(SQL).not.toMatch(/create or replace function/);
  });
});

/* ---------------------------------------------------------------------------
 * The medicine search
 * ------------------------------------------------------------------------ */

describe("the medicine suggestion search", () => {
  const body = functionBody("search_prescribed_medicines");

  it("is restricted to the caller's own prescribing history in the from clause", () => {
    // In the `from`/`where` join rather than in a predicate a later edit could
    // drop. It is not a catalog, and it makes no claim about anybody else.
    expect(body).toMatch(/where p\.practitioner_id = practitioner/);
  });

  it("returns nothing for an empty term", () => {
    expect(body).toMatch(/if char_length\(term\) < 1 then\s*\n\s*return;/);
  });

  it("clamps its own limit", () => {
    expect(body).toMatch(
      /least\(greatest\(coalesce\(p_limit, \d+\), 1\), \d+\)/,
    );
  });

  it("escapes the wildcards", () => {
    expect(body).toContain(
      "replace(replace(replace(term, '\\', '\\\\'), '%', '\\%'), '_', '\\_')",
    );
    expect(body).toContain("escape '\\'");
  });

  it("matches a prefix only, so no term returns everything", () => {
    expect(body).toMatch(/pattern := replace\([\s\S]*?\) \|\| '%'/);
    expect(body).not.toMatch(/pattern := '%'/);
  });

  it("discloses a name and a form, and no patient, date or dose", () => {
    const returns = /returns table \(([\s\S]*?)\)/.exec(body)?.[1] ?? "";

    expect(returns).toContain("medicine_name");
    expect(returns).toContain("form");
    for (const forbidden of [
      "patient",
      "dose",
      "frequency",
      "created_at",
      "prescription_id",
    ]) {
      expect(returns).not.toContain(forbidden);
    }
  });
});

/* ---------------------------------------------------------------------------
 * Integrity
 * ------------------------------------------------------------------------ */

describe("integrity", () => {
  it("binds all four identities with one composite foreign key", () => {
    // Sections 29-33 and 94: a prescription naming a different patient than
    // its consultation does is not something application code must prevent —
    // the database cannot represent it.
    for (const table of ["prescriptions", "treatment_plans"]) {
      expect(SQL).toMatch(
        new RegExp(
          `constraint ${table}_clinical_record_consistency\\s*\\n\\s*foreign key \\(clinical_record_id, appointment_id, patient_id, practitioner_id\\)\\s*\\n\\s*references public\\.clinical_records \\(id, appointment_id, patient_id, practitioner_id\\)`,
        ),
      );
    }
  });

  it("adds the unique key that composite foreign key needs", () => {
    expect(SQL).toMatch(
      /alter table public\.clinical_records\s*\n\s*add constraint clinical_records_identity_key\s*\n\s*unique \(id, appointment_id, patient_id, practitioner_id\)/,
    );
  });

  it("restricts every reference to a patient, practitioner or appointment", () => {
    // Section 98: no cascade that could destroy clinical history. Deleting a
    // patient with a prescription fails loudly instead.
    const references = [
      ...SQL.matchAll(
        /references public\.(patients|practitioners|appointments|clinical_records) \([^)]*\)\s*\n?\s*(on update cascade\s*\n?\s*)?on delete (\w+)/g,
      ),
    ];

    expect(references.length).toBeGreaterThanOrEqual(8);
    for (const [, table, , action] of references) {
      expect(action, `${table} is not on delete restrict`).toBe("restrict");
    }
  });

  it("allows at most one live prescription and one live plan per consultation", () => {
    // Sections 73 and 92. A partial unique index, so it decides between two
    // genuinely concurrent creates — and excluding the closed statuses leaves
    // the correction path open (section 42).
    expect(SQL).toMatch(
      /create unique index prescriptions_one_live_per_record\s*\n\s*on public\.prescriptions \(clinical_record_id\)\s*\n\s*where status <> 'cancelled'/,
    );
    expect(SQL).toMatch(
      /create unique index treatment_plans_one_live_per_record\s*\n\s*on public\.treatment_plans \(clinical_record_id\)\s*\n\s*where status in \('draft', 'active'\)/,
    );
  });

  it("creates idempotently, so a second request returns the first one's row", () => {
    expect(functionBody("create_prescription")).toContain(
      "on conflict (clinical_record_id) where status <> 'cancelled' do nothing",
    );
    expect(functionBody("create_treatment_plan")).toContain(
      "on conflict (clinical_record_id) where status in ('draft', 'active') do nothing",
    );
  });

  it("increments the version in a trigger, so no function can forget", () => {
    expect(functionBody("prescriptions_guard_update")).toContain(
      "new.version := old.version + 1;",
    );
    expect(functionBody("treatment_plans_guard_update")).toContain(
      "new.version := old.version + 1;",
    );
  });

  it("makes the identity columns immutable", () => {
    for (const name of [
      "prescriptions_guard_update",
      "treatment_plans_guard_update",
    ]) {
      const body = functionBody(name);
      expect(body).toContain(
        "new.clinical_record_id <> old.clinical_record_id",
      );
      expect(body).toContain("new.patient_id <> old.patient_id");
      expect(body).toContain("new.practitioner_id <> old.practitioner_id");
    }
  });

  it("refuses to change an issued prescription's items, whatever wrote them", () => {
    // Section 67: issued items must not simply disappear from history.
    const body = functionBody("prescription_items_guard_write");

    expect(body).toContain("parent_status is distinct from 'draft'");
    expect(SQL).toMatch(
      /create trigger prescription_items_guard_write\s*\n\s*before insert or update or delete on public\.prescription_items/,
    );
  });

  it("refuses to issue a prescription with no items", () => {
    expect(functionBody("prescriptions_guard_update")).toMatch(
      /new\.status = 'issued'[\s\S]*?not exists \([\s\S]*?public\.prescription_items[\s\S]*?raise exception/,
    );
  });

  it("stores no medicine catalog reference, so no catalog can rewrite history", () => {
    // Sections 9, 50, 51 and 52, and example 5. Every clinically relevant
    // value is a snapshot of what the doctor wrote.
    const table =
      /create table public\.prescription_items \(([\s\S]*?)\n\);/.exec(
        SQL,
      )?.[1];

    expect(table).toBeDefined();
    expect(table).toContain("medicine_name text not null");
    expect(table).not.toContain("medicine_id");
    expect(SQL).not.toMatch(/create table public\.medicines/);

    for (const column of [
      "form",
      "strength",
      "dose_amount",
      "dose_unit",
      "frequency",
      "timing",
      "duration",
      "quantity",
      "quantity_unit",
      "instructions",
    ]) {
      expect(table, `the snapshot has no ${column}`).toContain(column);
    }
  });

  it("gives every item a deterministic order the doctor controls", () => {
    // Section 66: never arbitrary database row order.
    expect(SQL).toMatch(
      /constraint prescription_items_order_unique unique \(prescription_id, sort_order\)/,
    );
    expect(SQL).toMatch(
      /constraint treatment_plan_items_order_unique\s*\n?\s*unique \(treatment_plan_id, sort_order\)/,
    );
  });
});

/* ---------------------------------------------------------------------------
 * Boundaries this phase must not cross
 * ------------------------------------------------------------------------ */

describe("scope boundaries", () => {
  it("adds no prescription column to an existing clinical table", () => {
    // `phase_13.md` section 2 and example 1: a prescription is not text in
    // `clinical_records.doctor_notes`, and a treatment plan is not text on an
    // appointment.
    expect(SQL).not.toMatch(
      /alter table public\.clinical_records[\s\S]{0,80}add column/,
    );
    expect(SQL).not.toMatch(/alter table public\.appointments/);
  });

  it("writes no appointment, so a follow-up date books nothing", () => {
    // Section 47. Phase 09 remains the appointment engine.
    expect(SQL).not.toMatch(/insert into public\.appointments/);
    expect(SQL).not.toMatch(/update public\.appointments/);
  });

  it("stores no document, file or storage reference", () => {
    // Section 62 and Phase 14. The database is the source of truth; a
    // generated document is a later projection of it.
    for (const forbidden of [
      "storage.",
      "bucket",
      "file_path",
      "document_id",
    ]) {
      expect(SQL).not.toContain(forbidden);
    }
  });

  it("contains nothing AI-shaped", () => {
    // Section 63 and Phase 17. No suggestion column, no confidence score, no
    // model reference — and nothing that would let a future one be issued
    // without a doctor, because `issue_prescription` is the only path to
    // `issued` and it is gated on a practitioner.
    for (const forbidden of [
      "confidence",
      "model_",
      "suggested_by",
      "generated_by",
      "ai_",
    ]) {
      expect(SQL).not.toContain(forbidden);
    }
  });

  it("provides no delete path of any kind", () => {
    // Sections 99 and 100: withdraw, never delete.
    expect(SQL).not.toMatch(/create function public\.delete_/);
    expect(SQL).not.toMatch(/grant delete/);
    expect(SQL).not.toMatch(/delete from public\.prescriptions/);
    expect(SQL).not.toMatch(/delete from public\.treatment_plans\b/);
  });
});

/* ---------------------------------------------------------------------------
 * Phase 12's guarantees, unweakened
 * ------------------------------------------------------------------------ */

describe("what Phase 12 still guarantees", () => {
  it("still gives the clinical record exactly one policy", () => {
    const policies = [
      ...sqlWithoutComments(CLINICAL).matchAll(/create policy (\w+)/g),
    ];

    expect(policies).toHaveLength(1);
    expect(policies[0]?.[1]).toBe("clinical_records_select_author");
  });

  it("adds no clinical-record policy for a patient", () => {
    // `phase_12.md` sections 21 and 53: a doctor-facing clinical record is
    // not a patient-facing one. Phase 13 gives a patient their prescription
    // and their plan, and still not the notes those came out of.
    expect(SQL).not.toMatch(/create policy[\s\S]{0,200}clinical_records/);
  });
});

/* ---------------------------------------------------------------------------
 * The application layer
 * ------------------------------------------------------------------------ */

describe("the application layer", () => {
  const modules = {
    "prescriptions/queries.ts": PRESCRIPTION_QUERIES,
    "prescriptions/actions.ts": PRESCRIPTION_ACTIONS,
    "treatment-plans/queries.ts": PLAN_QUERIES,
    "treatment-plans/actions.ts": PLAN_ACTIONS,
  };

  it("never writes through a table client", () => {
    for (const [name, text] of Object.entries(modules)) {
      for (const method of [".insert(", ".update(", ".delete(", ".upsert("]) {
        expect(text, `${name} writes through ${method}`).not.toContain(method);
      }
    }
  });

  it("never touches the service-role client", () => {
    for (const [name, text] of Object.entries(modules)) {
      expect(text, `${name} imports the admin client`).not.toContain(
        "supabase/admin",
      );
      expect(text).not.toContain("SERVICE_ROLE");
    }
  });

  it("checks a permission on every exported read", () => {
    for (const [name, text] of [
      ["prescriptions/queries.ts", PRESCRIPTION_QUERIES],
      ["treatment-plans/queries.ts", PLAN_QUERIES],
    ] as const) {
      const exported = [...text.matchAll(/export async function (\w+)/g)]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined);

      expect(exported.length).toBeGreaterThan(0);

      for (const fn of exported) {
        const body = new RegExp(
          `export async function ${fn}\\([\\s\\S]*?\\n\\}`,
        ).exec(text)?.[0];

        // The two display-name helpers delegate to a reader that has already
        // been authorized by the page's own guard, and disclose only a
        // practitioner's name — which `public.practitioners` grants to every
        // authenticated caller anyway.
        if (fn.includes("PractitionerDisplayName")) continue;

        expect(body, `${name}:${fn} checks no permission`).toMatch(
          /assertPermission\(/,
        );
      }
    }
  });

  it("never selects everything", () => {
    for (const [name, text] of Object.entries(modules)) {
      expect(text, `${name} uses select *`).not.toMatch(/select\(\s*["'`]\*/);
    }
  });

  it("filters a patient read to non-drafts as well as trusting the policy", () => {
    // Defence in depth on the property that matters most here.
    expect(PRESCRIPTION_QUERIES).toMatch(/\.neq\("status", "draft"\)/);
    expect(PLAN_QUERIES).toMatch(/\.neq\("status", "draft"\)/);
  });

  it("takes no patient id on anything a patient calls", () => {
    // The same structural choice Phase 07 made: an identifier that cannot be
    // passed cannot be substituted.
    for (const fn of [
      "listPatientPrescriptions",
      "listPatientTreatmentPlans",
    ]) {
      const signature = new RegExp(
        `export async function ${fn}\\(([\\s\\S]*?)\\)`,
      ).exec(`${PRESCRIPTION_QUERIES}\n${PLAN_QUERIES}`)?.[1];

      expect(signature ?? "", `${fn} accepts an id`).not.toContain("patientId");
    }
  });

  it("names no clinical field in any log call", () => {
    // Section 83. A log line carries the operation and opaque ids; the
    // structured logger's redaction is the safety net, not the policy.
    for (const [name, text] of Object.entries(modules)) {
      const logCalls = [...text.matchAll(/logger\.\w+\(([\s\S]*?)\);/g)]
        .map((match) => match[1] ?? "")
        // Drop the leading event name. It is a fixed, low-cardinality
        // category written here — `prescription.items_read_failed` contains
        // the word "items" and carries nothing. What must not name a clinical
        // field is the *context object* after it.
        .map((call) => call.replace(/^\s*"[^"]*"\s*,?/, ""));

      for (const call of logCalls) {
        // Nothing clinical by name.
        for (const forbidden of [
          "medicineName",
          "doseAmount",
          "doseUnit",
          "generalInstructions",
          "cancellationReason",
          "fullName",
          "medicine_name",
        ]) {
          expect(call, `${name} logs ${forbidden}`).not.toContain(forbidden);
        }

        // And nothing read off the validated request except the two opaque
        // identifiers. Stronger than a name list, because it catches a field
        // added later that nobody thought to forbid.
        const fromRequest = [...call.matchAll(/parsed\.data\.(\w+)/g)].map(
          (match) => match[1],
        );

        for (const field of fromRequest) {
          expect(
            ["prescriptionId", "treatmentPlanId"],
            `${name} logs parsed.data.${field}`,
          ).toContain(field);
        }
      }
    }
  });

  it("writes nothing to browser storage", () => {
    for (const [name, text] of Object.entries(modules)) {
      for (const api of ["localStorage", "sessionStorage", "indexedDB"]) {
        expect(text, `${name} uses ${api}`).not.toContain(api);
      }
    }
  });
});
