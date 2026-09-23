import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_ERROR_CODES,
  PROVIDER_ERROR_CODES,
  classifyProviderException,
  classifyProviderStatus,
  describeNotificationFailure,
} from "./errors";

/**
 * Failure to safe copy, and failure to a retry decision.
 *
 * Two separate questions, deliberately answered by two separate functions:
 * what a **person** is told, and what the **worker** does next. Keeping them
 * apart is what stops a provider's status code becoming a patient-facing
 * message by the shortest available route.
 */

/**
 * Every migration that raises a `PV05x`.
 *
 * Read together, because the feature's error vocabulary is spread across
 * them: `20260930120000` both re-raises PV050 in the replaced
 * `create_notification` and introduces PV056. A test that read only the first
 * file would report a code as undeclared when it is in fact raised, and would
 * miss one raised only by the newer one.
 */
const MIGRATION = [
  "20260926120000_notifications.sql",
  "20260926130000_notification_function_grants_fix.sql",
  "20260926140000_notification_preference_reader_gate.sql",
  "20260930120000_doctor_notifications.sql",
]
  .map((name) =>
    readFileSync(
      new URL(`../../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    ),
  )
  .join("\n");

describe("the error codes", () => {
  it("are all raised by the migration", () => {
    // A declared code the database never raises is a branch nothing can
    // reach, and it rots.
    for (const code of Object.values(NOTIFICATION_ERROR_CODES)) {
      expect(MIGRATION, `${code} is declared but never raised`).toContain(
        `errcode = '${code}'`,
      );
    }
  });

  it("cover every code the migration raises", () => {
    // The other direction, which is the one that matters: a code the
    // database raises and this module does not know becomes a generic
    // message where a specific one was available.
    const raised = new Set(
      [...MIGRATION.matchAll(/errcode = '(PV\d+)'/g)].map(
        (match) => match[1] ?? "",
      ),
    );

    const known = new Set<string>(Object.values(NOTIFICATION_ERROR_CODES));

    for (const code of raised) {
      expect(known.has(code), `${code} is raised but unmapped`).toBe(true);
    }
  });

  it("occupy a range no other phase uses", () => {
    // PV001-PV019 appointments and clinical records, PV020-PV034
    // prescriptions and plans, PV040-PV046 documents.
    for (const code of Object.values(NOTIFICATION_ERROR_CODES)) {
      const number = Number(code.slice(2));
      expect(number).toBeGreaterThanOrEqual(50);
      expect(number).toBeLessThanOrEqual(59);
    }
  });
});

describe("describeNotificationFailure", () => {
  it("never lets a database message reach a person", () => {
    const failure = describeNotificationFailure({
      code: "42P01",
      message: 'relation "public.notification_outbox" does not exist',
      details: "at character 15",
      hint: "Perhaps you meant notifications",
    });

    expect(failure.message).not.toContain("relation");
    expect(failure.message).not.toContain("notification_outbox");
    expect(failure.message).not.toContain("42P01");
    expect(failure.message).not.toContain("character");
  });

  it("never lets a policy failure describe the schema", () => {
    const failure = describeNotificationFailure({
      code: "42501",
      message: "permission denied for table notifications",
    });

    expect(failure.message).not.toContain("permission denied");
    expect(failure.message).not.toContain("table");
    expect(failure.message).not.toContain("notifications");
  });

  it("explains a mandatory channel rather than refusing silently", () => {
    const failure = describeNotificationFailure({
      code: NOTIFICATION_ERROR_CODES.mandatoryChannel,
    });

    // Section 22. A patient who cannot switch something off deserves to be
    // told why, and to be told what they *can* switch off.
    expect(failure.message.toLowerCase()).toContain("care");
    expect(failure.message.toLowerCase()).toContain("email");
  });

  it("says nothing changed when nothing changed", () => {
    const failure = describeNotificationFailure({ code: "08006" });
    expect(failure.message.toLowerCase()).toContain("nothing has been changed");
  });

  it("produces a stable low-cardinality log event", () => {
    for (const code of Object.values(NOTIFICATION_ERROR_CODES)) {
      const failure = describeNotificationFailure({ code });
      expect(failure.logEvent).toMatch(/^notification\.[a-z_]+$/);
    }
  });

  it("handles a thrown value that is not an error object", () => {
    for (const thrown of [null, undefined, "boom", 42, [], {}]) {
      const failure = describeNotificationFailure(thrown);
      expect(failure.message.length).toBeGreaterThan(0);
      expect(failure.logEvent).toBe("notification.operation_failed");
    }
  });
});

describe("classifyProviderStatus", () => {
  it("retries a rate limit", () => {
    // Section 45. The provider was willing to take this a minute later;
    // throwing it away is a message nobody receives.
    const failure = classifyProviderStatus(429);
    expect(failure.kind).toBe("transient");
    expect(failure.errorCode).toBe("provider_rate_limited");
  });

  it.each([500, 502, 503, 504])("retries a %i", (status) => {
    expect(classifyProviderStatus(status).kind).toBe("transient");
  });

  it.each([401, 403])("does not retry an auth failure (%i)", (status) => {
    // A revoked or misconfigured credential is not fixed by trying again,
    // and hammering an authentication endpoint is how a key gets locked.
    const failure = classifyProviderStatus(status);
    expect(failure.kind).toBe("permanent");
    expect(failure.errorCode).toBe("provider_auth_failed");
  });

  it("recognises an invalid recipient and does not retry it", () => {
    // EmailJS's own wording when a template's recipient field is wrong.
    const failure = classifyProviderStatus(
      422,
      "The recipients address is empty",
    );
    expect(failure.kind).toBe("permanent");
    expect(failure.errorCode).toBe("invalid_recipient");
  });

  it("does not retry an ordinary rejection", () => {
    const failure = classifyProviderStatus(400, "Bad template id");
    expect(failure.kind).toBe("permanent");
    expect(failure.errorCode).toBe("provider_rejected");
  });

  it("produces only codes that are declared, and that fit the column", () => {
    const codes = [
      classifyProviderStatus(429),
      classifyProviderStatus(500),
      classifyProviderStatus(401),
      classifyProviderStatus(422, "recipient"),
      classifyProviderStatus(400),
      classifyProviderException(
        Object.assign(new Error(), { name: "TimeoutError" }),
      ),
      classifyProviderException(new Error("ECONNRESET")),
    ];

    for (const failure of codes) {
      expect(PROVIDER_ERROR_CODES).toContain(failure.errorCode);
      // `notification_deliveries_error_code_shape`.
      expect(failure.errorCode).toMatch(/^[a-z0-9_]{1,64}$/);
    }
  });
});

describe("classifyProviderException", () => {
  it("retries a timeout", () => {
    const failure = classifyProviderException(
      Object.assign(new Error("timed out"), { name: "TimeoutError" }),
    );
    expect(failure.kind).toBe("transient");
    expect(failure.errorCode).toBe("provider_timeout");
  });

  it("retries an abort", () => {
    const failure = classifyProviderException(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    expect(failure.kind).toBe("transient");
  });

  it("retries an unreachable provider", () => {
    expect(classifyProviderException(new Error("ENOTFOUND")).kind).toBe(
      "transient",
    );
  });

  it("carries none of the thrown message into the code", () => {
    // Section 77. A provider error can echo the request back, which for this
    // feature means an address and a live link.
    const failure = classifyProviderException(
      new Error("failed to POST to api.emailjs.com for patient@example.test"),
    );

    expect(failure.errorCode).not.toContain("@");
    expect(failure.errorCode).not.toContain("emailjs.com");
    expect(failure.errorCode).toMatch(/^[a-z0-9_]+$/);
  });
});
