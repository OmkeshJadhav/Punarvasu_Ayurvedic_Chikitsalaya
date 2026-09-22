import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level guarantees of the appointment engine.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the *database*,
 * not of the application: no client can insert an appointment, no client can
 * read another patient's, the internal note is unreachable, and two concurrent
 * bookings cannot both succeed. None of that can be proved by stubbing a
 * Supabase client — a stub will happily answer whatever it is told to.
 *
 * Running real PostgreSQL in this suite would mean a database in CI, which
 * `docs/QA_STRATEGY.md` section 1.1 has deliberately avoided since Phase 01.
 * So this file does the next most useful thing: it asserts that the migration
 * *says* what the design requires. It is a structural check, not a behavioural
 * one, and it catches the failure that actually happens — a policy or a grant
 * being weakened or dropped in a later edit without anybody noticing.
 *
 * The behavioural half is verified against the live project and recorded in
 * `docs/progress/progress_phase_09.md`. **Both halves are needed**, and this
 * file is explicit that it is only one of them.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260920120000_appointment_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * The forward-only fix to the doctor's-diary policy.
 *
 * Kept as its own file because migrations are applied exactly once
 * (`docs/DATABASE.md` section 12). Assertions about the *effective* doctor
 * policy read this; assertions about the schema read the engine migration.
 */
const POLICY_FIX = readFileSync(
  new URL(
    "../../supabase/migrations/20260920130000_appointment_doctor_policy_fix.sql",
    import.meta.url,
  ),
  "utf8",
);

const QUERIES = readFileSync(
  new URL("../../src/features/appointments/queries.ts", import.meta.url),
  "utf8",
);

/**
 * Strips comments, so a scan for a forbidden word tests the schema rather than
 * the prose explaining why the word is forbidden.
 *
 * Without this, a comment saying "there is no column for a symptom here" would
 * fail the assertion that there is no column for a symptom here.
 */
function sqlWithoutComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

/** The same, for TypeScript: block comments, line comments and JSDoc. */
function tsWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const TABLES = [
  "practitioners",
  "appointment_types",
  "practitioner_availability",
  "schedule_exceptions",
  "appointments",
  "appointment_events",
] as const;

