import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_MIME_TYPES,
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_BUCKET,
  DOCUMENT_FIELD_LIMITS,
  DOCUMENT_LIST_LIMIT,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_SIZE_LABEL,
  SIGNED_URL_TTL_SECONDS,
  documentExtensionFor,
  formatFileSize,
  isAllowedMimeType,
  isPreviewableMimeType,
} from "./documents";

/**
 * The document configuration, against the migration that has to agree with
 * it.
 *
 * ## Why this reads SQL
 *
 * The same numbers exist in **three** places: this module, so the browser can
 * refuse a file before spending a minute uploading it; the check constraints
 * on `public.patient_documents`, which hold against any writer; and the
 * bucket's own `file_size_limit` and `allowed_mime_types`, which hold even
 * against a write that reached storage directly.
 *
 * Three copies of a rule is a divergence waiting to happen, and the failures
 * it produces here are concrete and user-visible:
 *
 *   * a client limit **larger** than the database's is a patient watching a
 *     9 MB scan upload and then being told it is too large;
 *   * a client limit **smaller** is a file the clinic would accept being
 *     refused for no reason;
 *   * a type on this allowlist but not on the bucket's is an upload that
 *     passes every application check and is refused by storage, leaving the
 *     compensation path to clean up after it every time.
 *
 * So this file parses the migration rather than restating it. A test that
 * restated the numbers would agree with a wrong migration.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260925120000_patient_documents.sql",
    import.meta.url,
  ),
  "utf8",
);

function sqlWithoutComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

const SQL = sqlWithoutComments(MIGRATION);

/** The MIME types named inside a given `in ( ... )` or `array[ ... ]` block. */
function quotedValues(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

describe("the allowed types", () => {
  it("are exactly the types the table's check constraint permits", () => {
    const match =
      /constraint patient_documents_mime_type_allowed check \(\s*mime_type in \(([\s\S]*?)\)\s*\)/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1] ?? "").sort()).toEqual(
      [...ALLOWED_MIME_TYPES].sort(),
    );
  });

  it("are exactly the types the bucket permits", () => {
    const match =
      /allowed_mime_types\s*\)\s*values \([\s\S]*?array\[([\s\S]*?)\]/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    expect(quotedValues(match?.[1] ?? "").sort()).toEqual(
      [...ALLOWED_MIME_TYPES].sort(),
    );
  });

  it("map to the same extensions the database derives", () => {
    // `patient_document_extension` is what builds the canonical storage path
    // inside the create functions, and `buildDocumentStoragePath` builds the
    // identical string in TypeScript. If the two extension tables disagree,
    // every upload of the affected type is refused with `PV041` — the path
    // the server wrote would not be the path the database recomputed.
    const body =
      /create function public\.patient_document_extension[\s\S]*?\$\$;/.exec(
        SQL,
      );
    expect(body).not.toBeNull();

    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(body?.[0]).toContain(
        `when '${mimeType}' then '${documentExtensionFor(mimeType)}'`,
      );
    }
  });

  it("contain nothing a browser could be made to execute", () => {
    // The rule this allowlist exists to hold. An SVG is a document that can
    // carry script, and rendering one from a patient's upload would be a
    // same-origin XSS on a healthcare portal; HTML and XML are the same
    // problem stated differently.
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(mimeType).not.toMatch(
        /svg|html|xml|javascript|ecmascript|x-msdownload|x-sh|octet-stream/i,
      );
    }
  });

  it("offer a preview only for the formats a browser renders inertly", () => {
    // A PDF and the three web image formats. HEIC is accepted for upload
    // because it is what an iPhone produces, and is deliberately **not**
    // previewable — no browser renders it, and an empty frame is worse than
    // an honest "download it to open it".
    expect(
      ALLOWED_MIME_TYPES.filter((type) => isPreviewableMimeType(type)).sort(),
    ).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

    expect(isPreviewableMimeType("image/heic")).toBe(false);
    expect(isPreviewableMimeType("image/heif")).toBe(false);
  });

  it("recognise only what is on the list", () => {
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    for (const rejected of [
      "image/svg+xml",
      "text/html",
      "application/xml",
      "application/x-msdownload",
      "application/octet-stream",
      "text/javascript",
      "application/zip",
      "",
      "APPLICATION/PDF",
    ]) {
      expect(isAllowedMimeType(rejected)).toBe(false);
      expect(isPreviewableMimeType(rejected)).toBe(false);
    }
  });

  it("are all offered to the file picker, by type and by extension", () => {
    // Some Android pickers match on extension and some iOS versions report
    // `image/heic` inconsistently, so both forms are in `accept`.
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(DOCUMENT_ACCEPT_ATTRIBUTE).toContain(mimeType);
      expect(DOCUMENT_ACCEPT_ATTRIBUTE).toContain(
        `.${documentExtensionFor(mimeType)}`,
      );
    }
  });
});

