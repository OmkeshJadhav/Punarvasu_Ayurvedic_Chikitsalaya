import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALLOWED_MIME_TYPES, documentExtensionFor } from "@/config/documents";
import {
  assertUuid,
  buildDocumentStoragePath,
  buildDownloadFileName,
  isCanonicalDocumentPath,
} from "./storage-path";

/**
 * The storage path, and the download name.
 *
 * ## The two properties this file exists to hold
 *
 * 1. **The original filename cannot influence where anything is written**
 *    (`phase_14.md` sections 8, 9, 61, attack 8 and example 4). It is not an
 *    argument to the builder, so the strongest form of the assertion is a
 *    type-level one — but the behavioural half is asserted anyway, against
 *    every hostile name somebody might send.
 *
 * 2. **The TypeScript builder and the SQL builder produce the same string.**
 *    They have to exist in both places: the server must know the path before
 *    the row exists in order to upload the object, and the database must be
 *    able to recompute it in order to refuse one it would not have
 *    generated. If they ever disagree, every upload of the affected type is
 *    refused with `PV041` after the object has already been written — so
 *    this test parses the migration rather than restating it.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260925120000_patient_documents.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

const PATIENT = "11111111-1111-4111-8111-111111111111";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";

describe("buildDocumentStoragePath", () => {
  it("puts a document in the controlled namespace", () => {
    expect(buildDocumentStoragePath(PATIENT, DOCUMENT, "application/pdf")).toBe(
      `patients/${PATIENT}/documents/${DOCUMENT}/document.pdf`,
    );
  });

  it("takes its extension from the type, never from a filename", () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(
        buildDocumentStoragePath(PATIENT, DOCUMENT, mimeType).endsWith(
          `/document.${documentExtensionFor(mimeType)}`,
        ),
      ).toBe(true);
    }
  });

  it("produces the identical string the database recomputes", () => {
    // `public.patient_document_storage_path` is what every create function
    // compares the caller's path against. A divergence here is a `PV041` on
    // every upload, after the object has already been stored.
    const body =
      /create function public\.patient_document_storage_path\([\s\S]*?\$\$;/.exec(
        SQL,
      );

    expect(body).not.toBeNull();
    const sql = body?.[0] ?? "";

    // The SQL concatenation, read literally: the same four segments, the
    // same separators, the same generated filename.
    expect(sql).toContain("'patients/' || p_patient_id::text");
    expect(sql).toContain("'/documents/' || p_document_id::text");
    expect(sql).toContain(
      "'/document.' || public.patient_document_extension(p_mime_type)",
    );
    // And it yields nothing at all for a type that is not allowed, which is
    // what turns an unsupported type into a refused path rather than a path
    // with no extension.
    expect(sql).toContain(
      "when public.patient_document_extension(p_mime_type) is null then null",
    );
  });

  it("has no parameter a filename could arrive through", () => {
    // The type-level form of the guarantee. `buildDocumentStoragePath` takes
    // three arguments and none of them is a name.
    expect(buildDocumentStoragePath.length).toBe(3);
  });

  it("refuses to build a path from anything that is not a uuid", () => {
    // Belt and braces: every caller already resolved these server-side, and
    // a non-uuid reaching here would mean a defect upstream. It throws
    // rather than producing a path nobody intended.
    for (const hostile of [
      "../../etc/passwd",
      "..",
      "a/b",
      "",
      "not-a-uuid",
      `${PATIENT}/../${DOCUMENT}`,
      "11111111-1111-4111-8111-11111111111",
      "%2e%2e%2f",
    ]) {
      expect(() =>
        buildDocumentStoragePath(hostile, DOCUMENT, "application/pdf"),
      ).toThrow(/storage path/i);
      expect(() =>
        buildDocumentStoragePath(PATIENT, hostile, "application/pdf"),
      ).toThrow(/storage path/i);
    }
  });

  it("never produces a traversal segment, an absolute path or a bucket name", () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      const path = buildDocumentStoragePath(PATIENT, DOCUMENT, mimeType);
      expect(path).not.toContain("..");
      expect(path.startsWith("/")).toBe(false);
      expect(path).not.toContain("//");
      expect(path).not.toContain("patient-documents");
      expect(path).not.toContain("\\");
    }
  });

  it("carries no clinical information", () => {
    // Section 44. Two opaque uuids and a generated filename — no name, no
    // date of birth, no diagnosis, no type, no date.
    const path = buildDocumentStoragePath(PATIENT, DOCUMENT, "application/pdf");
    expect(path.replace(PATIENT, "").replace(DOCUMENT, "")).toBe(
      "patients//documents//document.pdf",
    );
  });
});

describe("isCanonicalDocumentPath", () => {
  it("accepts exactly what the builder produces", () => {
    const path = buildDocumentStoragePath(PATIENT, DOCUMENT, "image/png");
    expect(isCanonicalDocumentPath(path, PATIENT, DOCUMENT, "image/png")).toBe(
      true,
    );
  });

  it("rejects a path for a different patient, document or type", () => {
    const path = buildDocumentStoragePath(PATIENT, DOCUMENT, "image/png");
    expect(isCanonicalDocumentPath(path, DOCUMENT, DOCUMENT, "image/png")).toBe(
      false,
    );
    expect(isCanonicalDocumentPath(path, PATIENT, PATIENT, "image/png")).toBe(
      false,
    );
    expect(
      isCanonicalDocumentPath(path, PATIENT, DOCUMENT, "application/pdf"),
    ).toBe(false);
  });

  it("rejects a hand-written path, however plausible", () => {
    for (const hostile of [
      `patients/${PATIENT}/documents/${DOCUMENT}/../../other/document.png`,
      `/patients/${PATIENT}/documents/${DOCUMENT}/document.png`,
      `patient-documents/patients/${PATIENT}/documents/${DOCUMENT}/document.png`,
      `patients/${PATIENT}/documents/${DOCUMENT}/document.png/../evil.png`,
      `patients/${PATIENT}/documents/${DOCUMENT}/report.png`,
      "",
    ]) {
      expect(
        isCanonicalDocumentPath(hostile, PATIENT, DOCUMENT, "image/png"),
      ).toBe(false);
    }
  });

  it("rejects a type that is not on the allowlist, whatever the path says", () => {
    expect(
      isCanonicalDocumentPath(
        `patients/${PATIENT}/documents/${DOCUMENT}/document.svg`,
        PATIENT,
        DOCUMENT,
        "image/svg+xml",
      ),
    ).toBe(false);
  });
});

describe("assertUuid", () => {
  it("accepts a uuid and refuses everything else", () => {
    expect(() => assertUuid(PATIENT, "patient id")).not.toThrow();
    expect(() => assertUuid("nope", "patient id")).toThrow(/patient id/);
  });
});

describe("buildDownloadFileName", () => {
  it("uses the title the person wrote, and the stored type's extension", () => {
    expect(
      buildDownloadFileName("Blood test September", "application/pdf"),
    ).toBe("Blood-test-September.pdf");
  });

  it("adds nothing the application was not asked to add", () => {
    // Section 83: no diagnosis, no full date of birth, no patient
    // identifier. The only inputs are the title and the type.
    const name = buildDownloadFileName("Report", "image/png");
    expect(name).toBe("Report.png");
  });

  it("cannot produce a filename that means something to a shell or a header", () => {
    for (const [title, expected] of [
      ["../../etc/passwd", "etc-passwd.pdf"],
      // A hyphen survives because it is a legitimate filename character, so
      // the quote-and-semicolon collapse to one separator each and the
      // result keeps a double hyphen. Deliberate: replacing rather than
      // dropping the illegal characters is what keeps two different titles
      // from collapsing into one filename.
      ['report"; rm -rf /', "report-rm--rf.pdf"],
      [
        "report\r\nContent-Type: text/html",
        "report-Content-Type-text-html.pdf",
      ],
      ["..", "punarvasu-document.pdf"],
      [".hidden", "hidden.pdf"],
      ["", "punarvasu-document.pdf"],
      ["   ", "punarvasu-document.pdf"],
      ["रक्त परीक्षण", "punarvasu-document.pdf"],
    ] as const) {
      const name = buildDownloadFileName(title, "application/pdf");
      expect(name, title).toBe(expected);
      expect(name).not.toContain("/");
      expect(name).not.toContain("\\");
      expect(name).not.toContain('"');
      expect(name).not.toContain("\r");
      expect(name).not.toContain("\n");
      expect(name.startsWith(".")).toBe(false);
    }
  });

  it("bounds the length, so a 10,000-character title cannot become a header", () => {
    const name = buildDownloadFileName("a".repeat(10_000), "application/pdf");
    expect(name.length).toBeLessThanOrEqual(85);
  });

  it("falls back to an inert extension for a type that is not on the list", () => {
    // Unreachable in practice — the stored type is always validated — and
    // the fallback is deliberately not `.html` or the empty string.
    expect(buildDownloadFileName("Report", "image/svg+xml")).toBe("Report.bin");
  });
});
