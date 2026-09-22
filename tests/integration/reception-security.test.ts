import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level guarantees of the receptionist workspace.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the *database*,
 * not of the application: a receptionist can read the diary and a patient
 * cannot read anybody else's, no client can insert an appointment, the staff
 * note stays unreadable, a receptionist cannot complete an appointment or
 * assign an owner to a patient record, and two concurrent bookings still
 * cannot both succeed. None of that can be proved by stubbing a Supabase
 * client — a stub will happily answer whatever it is told to.
 *
 * Running real PostgreSQL in this suite would mean a database in CI, which
 * `docs/QA_STRATEGY.md` section 1.1 has deliberately avoided since Phase 01.
 * So this file does the next most useful thing: it asserts that the migration
 * *says* what the design requires. It is a structural check, not a behavioural
 * one, and it catches the failure that actually happens — a policy, a grant or
 * an allowlist weakened in a later edit without anybody noticing.
 *
 * The behavioural half must be verified against a live project, and
 * `docs/progress/progress_phase_10.md` records exactly which checks are
 * outstanding. **Both halves are needed**, and neither substitutes for the
 * other.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260921120000_receptionist_workspace.sql",
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

const QUERIES = readFileSync(
  new URL("../../src/features/reception/queries.ts", import.meta.url),
  "utf8",
);

const ACTIONS = readFileSync(
  new URL("../../src/features/reception/actions.ts", import.meta.url),
  "utf8",
);

/**
 * Strips comments, so a scan for a forbidden word tests the schema rather than
 * the prose explaining why the word is forbidden.
 */
function sqlWithoutComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

function tsWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const SQL = sqlWithoutComments(MIGRATION);

describe("the receptionist's row-level security", () => {
  it("names the role explicitly in every new policy", () => {
    // `phase_10.md` section 39 forbids broad policies such as
    // `auth.uid() is not null` on sensitive tables. Every policy this
    // migration adds requires a specific role, read from `public.user_roles`.
    const policies = [
      ...SQL.matchAll(/create policy (\w+)[\s\S]*?using \(([\s\S]*?)\);/g),
    ];

    expect(policies.length).toBe(3);

    for (const [, name, predicate] of policies) {
      expect(predicate, name).toContain("has_app_role('receptionist')");
    }
  });

  it("adds no policy that admits anybody authenticated", () => {
    expect(SQL).not.toMatch(/using \(\s*true\s*\)/);
    expect(SQL).not.toMatch(/auth\.uid\(\)\s+is not null/);
  });

  it("adds a select policy for the three tables the front desk reads", () => {
    for (const table of [
      "public.appointments",
      "public.appointment_events",
      "public.patients",
    ]) {
      expect(SQL).toContain(`on ${table}\n  for select`);
    }
  });

  it("adds no insert, update or delete policy anywhere", () => {
    // The Phase 09 guarantee, preserved. Every write is still a function call.
    const policies = [...SQL.matchAll(/create policy [\s\S]*?;/g)].map(
      (match) => match[0],
    );

    for (const policy of policies) {
      expect(policy).toContain("for select");
      expect(policy).not.toContain("for insert");
      expect(policy).not.toContain("for update");
      expect(policy).not.toContain("for delete");
      expect(policy).not.toContain("for all");
    }
  });

  it("leaves blocked periods with no policy at all, for anybody", () => {
    // `schedule_exceptions.reason` may be personal
    // (`docs/DATABASE.md` section 4.6). A receptionist gets no more of it than
    // a patient does.
    expect(SQL).not.toContain("on public.schedule_exceptions");
  });

  it("does not touch the patient's own policies", () => {
    // Phase 07 and 08's ownership policies must still say what they said. The
    // new policies are additional and permissive, so the only change is that a
    // receptionist now matches one.
    expect(SQL).not.toContain("drop policy");
    expect(SQL).not.toContain("patients_select_own");
    expect(SQL).not.toContain("appointments_select_own_patient");
  });
});

