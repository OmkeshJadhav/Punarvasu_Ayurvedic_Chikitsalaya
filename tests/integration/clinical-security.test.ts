import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level guarantees of the clinical record.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the
 * *database*, not of the application: a doctor reads the records they wrote
 * and nobody else's, a receptionist reads none at all, a patient reads none,
 * a completed record cannot be edited, an appointment can hold at most one
 * consultation, and a record cannot name a patient its appointment does not.
 * None of that can be proved by stubbing a Supabase client — a stub will
 * happily answer whatever it is told to.
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
 * `docs/progress/progress_phase_12.md` records exactly which checks are
 * outstanding. **Both halves are needed**, and neither substitutes for the
 * other.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260923120000_clinical_records.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 07's, for the patient-profile guarantees this phase must not weaken. */
const PATIENT_PROFILE = readFileSync(
  new URL(
    "../../supabase/migrations/20260918120000_patient_profile.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 09's, for the appointment guarantees this phase must not weaken. */
const ENGINE = readFileSync(
  new URL(
    "../../supabase/migrations/20260920120000_appointment_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

const QUERIES = readFileSync(
  new URL("../../src/features/clinical/queries.ts", import.meta.url),
  "utf8",
);

const ACTIONS = readFileSync(
  new URL("../../src/features/clinical/actions.ts", import.meta.url),
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

/** One `security definer` function's body, by name. */
function functionBody(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  ).exec(SQL);

  if (!match) throw new Error(`No such function in the migration: ${name}`);
  return match[0];
}

const WRITE_FUNCTIONS = [
  "start_consultation",
  "save_clinical_draft",
  "complete_clinical_record",
] as const;

describe("row-level security", () => {
  it("is enabled on the clinical table", () => {
    expect(SQL).toMatch(
      /alter table public\.clinical_records enable row level security/,
    );
  });

  it("adds exactly one policy, and it is a select policy", () => {
    // `phase_12.md` section 24: RLS is mandatory and must not be left to
    // `requireRole("doctor")` in server code. One policy, one audience.
    const policies = [...SQL.matchAll(/create policy (\w+)[\s\S]*?;\n/g)];

    expect(policies).toHaveLength(1);
    expect(policies[0]?.[1]).toBe("clinical_records_select_author");
    expect(SQL).toMatch(
      /create policy clinical_records_select_author[\s\S]*?for select/,
    );
  });

  it("scopes the policy by the practitioner relationship, not by role alone", () => {
    // `docs/SECURITY.md` section 6 and `phase_12.md` sections 20 and 59.
    // Holding the doctor role must not by itself reach a clinical record.
    const predicate =
      /create policy clinical_records_select_author[\s\S]*?using \(([\s\S]*?)\);/.exec(
        SQL,
      )?.[1];

    expect(predicate).toBeTruthy();
    expect(predicate).toContain("has_app_role('doctor')");
    expect(predicate).toContain(
      "practitioner_id = public.current_practitioner_id()",
    );
  });

  it("adds no policy that admits anybody authenticated", () => {
    expect(SQL).not.toMatch(/using \(\s*true\s*\)/);
    expect(SQL).not.toMatch(/auth\.uid\(\)\s+is not null/);
  });

  it("adds no insert, update or delete policy anywhere", () => {
    // The Phase 09 discipline, unchanged for the most sensitive table in the
    // schema. Every write is a function call whose argument list is the
    // allowlist.
    expect(SQL).not.toMatch(/create policy[\s\S]*?for (insert|update|delete)/);
  });

  it("gives a receptionist, a patient and an administrator no policy at all", () => {
    // Sections 21, 22 and 23. Each is denied by having no policy rather than
    // by a policy that evaluates to false, which is a stronger statement: a
    // predicate can be weakened by an edit, and an absent policy cannot be
    // weakened at all.
    const clinicalPolicies = [
      ...SQL.matchAll(/create policy (\w+) *\n? *on public\.clinical_records/g),
    ].map(([, name]) => name);

    expect(clinicalPolicies).toEqual(["clinical_records_select_author"]);
    expect(SQL).not.toMatch(/has_app_role\('receptionist'\)/);
    expect(SQL).not.toMatch(/has_app_role\('patient'\)/);
    expect(SQL).not.toMatch(/has_app_role\('admin'\)/);
  });

  it("drops no existing policy", () => {
    // Phase 07's ownership policies, Phase 10's operational ones and Phase
    // 11's care-scoped ones must all still say exactly what they said
    // (section 88).
    expect(SQL).not.toMatch(/drop policy/i);
  });
});

describe("grants", () => {
  it("gives anon nothing on the clinical table", () => {
    expect(SQL).toMatch(
      /revoke all on public\.clinical_records from anon, authenticated/,
    );
    expect(SQL).not.toMatch(/grant \w+ on public\.clinical_records to anon/);
  });

  it("gives authenticated select and nothing else", () => {
    expect(SQL).toMatch(
      /grant select on public\.clinical_records to authenticated/,
    );

    for (const write of ["insert", "update", "delete", "truncate", "all"]) {
      expect(SQL, write).not.toMatch(
        new RegExp(
          `grant[^;]*\\b${write}\\b[^;]*on public\\.clinical_records`,
          "i",
        ),
      );
    }
  });

  it("revokes each function from public before granting it", () => {
    // `revoke ... from public` first, or `execute` is held by everybody by
    // default — including `anon`.
    for (const name of WRITE_FUNCTIONS) {
      expect(SQL, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
    }
  });

  it("grants no clinical function to anon", () => {
    expect(SQL).not.toMatch(/grant execute on function[\s\S]*?to anon/);
  });
});

describe("every write authorizes before it reads or writes", () => {
  it.each(WRITE_FUNCTIONS)("%s calls the care gate first", (name) => {
    const body = functionBody(name);
    const gate = body.indexOf("public.assert_care_practitioner()");

    expect(gate, `${name} never calls the gate`).toBeGreaterThan(-1);

    // Nothing touches a table before the gate has run. `assert_care_practitioner`
    // refuses no session, a non-doctor, and a doctor with no practitioner
    // record — three raises, so a caller cannot ignore a returned null.
    for (const statement of ["select ", "insert into", "update public."]) {
      const first = body.indexOf(statement, body.indexOf("begin"));
      if (first === -1) continue;
      expect(first, `${name}: ${statement}`).toBeGreaterThan(gate);
    }
  });

  it.each(WRITE_FUNCTIONS)("%s pins its search_path", (name) => {
    // An unpinned `search_path` on a `security definer` function is a
    // privilege-escalation vector: a caller can shadow a referenced object.
    expect(functionBody(name)).toMatch(/set search_path = ''/);
  });

  it.each([...WRITE_FUNCTIONS, "clinical_records_guard_update"])(
    "%s takes no practitioner, doctor or role parameter",
    (name) => {
      // Examples 2 and 3. The practitioner is resolved from `auth.uid()`
      // inside the database; there is no parameter to substitute.
      const signature = functionBody(name).split("$$")[0] ?? "";

      // `p_doctor_id`, not `p_doctor` — `p_doctor_notes` is a legitimate
      // clinical field and matching on the prefix would flag it.
      for (const forbidden of [
        "p_practitioner",
        "p_doctor_id",
        "p_role",
        "p_user",
        "p_actor",
        "p_permission",
      ]) {
        expect(signature, `${name}: ${forbidden}`).not.toContain(forbidden);
      }
    },
  );

  it("start_consultation takes no patient parameter", () => {
    // Example 4. The patient is read out of the appointment, which was itself
    // resolved by the caller's own practitioner record — so the record's
    // triple is consistent by construction as well as by constraint.
    const signature = functionBody("start_consultation").split("$$")[0] ?? "";

    expect(signature).not.toContain("p_patient");
    expect(functionBody("start_consultation")).toContain("appt.patient_id");
  });

  it("no write function takes a status parameter", () => {
    // The status is set by the function. The only path to `completed` is
    // `complete_clinical_record`, and it validates first.
    for (const name of WRITE_FUNCTIONS) {
      const signature = functionBody(name).split("$$")[0] ?? "";
      expect(signature, name).not.toMatch(/p_status/);
    }
  });

  it("resolves the record by the caller's own practitioner id", () => {
    // Section 57: a record id for somebody else's consultation must be
    // indistinguishable from one that never existed. Resolving by id *and* by
    // practitioner in one statement is what makes that true, and leaves no
    // window between reading and checking.
    for (const name of ["save_clinical_draft", "complete_clinical_record"]) {
      const body = functionBody(name);
      expect(body, name).toMatch(
        /where cr\.id = p_record_id\s*\n\s*and cr\.practitioner_id = practitioner/,
      );
    }

    expect(functionBody("start_consultation")).toMatch(
      /where a\.id = p_appointment_id\s*\n\s*and a\.practitioner_id = practitioner/,
    );
  });
});

describe("data integrity", () => {
  it("allows at most one consultation per appointment", () => {
    // Section 7 and section 61. An index, not a check-then-insert that two
    // concurrent requests both pass.
    expect(SQL).toMatch(
      /constraint clinical_records_one_per_appointment unique \(appointment_id\)/,
    );
  });

  it("resolves a duplicate creation rather than failing", () => {
    // Section 87: a double-click, a retry, a refresh and two genuinely
    // concurrent requests must all leave at most one record — and from the
    // practitioner's side, "open the consultation" is idempotent.
    expect(functionBody("start_consultation")).toMatch(
      /on conflict \(appointment_id\) do nothing/,
    );
  });

  it("forbids a record whose patient or practitioner disagrees with its appointment", () => {
    // **Sections 92-93**, and the reason this is a composite foreign key
    // rather than a trigger: it is declarative, always enforced, and
    // impossible for application code to route around.
    expect(SQL).toMatch(
      /foreign key \(appointment_id, patient_id, practitioner_id\)\s*\n\s*references public\.appointments \(id, patient_id, practitioner_id\)/,
    );

    // And the unique constraint that makes the reference declarable.
    expect(SQL).toMatch(
      /add constraint appointments_identity_key\s*\n\s*unique \(id, patient_id, practitioner_id\)/,
    );
  });

  it("never cascades a delete into clinical history", () => {
    // Section 62: avoid cascading deletion that could unintentionally destroy
    // clinical history. All three references restrict, so deleting a patient,
    // a practitioner or an appointment that has a record fails loudly.
    const table =
      /create table public\.clinical_records \(([\s\S]*?)\n\);/.exec(SQL)?.[1];

    expect(table).toBeTruthy();

    const references = [
      ...(table ?? "").matchAll(
        /references public\.(\w+) \([^)]*\)\s*\n?\s*(on update cascade\s*\n?\s*)?on delete (\w+)/g,
      ),
    ];
    expect(references.length).toBeGreaterThanOrEqual(3);

    for (const [, referenced, , behaviour] of references) {
      expect(behaviour, referenced).toBe("restrict");
    }
  });

  it("holds the identity columns immutable", () => {
    // The one remaining way the composite foreign key could be satisfied at
    // insert and then subverted.
    const guard = functionBody("clinical_records_guard_update");

    expect(guard).toContain("new.appointment_id <> old.appointment_id");
    expect(guard).toContain("new.patient_id <> old.patient_id");
    expect(guard).toContain("new.practitioner_id <> old.practitioner_id");
  });

  it("increments the version on every update, in a trigger", () => {
    // Section 34. Put in the trigger rather than in each function so a
    // function added later cannot forget it — which is the failure that turns
    // optimistic concurrency into silent overwrite.
    expect(functionBody("clinical_records_guard_update")).toContain(
      "new.version := old.version + 1",
    );
    expect(SQL).toMatch(
      /create trigger clinical_records_guard_update\s*\n\s*before update on public\.clinical_records/,
    );
  });

  it("applies the optimistic lock in the update statement itself", () => {
    // Not only in the `if` above it: two concurrent saves could both pass a
    // check and both write. The `where version = p_expected_version` clause
    // is what makes at most one of them affect a row.
    for (const name of ["save_clinical_draft", "complete_clinical_record"]) {
      expect(functionBody(name), name).toContain(
        "and cr.version = p_expected_version",
      );
    }
  });

  it("refuses a completing update that is missing the required fields", () => {
    // The check constraint, which holds against any writer — including one
    // that skipped `complete_clinical_record` entirely (sections 37-38).
    expect(SQL).toMatch(
      /constraint clinical_records_completion_requirements check \(\s*\n\s*status = 'draft'/,
    );
  });

  it("keeps completion state and the completion timestamp in step", () => {
    expect(SQL).toMatch(
      /constraint clinical_records_completion_consistency check \(\s*\n\s*\(status = 'draft'\) = \(completed_at is null\)/,
    );
  });

  it("refuses to complete an appointment whose notes are still a draft", () => {
    // Section 73: the record's completion and the appointment's must not be
    // able to disagree. A trigger rather than a check inside one function, so
    // it binds every write path including any added later.
    const guard = functionBody("appointments_guard_clinical_documentation");

    expect(guard).toContain("new.status = 'completed'");
    expect(guard).toContain("cr.status = 'draft'");
    expect(guard).toContain("errcode = 'PV019'");
    expect(SQL).toMatch(
      /create trigger appointments_guard_clinical_documentation\s*\n\s*before update on public\.appointments/,
    );
  });

  it("completes the appointment in the same transaction as the record", () => {
    // Section 71. One PL/pgSQL body is one transaction, so either both happen
    // or neither does — and the appointment goes through the ordinary update,
    // so Phase 09's transition trigger still decides legality (section 72).
    const body = functionBody("complete_clinical_record");

    expect(body).toContain("update public.appointments");
    expect(body).toContain("insert into public.appointment_events");
    // The record is completed first, so the draft-notes trigger permits it.
    expect(body.indexOf("status = 'completed',")).toBeLessThan(
      body.indexOf("update public.appointments"),
    );
  });
});

describe("the completed record is not silently overwritable", () => {
  it("refuses a content change on a non-draft record", () => {
    // Section 16 and example 5, enforced in the database rather than hidden
    // in the UI.
    const guard = functionBody("clinical_records_guard_update");
    // Up to `end if;`, not up to `then` — the refusal is what is being
    // asserted, and it sits after the condition.
    const clause = /old\.status <> 'draft'[\s\S]*?end if;/.exec(guard)?.[0];

    expect(clause).toBeTruthy();
    expect(clause).toContain("A completed clinical record cannot be edited.");

    // And it names every clinical field, so none is a column a completed
    // record could still be edited through.
    for (const column of [
      "chief_complaint",
      "history_of_presenting_concern",
      "symptoms",
      "clinical_observations",
      "assessment",
      "diagnosis_or_clinical_impression",
      "doctor_notes",
      "follow_up_notes",
    ]) {
      expect(clause, column).toContain(column);
    }
  });

  it("refuses a save against a completed record in the function too", () => {
    for (const name of ["save_clinical_draft", "complete_clinical_record"]) {
      expect(functionBody(name), name).toContain("existing.status <> 'draft'");
    }
  });

  it("has no function that deletes a clinical record", () => {
    // Sections 45 and 46: no automatic deletion, and no hard delete through
    // normal UI actions. There is no delete function, no delete grant and no
    // delete policy — absent at three levels rather than hidden at one.
    expect(SQL).not.toMatch(/delete from public\.clinical_records/);
  });
});

describe("no earlier phase is weakened", () => {
  it("adds no clinical column to the appointments table", () => {
    // **Section 2 and example 1**, the boundary this whole phase exists to
    // hold. The migration touches `appointments` twice — a unique constraint
    // and a trigger — and adds no column at all.
    expect(SQL).not.toMatch(/alter table public\.appointments\s+add column/);

    for (const word of [
      "diagnosis",
      "symptom",
      "assessment",
      "chief_complaint",
      "doctor_notes",
      "prescription",
    ]) {
      expect(SQL, word).not.toMatch(
        new RegExp(`alter table public\\.appointments[^;]*${word}`, "i"),
      );
    }
  });

  it("leaves the appointment write ban intact", () => {
    // Phase 09's guarantee: no client role can write `public.appointments`.
    // This migration issues no grant on that table at all.
    expect(SQL).not.toMatch(/grant \w+ on public\.appointments/);
    expect(ENGINE).not.toMatch(
      /grant (insert|update|delete) on public\.appointments/,
    );
  });

  it("leaves the patients table with no clinical column", () => {
    // Phase 07's rule: `public.patients` is demographic and administrative,
    // and none may be added to it. Phase 12 adds the clinical table instead
    // of widening that one — which is exactly what that rule was for.
    expect(SQL).not.toMatch(/alter table public\.patients/);

    const patientsTable =
      /create table public\.patients \(([\s\S]*?)\n\);/.exec(
        PATIENT_PROFILE,
      )?.[1];

    for (const word of ["diagnosis", "symptom", "medication", "allergy"]) {
      expect(patientsTable ?? "", word).not.toContain(word);
    }
  });

  it("does not touch schedule_exceptions, which still has no policy", () => {
    expect(SQL).not.toMatch(/schedule_exceptions/);
  });

  it("replaces no existing function", () => {
    // `create or replace` on a Phase 09 or 11 function would leave the mirror
    // tests that parse those migrations describing a definition that is no
    // longer installed.
    expect(SQL).not.toMatch(/create or replace function/);
  });
});

describe("the application layer", () => {
  it("never writes to a table directly", () => {
    const ts = tsWithoutComments(ACTIONS);

    expect(ts).not.toMatch(/\.from\(["'`]clinical_records["'`]\)/);
    expect(ts).not.toMatch(/\.insert\(/);
    expect(ts).not.toMatch(/\.update\(/);
    expect(ts).not.toMatch(/\.delete\(/);
    expect(ts).not.toMatch(/\.upsert\(/);
  });

  it("never touches the service-role client", () => {
    // The key that bypasses every policy stays out of the request path.
    for (const source of [QUERIES, ACTIONS]) {
      expect(source).not.toContain("lib/supabase/admin");
      expect(source).not.toContain("SERVICE_ROLE");
    }
  });

  it("checks a permission on every exported read", () => {
    const ts = tsWithoutComments(QUERIES);
    const exported = [...ts.matchAll(/export async function (\w+)/g)].map(
      ([, name]) => name,
    );

    expect(exported.length).toBeGreaterThan(0);

    for (const name of exported) {
      const body = new RegExp(
        `export async function ${name}[\\s\\S]*?\\n}`,
      ).exec(ts)?.[0];

      expect(body, name).toMatch(/assertPermission\(/);
    }
  });

  it("names its columns rather than selecting everything", () => {
    // Section 26 says so explicitly for clinical records.
    expect(tsWithoutComments(QUERIES)).not.toMatch(/select\(["'`]\*["'`]\)/);
  });

  it("never sends a practitioner id", () => {
    const ts = tsWithoutComments(QUERIES) + tsWithoutComments(ACTIONS);

    expect(ts).not.toMatch(/p_practitioner_id/);
    expect(ts).not.toMatch(/p_patient_id/);
    expect(ts).not.toMatch(/p_status/);
  });

  it("keeps clinical content out of browser storage", () => {
    // Section 79. Nothing in the feature writes `localStorage`,
    // `sessionStorage` or IndexedDB, and the component layer is asserted
    // separately in `tests/components/clinical.test.tsx`.
    for (const source of [QUERIES, ACTIONS]) {
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("indexedDB");
    }
  });

  it("logs no clinical field name", () => {
    // Section 43 and example 7. Even *which* sections were filled in is
    // information about a consultation.
    const logCalls = [
      ...tsWithoutComments(ACTIONS).matchAll(/logger\.\w+\(([\s\S]*?)\);/g),
    ]
      .map(([, args]) => args)
      .join("\n");

    for (const word of [
      "chiefComplaint",
      "assessment",
      "symptoms",
      "diagnosis",
      "doctorNotes",
      "followUpNotes",
      "content",
    ]) {
      expect(logCalls, word).not.toContain(word);
    }
  });
});
