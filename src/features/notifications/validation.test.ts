import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  markNotificationReadSchema,
  parseNotificationCursor,
  parseNotificationFilter,
  setNotificationPreferenceSchema,
} from "./validation";

/**
 * The trust boundary.
 *
 * `phase_15.md` section 129 asks for an attempt to manipulate
 * `recipientUserId`, `recipientEmail`, `recipientPhone`, `channel`,
 * `template` and `body` from the browser, and for the server to ignore or
 * reject every one.
 *
 * Every hostile field below is asserted **one at a time**, so a failure names
 * the field that got through. And each is **rejected rather than stripped**: a
 * rejected request is visible in a log, and a dropped field is how a
 * capability arrives by accident.
 */

const NOTIFICATION_ID = "7d1f6c0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

/**
 * Everything section 129 names, plus everything a caller might try if they
 * had read the schema.
 */
const HOSTILE_FIELDS: Readonly<Record<string, string>> = {
  recipientUserId: "00000000-0000-4000-8000-000000000000",
  recipientEmail: "attacker@example.test",
  recipientPhone: "+919999999999",
  recipientId: "00000000-0000-4000-8000-000000000000",
  userId: "00000000-0000-4000-8000-000000000000",
  to: "victim@example.test",
  subject: "Your test results are ready",
  body: "Take 500mg twice daily",
  title: "Prescription details",
  template: "appointment_confirmed",
  templateVersion: "99",
  linkPath: "/patient/appointments/other",
  url: "https://evil.test/steal",
  status: "active",
  eventType: "prescription_issued",
  provider: "emailjs",
  deliveryStatus: "sent",
  scheduledFor: "2026-01-01T00:00:00.000Z",
  role: "admin",
  permission: "roles.manage",
  isAdmin: "true",
};

describe("markNotificationReadSchema", () => {
  it("accepts an id and nothing else", () => {
    const parsed = markNotificationReadSchema.safeParse({
      notificationId: NOTIFICATION_ID,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data)).toEqual([
      "notificationId",
    ]);
  });

  it.each(Object.entries(HOSTILE_FIELDS))(
    "rejects a request carrying %s",
    (field, value) => {
      const parsed = markNotificationReadSchema.safeParse({
        notificationId: NOTIFICATION_ID,
        [field]: value,
      });

      // Rejected, not stripped.
      expect(parsed.success, `${field} was accepted`).toBe(false);
    },
  );

  it.each([
    "not-a-uuid",
    "../../etc/passwd",
    "' or 1=1 --",
    "<script>alert(1)</script>",
    "",
    " ",
  ])("refuses %j as an identifier", (value) => {
    expect(
      markNotificationReadSchema.safeParse({ notificationId: value }).success,
    ).toBe(false);
  });
});

describe("setNotificationPreferenceSchema", () => {
  it("accepts a category, a channel and an explicit value", () => {
    const parsed = setNotificationPreferenceSchema.safeParse({
      category: "appointment_reminders",
      channel: "email",
      enabled: "false",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.enabled).toBe(false);
    expect(parsed.success && Object.keys(parsed.data).sort()).toEqual([
      "category",
      "channel",
      "enabled",
    ]);
  });

  it.each(Object.entries(HOSTILE_FIELDS))(
    "rejects a request carrying %s",
    (field, value) => {
      const parsed = setNotificationPreferenceSchema.safeParse({
        category: "appointment_reminders",
        channel: "email",
        enabled: "false",
        [field]: value,
      });

      expect(parsed.success, `${field} was accepted`).toBe(false);
    },
  );

  it("refuses a channel that does not exist", () => {
    // No SMS or WhatsApp provider is configured, so neither channel exists
    // anywhere — not here, not in the enum, not as an adapter
    // (`phase_15.md` section 14).
    for (const channel of ["sms", "whatsapp", "push", "post", "telegram"]) {
      expect(
        setNotificationPreferenceSchema.safeParse({
          category: "appointment_updates",
          channel,
          enabled: "true",
        }).success,
        `${channel} was accepted`,
      ).toBe(false);
    }
  });

  it("refuses a category that does not exist", () => {
    for (const category of [
      "marketing",
      "promotions",
      "newsletter",
      "everything",
    ]) {
      expect(
        setNotificationPreferenceSchema.safeParse({
          category,
          channel: "email",
          enabled: "true",
        }).success,
        `${category} was accepted`,
      ).toBe(false);
    }
  });

  it("refuses an ambiguous value for `enabled`", () => {
    // A checkbox posts "on" or nothing, which would make "absent" and "off"
    // the same request. The schema requires a literal.
    for (const value of ["on", "off", "1", "0", "yes", "", true, false, null]) {
      expect(
        setNotificationPreferenceSchema.safeParse({
          category: "appointment_updates",
          channel: "email",
          enabled: value,
        }).success,
        `${String(value)} was accepted`,
      ).toBe(false);
    }
  });
});

describe("the schemas carry no field that could confer authority", () => {
  it("names no recipient, no content and no status anywhere in the module", () => {
    // Structural rather than behavioural: the point is that these concepts
    // are absent from the source, not merely rejected at runtime.
    const source = readFileSync(
      new URL("./validation.ts", import.meta.url),
      "utf8",
    );

    // The docblock names them deliberately, to say they are absent. Strip
    // the comments and assert against the code.
    const code = source
      .replace(/\/\*\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    for (const forbidden of [
      "recipient",
      "recipientEmail",
      "recipientPhone",
      "userId",
      "subject",
      "body",
      "title",
      "linkPath",
      "provider",
    ]) {
      expect(code, `${forbidden} appears in the schema module`).not.toContain(
        forbidden,
      );
    }
  });

  it("has no schema for creating or sending a notification", () => {
    const source = readFileSync(
      new URL("./validation.ts", import.meta.url),
      "utf8",
    );

    // Section 109: no arbitrary notification-sending surface exists, and the
    // absence of a schema for one is the first place that is visible.
    expect(source).not.toMatch(/createNotificationSchema/);
    expect(source).not.toMatch(/sendNotificationSchema/);
  });
});

describe("parseNotificationFilter", () => {
  it("recognises the two filters", () => {
    expect(parseNotificationFilter("unread")).toBe("unread");
    expect(parseNotificationFilter("all")).toBe("all");
  });

  it("falls back to all rather than failing", () => {
    // A mistyped URL should show a list, not an error.
    for (const value of [undefined, null, "", "UNREAD", "everything", 42, []]) {
      expect(parseNotificationFilter(value)).toBe("all");
    }
  });
});

describe("parseNotificationCursor", () => {
  it("accepts an ISO instant and normalises it", () => {
    expect(parseNotificationCursor("2026-09-19T10:00:00.000Z")).toBe(
      "2026-09-19T10:00:00.000Z",
    );
  });

  it("rejects anything that is not a date", () => {
    for (const value of [
      undefined,
      null,
      "",
      "yesterday",
      "' or 1=1 --",
      "<script>",
      "x".repeat(200),
      123,
      {},
    ]) {
      expect(parseNotificationCursor(value)).toBeNull();
    }
  });

  it("bounds the length before parsing", () => {
    expect(parseNotificationCursor("2026-09-19T10:00:00.000Z".repeat(10))).toBe(
      null,
    );
  });
});