describe("grants", () => {
  it("issues no new table grant at all", () => {
    // The column-level select grants are Phase 09's and Phase 07's. This
    // migration widens none of them — a receptionist reads more *rows*, never
    // more columns.
    expect(SQL).not.toMatch(
      /grant\s+(select|insert|update|delete)[\s\S]{0,80}on public\./,
    );
  });

  it("keeps the internal note unreadable by any client", () => {
    // Column privileges are granted to a *database* role, and a patient and a
    // receptionist are both `authenticated`. Granting the staff note to one
    // would grant it to the other, so it stays ungranted — and nothing in this
    // migration writes it either.
    expect(SQL).not.toContain("internal_note");

    const engineGrant =
      /grant select \(([\s\S]*?)\) on public\.appointments/.exec(ENGINE);
    expect(engineGrant?.[1]).not.toContain("internal_note");
  });

  it("grants every new function to authenticated and revokes it from public", () => {
    const granted = [
      "search_patients",
      "find_possible_duplicate_patients",
      "create_patient_record",
      "create_appointment_for_patient",
      "update_appointment_status_as_staff",
      "reschedule_appointment_as_staff",
    ];

    for (const name of granted) {
      expect(SQL, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}`),
      );
      expect(SQL, name).toMatch(
        new RegExp(
          `grant execute on function public\\.${name}[\\s\\S]{0,200}to authenticated`,
        ),
      );
    }
  });

  it("grants anon nothing", () => {
    expect(SQL).not.toMatch(/to anon/);
  });

  it("keeps the internal helpers uncallable by a client", () => {
    // Both are `security definer` and read scheduling data. Neither is
    // something a client should call directly even though both disclose
    // nothing but a yes or a raise.
    for (const helper of [
      "assert_appointment_manager",
      "assert_bookable_slot",
    ]) {
      expect(SQL, helper).toMatch(
        new RegExp(`revoke all on function public\\.${helper}`),
      );
      expect(SQL, helper).not.toMatch(
        new RegExp(
          `grant execute on function public\\.${helper}[\\s\\S]{0,200}to authenticated`,
        ),
      );
    }
  });
});

describe("the staff write functions", () => {
  const STAFF_FUNCTIONS = [
    "search_patients",
    "find_possible_duplicate_patients",
    "create_patient_record",
    "create_appointment_for_patient",
    "update_appointment_status_as_staff",
    "reschedule_appointment_as_staff",
  ];

  it("all authorize the caller before doing anything", () => {
    for (const name of STAFF_FUNCTIONS) {
      const body = functionBody(name);
      expect(body, name).toContain(
        "perform public.assert_appointment_manager()",
      );

      // And it is the *first* statement, so nothing is read or written by an
      // unauthorized caller even transiently.
      const beforeCheck = body.slice(
        0,
        body.indexOf("assert_appointment_manager"),
      );
      expect(beforeCheck, name).not.toMatch(/\b(insert|update|delete)\b/i);
    }
  });

  it("all pin their search_path", () => {
    for (const name of STAFF_FUNCTIONS.concat([
      "assert_appointment_manager",
      "assert_bookable_slot",
    ])) {
      expect(functionHeader(name), name).toContain("set search_path = ''");
    }
  });

  it("authorize from the database, never from an argument", () => {
    const guard = functionBody("assert_appointment_manager");

    expect(guard).toContain("auth.uid()");
    expect(guard).toContain("has_app_role('receptionist')");
    // It takes no argument, so there is nothing a caller could substitute.
    expect(SQL).toContain(
      "create function public.assert_appointment_manager()",
    );
  });

  it("raise rather than return a boolean the caller could ignore", () => {
    const guard = functionBody("assert_appointment_manager");
    expect(guard).toContain("raise exception");
    expect(guard).toContain("insufficient_privilege");
  });
});

describe("booking on a patient's behalf", () => {
  it("takes a patient id and no status, duration or end time", () => {
    const signature =
      /create function public\.create_appointment_for_patient\(([\s\S]*?)\)\nreturns/.exec(
        SQL,
      );
    expect(signature).not.toBeNull();

    const params = (signature?.[1] ?? "")
      .split(",")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);

    expect(params).toEqual([
      "p_patient_id",
      "p_practitioner_id",
      "p_appointment_type_id",
      "p_starts_at",
      "p_patient_note",
    ]);
  });

  it("validates the patient id rather than trusting it", () => {
    // `phase_10.md` section 18. The id says which patient; this is where the
    // database says whether that patient exists.
    const body = functionBody("create_appointment_for_patient");
    expect(body).toMatch(
      /if not exists \(select 1 from public\.patients p where p\.id = p_patient_id\)/,
    );
    expect(body).toContain("PV014");
  });

  it("reads the duration and buffer from the appointment type", () => {
    const body = functionBody("create_appointment_for_patient");
    expect(body).toContain("from public.appointment_types t");
    expect(body).toContain("appointment_type.duration_minutes");
    expect(body).toContain("appointment_type.buffer_minutes");
  });

  it("sets the status itself rather than accepting one", () => {
    const body = functionBody("create_appointment_for_patient");
    expect(body).toContain("'confirmed'");
    expect(body).not.toContain("p_status");
  });

  it("re-validates the slot through the one shared validator", () => {
    // Not a second scheduling engine (`phase_10.md` section 17).
    const body = functionBody("create_appointment_for_patient");
    expect(body).toContain("perform public.assert_bookable_slot(");
  });

  it("records the creation in the insert-only history", () => {
    const body = functionBody("create_appointment_for_patient");
    expect(body).toContain("insert into public.appointment_events");
    expect(body).toContain("'created'");
  });
});

describe("the shared slot validator", () => {
  it("still checks working hours, the grid, the horizon and blocked periods", () => {
    // The two parameters this phase adds turn *self-service* rules on and off.
    // Everything that is a property of the diary still applies to both
    // callers.
    const body = functionBody("assert_bookable_slot");

    expect(body).toContain("public.practitioner_availability");
    expect(body).toContain("slot_interval_minutes");
    expect(body).toContain("max_horizon_days");
    expect(body).toContain("public.schedule_exceptions");
    expect(body).toContain("Appointments cannot be booked in the past.");
  });

  it("makes the two self-service rules parameters, not client input", () => {
    const body = functionBody("assert_bookable_slot");

    expect(body).toContain("p_require_online_booking");
    expect(body).toContain("p_min_notice_minutes");
    // The patient path passes them as literals; there is no request shape that
    // reaches them.
    expect(SQL).toMatch(/true, rules\.min_notice_minutes/);
    expect(SQL).toMatch(/false, 0/);
  });

  it("is still the only validator, called by all four write paths", () => {
    const calls = [...SQL.matchAll(/perform public\.assert_bookable_slot\(/g)];
    // book_appointment, reschedule_appointment, create_appointment_for_patient,
    // reschedule_appointment_as_staff.
    expect(calls).toHaveLength(4);
  });

  it("leaves the patient path's own rules exactly as they were", () => {
    // The replacement of `book_appointment` must not have relaxed anything.
    const body = functionBody("book_appointment");

    expect(body).toContain("has_app_role('patient')");
    expect(body).toContain("public.current_patient_id()");
    expect(body).toContain("max_active_per_patient");
    expect(body).toContain("'requested'");
    expect(body).not.toContain("p_patient_id");
    expect(body).not.toContain("p_status");
  });
});

describe("the status allowlist", () => {
  it("refuses completed and in_consultation for this role", () => {
    const body = functionBody("update_appointment_status_as_staff");
    const allowlist = /p_status not in \(([^)]*)\)/.exec(body);

    expect(allowlist).not.toBeNull();
    expect(allowlist?.[1]).not.toContain("completed");
    expect(allowlist?.[1]).not.toContain("in_consultation");
  });

  it("refuses an unauthorized status with insufficient_privilege", () => {
    const body = functionBody("update_appointment_status_as_staff");
    expect(body).toMatch(
      /p_status not in[\s\S]{0,200}errcode = 'insufficient_privilege'/,
    );
  });

  it("cancels by status change, never by delete", () => {
    const body = functionBody("update_appointment_status_as_staff");

    expect(body).toContain("set status = 'cancelled'");
    expect(body).toContain("cancelled_at = now()");
    expect(body).toContain("cancelled_by = actor");
    expect(body).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("defers to the Phase 09 transition trigger rather than replacing it", () => {
    // The mirrored `case` produces a message a person can act on; the trigger
    // is what actually holds, and this migration does not drop or alter it.
    expect(SQL).not.toContain("drop trigger appointments_guard_transition");
    expect(SQL).not.toContain("appointments_guard_transition()");
    expect(ENGINE).toContain("create trigger appointments_guard_transition");
  });

  it("treats a repeated request as a no-op rather than an error", () => {
    // Two receptionists confirming the same appointment is ordinary.
    const body = functionBody("update_appointment_status_as_staff");
    expect(body).toMatch(/if appt\.status = p_status then[\s\S]{0,200}return;/);
  });
});

describe("creating a patient record", () => {
  it("has no owner parameter", () => {
    // The whole security argument of `phase_10.md` sections 34-35: a
    // receptionist cannot attach a record to an account because there is
    // nothing to attach it with.
    const signature =
      /create function public\.create_patient_record\(([\s\S]*?)\)\nreturns/.exec(
        SQL,
      );
    const params = signature?.[1] ?? "";

    for (const forbidden of [
      "p_profile_id",
      "p_user_id",
      "p_id",
      "p_role",
      "p_email",
      "p_password",
    ]) {
      expect(params, forbidden).not.toContain(forbidden);
    }
  });

  it("writes a null owner explicitly", () => {
    const body = functionBody("create_patient_record");
    expect(body).toMatch(/values \(\s*\n\s*(--[^\n]*\n\s*)*null,/);
  });

  it("creates no authentication account and no credential", () => {
    expect(SQL).not.toContain("auth.users");
    expect(SQL).not.toMatch(/\bpassword\b/i);
    expect(SQL).not.toContain("user_roles");
  });

  it("has nowhere to put clinical information", () => {
    const signature =
      /create function public\.create_patient_record\(([\s\S]*?)\)\nreturns/.exec(
        SQL,
      );

    for (const forbidden of [
      "diagnos",
      "symptom",
      "medicat",
      "allerg",
      "prescri",
      "treatment",
      "clinical",
      "medical_history",
    ]) {
      expect(signature?.[1] ?? "", forbidden).not.toContain(forbidden);
    }
  });
});

describe("patient search", () => {
  it("refuses a query too short to be a search", () => {
    const body = functionBody("search_patients");
    expect(body).toMatch(/char_length\(term\) < 2[\s\S]{0,60}return;/);
  });

  it("clamps its own result count rather than trusting the caller", () => {
    const body = functionBody("search_patients");
    expect(body).toMatch(
      /least\(greatest\(coalesce\(p_limit, \d+\), 1\), \d+\)/,
    );
    expect(body).toContain("limit bounded");
  });

  it("escapes wildcard characters in the term", () => {
    // A query of `%` must match a literal percent sign, not everybody.
    const body = functionBody("search_patients");
    expect(body).toContain("escape");
    expect(body).toMatch(/replace\(replace\(replace\(term/);
  });

  it("returns the minimum needed to identify a person", () => {
    // `phase_10.md` example 6. No address, no emergency contact, no account
    // identifier.
    const returns =
      /create function public\.search_patients\([\s\S]*?returns table \(([\s\S]*?)\)\nlanguage/.exec(
        SQL,
      );
    const columns = (returns?.[1] ?? "")
      .split(",")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);

    expect(columns).toEqual([
      "id",
      "full_name",
      "preferred_name",
      "phone",
      "date_of_birth",
      "city",
      "has_account",
    ]);
    expect(columns).not.toContain("profile_id");
    expect(columns).not.toContain("address_line1");
    expect(columns).not.toContain("emergency_contact_name");
  });

  it("discloses whether there is an account, never which one", () => {
    const body = functionBody("search_patients");
    expect(body).toContain("p.profile_id is not null");
    // The id itself is never selected.
    expect(body).not.toMatch(/select[\s\S]{0,200}p\.profile_id,/);
  });
});

describe("duplicate detection", () => {
  it("merges nothing and writes nothing", () => {
    const body = functionBody("find_possible_duplicate_patients");

    expect(body).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(SQL).toContain(
      "create function public.find_possible_duplicate_patients",
    );
  });

  it("is bounded", () => {
    expect(functionBody("find_possible_duplicate_patients")).toContain(
      "limit 10",
    );
  });

  it("does not match on a name alone", () => {
    // Two people called the same thing is ordinary. A false "this already
    // exists" at the front desk either creates a duplicate anyway or attaches
    // somebody's appointment to a stranger's record.
    const body = functionBody("find_possible_duplicate_patients");
    expect(body).toMatch(
      /name_term <> ''\s*\n\s*and p_date_of_birth is not null/,
    );
  });
});

describe("the application layer", () => {
  it("authorizes every reception read", () => {
    const source = tsWithoutComments(QUERIES);
    const exported = [...source.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1] as string,
    );

    expect(exported.length).toBeGreaterThan(0);

    for (const name of exported) {
      const body = source.slice(
        source.indexOf(`export async function ${name}`),
      );
      const upToNext = body.slice(
        0,
        body.indexOf("\nexport ") + 1 || undefined,
      );
      expect(upToNext, name).toContain("assertPermission(");
    }
  });

  it("never selects everything from a patient or appointment table", () => {
    // `phase_10.md` section 37: select only the fields the workflow needs.
    const source = tsWithoutComments(QUERIES);
    expect(source).not.toMatch(/\.select\(\s*["'`]\*/);
  });

  it("never reads the internal note", () => {
    expect(tsWithoutComments(QUERIES)).not.toContain("internal_note");
  });

  it("names no clinical column anywhere in the reception feature", () => {
    const source = tsWithoutComments(QUERIES) + tsWithoutComments(ACTIONS);

    for (const forbidden of [
      "diagnosis",
      "symptoms",
      "medications",
      "allergies",
      "medical_history",
      "prescription",
      "treatment_plan",
      "clinical_note",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("never writes through a table client", () => {
    // Every reception write is an RPC. A `.insert(`, `.update(` or `.delete(`
    // here would be the direct database write `phase_10.md` section 17
    // forbids — and would be refused anyway, since no client holds the grant.
    const source = tsWithoutComments(ACTIONS);

    expect(source).not.toMatch(
      /\.from\([^)]*\)\s*\.\s*(insert|update|delete)\(/,
    );
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.upsert\(/);
    expect(source).not.toMatch(/\.delete\(/);
  });

  it("never touches the service-role client", () => {
    // The key that bypasses every policy stays out of the request path. The
    // elevated operations are `security definer` functions with their own
    // checks.
    const source = tsWithoutComments(QUERIES) + tsWithoutComments(ACTIONS);
    expect(source).not.toContain("lib/supabase/admin");
    expect(source).not.toContain("createSupabaseAdminClient");
  });
});

/** The text of one `create function`, from its body to its terminator. */
function functionBody(name: string): string {
  const pattern = new RegExp(
    `create (?:or replace )?function public\\.${name}\\(`,
  );
  const start = SQL.search(pattern);
  expect(start, name).toBeGreaterThan(-1);

  const rest = SQL.slice(start);
  const end = rest.indexOf("\n$$;");
  return rest.slice(0, end === -1 ? undefined : end);
}

/** Everything from `create function` down to the body marker. */
function functionHeader(name: string): string {
  const body = functionBody(name);
  const marker = body.indexOf("as $$");
  return body.slice(0, marker === -1 ? undefined : marker);
}
