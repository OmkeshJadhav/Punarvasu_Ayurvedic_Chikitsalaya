import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level guarantees of the doctor workspace.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the
 * *database*, not of the application: a doctor reads their own diary and
 * nobody else's, reads only the patients they are booked to see, cannot
 * cancel, cannot reach another practitioner's appointment, and cannot ask
 * for the whole patient list. None of that can be proved by stubbing a
 * Supabase client — a stub will happily answer whatever it is told to.
 *
 * Running real PostgreSQL in this suite would mean a database in CI, which
 * `docs/QA_STRATEGY.md` section 1.1 has deliberately avoided since Phase 01.
 * So this file does the next most useful thing: it asserts that the migration
 * *says* what the design requires. It is a structural check, not a
 * behavioural one, and it catches the failure that actually happens — a
 * policy, a grant or an allowlist weakened in a later edit without anybody
 * noticing.
 *
 * The behavioural half must be verified against a live project, and
 * `docs/progress/progress_phase_11.md` records exactly which checks are
 * outstanding. **Both halves are needed**, and neither substitutes for the
 * other.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260922120000_doctor_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 09's, for the guarantees this phase must not have weakened. */
const ENGINE = readFileSync(
  new URL(
    "../../supabase/migrations/20260920120000_appointment_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 09's fix, which established the relationship this phase builds on. */
const DOCTOR_POLICY_FIX = readFileSync(
  new URL(
    "../../supabase/migrations/20260920130000_appointment_doctor_policy_fix.sql",
    import.meta.url,
  ),
  "utf8",
);

const QUERIES = readFileSync(
  new URL("../../src/features/doctor/queries.ts", import.meta.url),
  "utf8",
);

const ACTIONS = readFileSync(
  new URL("../../src/features/doctor/actions.ts", import.meta.url),
  "utf8",
);

/**
 * Strips comments, so a scan for a forbidden word tests the schema rather
 * than the prose explaining why the word is forbidden.
 */
function sqlWithoutComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

function tsWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const SQL = sqlWithoutComments(MIGRATION);

describe("the doctor's row-level security", () => {
  it("names the role explicitly in every new policy", () => {
    // `phase_11.md` section 45 and `phase_08.md` section 19 forbid a broad
    // policy such as `auth.uid() is not null` on a sensitive table. Every
    // policy this migration adds requires the doctor role, read from
    // `public.user_roles`.
    const policies = [
      ...SQL.matchAll(/create policy (\w+)[\s\S]*?using \(([\s\S]*?)\);/g),
    ];

    expect(policies.length).toBe(2);

    for (const [, name, predicate] of policies) {
      expect(predicate, name).toContain("has_app_role('doctor')");
    }
  });

  it("scopes every new policy by relationship as well as by role", () => {
    // The half that matters. `docs/SECURITY.md` section 6 requires a
    // doctor's access to be scoped by treatment relationship rather than by
    // role alone, and `phase_11.md` sections 11 and 23 repeat it: holding
    // the doctor role must not by itself reach a patient or an appointment.
    const policies = [
      ...SQL.matchAll(/create policy (\w+)[\s\S]*?using \(([\s\S]*?)\);/g),
    ];

    for (const [, name, predicate] of policies) {
      expect(predicate, name).toMatch(
        /doctor_has_care_relationship|doctor_owns_appointment/,
      );
    }
  });

  it("adds no policy that admits anybody authenticated", () => {
    expect(SQL).not.toMatch(/using \(\s*true\s*\)/);
    expect(SQL).not.toMatch(/auth\.uid\(\)\s+is not null/);
  });

  it("adds no insert, update or delete policy anywhere", () => {
    // The Phase 09 guarantee, preserved. Every write is still a function
    // call.
    const policies = [...SQL.matchAll(/create policy [\s\S]*?;/g)].map(
      (match) => match[0],
    );

    expect(policies.length).toBeGreaterThan(0);

    for (const policy of policies) {
      expect(policy).toContain("for select");
      expect(policy).not.toContain("for insert");
      expect(policy).not.toContain("for update");
      expect(policy).not.toContain("for delete");
      expect(policy).not.toContain("for all");
    }
  });

  it("drops no existing policy", () => {
    // A patient's own-record policies, the receptionist's operational ones
    // and the practitioner's own-diary policy must all still say exactly
    // what they said. This migration only ever adds.
    expect(SQL).not.toContain("drop policy");
  });

  it("leaves blocked periods with no policy at all, for anybody", () => {
    // `schedule_exceptions.reason` may be personal
    // (`docs/DATABASE.md` section 4.6). A practitioner gets no more of it
    // than a patient or a receptionist does.
    expect(SQL).not.toContain("schedule_exceptions");
  });

  it("issues no new grant on any table", () => {
    // A doctor reads `public.patients` through the existing table-wide
    // select grant, narrowed to their care scope by the policy. Widening a
    // column grant would widen it for every `authenticated` role at once,
    // which is the trap Phase 10 recorded about `internal_note`.
    const tableGrants = [
      ...SQL.matchAll(/grant\s+(select|insert|update|delete)[\s\S]*?;/g),
    ].map((match) => match[0]);

    for (const grant of tableGrants) {
      expect(grant).toContain("on function");
    }
  });
});

describe("the care-relationship predicate", () => {
  it("is a security definer function with a pinned search path", () => {
    // `security definer` for the reason the Phase 09 fix records: a policy
    // expression is evaluated with the caller's privileges, and a policy
    // that raises takes out the query for every caller because policies are
    // OR-ed and all of them are evaluated.
    const definition = extractFunction(
      MIGRATION,
      "doctor_has_care_relationship",
    );
    expect(definition).toContain("security definer");
    expect(definition).toContain("set search_path = ''");
    expect(definition).toContain("stable");
  });

  it("answers only about the caller's own practitioner record", () => {
    // There is no practitioner argument, so a doctor cannot ask whether some
    // other doctor treats somebody. The practitioner comes from
    // `current_practitioner_id()`, which reads `auth.uid()`.
    const definition = extractFunction(
      MIGRATION,
      "doctor_has_care_relationship",
    );
    expect(definition).toContain("current_practitioner_id()");
    expect(definition).toMatch(/\(p_patient_id uuid\)/);
    expect(definition).not.toMatch(/p_practitioner_id|p_doctor_id/);
  });

  it("scopes appointment ownership the same way", () => {
    const definition = extractFunction(MIGRATION, "doctor_owns_appointment");
    expect(definition).toContain("security definer");
    expect(definition).toContain("set search_path = ''");
    expect(definition).toContain("current_practitioner_id()");
    expect(definition).not.toMatch(/p_practitioner_id|p_doctor_id/);
  });
});

describe("the authorization gate", () => {
  it("refuses no session, the wrong role, and a missing practitioner record", () => {
    const definition = extractFunction(MIGRATION, "assert_care_practitioner");

    expect(definition).toContain("auth.uid()) is null");
    expect(definition).toContain("has_app_role('doctor')");
    expect(definition).toContain("practitioner is null");

    // Three refusals, all raising rather than returning something a caller
    // could forget to check.
    const raises = definition.match(/raise exception/g) ?? [];
    expect(raises.length).toBe(3);

    for (const code of definition.match(/errcode = '([^']+)'/g) ?? []) {
      expect(code).toContain("insufficient_privilege");
    }
  });

  it("returns the practitioner id rather than accepting one", () => {
    // `phase_11.md` sections 47-48 and example 2: a `doctorId` from the
    // browser is not proof of identity, and there is no parameter for one.
    const definition = extractFunction(MIGRATION, "assert_care_practitioner");
    expect(definition).toMatch(/assert_care_practitioner\(\)/);
    expect(definition).toContain("returns uuid");
    expect(definition).toContain("return practitioner;");
  });

  it("is called first by every function that reads or writes", () => {
    for (const name of [
      "search_care_patients",
      "update_appointment_status_as_doctor",
    ]) {
      const definition = extractFunction(MIGRATION, name);
      const body = definition.slice(definition.indexOf("begin"));
      const gate = body.indexOf("assert_care_practitioner()");

      expect(gate, name).toBeGreaterThan(-1);

      // Nothing is read or written before the gate.
      const before = body.slice(0, gate);
      expect(before, name).not.toMatch(/\bselect\b|\binsert\b|\bupdate\b/);
    }
  });

  it("is not callable by a client at all", () => {
    // Internal: called only from other `security definer` functions, which
    // run as the owner. The same arrangement as `assert_appointment_manager`.
    expect(SQL).toContain(
      "revoke all on function public.assert_care_practitioner() from public;",
    );
    expect(SQL).not.toMatch(
      /grant execute on function public\.assert_care_practitioner\(\)/,
    );
  });
});

describe("the care-scoped patient search", () => {
  const definition = extractFunction(MIGRATION, "search_care_patients");

  it("restricts the rows to this practitioner's own patients", () => {
    // In the `from` clause rather than in a predicate a later edit could
    // drop.
    expect(definition).toContain("join public.appointments a");
    expect(definition).toContain("where a.practitioner_id = practitioner");
  });

  it("returns nothing for a term shorter than two characters", () => {
    // An empty box must never be a "list every patient" button
    // (`phase_11.md` section 15).
    expect(definition).toContain("char_length(term) < 2");
    expect(definition).toMatch(/char_length\(term\) < 2\s*then\s*return;/);
  });

  it("clamps its own result count", () => {
    expect(definition).toContain(
      "least(greatest(coalesce(p_limit, 20), 1), 50)",
    );
    expect(definition).toContain("limit bounded");
  });

  it("escapes wildcard characters in the term", () => {
    expect(definition).toContain("replace(replace(replace(term");
    expect(definition).toContain("escape '\\'");
  });

  it("discloses no address, emergency contact or account identifier", () => {
    const returns = definition.slice(
      definition.indexOf("returns table"),
      definition.indexOf("language"),
    );

    expect(returns).toContain("full_name");
    expect(returns).toContain("date_of_birth");
    expect(returns).toContain("last_appointment_at");

    for (const column of [
      "address_line1",
      "address_line2",
      "postal_code",
      "emergency_contact",
      "profile_id",
      "internal_note",
    ]) {
      expect(returns, column).not.toContain(column);
    }
  });
});

describe("the doctor's status function", () => {
  const definition = extractFunction(
    MIGRATION,
    "update_appointment_status_as_doctor",
  );

  it("takes an appointment id and a status, and nothing else", () => {
    const signature = definition.slice(0, definition.indexOf("returns void"));
    expect(signature).toContain("p_appointment_id uuid");
    expect(signature).toContain("p_status public.appointment_status");

    for (const parameter of [
      "p_practitioner_id",
      "p_doctor_id",
      "p_patient_id",
      "p_reason",
      "p_starts_at",
      "p_duration",
    ]) {
      expect(signature, parameter).not.toContain(parameter);
    }
  });

  it("resolves the appointment by the caller's own practitioner id", () => {
    // Cross-doctor isolation, and the reason another practitioner's
    // appointment is indistinguishable from one that does not exist.
    expect(definition).toContain("where a.id = p_appointment_id");
    expect(definition).toContain("and a.practitioner_id = practitioner");
  });

  it("refuses cancelling", () => {
    const match = /p_status not in \(([^)]*)\)/.exec(definition);
    expect(match).not.toBeNull();
    expect(match?.[1]).not.toContain("cancelled");
    expect(match?.[1]).not.toContain("checked_in");
  });

  it("raises the shared not-found and invalid-transition codes", () => {
    expect(definition).toContain("errcode = 'PV009'");
    expect(definition).toContain("errcode = 'PV008'");
  });

  it("writes a history row for every change", () => {
    expect(definition).toContain("insert into public.appointment_events");
    expect(definition).toContain("'status_changed'");
  });

  it("is a no-op rather than an error when nothing changes", () => {
    // Two people acting on the same appointment at the same moment should
    // not raise.
    expect(definition).toMatch(/appt\.status = p_status then[\s\S]*?return;/);
  });

  it("pins its search path", () => {
    expect(definition).toContain("set search_path = ''");
    expect(definition).toContain("security definer");
  });
});

