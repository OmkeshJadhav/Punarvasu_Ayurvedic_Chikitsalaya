import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  canArchiveDocument,
  canPreviewDocument,
  canTransitionDocument,
  DOCUMENT_STATUSES,
  DOCUMENT_TRANSITIONS,
  DOCUMENT_TYPES,
} from "./status";
import type { PatientDocument } from "./types";

/**
 * The document lifecycle, against the migration that enforces it.
 *
 * ## Why this reads SQL
 *
 * The same rules live in `patient_documents_guard_update()`, and that copy
 * is the one that actually holds. This one exists so the UI can decide what
 * to render — and two copies of a rule is a divergence waiting to happen,
 * producing a specific, user-visible failure: a control the page offers and
 * the database then refuses.
 *
 * A test that restated the SQL would agree with a wrong migration. This one
 * parses it.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260925120000_patient_documents.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

function document(overrides: Partial<PatientDocument> = {}): PatientDocument {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    documentType: "lab_report",
    title: "Blood test",
    description: null,
    fileName: "report.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    status: "active",
    uploadedByRole: "patient",
    appointmentId: null,
    clinicalRecordId: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: new Date("2026-09-25T04:00:00.000Z"),
    storagePath: "patients/x/documents/y/document.pdf",
    uploadedByCurrentUser: true,
    ...overrides,
  };
}

describe("the status enum", () => {
  it("is exactly the enum the database declares", () => {
    const match =
      /create type public\.patient_document_status as enum \(([\s\S]*?)\);/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    const declared = [...(match?.[1] ?? "").matchAll(/'([^']+)'/g)].map(
      (value) => value[1],
    );

    expect(declared).toEqual([...DOCUMENT_STATUSES]);
  });

  it("declares no state the workflow does not reach", () => {
    // Unlike the appointment, clinical record and prescription enums, this
    // one carries **no unreachable value**. There was no reason to declare
    // one: nothing in a foreseeable phase needs a third state, and an enum
    // value nothing writes is a state somebody has to reason about for ever.
    expect(DOCUMENT_STATUSES).toHaveLength(2);
  });
});

describe("the document type enum", () => {
  it("is exactly the enum the database declares, in the same order", () => {
    const match =
      /create type public\.patient_document_type as enum \(([\s\S]*?)\);/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    const declared = [...(match?.[1] ?? "").matchAll(/'([^']+)'/g)].map(
      (value) => value[1],
    );

    expect(declared).toEqual([...DOCUMENT_TYPES]);
  });

  it("does not call an outside scan a 'prescription'", () => {
    // A document of this kind is a scan of somebody else's prescription that
    // the patient brought in, and confusing it with `public.prescriptions` —
    // which is what a Punarvasu practitioner issued, is not a file, and is
    // immutable once issued — would be a genuine clinical-safety problem.
    expect(DOCUMENT_TYPES).toContain("previous_prescription");
    expect(DOCUMENT_TYPES as readonly string[]).not.toContain("prescription");
  });
});

describe("the transitions", () => {
  it("permit archiving and nothing else", () => {
    expect(DOCUMENT_TRANSITIONS.active).toEqual(["archived"]);
    expect(DOCUMENT_TRANSITIONS.archived).toEqual([]);
  });

  it("agree with the guard trigger, cell by cell", () => {
    const guard =
      /create function public\.patient_documents_guard_update\(\)[\s\S]*?\$\$;/.exec(
        SQL,
      );

    expect(guard).not.toBeNull();
    const sql = guard?.[0] ?? "";

    // The trigger permits exactly one from→to pair and raises on every
    // other change of status.
    expect(sql).toContain("old.status = 'active' and new.status = 'archived'");
    expect(sql).toMatch(
      /if new\.status <> old\.status and not \(\s*old\.status = 'active' and new\.status = 'archived'\s*\) then/,
    );
  });

  it("are one-way: an archived document never comes back", () => {
    expect(canTransitionDocument("active", "archived")).toBe(true);
    expect(canTransitionDocument("archived", "active")).toBe(false);
    expect(canTransitionDocument("archived", "archived")).toBe(false);
    expect(canTransitionDocument("active", "active")).toBe(false);
  });
});

describe("canArchiveDocument", () => {
  it("is true only for the uploader, and only while it is active", () => {
    expect(canArchiveDocument(document())).toBe(true);
    expect(canArchiveDocument(document({ uploadedByCurrentUser: false }))).toBe(
      false,
    );
    expect(
      canArchiveDocument(
        document({ status: "archived", archivedAt: new Date() }),
      ),
    ).toBe(false);
  });

  it("agrees with the database's own resolution of the same question", () => {
    // Section 34: a patient cannot withdraw a document their clinician put
    // on their record, and a clinician cannot quietly remove one the patient
    // supplied. The function resolves the row by id **and** by the caller
    // being the uploader **and** by it still being active, in one statement.
    const body =
      /create function public\.archive_patient_document\([\s\S]*?\$\$;/.exec(
        SQL,
      );

    expect(body).not.toBeNull();
    const sql = body?.[0] ?? "";
    expect(sql).toContain("and d.uploaded_by = actor");
    expect(sql).toContain("and d.status = 'active'");
  });
});

describe("canPreviewDocument", () => {
  it("is true for the four formats a browser renders inertly", () => {
    for (const mimeType of [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]) {
      expect(canPreviewDocument(document({ mimeType })), mimeType).toBe(true);
    }
  });

  it("is false for HEIC, which no browser renders", () => {
    expect(canPreviewDocument(document({ mimeType: "image/heic" }))).toBe(
      false,
    );
    expect(canPreviewDocument(document({ mimeType: "image/heif" }))).toBe(
      false,
    );
  });

  it("is false for anything that is not on the allowlist at all", () => {
    for (const mimeType of [
      "image/svg+xml",
      "text/html",
      "",
      "application/zip",
    ]) {
      expect(canPreviewDocument(document({ mimeType })), mimeType).toBe(false);
    }
  });

  it("is false for an archived document, which is still downloadable", () => {
    // Archiving withdraws a report from the working record; it does not
    // destroy the evidence. There is deliberately no `canDownloadDocument`
    // predicate — see the note in `status.ts`.
    expect(
      canPreviewDocument(
        document({ status: "archived", archivedAt: new Date() }),
      ),
    ).toBe(false);
  });
});

describe("what the migration does not do", () => {
  it("never deletes a document", () => {
    // No delete function, no delete grant, no delete policy (sections 34
    // and 46). Absent at three levels rather than hidden at one.
    expect(SQL).not.toMatch(/delete from public\.patient_documents/);
    expect(SQL).not.toMatch(/for delete/);
    expect(SQL).not.toMatch(/grant delete/);
  });

  it("references every anchor with `on delete restrict`", () => {
    for (const constraint of [
      "patient_documents_patient_fkey",
      "patient_documents_practitioner_fkey",
      "patient_documents_appointment_consistency",
      "patient_documents_clinical_record_consistency",
    ]) {
      const match = new RegExp(
        `constraint ${constraint}[\\s\\S]*?on delete restrict`,
      ).exec(SQL);
      expect(match, constraint).not.toBeNull();
    }
  });

  it("reads nothing from inside a file", () => {
    // Sections 90-92. No OCR, no extraction, no classification, no summary,
    // no recommendation — and no column that could hold one.
    //
    // `diagnostic_report` is removed before the scan: it is a **category the
    // uploader chooses**, not something the application concluded, and it is
    // exactly the word a naive pattern would trip over. Everything else in
    // the list would be a claim about a file's contents.
    const withoutCategories = SQL.replaceAll("diagnostic_report", "");

    expect(withoutCategories).not.toMatch(
      /ocr|extracted_text|extraction|classification|confidence|diagnos|interpret|inference|embedding/i,
    );
  });
});