describe("the size limit", () => {
  it("equals the table's check constraint", () => {
    const match =
      /constraint patient_documents_file_size_range check \(\s*file_size between 1 and (\d+)\s*\)/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(MAX_DOCUMENT_BYTES);
  });

  it("equals the bucket's own limit", () => {
    const match =
      /values \(\s*'patient-documents',\s*'patient-documents',\s*false,\s*(\d+),/.exec(
        SQL,
      );

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(MAX_DOCUMENT_BYTES);
  });

  it("is described to the user in the same units it is enforced in", () => {
    expect(MAX_DOCUMENT_SIZE_LABEL).toBe("10.0 MB");
  });
});

describe("the field limits", () => {
  it("equal the table's check constraints", () => {
    const bounds: Readonly<Record<string, number>> = {
      patient_documents_title_length: DOCUMENT_FIELD_LIMITS.title,
      patient_documents_description_length: DOCUMENT_FIELD_LIMITS.description,
      patient_documents_file_name_length: DOCUMENT_FIELD_LIMITS.fileName,
      patient_documents_archive_reason_length:
        DOCUMENT_FIELD_LIMITS.archiveReason,
    };

    for (const [constraint, limit] of Object.entries(bounds)) {
      const match = new RegExp(
        `constraint ${constraint} check \\([\\s\\S]*?between 1 and (\\d+)`,
      ).exec(SQL);

      expect(match, `no constraint named ${constraint}`).not.toBeNull();
      expect(Number(match?.[1]), constraint).toBe(limit);
    }
  });
});

describe("the bucket", () => {
  it("is the one the migration creates, and it is private", () => {
    expect(DOCUMENT_BUCKET).toBe("patient-documents");
    expect(SQL).toMatch(
      /insert into storage\.buckets[\s\S]*?'patient-documents',\s*'patient-documents',\s*false,/,
    );
    // `do update` rather than `do nothing`: if the bucket already exists,
    // this migration must still be the thing that decides it is private.
    expect(SQL).toMatch(/on conflict \(id\) do update\s*set public = false/);
  });

  it("is never made public anywhere in the migration", () => {
    expect(SQL).not.toMatch(/public\s*=\s*true/);
    expect(SQL).not.toMatch(/getPublicUrl|public\/patient-documents/);
  });
});

describe("the signed URL lifetime", () => {
  it("is short", () => {
    // Section 32 rules out a long-lived link. Five minutes is long enough to
    // open a PDF on a slow connection and short enough that a URL left in a
    // shared browser is worthless within the length of a consultation.
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60);
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(600);
  });
});

describe("the list bound", () => {
  it("is bounded rather than unbounded", () => {
    expect(DOCUMENT_LIST_LIMIT).toBeGreaterThan(0);
    expect(DOCUMENT_LIST_LIMIT).toBeLessThanOrEqual(50);
  });
});

describe("formatFileSize", () => {
  it("is coarse enough to be read at a glance", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(2_517_113)).toBe("2.4 MB");
    expect(formatFileSize(MAX_DOCUMENT_BYTES)).toBe("10.0 MB");
  });

  it("does not render nonsense for a missing or impossible size", () => {
    expect(formatFileSize(Number.NaN)).toBe("—");
    expect(formatFileSize(-1)).toBe("—");
  });
});

describe("the type table itself", () => {
  it("gives every allowed type an extension and a label", () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      const entry = ALLOWED_DOCUMENT_TYPES[mimeType];
      expect(entry.extension).toMatch(/^[a-z0-9]{3,4}$/);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("uses extensions the storage-path check constraint can accept", () => {
    // The constraint requires `^[a-z0-9]{3,4}$`, so an extension outside that
    // shape would make every upload of its type unstorable.
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(documentExtensionFor(mimeType)).toMatch(/^[a-z0-9]{3,4}$/);
    }
  });
});
