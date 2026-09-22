import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The database-level and storage-level guarantees of patient documents.
 *
 * ## Why these are asserted against the SQL text
 *
 * The properties this phase depends on most are properties of the
 * *database and the bucket*, not of the application: a patient reads their
 * own documents and nobody else's, a doctor reads the documents of patients
 * they are booked to see, a receptionist and an administrator read none at
 * all, an object is unreachable by anyone who guesses its path, a document
 * cannot be deleted, and a storage path is recomputed rather than trusted.
 * None of that can be proved by stubbing a Supabase client — a stub will
 * happily answer whatever it is told to.
 *
 * Running real PostgreSQL in this suite would mean a database in CI, which
 * `docs/QA_STRATEGY.md` section 1.1 has deliberately avoided since Phase 01.
 * So this file does the next most useful thing: it asserts that the
 * migration **says** what the design requires. It is a structural check, not
 * a behavioural one, and it catches the failure that actually happens — a
 * policy, a grant, a constraint or a predicate weakened in a later edit
 * without anybody noticing.
 *
 * The behavioural half must be verified against a live project, and
 * `docs/progress/progress_phase_14.md` records exactly which checks were
 * run. **Both halves are needed**, and neither substitutes for the other.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260925120000_patient_documents.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Phase 13's, for the guarantees this phase must not weaken. */
