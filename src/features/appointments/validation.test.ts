import { describe, expect, it } from "vitest";

import {
  availabilityQuerySchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  clinicDateSchema,
  instantSchema,
  rescheduleAppointmentSchema,
} from "./validation";

/**
 * Appointment input validation.
 *
 * The assertions that matter here are the negative ones. `phase_09.md` section
 * 70 asks that manipulating `patientId`, `practitionerId`, `appointmentId`,
 * `appointmentTypeId`, `status`, `startAt`, `endAt` and `duration` from the
 * browser fail — and the strongest form of "fail" is that the schema has no
 * field for the value, is `strict()`, and therefore **rejects** the request
 * rather than dropping the key.
 *
 * A rejected request is visible in a log. A silently dropped field is how a
 * trusted value starts being read from the request two phases later.
 */

const PRACTITIONER_ID = "11111111-1111-4111-8111-111111111111";
const TYPE_ID = "22222222-2222-4222-8222-222222222222";
const APPOINTMENT_ID = "33333333-3333-4333-8333-333333333333";
const STARTS_AT = "2026-09-22T10:30:00+05:30";

function booking(overrides: Record<string, unknown> = {}) {
  return {
    practitionerId: PRACTITIONER_ID,
    appointmentTypeId: TYPE_ID,
    startsAt: STARTS_AT,
    patientNote: "",
    ...overrides,
  };
}

describe("instantSchema", () => {
  it("accepts an instant that states its offset", () => {
    for (const value of [
      "2026-09-22T10:30:00+05:30",
      "2026-09-22T05:00:00Z",
      "2026-09-22T05:00:00.000Z",
      "2026-09-22T05:00Z",
      "2026-09-22T00:00:00-04:00",
    ]) {
      expect(instantSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects a local time with no timezone", () => {
    // This is the parse `phase_09.md` section 12 warns about: `Date.parse`
    // would resolve it against the *server's* timezone, so the same request
    // would mean different moments on different machines.
    for (const value of [
      "2026-09-22 10:30",
      "2026-09-22T10:30",
      "2026-09-22T10:30:00",
      "2026-09-22",
      "22/09/2026 10:30",
    ]) {
      expect(instantSchema.safeParse(value).success).toBe(false);
    }
  });

  it("rejects an instant that is well-formed but not a real moment", () => {
    expect(instantSchema.safeParse("2026-13-45T10:30:00Z").success).toBe(false);
    expect(instantSchema.safeParse("").success).toBe(false);
    expect(instantSchema.safeParse("x".repeat(200)).success).toBe(false);
  });
});

describe("clinicDateSchema", () => {
  it("accepts a real calendar date and rejects anything else", () => {
    expect(clinicDateSchema.safeParse("2026-09-22").success).toBe(true);
    expect(clinicDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(clinicDateSchema.safeParse("2026-9-22").success).toBe(false);
    expect(clinicDateSchema.safeParse("../../etc/passwd").success).toBe(false);
  });
});

describe("bookAppointmentSchema", () => {
  it("accepts a well-formed request", () => {
    const result = bookAppointmentSchema.safeParse(booking());
    expect(result.success).toBe(true);
    expect(result.data?.practitionerId).toBe(PRACTITIONER_ID);
    // An untouched optional field becomes absent, not an empty string.
    expect(result.data?.patientNote).toBeUndefined();
  });

  it("trims and keeps a real note", () => {
    const result = bookAppointmentSchema.safeParse(
      booking({ patientNote: "  I will bring my daughter.  " }),
    );
    expect(result.data?.patientNote).toBe("I will bring my daughter.");
  });

  it("bounds the note", () => {
    expect(
      bookAppointmentSchema.safeParse(booking({ patientNote: "a".repeat(501) }))
        .success,
    ).toBe(false);
    expect(
      bookAppointmentSchema.safeParse(booking({ patientNote: "a".repeat(500) }))
        .success,
    ).toBe(true);
  });

  /**
   * The field allowlist, asserted one hostile key at a time.
   *
   * Each of these is a value `phase_09.md` says a client must not control.
   * There is no field for any of them, the object is `strict()`, and the RPC
   * signature does not accept them either — so a request carrying one is
   * refused three times over.
   */
  it.each([
    ["patientId", "44444444-4444-4444-8444-444444444444"],
    ["patient_id", "44444444-4444-4444-8444-444444444444"],
    ["userId", "44444444-4444-4444-8444-444444444444"],
    ["profileId", "44444444-4444-4444-8444-444444444444"],
    ["status", "confirmed"],
    ["duration", 5],
    ["durationMinutes", 5000],
    ["endsAt", "2026-09-22T23:59:00+05:30"],
    ["blockedUntil", "2026-09-22T23:59:00+05:30"],
    ["internalNote", "anything"],
    ["createdAt", "2020-01-01T00:00:00Z"],
    ["createdBy", "44444444-4444-4444-8444-444444444444"],
    ["cancelledBy", "44444444-4444-4444-8444-444444444444"],
    ["role", "admin"],
    ["price", 0],
  ])("rejects a request carrying %s", (key, value) => {
    const result = bookAppointmentSchema.safeParse(booking({ [key]: value }));

    expect(result.success).toBe(false);
    // And the value is not silently kept under another name.
    expect(JSON.stringify(result.data ?? {})).not.toContain(String(value));
  });

  it("rejects a practitioner or type id that is not an identifier", () => {
    for (const hostile of [
      "",
      "not-a-uuid",
      "1; drop table appointments; --",
      "../../etc/passwd",
      "<script>alert(1)</script>",
      "11111111-1111-4111-8111-111111111111 or 1=1",
      "a".repeat(5000),
    ]) {
      expect(
        bookAppointmentSchema.safeParse(booking({ practitionerId: hostile }))
          .success,
      ).toBe(false);
      expect(
        bookAppointmentSchema.safeParse(booking({ appointmentTypeId: hostile }))
          .success,
      ).toBe(false);
    }
  });

  it("rejects a missing field rather than defaulting it", () => {
    for (const key of ["practitionerId", "appointmentTypeId", "startsAt"]) {
      const payload = booking();
      delete (payload as Record<string, unknown>)[key];
      expect(bookAppointmentSchema.safeParse(payload).success).toBe(false);
    }
  });

  it("has no field for anything clinical", () => {
    // A booking form is not a medical-history form (`phase_09.md` sections 24
    // and 52). The schema's shape is the assertion.
    const shape = Object.keys(bookAppointmentSchema.shape);
    expect(shape).toEqual([
      "practitionerId",
      "appointmentTypeId",
      "startsAt",
      "patientNote",
    ]);

    for (const clinical of [
      "symptoms",
      "diagnosis",
      "medications",
      "allergies",
      "medicalHistory",
      "reason",
      "complaint",
    ]) {
      expect(shape).not.toContain(clinical);
    }
  });
});

describe("cancelAppointmentSchema", () => {
  it("accepts an id with or without a reason", () => {
    expect(
      cancelAppointmentSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        reason: "",
      }).success,
    ).toBe(true);
    expect(
      cancelAppointmentSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        reason: "Away that week.",
      }).success,
    ).toBe(true);
  });

  it("bounds the reason", () => {
    expect(
      cancelAppointmentSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        reason: "a".repeat(301),
      }).success,
    ).toBe(false);
  });

  it("rejects a manipulated status or patient", () => {
    for (const key of ["status", "patientId", "cancelledBy", "cancelledAt"]) {
      expect(
        cancelAppointmentSchema.safeParse({
          appointmentId: APPOINTMENT_ID,
          reason: "",
          [key]: "anything",
        }).success,
      ).toBe(false);
    }
  });

  it("rejects an appointment id that is not an identifier", () => {
    for (const hostile of ["", "1 or 1=1", "../1", "%2e%2e%2f"]) {
      expect(
        cancelAppointmentSchema.safeParse({
          appointmentId: hostile,
          reason: "",
        }).success,
      ).toBe(false);
    }
  });
});

