import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DOCUMENT_FIELD_LIMITS } from "@/config/documents";
import {
  ARCHIVE_DOCUMENT_FIELDS,
  PATIENT_UPLOAD_FIELDS,
  PRACTITIONER_UPLOAD_FIELDS,
  archiveDocumentSchema,
  documentAccessSchema,
  patientDocumentUploadSchema,
  practitionerDocumentUploadSchema,
} from "./validation";

/**
 * The document trust boundary.
 *
 * ## The shape of every test here
 *
 * One hostile field at a time, and the assertion is **rejected**, never
 * "stripped". A rejected request is visible in a log; a dropped field is how
 * a `patientId` or a `storagePath` arrives by accident and nobody notices.
 *
 * `phase_14.md` attacks 3, 4 and 5, sections 17, 60 and 86, and example 2.
 */

const SOURCE = readFileSync(
  new URL("./validation.ts", import.meta.url),
  "utf8",
);

/**
 * The module's own text, with comments **and import statements** removed.
 *
 * The imports go because `./status` legitimately contains the word "status",
 * and a scan that tripped over a module name would have to be relaxed —
 * which is how an assertion like this one quietly stops asserting anything.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "")
  .replace(/^import[\s\S]*?;$/gm, "");

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function patientUpload(overrides: Record<string, unknown> = {}) {
  return {
    documentType: "lab_report",
    title: "Blood test",
    description: "",
    ...overrides,
  };
}

function practitionerUpload(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: UUID,
    documentType: "lab_report",
    title: "Blood test",
    description: "",
    ...overrides,
  };
}

/**
 * Every identity, path and derived value a request must never be able to
 * choose. `phase_14.md` attacks 3, 4 and 5, and section 86.
 */
const HOSTILE_FIELDS: Readonly<Record<string, unknown>> = {
  patientId: OTHER,
  patient_id: OTHER,
  practitionerId: OTHER,
  practitioner_id: OTHER,
  doctorId: OTHER,
  uploadedBy: OTHER,
  uploaded_by: OTHER,
  uploadedByRole: "practitioner",
  clinicalRecordId: OTHER,
  clinical_record_id: OTHER,
  storagePath: "patients/other/documents/other/document.pdf",
  storage_path: "../../secret.pdf",
  bucket: "patient-documents",
  mimeType: "application/pdf",
  mime_type: "image/svg+xml",
  fileSize: 1,
  file_size: 999_999_999,
  checksum: "0".repeat(64),
  documentId: OTHER,
  status: "archived",
  archivedAt: "2026-09-25T00:00:00.000Z",
  role: "admin",
  permission: "documents.read.care",
  isAdmin: true,
};