const PRESCRIPTIONS = readFileSync(
  new URL(
    "../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
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

/**
 * The text of one top-level exported function, up to the next top-level
 * export.
 *
 * A regex ending at the first `\n}` finds the closing brace of a
 * destructured parameter type rather than the end of the function, which is
 * how an assertion like the ones below quietly starts inspecting the wrong
 * thing.
 */
function exportedFunction(code: string, name: string): string {
  const start = code.search(
    new RegExp(`export (?:async )?function ${name}\\b`),
  );
  if (start === -1) throw new Error(`No such exported function: ${name}`);

  const rest = code.slice(start + 1);
  const next = rest.search(/\nexport /);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * The argument text of every `logger.*` call, read by matching parentheses.
 *
 * A regex is not good enough: a single-line call has no newline before its
 * `);`, so a lazy pattern runs on into the next statement and the assertion
 * ends up inspecting unrelated code — passing or failing for entirely the
 * wrong reason.
 */
function loggerCalls(code: string): string[] {
  const calls: string[] = [];
  const pattern = /logger\.(?:debug|info|warn|error)\(/g;
  let match: RegExpExecArray | null = pattern.exec(code);

  while (match !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;

    while (index < code.length && depth > 0) {
      const character = code[index];
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      index += 1;
    }

    calls.push(code.slice(start, index - 1));
    match = pattern.exec(code);
  }

  return calls;
}

/**
 * The context object of every `logger.*` call — the `{ ... }` argument.
 *
 * Scanning the whole argument list would trip over the *event name*, which
 * is a fixed category by construction (and is asserted separately). What
 * matters for privacy is what goes into the context.
 */
function loggerContexts(code: string): string[] {
  return loggerCalls(code)
    .map((call) => {
      const open = call.indexOf("{");
      return open === -1 ? "" : call.slice(open);
    })
    .filter((context) => context !== "");
}

const QUERIES = source("features/documents/queries.ts");
const ACTIONS = source("features/documents/actions.ts");
const UPLOAD = source("features/documents/upload.ts");
const STORAGE = source("features/documents/storage.ts");
const UPLOAD_ROUTE = source("app/api/patient-documents/route.ts");
const VIEWER = source("components/documents/document-viewer.tsx");
const UPLOAD_FORM = source("components/documents/document-upload-form.tsx");

const WRITE_FUNCTIONS = [
  "create_patient_document_as_patient",
  "create_patient_document_as_practitioner",
  "archive_patient_document",
] as const;

const ALL_FUNCTIONS = [
  ...WRITE_FUNCTIONS,
  "assert_document_patient",
  "can_read_patient_document",
  "can_read_patient_document_object",
  "patient_document_extension",
  "patient_document_storage_path",
  "patient_documents_guard_update",
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
  it("is enabled on the table", () => {
    expect(SQL).toMatch(
      /alter table public\.patient_documents enable row level security/,
    );
  });

  it("declares exactly two policies, and both are selects", () => {
    const policies = [
      ...SQL.matchAll(/create policy (\w+)\s+on public\.patient_documents/g),
    ].map((match) => match[1]);

    expect(policies.sort()).toEqual([
      "patient_documents_select_doctor_care",
      "patient_documents_select_own",
    ]);

    for (const policy of policies) {
      const body = new RegExp(
        `create policy ${policy}[\\s\\S]*?using \\(`,
      ).exec(SQL);
      expect(body?.[0], policy).toContain("for select");
    }
  });

  it("scopes each policy by a relationship as well as by a role", () => {
    // Section 55 and example 3: `role === "doctor"` must not reach every
    // document. Both halves are required in both policies.
    const own = /create policy patient_documents_select_own[\s\S]*?\);/.exec(
      SQL,
    );
    expect(own?.[0]).toContain("public.has_app_role('patient')");
    expect(own?.[0]).toContain("patient_id = public.current_patient_id()");

    const care =
      /create policy patient_documents_select_doctor_care[\s\S]*?\);/.exec(SQL);
    expect(care?.[0]).toContain("public.has_app_role('doctor')");
    expect(care?.[0]).toContain(
      "public.doctor_has_care_relationship(patient_id)",
    );
  });

  it("has no blanket policy", () => {
    expect(SQL).not.toMatch(/using \(\s*true\s*\)/);
    expect(SQL).not.toMatch(/auth\.uid\(\) is not null/);
    // A word boundary before "to", because `insert into public.…`
    // contains the bare substring "to public".
    expect(SQL).not.toMatch(/\bto public\b/);
  });

  it("has no insert, update or delete policy for any role", () => {
    // Every write is a `security definer` function. A write policy would be
    // a second way in that nothing else in this phase reasons about.
    expect(SQL).not.toMatch(/for insert/);
    expect(SQL).not.toMatch(/for update/);
    expect(SQL).not.toMatch(/for delete/);
    expect(SQL).not.toMatch(/for all/);
    expect(SQL).not.toMatch(/with check/);
  });

  it("gives a receptionist and an administrator no policy at all", () => {
    // Stronger than a predicate that evaluates to false: a predicate can be
    // weakened by an edit, an absent policy cannot. Sections 19 and 20.
    expect(SQL).not.toContain("'receptionist'");
    expect(SQL).not.toContain("'admin'");
  });

  it("drops no existing policy and replaces no existing function", () => {
    expect(SQL).not.toMatch(/drop policy/i);
    expect(SQL).not.toMatch(/create or replace function/i);
    expect(SQL).not.toMatch(/drop function/i);
  });
});

/* ---------------------------------------------------------------------------
 * Grants
 * ------------------------------------------------------------------------ */

describe("grants", () => {
  it("revokes everything from anon and authenticated first", () => {
    expect(SQL).toMatch(
      /revoke all on public\.patient_documents from anon, authenticated;/,
    );
  });

  it("grants select to authenticated only, and never to anon", () => {
    expect(SQL).toMatch(
      /grant select \([\s\S]*?\) on public\.patient_documents to authenticated;/,
    );
    expect(SQL).not.toMatch(/on public\.patient_documents to anon/);
  });

  it("grants no insert, update or delete on the table to any client role", () => {
    expect(SQL).not.toMatch(/grant insert/);
    expect(SQL).not.toMatch(/grant update/);
    expect(SQL).not.toMatch(/grant delete/);
  });

  it("keeps the actor columns out of the select grant", () => {
    // A column privilege belongs to a database role, and a patient and a
    // doctor are both `authenticated` — so a column readable by one is
    // readable by the other. The trap Phase 10 recorded about
    // `internal_note`.
    const grant =
      /grant select \(([\s\S]*?)\) on public\.patient_documents/.exec(SQL);
    const columns = (grant?.[1] ?? "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);

    expect(columns).not.toContain("uploaded_by");
    expect(columns).not.toContain("archived_by");
    // And the checksum, which section 39 says not to expose to patients.
    expect(columns).not.toContain("checksum_sha256");
    // What a screen genuinely needs is granted.
    expect(columns).toContain("title");
    expect(columns).toContain("storage_path");
    expect(columns).toContain("uploaded_by_role");
  });

  it("grants execute on the three write functions and on nothing else", () => {
    for (const name of WRITE_FUNCTIONS) {
      expect(SQL, name).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\(`),
      );
    }

    // The gate and the two predicates exist for row-level security and the
    // storage policy. They are not an API a caller could use to probe which
    // documents exist.
    for (const name of [
      "assert_document_patient",
      "can_read_patient_document",
      "can_read_patient_document_object",
      "patient_document_extension",
      "patient_document_storage_path",
    ]) {
      expect(SQL, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
      expect(SQL, name).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}\\(`),
      );
    }
  });
});

/* ---------------------------------------------------------------------------
 * Storage
 * ------------------------------------------------------------------------ */

describe("the bucket and its policies", () => {
  it("is private", () => {
    expect(SQL).toMatch(
      /insert into storage\.buckets[\s\S]*?'patient-documents',\s*'patient-documents',\s*false,/,
    );
  });

  it("carries the size limit and the type allowlist itself", () => {
    // A third independent layer under the application's validation and the
    // table's check constraints.
    expect(SQL).toMatch(/file_size_limit, allowed_mime_types/);
    expect(SQL).toMatch(
      /set public = false,\s*file_size_limit = excluded\.file_size_limit/,
    );
  });

  it("declares exactly one storage policy, and it is a select", () => {
    const policies = [
      ...SQL.matchAll(/create policy (\w+)\s+on storage\.objects/g),
    ].map((match) => match[1]);

    expect(policies).toEqual(["patient_documents_objects_select"]);
    expect(
      /create policy patient_documents_objects_select[\s\S]*?\);/.exec(
        SQL,
      )?.[0],
    ).toContain("for select");
  });

  it("resolves an object key to its document row rather than parsing it", () => {
    // **Attack 2 and section 106.** An authenticated user who guesses or
    // constructs another patient's path reaches an object only if it
    // resolves to a row they could have read.
    const policy =
      /create policy patient_documents_objects_select[\s\S]*?\);/.exec(SQL);

    expect(policy?.[0]).toContain("bucket_id = 'patient-documents'");
    expect(policy?.[0]).toContain(
      "public.can_read_patient_document_object(name)",
    );

    const predicate = functionBody("can_read_patient_document_object");
    expect(predicate).toContain("where d.storage_path = p_object_name");
    expect(predicate).toContain("d.patient_id = public.current_patient_id()");
    expect(predicate).toContain(
      "public.doctor_has_care_relationship(d.patient_id)",
    );
    // No string surgery on the key: it is looked up, never split apart.
    expect(predicate).not.toMatch(/split_part|substring|position|like/);
  });

  it("gives no client role any way to write into the bucket", () => {
    // A client that could write could choose its own path, which sections 8
    // and 61 forbid. Every object is written by the server after it has
    // authorized, validated the signature and generated the key.
    const storagePolicies = [
      ...SQL.matchAll(/create policy \w+\s+on storage\.objects[\s\S]*?\);/g),
    ].map((match) => match[0]);

    for (const policy of storagePolicies) {
      expect(policy).not.toContain("for insert");
      expect(policy).not.toContain("for update");
      expect(policy).not.toContain("for delete");
      expect(policy).not.toContain("for all");
    }
  });

  it("gives anon no storage policy at all", () => {
    // **Attack 6.** An anonymous request for a known object key.
    const storagePolicies = [
      ...SQL.matchAll(/create policy \w+\s+on storage\.objects[\s\S]*?\);/g),
    ].map((match) => match[0]);

    for (const policy of storagePolicies) {
      expect(policy).toContain("to authenticated");
      expect(policy).not.toContain("to anon");
    }
  });
});

