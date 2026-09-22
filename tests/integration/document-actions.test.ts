import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "@/lib/security/rate-limit";

/**
 * The document server actions and the upload workflow.
 *
 * These assert the properties every Phase 14 write rests on:
 *
 *   * an unauthenticated or unauthorized caller writes nothing, whatever
 *     role they hold — `phase_14.md` section 93's authorization list;
 *   * **no patient id, practitioner id, uploader id, storage path, MIME
 *     type, size or checksum is ever read from the request and passed on.**
 *     The first three are derived, the path is generated and then recomputed
 *     by the database, and the last three are properties of the bytes the
 *     server measures for itself (sections 17, 86, attacks 3, 4 and 5);
 *   * a signed URL is minted **after** authorization and only for a path
 *     read off a row the policy admitted — never for one a caller supplied
 *     (sections 31 and 60, attack 10);
 *   * an upload whose metadata write fails **removes the object it wrote**,
 *     so a failure leaves no orphan (section 14);
 *   * a database failure reaches the person as a sentence rather than as a
 *     PostgREST error (sections 50 and 75, example 9);
 *   * **no log line carries a title, a filename, a description, a reason, a
 *     path or a signed URL** (sections 63 and 65).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database and the bucket refuse independently —
 * is a property of
 * `supabase/migrations/20260925120000_patient_documents.sql`, asserted
 * structurally in `document-security.test.ts` and against a live project in
 * `docs/progress/progress_phase_14.md`. Both halves are needed; neither
 * substitutes for the other.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_PRACTITIONER_ID = "66666666-6666-4666-8666-666666666666";

const TITLE = "Blood test — 12 September 2026";
const FILE_NAME = "CBC-report.pdf";
const DESCRIPTION = "From Sahyadri Hospital, Satara.";
const ARCHIVE_REASON = "Superseded by the repeat test.";

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

interface StorageCall {
  readonly op: "upload" | "remove" | "createSignedUrl";
  readonly bucket: string;
  readonly args: readonly unknown[];
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};
let tableRows: Record<string, unknown> = {};
let storageCalls: StorageCall[] = [];
let uploadError: unknown = null;
let signedUrlResult: { data: unknown; error: unknown } = {
  data: { signedUrl: "https://storage.example.test/signed?token=SECRET" },
  error: null,
};

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

function storageStub(bucket: string) {
  return {
    upload: async (...args: unknown[]) => {
      storageCalls.push({ op: "upload", bucket, args });
      return {
        data: uploadError ? null : { path: args[0] },
        error: uploadError,
      };
    },
    remove: async (...args: unknown[]) => {
      storageCalls.push({ op: "remove", bucket, args });
      return { data: null, error: null };
    },
    createSignedUrl: async (...args: unknown[]) => {
      storageCalls.push({ op: "createSignedUrl", bucket, args });
      return signedUrlResult;
    },
  };
}

function queryStub(table: string) {
  const result = {
    select: () => result,
    eq: () => result,
    neq: () => result,
    order: () => result,
    limit: () => result,
    maybeSingle: async () => ({ data: tableRows[table] ?? null, error: null }),
    returns: () => result,
    then: undefined,
  };
  return result;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
    from: (table: string) => queryStub(table),
    storage: { from: (bucket: string) => storageStub(bucket) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: (bucket: string) => storageStub(bucket) },
  }),
}));

const logLines: string[] = [];

function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

/** A genuine PDF: `%PDF-` and enough bytes to be inspected. */
function pdfFile(name = FILE_NAME, type = "application/pdf"): File {
  const header = new TextEncoder().encode("%PDF-1.7\nreport contents");
  return new File([header], name, { type });
}

function patientForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("file", pdfFile());
  data.set("documentType", "lab_report");
  data.set("title", TITLE);
  data.set("description", DESCRIPTION);
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function practitionerForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("file", pdfFile());
  data.set("appointmentId", APPOINTMENT_ID);
  data.set("documentType", "diagnostic_report");
  data.set("title", TITLE);
  data.set("description", "");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function archiveForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("documentId", DOCUMENT_ID);
  data.set("reason", ARCHIVE_REASON);
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

