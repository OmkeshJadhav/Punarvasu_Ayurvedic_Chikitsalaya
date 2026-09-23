import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_REMINDER_OFFSETS_MINUTES,
  NOTIFICATION_AUDIENCE_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_RETRY,
  NOTIFICATION_WORKER,
  UNREAD_COUNT_CAP,
  isMandatoryChannel,
  notificationAudienceForRole,
  notificationCategoryCopy,
} from "./notifications";
import type {
  NotificationAudience,
  NotificationCategory,
} from "@/features/notifications/types";
import type { AppRole } from "@/types/database";

/**
 * The notification configuration mirror.
 *
 * `src/config/notifications.ts` restates values whose authority is the
 * migration: `notification_reminder_offsets()` is what the reminder planner
 * actually reads, and `set_notification_preference` is what actually refuses
 * to switch a mandatory channel off. The application's copies exist so a
 * preference control can be rendered disabled rather than offered and then
 * refused.
 *
 * Two copies of a rule is a divergence waiting to happen, so this file reads
 * the SQL and asserts they agree — the same arrangement `config/appointments.
 * test.ts` and `config/documents.test.ts` have, and the failure it prevents is
 * the same: a UI that confidently offers something the system will refuse.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260926120000_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the migration this mirrors", () => {
  it("is the file the test thinks it is", () => {
    // A mirror test that silently reads an empty string passes everything.
    expect(MIGRATION.length).toBeGreaterThan(5_000);
    expect(MIGRATION).toContain("create table public.notifications");
  });
});

describe("the reminder schedule", () => {
  it("matches the database", () => {
    const body =
      /create function public\.notification_reminder_offsets\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const declared = /array\[([0-9,\s]+)\]::integer\[\]/.exec(body)?.[1];
    expect(declared, "no offsets array in the migration").toBeDefined();

    const offsets = (declared ?? "")
      .split(",")
      .map((value) => Number(value.trim()));

    expect(offsets).toEqual([...APPOINTMENT_REMINDER_OFFSETS_MINUTES]);
  });

  it("is traceable to the specification's own example", () => {
    // 24 hours and 2 hours, from `phase_15.md` section 28. The clinic has
    // confirmed no reminder policy, so a number nobody can trace to a
    // document would be an invented clinical-operations rule.
    expect(APPOINTMENT_REMINDER_OFFSETS_MINUTES).toEqual([24 * 60, 2 * 60]);
  });

  it("offers no reminder so far ahead that the schedule constraint refuses it", () => {
    // `notifications_reminder_offset_range` bounds the column at 14 days.
    for (const offset of APPOINTMENT_REMINDER_OFFSETS_MINUTES) {
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(20160);
    }
  });
});

describe("the channels", () => {
  it("are exactly the ones the database enum declares", () => {
    const declared =
      /create type public\.notification_channel as enum \(([^)]*)\)/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect(values).toEqual([...NOTIFICATION_CHANNELS]);
  });

  it("does not include a channel nothing can deliver on", () => {
    // `phase_15.md` section 14: do not pretend an unconfigured channel
    // works. No SMS or WhatsApp provider exists for this project, so neither
    // value exists anywhere — not here, not in the enum, not as an adapter.
    expect(NOTIFICATION_CHANNELS).not.toContain("sms");
    expect(NOTIFICATION_CHANNELS).not.toContain("whatsapp");
    expect(MIGRATION).not.toMatch(/'whatsapp'/);
    expect(
      /create type public\.notification_channel as enum \(([^)]*)\)/.exec(
        MIGRATION,
      )?.[1],
    ).not.toMatch(/'sms'/);
  });
});

describe("mandatory categories", () => {
  it("match the database's own rule", () => {
    const body =
      /create function public\.notification_category_is_mandatory\([\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const declared = [...body.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    const mirrored = (
      Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]
    ).filter((category) =>
      NOTIFICATION_CATEGORIES[category].mandatoryChannels.includes("in_app"),
    );

    expect([...declared].sort()).toEqual([...mirrored].sort());
  });

  it("covers every category the database enum declares", () => {
    const declared =
      /create type public\.notification_category as enum \(([^)]*)\)/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect([...values].sort()).toEqual(
      Object.keys(NOTIFICATION_CATEGORIES).sort(),
    );
  });

  it("makes the two transactional categories mandatory in app and optional by email", () => {
    // Section 22. Operational information has to reach the patient
    // somewhere; email is never that somewhere, because an email channel can
    // be unconfigured, undeliverable or switched off by the patient.
    expect(isMandatoryChannel("appointment_updates", "in_app")).toBe(true);
    expect(isMandatoryChannel("clinical_updates", "in_app")).toBe(true);
    expect(isMandatoryChannel("appointment_updates", "email")).toBe(false);
    expect(isMandatoryChannel("clinical_updates", "email")).toBe(false);
  });

  it("leaves reminders entirely optional", () => {
    // A reminder is a convenience. Section 22 draws the line between
    // necessary operational communication and everything else, and a
    // reminder is on the far side of it.
    expect(isMandatoryChannel("appointment_reminders", "in_app")).toBe(false);
    expect(isMandatoryChannel("appointment_reminders", "email")).toBe(false);
  });

  it("describes every category in words a patient can act on", () => {
    for (const rule of Object.values(NOTIFICATION_CATEGORIES)) {
      expect(rule.label.length).toBeGreaterThan(3);
      expect(rule.description.length).toBeGreaterThan(30);
    }
  });
});

describe("no marketing exists", () => {
  it("declares no promotional category", () => {
    // Sections 23 and 24. There is no marketing, no campaign and nothing to
    // consent to, and the absence is asserted so adding one is a deliberate
    // change to a test that says why it was there.
    const names = Object.keys(NOTIFICATION_CATEGORIES).join(" ");
    expect(names).not.toMatch(
      /marketing|promo|campaign|newsletter|offer|announcement/i,
    );
  });
});

describe("bounds", () => {
  it("pages the notification list rather than loading everything", () => {
    // Section 94.
    expect(NOTIFICATION_PAGE_SIZE).toBeGreaterThan(0);
    expect(NOTIFICATION_PAGE_SIZE).toBeLessThanOrEqual(50);
  });

  it("caps the unread count", () => {
    expect(UNREAD_COUNT_CAP).toBeGreaterThan(0);
    expect(UNREAD_COUNT_CAP).toBeLessThanOrEqual(999);
  });

  it("bounds every worker batch", () => {
    // Section 136: the worker must not repeatedly query unbounded data.
    expect(NOTIFICATION_WORKER.outboxBatchSize).toBeGreaterThan(0);
    expect(NOTIFICATION_WORKER.deliveryBatchSize).toBeGreaterThan(0);
    expect(NOTIFICATION_WORKER.reminderBatchSize).toBeGreaterThan(0);
    expect(NOTIFICATION_WORKER.leaseSeconds).toBeGreaterThanOrEqual(10);
  });

  it("stops retrying", () => {
    // Section 46: do not retry permanent failures indefinitely — and do not
    // retry anything indefinitely either.
    expect(NOTIFICATION_RETRY.maxAttempts).toBeGreaterThan(1);
    expect(NOTIFICATION_RETRY.maxAttempts).toBeLessThanOrEqual(10);
    expect(NOTIFICATION_RETRY.backoffSeconds.length).toBeGreaterThan(0);
    for (const seconds of NOTIFICATION_RETRY.backoffSeconds) {
      expect(seconds).toBeGreaterThan(0);
    }
  });

  it("backs off further each time", () => {
    const sorted = [...NOTIFICATION_RETRY.backoffSeconds].sort((a, b) => a - b);
    expect([...NOTIFICATION_RETRY.backoffSeconds]).toEqual(sorted);
  });
});

/* ------------------------------------------------------------------------ */
/* Audiences                                                                 */
/* ------------------------------------------------------------------------ */