describe("what this phase does not change", () => {
  it("adds no table, enum, constraint or trigger", () => {
    for (const forbidden of [
      "create table",
      "create type",
      "alter table",
      "create trigger",
      "add constraint",
    ]) {
      expect(SQL, forbidden).not.toContain(forbidden);
    }
  });

  it("adds no clinical column anywhere, because it adds no column", () => {
    for (const word of [
      "diagnosis",
      "symptom",
      "medication",
      "allergy",
      "medical_history",
      "prescription",
      "treatment_plan",
      "clinical",
      "vitals",
    ]) {
      expect(SQL.toLowerCase(), word).not.toContain(word);
    }
  });

  it("leaves Phase 09's write prohibition intact", () => {
    // Asserted against the engine migration, not this one: no client role
    // holds insert, update or delete on `appointments`, and nothing here
    // grants one.
    const engine = sqlWithoutComments(ENGINE);
    expect(engine).toContain(
      "revoke all on public.appointments from anon, authenticated;",
    );
    expect(engine).not.toMatch(
      /grant\s+(insert|update|delete)[^;]*on public\.appointments/,
    );
    expect(SQL).not.toMatch(/grant[^;]*on public\.appointments/);
  });

  it("builds on the practitioner relationship Phase 09 established", () => {
    // `current_practitioner_id()` and the own-diary policy already existed
    // and were deliberately unused. This phase uses them rather than
    // inventing a second way to say the same thing.
    expect(DOCTOR_POLICY_FIX).toContain(
      "create function public.current_practitioner_id()",
    );
    expect(DOCTOR_POLICY_FIX).toContain("appointments_select_own_practitioner");
    expect(SQL).toContain("current_practitioner_id()");
    expect(SQL).not.toContain("create function public.current_practitioner_id");
  });

  it("leaves the internal note ungranted", () => {
    expect(SQL).not.toContain("internal_note");
  });
});