beforeEach(() => {
  // Phase 19 put a per-account rate limit on uploads, and the limiter is a
  // module singleton — correct in production, wrong in a test file, where
  // twenty upload cases in a row would otherwise exhaust a real allowance and
  // the twenty-first would fail for a reason unrelated to what it tests.
  resetRateLimits();

  rpcCalls = [];
  rpcResults = {
    current_patient_id: { data: PATIENT_ID, error: null },
    current_practitioner_id: { data: null, error: null },
  };
  tableRows = {
    appointments: { patient_id: PATIENT_ID },
    patient_documents: null,
  };
  storageCalls = [];
  uploadError = null;
  signedUrlResult = {
    data: { signedUrl: "https://storage.example.test/signed?token=SECRET" },
    error: null,
  };
  logLines.length = 0;
  getCurrentUser.mockReset();
  revalidatePath.mockReset();

  // The logger writes `info` and `debug` through `console.log`, so spying on
  // `console.info` would capture nothing — and a log assertion that captures
  // nothing passes for the wrong reason.
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function asPatient() {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "patient@example.test",
    emailVerified: true,
    role: "patient",
    displayName: "Test Patient",
  });
}

function asDoctor() {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "doctor@example.test",
    emailVerified: true,
    role: "doctor",
    displayName: "Test Doctor",
  });
}

function asRole(role: "receptionist" | "admin") {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: `${role}@example.test`,
    emailVerified: true,
    role,
    displayName: "Test Staff",
  });
}

const CONTENT_FRAGMENTS = [
  TITLE,
  FILE_NAME,
  DESCRIPTION,
  ARCHIVE_REASON,
  "Blood test",
  "CBC",
  "Sahyadri",
  "patients/",
  "SECRET",
  "patient@example.test",
];

function expectNoContentInLogs() {
  const joined = logLines.join("\n");
  for (const fragment of CONTENT_FRAGMENTS) {
    expect(joined, `a log line carried "${fragment}"`).not.toContain(fragment);
  }
}

/* ---------------------------------------------------------------------------
 * Uploading
 * ------------------------------------------------------------------------ */

