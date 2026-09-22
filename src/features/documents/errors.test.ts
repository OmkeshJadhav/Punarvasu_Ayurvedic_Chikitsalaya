import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";
import type { FileRejectionReason } from "@/lib/documents/file-signature";
import {
  DOCUMENT_ERROR_CODES,
  FILE_REJECTION_LOG_EVENTS,
  FILE_REJECTION_MESSAGES,
  describeDocumentFailure,
} from "./errors";

/**
 * What may and may not cross the boundary out of the database and the
 * storage service.
 *
 * `phase_14.md` sections 50, 75 and 110, example 9, and `docs/SECURITY.md`
 * section 16.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260925120000_patient_documents.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

/** Every application-defined SQLSTATE the migration actually raises. */
const RAISED = new Set(
  [...SQL.matchAll(/errcode = '(PV\d{3})'/g)].map(
    (match) => match[1] as string,
  ),
);

describe("the error codes", () => {
  it("recognises every code the migration raises", () => {
    // A code the database raises and this module does not know becomes the
    // generic message, which would tell a patient "please try again" about
    // something trying again cannot fix.
    for (const code of RAISED) {
      expect(
        describeDocumentFailure({ code }).logEvent,
        `PV code ${code} is unhandled`,
      ).not.toBe("document.operation_failed");
    }
  });

  it("declares no code the migration does not raise", () => {
    // The other direction: a declared code nothing raises is dead copy that
    // outlives the behaviour it described.
    for (const code of Object.values(DOCUMENT_ERROR_CODES)) {
      expect(RAISED.has(code), `PV code ${code} is never raised`).toBe(true);
    }
  });

  it("uses a range disjoint from every earlier phase's", () => {
    // Phase 12 used PV015-PV019 and Phase 13 PV020-PV025 and PV030-PV035.
    // Overlapping would mean one feature's mapper describing another's
    // failure, which is how a prescription message ends up on a document.
    for (const code of Object.values(DOCUMENT_ERROR_CODES)) {
      const number = Number(code.slice(2));
      expect(number, code).toBeGreaterThanOrEqual(40);
      expect(number, code).toBeLessThanOrEqual(49);
    }
  });
});

describe("what a message may contain", () => {
  const codes = [
    ...Object.values(DOCUMENT_ERROR_CODES),
    "42501",
    "23505",
    "23514",
    "23502",
    "23503",
    "08006",
    undefined,
  ];

  it("never names a table, a policy, a bucket, a path or SQL", () => {
    for (const code of codes) {
      const failure = describeDocumentFailure(code ? { code } : null);

      for (const forbidden of [
        "patient_documents",
        "storage.objects",
        "patient-documents",
        "row-level security",
        "row level security",
        "policy",
        "constraint",
        "relation",
        "bucket",
        "postgres",
        "supabase",
        "select",
        "insert",
        "PV0",
        "42501",
        "23505",
        "patients/",
      ]) {
        expect(
          failure.message.toLowerCase(),
          `${String(code)} leaked ${forbidden}`,
        ).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("discards the provider's own text entirely", () => {
    const failure = describeDocumentFailure({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "patient_documents_storage_path_unique"',
      details: "Key (storage_path)=(patients/abc/documents/def/document.pdf)",
      hint: "check the bucket",
    });

    expect(failure.message).not.toContain("patient_documents");
    expect(failure.message).not.toContain("patients/abc");
    expect(failure.message).not.toContain("duplicate key");
  });

  it("says explicitly what happened to the file", () => {
    // Somebody who watched a 6 MB scan upload and then saw a red box needs
    // to know whether it is stored. "Something went wrong" leaves them
    // uploading it again.
    for (const code of Object.values(DOCUMENT_ERROR_CODES)) {
      const { message } = describeDocumentFailure({ code });
      expect(message, code).toMatch(
        /not saved|nothing has been (saved|changed|altered)|already been (uploaded|archived)|cannot be changed/i,
      );
    }

    expect(describeDocumentFailure(null).message).toMatch(/not saved/i);
  });

  it("reuses the project's own refusal copy for a privilege failure", () => {
    expect(describeDocumentFailure({ code: "42501" }).message).toBe(
      DEFAULT_USER_MESSAGE.forbidden,
    );
  });

  it("falls back safely for anything it has never seen", () => {
    for (const value of [
      null,
      undefined,
      "a string",
      new Error("relation patient_documents does not exist"),
      { code: 42501 },
      { code: "ZZZZZ" },
      {},
    ]) {
      const failure = describeDocumentFailure(value);
      expect(failure.logEvent).toBe("document.operation_failed");
      expect(failure.message).not.toContain("patient_documents");
    }
  });
});

describe("the log events", () => {
  it("are all namespaced, and none carries content", () => {
    for (const code of [...Object.values(DOCUMENT_ERROR_CODES), "42501"]) {
      const { logEvent } = describeDocumentFailure({ code });
      expect(logEvent).toMatch(/^document\.[a-z_]+$/);
    }
  });
});

describe("the file rejection messages", () => {
  const reasons: readonly FileRejectionReason[] = [
    "empty",
    "too_large",
    "unsupported_signature",
    "extension_mismatch",
    "declared_type_mismatch",
  ];

  it("covers every reason the inspector can return", () => {
    for (const reason of reasons) {
      expect(FILE_REJECTION_MESSAGES[reason], reason).toBeTruthy();
      expect(FILE_REJECTION_LOG_EVENTS[reason], reason).toMatch(
        /^document\.rejected_[a-z_]+$/,
      );
    }
  });

  it("tells the person what they can actually do about it", () => {
    // Unlike a policy refusal, a rejected file is the person's problem and
    // they can fix it — so naming the limit and the accepted formats is the
    // right thing to do rather than a disclosure.
    expect(FILE_REJECTION_MESSAGES.too_large).toContain("10.0 MB");
    expect(FILE_REJECTION_MESSAGES.unsupported_signature).toMatch(
      /PDF.*JPEG.*PNG.*WebP.*HEIC/,
    );
  });

  it("does not tell an attacker which of the three checks caught them", () => {
    // "The contents do not match the extension" is an invitation to try
    // again with a matching one. All three type failures read the same.
    expect(FILE_REJECTION_MESSAGES.extension_mismatch).toBe(
      FILE_REJECTION_MESSAGES.unsupported_signature,
    );
    expect(FILE_REJECTION_MESSAGES.declared_type_mismatch).toBe(
      FILE_REJECTION_MESSAGES.unsupported_signature,
    );
  });

  it("distinguishes them in the log, where the detail is useful and safe", () => {
    const events = reasons.map((reason) => FILE_REJECTION_LOG_EVENTS[reason]);
    expect(new Set(events).size).toBe(reasons.length);
  });
});