describe("the application layer", () => {
  const queries = tsWithoutComments(QUERIES);
  const actions = tsWithoutComments(ACTIONS);

  it("never writes through a table client", () => {
    // Every write is an RPC. A `.insert(`, `.update(` or `.delete(` on a
    // Supabase table in this feature would be a write the database has no
    // grant for anyway — but it would also mean somebody had tried.
    for (const source of [queries, actions]) {
      expect(source).not.toMatch(/\.insert\(/);
      expect(source).not.toMatch(/\.update\(/);
      expect(source).not.toMatch(/\.delete\(/);
      expect(source).not.toMatch(/\.upsert\(/);
    }
  });

  it("never touches the service-role client", () => {
    // The key that bypasses every policy stays out of the request path.
    for (const source of [queries, actions]) {
      expect(source).not.toContain("supabase/admin");
      expect(source).not.toContain("createSupabaseAdminClient");
      expect(source).not.toContain("SERVICE_ROLE");
    }
  });

  it("checks a permission before every exported read", () => {
    // Not the security boundary — row-level security is — but the layer
    // that makes a refusal cheap and legible. Every exported query starts
    // with one.
    const reads = [
      "getDoctorIdentity",
      "getDoctorDaySchedule",
      "getDoctorAppointments",
      "getDoctorAppointment",
      "getCarePatient",
      "getCarePatientAppointments",
      "searchCarePatients",
    ];

    for (const name of reads) {
      const start = queries.indexOf(`export async function ${name}`);
      expect(start, name).toBeGreaterThan(-1);

      const body = queries.slice(start, start + 600);
      expect(body, name).toContain("assertPermission(");
    }
  });

  it("never passes a practitioner id to the database", () => {
    // The whole identity argument: there is no practitioner id in the
    // application to pass, and no RPC parameter to pass it to.
    for (const source of [queries, actions]) {
      expect(source).not.toContain("p_practitioner_id");
      expect(source).not.toContain("p_doctor_id");
    }
  });

  it("sends only an appointment id and a status when it writes", () => {
    const call = actions.slice(
      actions.indexOf('"update_appointment_status_as_doctor"'),
    );
    const args = call.slice(0, call.indexOf("}"));

    expect(args).toContain("p_appointment_id");
    expect(args).toContain("p_status");
    expect(args).not.toContain("p_reason");
    expect(args).not.toContain("p_patient_id");
  });

  it("names its columns rather than selecting everything", () => {
    // `phase_11.md` section 44. A column added to a table later must not
    // silently start reaching a screen.
    expect(queries).not.toMatch(/\.select\(\s*["'`]\*/);
  });

  it("never reads a column that does not exist for a reason", () => {
    for (const column of ["internal_note", "cancelled_by", "created_by"]) {
      expect(queries, column).not.toContain(column);
    }
  });

  it("never logs a search term or a patient detail", () => {
    // `docs/SECURITY.md` section 15 and `phase_11.md` section 43. The log
    // records that a search happened and who made it.
    const logCalls = [
      ...actions.matchAll(/logger\.(info|warn|error)\(([\s\S]*?)\);/g),
    ].map((match) => match[2] ?? "");

    expect(logCalls.length).toBeGreaterThan(0);

    for (const call of logCalls) {
      for (const forbidden of [
        "query",
        "term",
        "patientName",
        "fullName",
        "phone",
        "dateOfBirth",
      ]) {
        expect(call, forbidden).not.toContain(forbidden);
      }
    }
  });
});

/**
 * One function definition, from `create function` to its closing `$$;`.
 *
 * Comments are kept, because a couple of assertions want to look at the
 * signature exactly as written; the callers that need comments stripped do
 * it themselves.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`create function public.${name}`);
  if (start === -1)
    throw new Error(`No such function in the migration: ${name}`);

  const end = source.indexOf("$$;", start);
  if (end === -1) throw new Error(`Unterminated function: ${name}`);

  return sqlWithoutComments(source.slice(start, end + 3));
}