describe("uploadPatientDocument", () => {
  it("refuses a receptionist and an administrator, and writes nothing", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");

    for (const role of ["receptionist", "admin"] as const) {
      asRole(role);
      const user = await getCurrentUser();
      const outcome = await uploadPatientDocument(user, patientForm());

      expect(outcome.ok, role).toBe(false);
      expect(outcome.ok === false && outcome.reason).toBe("forbidden");
    }

    expect(rpcCalls).toEqual([]);
    expect(storageCalls).toEqual([]);
  });

  it("names neither the role held nor the role required", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asRole("receptionist");
    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      patientForm(),
    );

    const message = outcome.ok === false ? outcome.message : "";
    // Phase 08's rule: a refusal names no role and no specific capability.
    // The shared copy does contain the *word* "permission" — "You don't have
    // permission to do that." — which is the point: it says what happened
    // without saying which permission or which role would have sufficed.
    expect(message).not.toMatch(/receptionist|doctor|patient|admin/i);
    expect(message).not.toMatch(/documents\.|\.write\.|\.read\.|policy/i);
  });

  it("sends the patient's upload with no identity of any kind", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      patientForm(),
    );

    expect(outcome.ok).toBe(true);

    const call = rpcCalls.find(
      (entry) => entry.name === "create_patient_document_as_patient",
    );
    expect(call).toBeDefined();

    // **The argument list is the allowlist.** No patient, no practitioner,
    // no uploader, no status, no appointment.
    expect(Object.keys(call?.args ?? {}).sort()).toEqual([
      "p_checksum",
      "p_description",
      "p_document_id",
      "p_document_type",
      "p_file_name",
      "p_file_size",
      "p_mime_type",
      "p_storage_path",
      "p_title",
    ]);
  });

  it("derives the storage path from the resolved patient and a generated id", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    await uploadPatientDocument(await getCurrentUser(), patientForm());

    const call = rpcCalls.find(
      (entry) => entry.name === "create_patient_document_as_patient",
    );
    const documentId = call?.args.p_document_id as string;
    const path = call?.args.p_storage_path as string;

    // The patient comes from `current_patient_id()`, not from the request.
    expect(rpcCalls[0]?.name).toBe("current_patient_id");
    expect(path).toBe(
      `patients/${PATIENT_ID}/documents/${documentId}/document.pdf`,
    );
    // Generated server-side, and a uuid.
    expect(documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    // The object is written at exactly that path.
    const upload = storageCalls.find((entry) => entry.op === "upload");
    expect(upload?.bucket).toBe("patient-documents");
    expect(upload?.args[0]).toBe(path);
  });

  it("never lets a planted field change anything", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");

    // **Attacks 3, 4, 5 and 8, plus section 86.** Every one of these is
    // either rejected by `strict()` or has nowhere to arrive.
    const planted: Readonly<Record<string, string>> = {
      patientId: OTHER_PATIENT_ID,
      practitionerId: OTHER_PRACTITIONER_ID,
      doctorId: OTHER_PRACTITIONER_ID,
      uploadedBy: OTHER_PRACTITIONER_ID,
      clinicalRecordId: DOCUMENT_ID,
      storagePath: "patients/other/documents/other/document.pdf",
      mimeType: "image/svg+xml",
      fileSize: "1",
      checksum: "0".repeat(64),
      documentId: DOCUMENT_ID,
      status: "archived",
      role: "admin",
    };

    for (const [field, value] of Object.entries(planted)) {
      rpcCalls = [];
      storageCalls = [];
      asPatient();

      const outcome = await uploadPatientDocument(
        await getCurrentUser(),
        patientForm({ [field]: value }),
      );

      // The upload **succeeds and is unaffected**, which is the honest
      // property: the form is read by name from a fixed list, so a field
      // the form did not declare is never read at all. `strict()` is the
      // second layer, for an object assembled in code rather than posted —
      // the distinction Phase 08 recorded when its own docblock got this
      // wrong.
      expect(outcome.ok, `${field} broke the upload`).toBe(true);

      const call = rpcCalls.find(
        (entry) => entry.name === "create_patient_document_as_patient",
      );
      expect(call, field).toBeDefined();

      // Nothing planted reached the database, and the derived values are
      // still derived.
      expect(Object.keys(call?.args ?? {}), field).not.toContain(field);
      expect(call?.args.p_storage_path, field).toBe(
        `patients/${PATIENT_ID}/documents/${
          call?.args.p_document_id as string
        }/document.pdf`,
      );
      expect(call?.args.p_mime_type, field).toBe("application/pdf");
      expect(call?.args.p_document_id, field).not.toBe(DOCUMENT_ID);
      expect(String(JSON.stringify(call?.args)), field).not.toContain(
        OTHER_PATIENT_ID,
      );
      expect(String(JSON.stringify(call?.args)), field).not.toContain(
        OTHER_PRACTITIONER_ID,
      );
    }
  });

  it("sends the practitioner's upload with one appointment id and nothing else", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asDoctor();
    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      practitionerForm(),
    );

    expect(outcome.ok).toBe(true);

    const call = rpcCalls.find(
      (entry) => entry.name === "create_patient_document_as_practitioner",
    );
    expect(Object.keys(call?.args ?? {}).sort()).toEqual([
      "p_appointment_id",
      "p_checksum",
      "p_description",
      "p_document_id",
      "p_document_type",
      "p_file_name",
      "p_file_size",
      "p_mime_type",
      "p_storage_path",
      "p_title",
    ]);
    expect(call?.args.p_appointment_id).toBe(APPOINTMENT_ID);

    // The patient comes off the appointment, not off the form — and the
    // database resolves it again by the caller's own practitioner record.
    expect(call?.args.p_storage_path).toBe(
      `patients/${PATIENT_ID}/documents/${
        call?.args.p_document_id as string
      }/document.pdf`,
    );
  });

  it("refuses when the appointment is not in the caller's diary", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asDoctor();
    // `patients_select_doctor_care` and the Phase 09 own-practitioner policy
    // mean the read simply returns nothing.
    tableRows.appointments = null;

    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      practitionerForm(),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe(
      "care_context_not_found",
    );
    expect(storageCalls).toEqual([]);
  });

  it("refuses a patient with no patient record, and says what to do", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    rpcResults.current_patient_id = { data: null, error: null };

    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      patientForm(),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("no_patient_record");
    expect(outcome.ok === false && outcome.message).toMatch(
      /complete your profile/i,
    );
    expect(storageCalls).toEqual([]);
  });

  it("stores the type it detected, never the type that was declared", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();

    const data = patientForm();
    // A genuine JPEG, declared as `image/jpg` (a legacy spelling browsers
    // still send) and named `.jpg`.
    const jpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
      "scan.jpg",
      { type: "image/jpg" },
    );
    data.set("file", jpeg);

    await uploadPatientDocument(await getCurrentUser(), data);

    const call = rpcCalls.find(
      (entry) => entry.name === "create_patient_document_as_patient",
    );
    expect(call?.args.p_mime_type).toBe("image/jpeg");
    expect(call?.args.p_storage_path).toMatch(/\/document\.jpg$/);
  });

  it("rejects a spoofed file before it reaches storage", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();

    const data = patientForm();
    // **Attack 9.** An executable renamed and declared as a PDF.
    data.set(
      "file",
      new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "report.pdf", {
        type: "application/pdf",
      }),
    );

    const outcome = await uploadPatientDocument(await getCurrentUser(), data);

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("file_rejected");
    expect(storageCalls).toEqual([]);
    expect(rpcCalls.some((entry) => entry.name.startsWith("create_"))).toBe(
      false,
    );
  });

  it("rejects an oversized file before it reaches storage", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    const { MAX_DOCUMENT_BYTES } = await import("@/config/documents");
    asPatient();

    const data = patientForm();
    data.set(
      "file",
      new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "report.pdf", {
        type: "application/pdf",
      }),
    );

    const outcome = await uploadPatientDocument(await getCurrentUser(), data);

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("file_rejected");
    expect(storageCalls).toEqual([]);
  });

  it("removes the object when the metadata write fails", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    rpcResults.create_patient_document_as_patient = {
      data: null,
      error: pgError("PV041"),
    };

    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      patientForm(),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("metadata_failed");

    // **Section 14's compensation.** The object was written and is removed,
    // so a failure leaves no orphan.
    const ops = storageCalls.map((entry) => entry.op);
    expect(ops).toEqual(["upload", "remove"]);
    expect(storageCalls[1]?.args[0]).toEqual([storageCalls[0]?.args[0]]);
  });

  it("writes no metadata when the object could not be stored", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    uploadError = { message: 'Bucket not found: "patient-documents"' };

    const outcome = await uploadPatientDocument(
      await getCurrentUser(),
      patientForm(),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("storage_failed");
    expect(
      rpcCalls.some((entry) =>
        entry.name.startsWith("create_patient_document"),
      ),
    ).toBe(false);
    // And the provider's bucket name does not reach the person.
    expect(outcome.ok === false && outcome.message).not.toContain(
      "patient-documents",
    );
  });

  it("never writes an object it is allowed to overwrite", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    await uploadPatientDocument(await getCurrentUser(), patientForm());

    // Section 37: a corrected report is a new document, never an overwrite.
    const upload = storageCalls.find((entry) => entry.op === "upload");
    expect(upload?.args[2]).toMatchObject({ upsert: false });
  });

  it("logs the operation and nothing about the file", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();
    await uploadPatientDocument(await getCurrentUser(), patientForm());

    expect(logLines.join("\n")).toContain("document.uploaded");
    expectNoContentInLogs();
  });

  it("logs nothing about a rejected file either", async () => {
    const { uploadPatientDocument } =
      await import("@/features/documents/upload");
    asPatient();

    const data = patientForm();
    data.set(
      "file",
      new File([new Uint8Array([0x4d, 0x5a])], "my-medical-history.exe", {
        type: "application/pdf",
      }),
    );
    await uploadPatientDocument(await getCurrentUser(), data);

    // A filename is something the patient chose and may contain their name.
    expect(logLines.join("\n")).not.toContain("my-medical-history");
    expect(logLines.join("\n")).toContain("document.rejected");
  });
});