describe("the patient's upload schema", () => {
  it("accepts exactly the three fields the form posts", () => {
    const parsed = patientDocumentUploadSchema.safeParse(patientUpload());
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {}).sort()).toEqual([
      "description",
      "documentType",
      "title",
    ]);
  });

  it("rejects every hostile field, one at a time", () => {
    for (const [field, value] of Object.entries(HOSTILE_FIELDS)) {
      const parsed = patientDocumentUploadSchema.safeParse(
        patientUpload({ [field]: value }),
      );
      expect(parsed.success, `${field} was accepted`).toBe(false);
    }
  });

  it("has no appointment field at all", () => {
    // A patient's own upload attaches to no consultation. Sending one is a
    // rejection rather than a silently ignored key.
    expect(
      patientDocumentUploadSchema.safeParse(
        patientUpload({ appointmentId: UUID }),
      ).success,
    ).toBe(false);
  });

  it("requires a title and refuses a blank one", () => {
    expect(
      patientDocumentUploadSchema.safeParse(patientUpload({ title: "" }))
        .success,
    ).toBe(false);
    expect(
      patientDocumentUploadSchema.safeParse(patientUpload({ title: "   " }))
        .success,
    ).toBe(false);
  });

  it("refuses a document type the database does not have", () => {
    for (const documentType of [
      "prescription",
      "DIAGNOSTIC_REPORT",
      "",
      "invoice",
      "lab_report; drop table patient_documents",
    ]) {
      expect(
        patientDocumentUploadSchema.safeParse(patientUpload({ documentType }))
          .success,
        documentType,
      ).toBe(false);
    }
  });

  it("bounds the title and the description", () => {
    expect(
      patientDocumentUploadSchema.safeParse(
        patientUpload({ title: "a".repeat(DOCUMENT_FIELD_LIMITS.title) }),
      ).success,
    ).toBe(true);
    expect(
      patientDocumentUploadSchema.safeParse(
        patientUpload({ title: "a".repeat(DOCUMENT_FIELD_LIMITS.title + 1) }),
      ).success,
    ).toBe(false);
    expect(
      patientDocumentUploadSchema.safeParse(
        patientUpload({
          description: "a".repeat(DOCUMENT_FIELD_LIMITS.description + 1),
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts the punctuation a real title carries", () => {
    // A title is written by a person about their own health, and mangling
    // an en dash or an apostrophe would be the application correcting them.
    for (const title of [
      "Blood test — 12 September 2026",
      "Dr O'Brien's referral",
      "CBC (repeat) 50%",
      "MRI L4/L5",
      "रक्त तपासणी",
    ]) {
      expect(
        patientDocumentUploadSchema.safeParse(patientUpload({ title })).success,
        title,
      ).toBe(true);
    }
  });

  it("stores markup as text rather than refusing it", () => {
    // Refusing an angle bracket would refuse "<2 mmol/L". It is rendered as
    // text by React, and the component suite asserts that separately.
    const parsed = patientDocumentUploadSchema.safeParse(
      patientUpload({ title: "<script>alert(1)</script>" }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.title).toBe(
      "<script>alert(1)</script>",
    );
  });
});

describe("the practitioner's upload schema", () => {
  it("accepts exactly the four fields the form posts", () => {
    const parsed =
      practitionerDocumentUploadSchema.safeParse(practitionerUpload());
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {}).sort()).toEqual([
      "appointmentId",
      "description",
      "documentType",
      "title",
    ]);
  });

  it("rejects every hostile field, one at a time", () => {
    for (const [field, value] of Object.entries(HOSTILE_FIELDS)) {
      const parsed = practitionerDocumentUploadSchema.safeParse(
        practitionerUpload({ [field]: value }),
      );
      expect(parsed.success, `${field} was accepted`).toBe(false);
    }
  });

  it("requires the appointment id to be a uuid", () => {
    for (const appointmentId of [
      "",
      "not-a-uuid",
      "../../etc/passwd",
      "1 OR 1=1",
      UUID.slice(0, -1),
    ]) {
      expect(
        practitionerDocumentUploadSchema.safeParse(
          practitionerUpload({ appointmentId }),
        ).success,
        appointmentId,
      ).toBe(false);
    }
  });

  it("carries no patient, practitioner or clinical record field", () => {
    // Section 47: all three are inherited from the appointment inside the
    // database. The appointment id is the one identifier the practitioner
    // genuinely chooses, and it is *data* — resolved by the caller's own
    // practitioner record before anything is read out of it.
    expect([...PRACTITIONER_UPLOAD_FIELDS]).toEqual([
      "appointmentId",
      "documentType",
      "title",
      "description",
    ]);
  });
});

describe("the archive schema", () => {
  it("accepts a document id and an optional reason, and nothing else", () => {
    const parsed = archiveDocumentSchema.safeParse({
      documentId: UUID,
      reason: "",
    });
    expect(parsed.success).toBe(true);
    expect([...ARCHIVE_DOCUMENT_FIELDS]).toEqual(["documentId", "reason"]);
  });

  it("has no status field", () => {
    // There is one transition and it has its own function, so there is
    // nothing for a request to choose.
    expect(
      archiveDocumentSchema.safeParse({
        documentId: UUID,
        reason: "",
        status: "archived",
      }).success,
    ).toBe(false);
  });

  it("rejects every hostile field, one at a time", () => {
    for (const [field, value] of Object.entries(HOSTILE_FIELDS)) {
      if (field === "documentId") continue;
      expect(
        archiveDocumentSchema.safeParse({
          documentId: UUID,
          reason: "",
          [field]: value,
        }).success,
        `${field} was accepted`,
      ).toBe(false);
    }
  });

  it("bounds the reason", () => {
    expect(
      archiveDocumentSchema.safeParse({
        documentId: UUID,
        reason: "a".repeat(DOCUMENT_FIELD_LIMITS.archiveReason + 1),
      }).success,
    ).toBe(false);
  });
});

describe("the access schema", () => {
  it("carries a document id and nothing else", () => {
    expect(documentAccessSchema.safeParse({ documentId: UUID }).success).toBe(
      true,
    );
  });

  it("has no storagePath field, and refuses one", () => {
    // **Section 60's central rule.** A signed URL must never be minted for a
    // path a caller supplied. The path is looked up from a row row-level
    // security admitted; there is nothing here to sign blindly.
    expect(
      documentAccessSchema.safeParse({
        documentId: UUID,
        storagePath: "patients/other/documents/other/document.pdf",
      }).success,
    ).toBe(false);

    expect(
      documentAccessSchema.safeParse({
        storagePath: "patients/other/documents/other/document.pdf",
      }).success,
    ).toBe(false);
  });

  it("refuses a document id that is not a uuid", () => {
    for (const documentId of ["", "..", "%2e%2e%2f", "1", "null"]) {
      expect(
        documentAccessSchema.safeParse({ documentId }).success,
        documentId,
      ).toBe(false);
    }
  });
});

describe("the module's own source", () => {
  it("never names an identity, a path or a derived file property", () => {
    // The strongest form of the assertion: the fields are not filtered out,
    // they are **not written anywhere in this module**, so there is nothing
    // for a later edit to widen.
    for (const forbidden of [
      "patientId",
      "practitionerId",
      "doctorId",
      "uploadedBy",
      "storagePath",
      "checksum",
      "fileSize",
      "bucket",
      "status",
    ]) {
      expect(CODE, forbidden).not.toContain(forbidden);
    }
  });

  it("validates no property of the bytes", () => {
    // `mimeType` and the size are decided by `lib/documents/file-signature`
    // after reading the file. Validating a declared type here would look
    // like a check and be nothing of the kind.
    expect(CODE).not.toContain("mimeType");
    expect(CODE).not.toContain("image/");
    expect(CODE).not.toContain("application/pdf");
  });

  it("declares the same field lists the schemas parse", () => {
    // A field in one and not the other is a control somebody fills in and
    // that never reaches the server — the Phase 12 class of defect.
    expect([...PATIENT_UPLOAD_FIELDS].sort()).toEqual(
      Object.keys(patientDocumentUploadSchema.shape).sort(),
    );
    expect([...PRACTITIONER_UPLOAD_FIELDS].sort()).toEqual(
      Object.keys(practitionerDocumentUploadSchema.shape).sort(),
    );
    expect([...ARCHIVE_DOCUMENT_FIELDS].sort()).toEqual(
      Object.keys(archiveDocumentSchema.shape).sort(),
    );
  });
});