/** The `grant select (...) on public.<table>` column list, if there is one. */
function selectGrantColumns(table: string): string[] | null {
  const pattern = new RegExp(
    `grant select \\(([^)]*)\\)\\s*\\n?\\s*on public\\.${table} to authenticated`,
    "m",
  );
  const match = pattern.exec(MIGRATION);
  if (!match) return null;

  return (match[1] ?? "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

describe("row level security", () => {
  it.each(TABLES)("is enabled on %s", (table) => {
    expect(MIGRATION).toContain(
      `alter table public.${table} enable row level security;`,
    );
  });

  it("never grants blanket access to appointment data", () => {
    // `phase_09.md` section 36 forbids `using (auth.uid() is not null)` and an
    // unrestricted `using (true)` for appointments. The two `using (true)`
    // policies in this migration are on the practitioner roster and the
    // appointment-type list, which are operational configuration.
    const appointmentPolicies = [
      ...MIGRATION.matchAll(
        /create policy (appointments\w*|appointment_events\w*)[\s\S]*?using \(([\s\S]*?)\);/g,
      ),
    ];

    expect(appointmentPolicies.length).toBeGreaterThan(0);

    for (const policy of appointmentPolicies) {
      const predicate = policy[2] ?? "";
      expect(predicate.trim()).not.toBe("true");
      expect(predicate).not.toContain("auth.uid() is not null");
      // Every one is scoped by a role *and* by a relationship.
      expect(predicate).toContain("has_app_role");
    }
  });

  it("scopes a patient to their own appointments", () => {
    expect(MIGRATION).toContain(
      "create policy appointments_select_own_patient",
    );
    expect(MIGRATION).toMatch(
      /appointments_select_own_patient[\s\S]*?has_app_role\('patient'\)[\s\S]*?patient_id = public\.current_patient_id\(\)/,
    );
  });

  it("scopes a doctor to their own diary by relationship, not by role alone", () => {
    // `docs/SECURITY.md` section 6: "any doctor can read any patient" is not
    // acceptable. The effective policy is the one in the fix migration.
    expect(POLICY_FIX).toMatch(
      /create policy appointments_select_own_practitioner[\s\S]*?has_app_role\('doctor'\)[\s\S]*?practitioner_id = public\.current_practitioner_id\(\)/,
    );
  });

  it("replaced the policy that read a column no client may read", () => {
    // The original expression subqueried `practitioners.profile_id`, which is
    // not in the column grant. A policy is evaluated with the *caller's*
    // privileges and policies are OR-ed, so the resulting `42501` took out the
    // query for every caller — including the patient whose own policy would
    // have admitted them. Found by signing in against the real database.
    expect(POLICY_FIX).toContain(
      "drop policy appointments_select_own_practitioner on public.appointments;",
    );

    const effective =
      /create policy appointments_select_own_practitioner[\s\S]*?\);/.exec(
        POLICY_FIX,
      )?.[0] ?? "";

    expect(effective.length).toBeGreaterThan(0);
    expect(effective).not.toContain("profile_id");
    expect(effective).not.toContain("public.practitioners");
  });

  it("answers the practitioner question with a definer function, as it does the patient one", () => {
    // The same shape as `current_patient_id()`: runs as its owner, so it needs
    // no grant on a column the caller cannot read, and takes no argument, so
    // nobody can ask it about somebody else.
    expect(POLICY_FIX).toMatch(
      /create function public\.current_practitioner_id\(\)\s*\nreturns uuid[\s\S]*?security definer[\s\S]*?set search_path = ''/,
    );
    expect(POLICY_FIX).toContain(
      "revoke all on function public.current_practitioner_id() from public;",
    );
  });

  it("gives blocked periods no select policy at all", () => {
    // A blocked period's reason may be personal (`phase_09.md` section 15).
    // RLS is enabled with no policy, so every client read returns nothing.
    expect(MIGRATION).toContain(
      "alter table public.schedule_exceptions enable row level security;",
    );
    expect(MIGRATION).not.toMatch(/create policy \w*schedule_exceptions\w*/);
  });
});

describe("grants", () => {
  it.each(TABLES)(
    "revokes everything from anon and authenticated on %s first",
    (table) => {
      expect(MIGRATION).toContain(
        `revoke all on public.${table} from anon, authenticated;`,
      );
    },
  );

  it("grants anon nothing anywhere", () => {
    expect(MIGRATION).not.toMatch(/grant \w+[\s\S]{0,200}? to anon/);
  });

  it.each(["appointments", "appointment_events"])(
    "grants no client role insert, update or delete on %s",
    (table) => {
      for (const privilege of ["insert", "update", "delete"]) {
        const pattern = new RegExp(
          `grant ${privilege}[\\s\\S]{0,400}?on public\\.${table}`,
        );
        expect(MIGRATION).not.toMatch(pattern);
      }
    },
  );

  it("keeps the internal note unreadable by any client", () => {
    // `phase_09.md` section 24. It is protected by the absence of a column
    // grant, not by a filter in application code — so a `select *` cannot
    // reach it either.
    const columns = selectGrantColumns("appointments");
    expect(columns).not.toBeNull();
    expect(columns).not.toContain("internal_note");

    // And no query in the application asks for it. Comments are stripped, so
    // this tests the code rather than the prose explaining the rule.
    expect(tsWithoutComments(QUERIES)).not.toContain("internal_note");
  });

  it("keeps internal scheduling metadata out of the patient's reach", () => {
    const columns = selectGrantColumns("appointments") ?? [];

    for (const column of ["blocked_until", "created_by", "cancelled_by"]) {
      expect(columns).not.toContain(column);
    }
  });

  it("grants exactly the columns an appointment screen needs", () => {
    expect(selectGrantColumns("appointments")).toEqual([
      "id",
      "patient_id",
      "practitioner_id",
      "appointment_type_id",
      "starts_at",
      "ends_at",
      "status",
      "patient_note",
      "cancelled_at",
      "cancellation_reason",
      "created_at",
      "updated_at",
    ]);
  });
});

describe("the double-booking guarantee", () => {
  it("is an exclusion constraint on the practitioner's time", () => {
    // The mandatory requirement of `phase_09.md` sections 17 and 19, and the
    // only mechanism that survives two concurrent requests.
    expect(MIGRATION).toMatch(
      /add constraint appointments_practitioner_no_overlap\s*\n\s*exclude using gist \(\s*\n\s*practitioner_id with =,\s*\n\s*tstzrange\(starts_at, blocked_until, '\[\)'\) with &&/,
    );
  });

  it("also prevents a patient holding two overlapping appointments", () => {
    expect(MIGRATION).toMatch(
      /add constraint appointments_patient_no_overlap\s*\n\s*exclude using gist \(\s*\n\s*patient_id with =,/,
    );
  });

  it("releases the slot only when an appointment is cancelled", () => {
    const predicates = [
      ...MIGRATION.matchAll(
        /exclude using gist \([\s\S]*?\)\s*\n\s*where \(([^)]*)\)/g,
      ),
    ].map((match) => match[1]);

    expect(predicates).toHaveLength(2);
    for (const predicate of predicates) {
      expect(predicate).toBe("status <> 'cancelled'");
    }
  });

  it("uses a half-open range, so back-to-back appointments are legal", () => {
    // `phase_09.md` section 18: 10:00-10:30 and 10:30-11:00 must both be
    // bookable.
    expect(MIGRATION).toContain("'[)'");
  });

  it("requires btree_gist, without which the constraint cannot exist", () => {
    expect(MIGRATION).toContain("create extension if not exists btree_gist;");
  });
});

describe("the write path", () => {
  it("takes no patient, duration, end time or status as an argument", () => {
    const signature =
      /create function public\.book_appointment\(([\s\S]*?)\)\s*\nreturns uuid/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(signature.length).toBeGreaterThan(0);

    const parameters = signature
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);

    expect(parameters).toEqual([
      "p_practitioner_id",
      "p_appointment_type_id",
      "p_starts_at",
      "p_patient_note",
    ]);
  });

  it("derives the patient from the session", () => {
    expect(MIGRATION).toMatch(
      /create function public\.current_patient_id\(\)[\s\S]*?where p\.profile_id = \(select auth\.uid\(\)\)/,
    );
    expect(MIGRATION).toMatch(
      /book_appointment[\s\S]*?patient := public\.current_patient_id\(\);/,
    );
  });

  it("sets the status itself rather than accepting one", () => {
    expect(MIGRATION).toMatch(
      /book_appointment[\s\S]*?-- Set here, not sent[\s\S]*?'requested',/,
    );
  });

  it("reads the duration and buffer from the appointment type", () => {
    expect(MIGRATION).toMatch(
      /computed_ends_at :=\s*\n?\s*p_starts_at \+ make_interval\(mins => appointment_type\.duration_minutes\);/,
    );
    expect(MIGRATION).toMatch(
      /computed_blocked_until :=\s*\n?\s*computed_ends_at \+ make_interval\(mins => appointment_type\.buffer_minutes\);/,
    );
  });

  it("checks authentication and the patient role before every write", () => {
    for (const fn of [
      "book_appointment",
      "cancel_appointment",
      "reschedule_appointment",
    ]) {
      const body = new RegExp(
        `create function public\\.${fn}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
      ).exec(MIGRATION)?.[1];

      expect(body, `${fn} not found`).toBeTruthy();
      expect(body).toContain("if actor is null then");
      expect(body).toContain("public.has_app_role('patient')");
      expect(body).toContain("insufficient_privilege");
    }
  });

  it("resolves ownership and existence in one statement", () => {
    // So a wrong id and somebody else's id are indistinguishable to the
    // caller (`phase_09.md` section 35).
    for (const fn of ["cancel_appointment", "reschedule_appointment"]) {
      const body = new RegExp(
        `create function public\\.${fn}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
      ).exec(MIGRATION)?.[1];

      expect(body).toMatch(
        /where a\.id = p_appointment_id and a\.patient_id = patient;/,
      );
    }
  });

  it("re-validates the slot on both booking and rescheduling", () => {
    const calls = [
      ...MIGRATION.matchAll(/perform public\.assert_bookable_slot\(/g),
    ];
    expect(calls).toHaveLength(2);
  });

  it("cancels by status change, never by delete", () => {
    const body =
      /create function public\.cancel_appointment\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(
        MIGRATION,
      )?.[1];

    expect(body).toContain("set status = 'cancelled'");
    expect(body).toContain("cancelled_at = now()");
    expect(body).not.toMatch(/delete\s+from/i);
  });

  it("records every write in the insert-only history", () => {
    const inserts = [
      ...MIGRATION.matchAll(/insert into public\.appointment_events \(/g),
    ];
    // One per write path: created, cancelled, rescheduled.
    expect(inserts).toHaveLength(3);
  });
});

describe("definer functions", () => {
  it("pin their search_path", () => {
    // A `security definer` function without a pinned `search_path` can be
    // hijacked by a caller-controlled schema (`docs/DATABASE.md` section 6.2).
    const definers = [
      ...MIGRATION.matchAll(
        /create function public\.(\w+)\([\s\S]*?security definer([\s\S]*?)as \$\$/g,
      ),
    ];

    expect(definers.length).toBeGreaterThan(0);

    for (const definer of definers) {
      expect(definer[2], `${definer[1]} does not pin search_path`).toContain(
        "set search_path = ''",
      );
    }
  });

  it("are revoked from public before being granted", () => {
    for (const signature of [
      "public.book_appointment(uuid, uuid, timestamptz, text)",
      "public.cancel_appointment(uuid, text)",
      "public.reschedule_appointment(uuid, timestamptz)",
      "public.get_practitioner_busy_intervals(uuid, timestamptz, timestamptz)",
      "public.current_patient_id()",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${signature} from public;`,
      );
    }
  });

  it("does not let a client call the internal slot validator", () => {
    expect(MIGRATION).toContain(
      "revoke all on function public.assert_bookable_slot(uuid, timestamptz, timestamptz, timestamptz) from public;",
    );
    expect(MIGRATION).not.toMatch(
      /grant execute on function public\.assert_bookable_slot/,
    );
  });

  it("discloses only interval boundaries from the busy-interval reader", () => {
    const body =
      /create function public\.get_practitioner_busy_intervals\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(body).toContain("select a.starts_at, a.blocked_until");
    expect(body).toContain("select e.starts_at, e.ends_at");
    // No identity of any kind.
    expect(body).not.toMatch(/a\.id|a\.patient_id|a\.patient_note|e\.reason/);
    // And it refuses an unauthenticated caller.
    expect(body).toContain("if (select auth.uid()) is null then");
  });
});

describe("the schema itself", () => {
  it("stores appointment instants as timestamptz", () => {
    // `phase_09.md` sections 11-12 and `docs/DATABASE.md` section 2 rule 7. An
    // appointment must never be a naive local time or a formatted string.
    for (const column of ["starts_at", "ends_at", "blocked_until"]) {
      expect(MIGRATION).toMatch(new RegExp(`${column} timestamptz not null`));
    }
  });

  it("constrains the status to a database enum", () => {
    expect(MIGRATION).toContain(
      "status public.appointment_status not null default 'requested'",
    );
  });

  it("keeps an appointment's end after its start", () => {
    expect(MIGRATION).toContain(
      "constraint appointments_interval check (ends_at > starts_at)",
    );
  });

  it("indexes the two questions the table is actually asked", () => {
    expect(MIGRATION).toContain(
      "on public.appointments (patient_id, starts_at desc)",
    );
    expect(MIGRATION).toContain(
      "on public.appointments (practitioner_id, starts_at)",
    );
  });

  it("gives the practitioner table nowhere to put an unverified credential", () => {
    // `docs/HEALTHCARE_AND_AI_SAFETY.md`: a qualification or registration
    // number is a fact a patient decides on, and the clinic has confirmed
    // none. A field that exists gets filled.
    const table =
      /create table public\.practitioners \(([\s\S]*?)\n\);/.exec(
        MIGRATION,
      )?.[1] ?? "";

    expect(table.length).toBeGreaterThan(0);
    for (const forbidden of [
      "qualification",
      "registration",
      "licence",
      "license",
      "specialis",
      "specializ",
      "biography",
      "rating",
    ]) {
      expect(table.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("gives the appointment table nowhere to put clinical content", () => {
    const table = sqlWithoutComments(
      /create table public\.appointments \(([\s\S]*?)\n\);/.exec(
        MIGRATION,
      )?.[1] ?? "",
    );

    expect(table.length).toBeGreaterThan(0);
    for (const forbidden of [
      "diagnosis",
      "symptom",
      "medication",
      "allerg",
      "prescription",
      "assessment",
      "treatment_plan",
      "price",
      "amount",
    ]) {
      expect(table.toLowerCase()).not.toContain(forbidden);
    }
  });
});