/* ---------------------------------------------------------------------------
 * Archiving
 * ------------------------------------------------------------------------ */

describe("archiveDocumentAction", () => {
  it("refuses an unauthenticated caller", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    getCurrentUser.mockResolvedValue(null);

    const state = await archiveDocumentAction(
      { status: "idle" },
      archiveForm(),
    );

    expect(state.status).toBe("error");
    expect(rpcCalls).toEqual([]);
  });

  it("refuses a receptionist and an administrator, and writes nothing", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");

    for (const role of ["receptionist", "admin"] as const) {
      asRole(role);
      const state = await archiveDocumentAction(
        { status: "idle" },
        archiveForm(),
      );
      expect(state.status, role).toBe("error");
    }

    expect(rpcCalls).toEqual([]);
  });

  it("sends exactly a document id and a reason", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();

    const state = await archiveDocumentAction(
      { status: "idle" },
      archiveForm(),
    );

    expect(state.status).toBe("archived");
    expect(rpcCalls).toEqual([
      {
        name: "archive_patient_document",
        args: { p_document_id: DOCUMENT_ID, p_reason: ARCHIVE_REASON },
      },
    ]);
  });

  it("sends a null reason rather than an empty string", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();

    await archiveDocumentAction(
      { status: "idle" },
      archiveForm({ reason: "" }),
    );

    expect(rpcCalls[0]?.args.p_reason).toBeNull();
  });

  it("lets no planted field reach the database", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");

    for (const [field, value] of Object.entries({
      patientId: OTHER_PATIENT_ID,
      uploadedBy: USER_ID,
      status: "active",
      storagePath: "patients/other/documents/other/document.pdf",
      role: "admin",
    })) {
      rpcCalls = [];
      asPatient();

      const state = await archiveDocumentAction(
        { status: "idle" },
        archiveForm({ [field]: value }),
      );

      // The action succeeds and the planted field changes nothing: the form
      // is read by name from a fixed list, so it is never read at all.
      expect(state.status, field).toBe("archived");
      expect(rpcCalls, field).toEqual([
        {
          name: "archive_patient_document",
          args: { p_document_id: DOCUMENT_ID, p_reason: ARCHIVE_REASON },
        },
      ]);
    }
  });

  it("passes a well-formed id for somebody else's document through unchanged", async () => {
    // The application does not try to decide ownership: it sends the id and
    // lets the **database** resolve the row by id *and* by the caller being
    // the uploader. A refusal comes back as `PV040`, which reads the same as
    // a document that does not exist (sections 76 and example 6).
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();
    rpcResults.archive_patient_document = {
      data: null,
      error: pgError("PV040"),
    };

    const state = await archiveDocumentAction(
      { status: "idle" },
      archiveForm(),
    );

    expect(rpcCalls[0]?.args.p_document_id).toBe(DOCUMENT_ID);
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/couldn't find that document/i);
    expect(state.message).not.toMatch(/uploader|owner|permission/i);
  });

  it("turns a database failure into a sentence carrying no database text", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();
    rpcResults.archive_patient_document = {
      data: null,
      error: pgError(
        "23514",
        'new row violates check constraint "patient_documents_archive_reason_length"',
      ),
    };

    const state = await archiveDocumentAction(
      { status: "idle" },
      archiveForm(),
    );

    expect(state.message).not.toContain("patient_documents");
    expect(state.message).not.toContain("constraint");
    expect(state.message).toMatch(/not saved/i);
  });

  it("revalidates both audiences' lists", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();
    await archiveDocumentAction({ status: "idle" }, archiveForm());

    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toContain("/patient/documents");
    expect(paths).toContain("/doctor/patients");
  });

  it("logs the operation and never the reason", async () => {
    const { archiveDocumentAction } =
      await import("@/features/documents/actions");
    asPatient();
    await archiveDocumentAction({ status: "idle" }, archiveForm());

    expect(logLines.join("\n")).toContain("document.archived");
    expectNoContentInLogs();
  });
});