/* ---------------------------------------------------------------------------
 * The write functions
 * ------------------------------------------------------------------------ */

describe("the write functions", () => {
  it("all pin their search path", () => {
    for (const name of ALL_FUNCTIONS) {
      expect(functionBody(name), name).toContain("set search_path = ''");
    }
  });

  it("all authorize before they read or write anything", () => {
    const gates: Readonly<Record<string, string>> = {
      create_patient_document_as_patient: "public.assert_document_patient()",
      create_patient_document_as_practitioner:
        "public.assert_care_practitioner()",
    };

    for (const [name, gate] of Object.entries(gates)) {
      const body = functionBody(name);
      expect(body, name).toContain(gate);

      const gateAt = body.indexOf(gate);
      const insertAt = body.indexOf("insert into");
      // The first read of a *table*. `(select auth.uid())` in the declare
      // block is not one, and matching a bare `select` would find it.
      const readAt = body.indexOf("from public.");

      expect(gateAt, name).toBeGreaterThan(-1);
      expect(gateAt, name).toBeLessThan(insertAt);
      if (readAt > -1) expect(gateAt, name).toBeLessThan(readAt);
    }

    // The archive function checks the session and the role before its
    // update, and resolves the row by the caller being the uploader.
    const archive = functionBody("archive_patient_document");
    expect(archive.indexOf("has_app_role")).toBeLessThan(
      archive.indexOf("update public.patient_documents"),
    );
  });

  it("take no patient, practitioner, uploader or status parameter", () => {
    // **Attacks 3 and 4, and section 86.** There is nowhere for one to
    // arrive, which is stronger than filtering one out.
    for (const name of WRITE_FUNCTIONS) {
      const signature = new RegExp(
        `create function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns`,
      ).exec(SQL);

      const parameters = signature?.[1] ?? "";
      for (const forbidden of [
        "p_patient_id",
        "p_practitioner_id",
        "p_doctor_id",
        "p_uploaded_by",
        "p_status",
        "p_clinical_record_id",
        "p_archived_at",
        "p_created_at",
      ]) {
        expect(parameters, `${name} takes ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it("derive the patient rather than accepting one", () => {
    expect(functionBody("create_patient_document_as_patient")).toContain(
      "patient := public.assert_document_patient();",
    );

    // Section 47: the practitioner's upload reads the patient out of the
    // appointment, resolved by the caller's own practitioner record.
    const practitioner = functionBody(
      "create_patient_document_as_practitioner",
    );
    expect(practitioner).toContain(
      "select a.patient_id into appointment_patient",
    );
    expect(practitioner).toContain("and a.practitioner_id = practitioner");
  });

  it("recompute the storage path and compare it rather than trusting it", () => {
    // **Section 58, and attack 8.** The path is derived and checked, never
    // parsed.
    for (const name of [
      "create_patient_document_as_patient",
      "create_patient_document_as_practitioner",
    ]) {
      const body = functionBody(name);
      expect(body, name).toContain("public.patient_document_storage_path(");
      expect(body, name).toContain(
        "if expected_path is null or expected_path is distinct from p_storage_path then",
      );
      expect(body, name).toContain("errcode = 'PV041'");
      // And the stored value is the recomputed one, not the caller's.
      expect(body, name).toContain("expected_path,");
    }
  });

  it("resolve the row by the caller as well as by its id", () => {
    // Section 76: somebody else's document is indistinguishable from one
    // that does not exist.
    expect(functionBody("archive_patient_document")).toContain(
      "and d.uploaded_by = actor",
    );
  });

  it("are idempotent on the document id", () => {
    // Section 51: a retry of a request that reached the database must not
    // create a second row.
    for (const name of [
      "create_patient_document_as_patient",
      "create_patient_document_as_practitioner",
    ]) {
      expect(functionBody(name), name).toContain("on conflict (id) do nothing");
    }
  });

  it("never delete anything", () => {
    for (const name of ALL_FUNCTIONS) {
      expect(functionBody(name), name).not.toMatch(/delete from/);
    }
  });
});

/* ---------------------------------------------------------------------------
 * Integrity
 * ------------------------------------------------------------------------ */

describe("relationship integrity", () => {
  it("binds an appointment association to the same patient", () => {
    // **Sections 45-46 and example 7.** A document for patient A attached
    // to patient B's appointment is not something application code must
    // prevent — the database cannot represent it.
    expect(SQL).toMatch(
      /constraint patient_documents_appointment_consistency\s*foreign key \(appointment_id, patient_id\)\s*references public\.appointments \(id, patient_id\)/,
    );
  });

  it("binds a clinical record association to the same patient", () => {
    expect(SQL).toMatch(
      /constraint patient_documents_clinical_record_consistency\s*foreign key \(clinical_record_id, patient_id\)\s*references public\.clinical_records \(id, patient_id\)/,
    );
  });

  it("adds the identity keys those composite foreign keys need", () => {
    expect(SQL).toMatch(
      /alter table public\.appointments\s*add constraint appointments_patient_identity_key\s*unique \(id, patient_id\)/,
    );
    expect(SQL).toMatch(
      /alter table public\.clinical_records\s*add constraint clinical_records_patient_identity_key\s*unique \(id, patient_id\)/,
    );
  });

  it("refuses a second document for one object", () => {
    // Section 37: a corrected report is a new document, never an overwrite.
    expect(SQL).toContain(
      "constraint patient_documents_storage_path_unique unique (storage_path)",
    );
  });

  it("shapes the storage path in the table itself", () => {
    // Belt and braces on top of the recomputation inside the functions:
    // whatever route a row arrives by, its path is in the controlled
    // namespace and names this document and this patient.
    const constraint =
      /constraint patient_documents_storage_path_shape check \(([\s\S]*?)\n  \)/.exec(
        SQL,
      );

    expect(constraint).not.toBeNull();
    const body = constraint?.[1] ?? "";
    expect(body).toContain("'patients/' || patient_id::text");
    expect(body).toContain("'/documents/' || id::text");
    expect(body).toContain("storage_path !~ '\\.\\.'");
  });

  it("makes every reference restrict rather than cascade", () => {
    for (const constraint of [
      "patient_documents_patient_fkey",
      "patient_documents_practitioner_fkey",
      "patient_documents_appointment_consistency",
      "patient_documents_clinical_record_consistency",
    ]) {
      expect(
        new RegExp(`constraint ${constraint}[\\s\\S]*?on delete restrict`).test(
          SQL,
        ),
        constraint,
      ).toBe(true);
    }
  });

  it("makes a document's identity, file and associations immutable", () => {
    // Sections 37, 118 and 119. Every column that identifies the document,
    // the patient, the file or the clinical context is named — a column
    // missing from this list is one an edit could still change.
    const guard = functionBody("patient_documents_guard_update");

    for (const column of [
      "patient_id",
      "storage_path",
      "file_name",
      "mime_type",
      "file_size",
      "checksum_sha256",
      "uploaded_by_role",
      "uploaded_by",
      "uploaded_by_practitioner_id",
      "created_at",
      "appointment_id",
      "clinical_record_id",
    ]) {
      expect(guard, column).toContain(`new.${column}`);
      expect(guard, column).toContain(`old.${column}`);
    }
  });
});

/* ---------------------------------------------------------------------------
 * What the migration must not have done
 * ------------------------------------------------------------------------ */

describe("what the migration leaves alone", () => {
  it("adds no document column to an existing table", () => {
    // The Phase 12 and Phase 13 boundary, applied again: a document is its
    // own table, not a column on an appointment, a clinical record or a
    // prescription.
    const alters = [...SQL.matchAll(/alter table public\.(\w+)([\s\S]*?);/g)];

    for (const [statement, table] of alters.map(
      (match) => [match[0], match[1]] as const,
    )) {
      if (table === "patient_documents") continue;
      // The only thing this migration does to an existing table is add a
      // unique constraint so a composite foreign key can be declared.
      expect(statement, table).toMatch(/add constraint \w+_identity_key/);
      expect(statement, table).not.toMatch(/add column/);
    }
  });

  it("writes to no other table", () => {
    expect(SQL).not.toMatch(/insert into public\.(?!patient_documents)/);
    expect(SQL).not.toMatch(/update public\.(?!patient_documents)/);
  });

  it("weakens nothing Phase 13 established", () => {
    // The prescription guarantees stay exactly as they were: this migration
    // names none of those tables in a write, a grant or a policy.
    expect(SQL).not.toMatch(/prescriptions|treatment_plans/);
    expect(PRESCRIPTIONS).toContain("prescriptions_guard_update");
  });

  it("has no column for anything read out of a file", () => {
    // Sections 90-92: the database stores what a file *is*, never what it
    // *says*.
    const table =
      /create table public\.patient_documents \(([\s\S]*?)\n\);/.exec(SQL);

    expect(table).not.toBeNull();
    expect(table?.[1] ?? "").not.toMatch(
      /extracted|ocr|summary|transcript|content_text|classification|confidence/i,
    );
  });
});

/* ---------------------------------------------------------------------------
 * The application layer
 * ------------------------------------------------------------------------ */

describe("the application layer", () => {
  it("never writes the table directly", () => {
    for (const [name, code] of [
      ["queries", QUERIES],
      ["actions", ACTIONS],
      ["upload", UPLOAD],
    ] as const) {
      expect(code, name).not.toMatch(/\.insert\(/);
      expect(code, name).not.toMatch(/\.update\(/);
      expect(code, name).not.toMatch(/\.delete\(/);
      expect(code, name).not.toMatch(/\.upsert\(/);
    }
  });

  it("checks a permission on every exported read", () => {
    const exported = [...QUERIES.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1] as string,
    );

    expect(exported.length).toBeGreaterThan(0);

    for (const name of exported) {
      const body = exportedFunction(QUERIES, name);

      // `getAuthorizedDocument` delegates to the two that do check, so the
      // permission is required one call deeper.
      const checksHere = body.includes("assertPermission(");
      const delegates =
        body.includes("getPatientDocument(") ||
        body.includes("getCarePatientDocument(");

      expect(
        checksHere || delegates,
        `${name} performs no permission check`,
      ).toBe(true);
    }
  });

  it("never selects everything", () => {
    expect(QUERIES).not.toMatch(/select\("\*"\)/);
    expect(QUERIES).not.toMatch(/\.select\(\)/);
  });

  it("reads the patient's own documents without a patient id", () => {
    // The structural form of attack 1: there is no identifier to substitute.
    const body = exportedFunction(QUERIES, "listPatientDocuments");

    expect(body).not.toContain("patient_id");
    expect(body).not.toContain("patientId");
  });

  it("uses the service role for writes only, and the caller's own client to sign", () => {
    // The split that matters. A signed URL minted with the service role
    // would bypass the storage policy, throwing away the layer section 57
    // asks for.
    expect(STORAGE).toContain("createSupabaseAdminClient");

    const signer = exportedFunction(STORAGE, "createDocumentSignedUrl");
    expect(signer).toContain("createSupabaseServerClient");
    expect(signer).not.toContain("createSupabaseAdminClient");

    const uploader = exportedFunction(STORAGE, "putDocumentObject");
    expect(uploader).toContain("createSupabaseAdminClient");
  });

  it("keeps the service-role client out of every other module", () => {
    for (const [name, code] of [
      ["queries", QUERIES],
      ["actions", ACTIONS],
      ["upload", UPLOAD],
      ["route", UPLOAD_ROUTE],
      ["viewer", VIEWER],
      ["form", UPLOAD_FORM],
    ] as const) {
      expect(code, name).not.toContain("createSupabaseAdminClient");
      expect(code, name).not.toContain("SERVICE_ROLE");
      expect(code, name).not.toContain("service_role");
    }
  });

  it("never overwrites a stored object", () => {
    expect(STORAGE).toContain("upsert: false");
    expect(STORAGE).not.toContain("upsert: true");
  });

  it("removes an object only on the compensation path", () => {
    // The one `remove` in the feature is the orphan cleanup, and it runs
    // only where the metadata write failed.
    expect(STORAGE.match(/\.remove\(/g)?.length ?? 0).toBe(1);
    expect(UPLOAD).toContain("removeOrphanedObject");
    expect(QUERIES).not.toContain("remove");
    expect(ACTIONS).not.toContain("removeOrphanedObject");
  });

  it("mints a signed URL only after resolving the document", () => {
    // **Section 31.** The path is read off a row the policy admitted, so
    // there is nothing for a caller to supply and nothing to sign blindly.
    const body = exportedFunction(ACTIONS, "requestDocumentAccessAction");

    const resolveAt = body.indexOf("getAuthorizedDocument(");
    const signAt = body.indexOf("createDocumentSignedUrl(");

    expect(resolveAt).toBeGreaterThan(-1);
    expect(signAt).toBeGreaterThan(resolveAt);
    expect(body).toContain("path: document.storagePath");
  });

  it("never renders or stores a signed URL beyond the moment", () => {
    // Section 67. Nothing in the browser writes one anywhere persistent.
    for (const [name, code] of [
      ["viewer", VIEWER],
      ["form", UPLOAD_FORM],
    ] as const) {
      expect(code, name).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
      expect(code, name).not.toMatch(/document\.cookie/);
    }
  });

  it("puts no document identifier in a URL", () => {
    // Section 98. Access is a POST server action rather than
    // `GET /api/documents/:id/access`, so a document id never reaches
    // browser history, a proxy log or the next `Referer`.
    expect(VIEWER).toContain("requestDocumentAccessAction");
    expect(VIEWER).not.toMatch(/fetch\(`?\/api\/[^`"]*\$\{documentId\}/);
  });

  it("sends nothing derived from the bytes in the upload request", () => {
    // The browser posts a file and three or four metadata fields. The type,
    // the size and the checksum are measured by the server.
    expect(UPLOAD_FORM).not.toMatch(/data\.set\("mimeType"/);
    expect(UPLOAD_FORM).not.toMatch(/data\.set\("checksum"/);
    expect(UPLOAD_FORM).not.toMatch(/data\.set\("storagePath"/);
    expect(UPLOAD_FORM).not.toMatch(/data\.set\("patientId"/);
  });

  it("validates the file's signature before anything is stored", () => {
    const signatureAt = UPLOAD.indexOf("inspectUploadedFile(");
    const uploadAt = UPLOAD.indexOf("putDocumentObject(");

    expect(signatureAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(signatureAt);
  });

  it("bounds the size before it reads the bytes", () => {
    const sizeCheckAt = UPLOAD.indexOf("file.size > MAX_DOCUMENT_BYTES");
    const readAt = UPLOAD.indexOf("await file.arrayBuffer()");

    expect(sizeCheckAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(sizeCheckAt);
  });

  it("logs no filename, title, description, path or URL", () => {
    // Section 63. A log line carries the operation, the actor's opaque id
    // and the document's opaque id.
    //
    // The scan is over the **context object** of each call rather than the
    // whole argument list, because the first argument is an event name —
    // either a literal or a lookup into a fixed table — and a name like
    // `FILE_REJECTION_LOG_EVENTS[inspection.reason]` is a category, not
    // content. The event names have their own assertion below.
    for (const [name, code] of [
      ["actions", ACTIONS],
      ["upload", UPLOAD],
      ["storage", STORAGE],
      ["queries", QUERIES],
    ] as const) {
      for (const context of loggerContexts(code)) {
        // `authz.denied` is Phase 08's shared refusal event. Its `reason`
        // is one of a handful of fixed categories — "permission", "role" —
        // never anybody's words, and its shape is asserted separately.
        if (/reason: "(permission|role)"/.test(context)) continue;

        for (const forbidden of [
          "title",
          "fileName",
          "file_name",
          "description",
          "storagePath",
          "storage_path",
          "signedUrl",
          "reason",
          "url",
          "checksum",
        ]) {
          expect(context, `${name} logs ${forbidden}`).not.toContain(forbidden);
        }
      }
    }
  });

  it("names every event from a fixed vocabulary", () => {
    // The first argument to a log call. It is either a literal beginning
    // `document.`, the shared `authz.denied`, or a lookup into a constant
    // table of rejection events — never an interpolation, which is how a
    // filename or a title would reach a log by accident.
    for (const [name, code] of [
      ["actions", ACTIONS],
      ["upload", UPLOAD],
      ["storage", STORAGE],
      ["queries", QUERIES],
    ] as const) {
      for (const text of loggerCalls(code)) {
        const event = text.split(",")[0]?.trim() ?? "";
        expect(event, `${name} logs a computed event name`).not.toContain("`");
        expect(event, `${name}: ${event}`).toMatch(
          /^("document\.[a-z_]+"|"authz\.denied"|FILE_REJECTION_LOG_EVENTS(\.\w+|\[[\w.]+\])|failure\.logEvent|described\.logEvent)$/,
        );
      }
    }
  });

  it("never logs the archive reason, which is somebody's own words", () => {
    // The one place a `reason` could be content rather than a category.
    const archive = exportedFunction(ACTIONS, "archiveDocumentAction");

    for (const text of loggerCalls(archive)) {
      expect(text).not.toContain("parsed.data.reason");
      expect(text).not.toMatch(/reason: (?!"(permission|role)")/);
    }
  });

  it("logs only a fixed category on a refusal", () => {
    // `authz.denied` is skipped by the scan above, so its own shape is
    // asserted here: the reason is a literal, and the permission is an
    // application constant rather than anything a request supplied.
    for (const code of [ACTIONS, UPLOAD]) {
      for (const text of loggerCalls(code)) {
        if (!text.includes('"authz.denied"')) continue;
        expect(text).toMatch(/reason: "(permission|role)"/);
        expect(text).toContain('permission: "documents.');
      }
    }
  });
});