describe("rescheduleAppointmentSchema", () => {
  it("accepts an id and a new instant", () => {
    expect(
      rescheduleAppointmentSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        startsAt: STARTS_AT,
      }).success,
    ).toBe(true);
  });

  it("has no field for a duration or an end", () => {
    // A patient rescheduling must not be able to lengthen their own
    // appointment. The duration is re-read from the stored appointment type
    // inside `reschedule_appointment`.
    for (const key of ["endsAt", "duration", "durationMinutes", "status"]) {
      expect(
        rescheduleAppointmentSchema.safeParse({
          appointmentId: APPOINTMENT_ID,
          startsAt: STARTS_AT,
          [key]: 999,
        }).success,
      ).toBe(false);
    }
  });
});

describe("availabilityQuerySchema", () => {
  it("accepts a well-formed query and defaults the window to one day", () => {
    const result = availabilityQuerySchema.safeParse({
      practitionerId: PRACTITIONER_ID,
      appointmentTypeId: TYPE_ID,
      date: "2026-09-22",
    });

    expect(result.success).toBe(true);
    expect(result.data?.days).toBe(1);
  });

  it("bounds how much one request may ask for", () => {
    // Availability is the cheapest thing in this feature to abuse: it needs no
    // patient record and no booking. The database refuses a wider window too.
    for (const days of [0, -1, 15, 365, 100000]) {
      expect(
        availabilityQuerySchema.safeParse({
          practitionerId: PRACTITIONER_ID,
          appointmentTypeId: TYPE_ID,
          date: "2026-09-22",
          days,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects an unexpected parameter", () => {
    expect(
      availabilityQuerySchema.safeParse({
        practitionerId: PRACTITIONER_ID,
        appointmentTypeId: TYPE_ID,
        date: "2026-09-22",
        patientId: PRACTITIONER_ID,
      }).success,
    ).toBe(false);
  });
});
