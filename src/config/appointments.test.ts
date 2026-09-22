import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BOOKING_RULES,
  CANCELLATION_REASON_MAX_LENGTH,
  CLINIC_TIMEZONE,
  MAX_AVAILABILITY_WINDOW_DAYS,
  PATIENT_NOTE_MAX_LENGTH,
} from "./appointments";

/**
 * The scheduling configuration mirror.
 *
 * `src/config/appointments.ts` restates values whose authority is the
 * migration: the database is what actually refuses a booking made too soon,
 * too far ahead or off the slot grid. The application's copy exists so the
 * browser can grey out a date rather than let someone pick it and be told no.
 *
 * Two copies of a rule is a divergence waiting to happen, so this file reads
 * the SQL and asserts they agree. It is the same arrangement
 * `lib/design/palette.ts` has with `globals.css`, and the failure it prevents
 * is the same: a UI that confidently offers something the system will refuse.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260920120000_appointment_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The body of `appointment_booking_rules()`, where the numbers live. */
const RULES_BODY =
  /create function public\.appointment_booking_rules\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
    MIGRATION,
  )?.[1] ?? "";

/** Reads a value from the rules function by the comment that labels it. */
function sqlRule(comment: string): number {
  // The last rule in the list ends with `;` rather than `,`.
  const pattern = new RegExp(`(\\d+)::integer[,;]?\\s*--\\s*${comment}`);
  const match = pattern.exec(RULES_BODY);
  expect(
    match,
    `no rule commented "${comment}" in the migration`,
  ).not.toBeNull();
  return Number(match?.[1]);
}

describe("the clinic timezone", () => {
  it("matches the database", () => {
    const declared = /select '([^']+)'::text;/.exec(
      /create function public\.clinic_timezone\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
        MIGRATION,
      )?.[1] ?? "",
    )?.[1];

    expect(declared).toBe(CLINIC_TIMEZONE);
  });
});

describe("the booking rules", () => {
  it("found the rules function to compare against", () => {
    // Guards the guard: a regex that matched nothing would make every
    // assertion below vacuously pass.
    expect(RULES_BODY.length).toBeGreaterThan(0);
  });

  it("mirrors the minimum booking notice", () => {
    expect(BOOKING_RULES.minNoticeMinutes).toBe(
      sqlRule("minimum notice: 2 hours"),
    );
  });

  it("mirrors the booking horizon", () => {
    expect(BOOKING_RULES.maxHorizonDays).toBe(
      sqlRule("booking horizon: 90 days"),
    );
  });

  it("mirrors the slot grid", () => {
    expect(BOOKING_RULES.slotIntervalMinutes).toBe(
      sqlRule("slots are offered on a 15-minute grid"),
    );
  });

  it("mirrors the cancellation cutoff", () => {
    expect(BOOKING_RULES.cancellationCutoffMinutes).toBe(
      sqlRule("no cancellation cutoff; see the comment above"),
    );
  });

  it("mirrors the per-patient bound", () => {
    expect(BOOKING_RULES.maxActivePerPatient).toBe(
      sqlRule("concurrent upcoming requests one patient may hold"),
    );
  });

  it("records no cancellation cutoff, because the clinic has set none", () => {
    // `phase_09.md` section 28: where the clinic has not asked for a cutoff,
    // document the decision rather than invent a value. This asserts the
    // decision rather than a number — a patient may cancel any appointment
    // that has not yet started, and nothing silently traps them into
    // attending.
    expect(BOOKING_RULES.cancellationCutoffMinutes).toBe(0);
  });

  it("keeps every rule a sane, bounded number", () => {
    expect(BOOKING_RULES.minNoticeMinutes).toBeGreaterThanOrEqual(0);
    expect(BOOKING_RULES.maxHorizonDays).toBeGreaterThan(0);
    expect(BOOKING_RULES.slotIntervalMinutes).toBeGreaterThan(0);
    expect(BOOKING_RULES.maxActivePerPatient).toBeGreaterThan(0);

    // A slot grid that does not divide the hour would put appointments on
    // times nobody says out loud.
    expect(60 % BOOKING_RULES.slotIntervalMinutes).toBe(0);
  });
});

describe("text bounds", () => {
  it("match the database's own check constraints", () => {
    expect(MIGRATION).toContain(
      `char_length(patient_note) between 1 and ${PATIENT_NOTE_MAX_LENGTH}`,
    );
    expect(MIGRATION).toContain(
      `char_length(cancellation_reason) between 1 and ${CANCELLATION_REASON_MAX_LENGTH}`,
    );
  });
});

describe("the availability window", () => {
  it("is smaller than the booking horizon", () => {
    // One request must not be able to ask for the whole horizon in one go.
    expect(MAX_AVAILABILITY_WINDOW_DAYS).toBeLessThan(
      BOOKING_RULES.maxHorizonDays,
    );
    expect(MAX_AVAILABILITY_WINDOW_DAYS).toBeGreaterThan(0);
  });
});