/* ---------------------------------------------------------------------------
 * Access
 * ------------------------------------------------------------------------ */

describe("requestDocumentAccessAction", () => {
  const ROW = {
    id: DOCUMENT_ID,
    patient_id: PATIENT_ID,
    uploaded_by_role: "patient",
    uploaded_by_practitioner_id: null,
    document_type: "lab_report",
    title: TITLE,
    description: DESCRIPTION,
    storage_path: `patients/${PATIENT_ID}/documents/${DOCUMENT_ID}/document.pdf`,
    file_name: FILE_NAME,
    mime_type: "application/pdf",
    file_size: 2048,
    status: "active",
    appointment_id: null,
    clinical_record_id: null,
    archived_at: null,
    archive_reason: null,
    created_at: "2026-09-25T04:00:00.000Z",
  };

  it("refuses an unauthenticated caller before touching storage", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    getCurrentUser.mockResolvedValue(null);

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(result.ok).toBe(false);
    expect(storageCalls).toEqual([]);
  });

  it("refuses a receptionist and an administrator before touching storage", async () => {
    // **Attack 10.** A signed URL is never minted for a caller who holds no
    // document read permission, whatever document id they send.
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");

    for (const role of ["receptionist", "admin"] as const) {
      storageCalls = [];
      asRole(role);
      const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

      expect(result.ok, role).toBe(false);
      expect(storageCalls, role).toEqual([]);
    }
  });

  it("refuses a malformed document id, saying nothing about whether it exists", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();

    const result = await requestDocumentAccessAction(
      "../../etc/passwd",
      "download",
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/isn't available/i);
    expect(storageCalls).toEqual([]);
  });

  it("refuses a document the policy did not return, without saying which", async () => {
    // Sections 76 and example 6: a document that is not theirs and one that
    // does not exist produce the same sentence.
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = null;

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).not.toMatch(
      /exists|permission|another patient|not yours/i,
    );
    expect(storageCalls).toEqual([]);
  });

  it("signs only the path that came off the authorized row", async () => {
    // **Section 60's central rule.** The path is not an input — it is read
    // off a row row-level security admitted.
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = ROW;

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(result.ok).toBe(true);
    const signed = storageCalls.find((entry) => entry.op === "createSignedUrl");
    expect(signed?.bucket).toBe("patient-documents");
    expect(signed?.args[0]).toBe(ROW.storage_path);
  });

  it("mints a short-lived URL and says how long it lives", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    const { SIGNED_URL_TTL_SECONDS } = await import("@/config/documents");
    asPatient();
    tableRows.patient_documents = ROW;

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    const signed = storageCalls.find((entry) => entry.op === "createSignedUrl");
    expect(signed?.args[1]).toBe(SIGNED_URL_TTL_SECONDS);
    expect(result.ok && result.access.expiresInSeconds).toBe(
      SIGNED_URL_TTL_SECONDS,
    );
  });

  it("forces a safe download filename, and no filename for a preview", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = ROW;

    const download = await requestDocumentAccessAction(DOCUMENT_ID, "download");
    expect(download.ok && download.access.downloadFileName).toBe(
      "Blood-test-12-September-2026.pdf",
    );
    expect(storageCalls.at(-1)?.args[2]).toMatchObject({
      download: "Blood-test-12-September-2026.pdf",
    });

    storageCalls = [];
    await requestDocumentAccessAction(DOCUMENT_ID, "preview");
    // A preview must render inline; `Content-Disposition: attachment` would
    // make the frame download instead.
    expect(storageCalls.at(-1)?.args[2]).toBeUndefined();
  });

  it("refuses a preview of a type a browser must not render", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = { ...ROW, mime_type: "image/heic" };

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "preview");

    expect(result.ok).toBe(false);
    expect(storageCalls).toEqual([]);

    // The same document downloads perfectly well.
    const download = await requestDocumentAccessAction(DOCUMENT_ID, "download");
    expect(download.ok).toBe(true);
  });

  it("refuses a preview of an archived document but still allows the download", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = {
      ...ROW,
      status: "archived",
      archived_at: "2026-09-26T04:00:00.000Z",
    };

    expect((await requestDocumentAccessAction(DOCUMENT_ID, "preview")).ok).toBe(
      false,
    );
    expect(
      (await requestDocumentAccessAction(DOCUMENT_ID, "download")).ok,
    ).toBe(true);
  });

  it("returns nothing internal alongside the URL", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = ROW;

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(result.ok).toBe(true);
    expect(Object.keys(result.ok ? result.access : {}).sort()).toEqual([
      "downloadFileName",
      "expiresInSeconds",
      "mimeType",
      "previewable",
      "url",
    ]);
  });

  it("reports a storage failure without naming the bucket", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = ROW;
    signedUrlResult = {
      data: null,
      error: { message: 'Object not found in bucket "patient-documents"' },
    };

    const result = await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).not.toContain(
      "patient-documents",
    );
  });

  it("never logs the signed URL, the path or the title", async () => {
    const { requestDocumentAccessAction } =
      await import("@/features/documents/actions");
    asPatient();
    tableRows.patient_documents = ROW;
    await requestDocumentAccessAction(DOCUMENT_ID, "download");

    expect(logLines.join("\n")).toContain("document.access_granted");
    expectNoContentInLogs();
  });
});