describe("the audiences", () => {
  const AUDIENCES: readonly NotificationAudience[] = [
    "patient",
    "practitioner",
  ];

  it("covers every value the database enum declares", () => {
    const audienceMigration = readFileSync(
      new URL(
        "../../supabase/migrations/20260930120000_doctor_notifications.sql",
        import.meta.url,
      ),
      "utf8",
    );

    const declared =
      /create type public\.notification_audience as enum \(([^)]*)\)/.exec(
        audienceMigration,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect([...values].sort()).toEqual([...AUDIENCES].sort());
    expect(Object.keys(NOTIFICATION_AUDIENCE_CATEGORIES).sort()).toEqual(
      [...AUDIENCES].sort(),
    );
  });

  it("offers each audience only categories that exist", () => {
    for (const audience of AUDIENCES) {
      for (const category of NOTIFICATION_AUDIENCE_CATEGORIES[audience]) {
        expect(
          NOTIFICATION_CATEGORIES[category],
          `${audience} is offered an unknown category ${category}`,
        ).toBeDefined();
      }
    }
  });

  it("gives a patient every category and a practitioner only their day", () => {
    // Sections 56 and 61: staff are not flooded. A practitioner is sent no
    // reminder and no clinical update, so neither is offered as a control
    // over messages nobody will ever send them.
    expect([...NOTIFICATION_AUDIENCE_CATEGORIES.patient].sort()).toEqual(
      Object.keys(NOTIFICATION_CATEGORIES).sort(),
    );
    expect(NOTIFICATION_AUDIENCE_CATEGORIES.practitioner).toEqual([
      "appointment_updates",
    ]);
  });

  it("maps only the doctor role to the practitioner audience", () => {
    const roles: readonly AppRole[] = [
      "patient",
      "doctor",
      "receptionist",
      "admin",
    ];

    for (const role of roles) {
      expect(notificationAudienceForRole(role)).toBe(
        role === "doctor" ? "practitioner" : "patient",
      );
    }

    // An unresolved role gets the neutral wording rather than a throw.
    expect(notificationAudienceForRole(null)).toBe("patient");
  });

  it("gives every offered category words for the audience reading them", () => {
    for (const audience of AUDIENCES) {
      for (const category of NOTIFICATION_AUDIENCE_CATEGORIES[audience]) {
        const copy = notificationCategoryCopy(category, audience);
        expect(copy.label.length).toBeGreaterThan(0);
        expect(copy.description.length).toBeGreaterThan(0);
      }
    }

    // And they are genuinely different words where both read the same
    // category — "part of your care" is written for the person being cared
    // for, not for the person providing it.
    const patients = notificationCategoryCopy("appointment_updates", "patient");
    const theirs = notificationCategoryCopy(
      "appointment_updates",
      "practitioner",
    );

    expect(theirs.description).not.toBe(patients.description);
    expect(theirs.description.toLowerCase()).not.toContain("your care");
  });

  it("keeps a practitioner's one category mandatory in app", () => {
    // Section 22. A change to somebody's working day made by the front desk
    // has to reach them somewhere, and the in-app record is that somewhere.
    expect(isMandatoryChannel("appointment_updates", "in_app")).toBe(true);
  });
});
