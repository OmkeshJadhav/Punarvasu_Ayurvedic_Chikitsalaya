import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CARE_SEARCH_MAX_LENGTH,
  DOCTOR_APPOINTMENT_RANGES,
  carePatientSearchSchema,
  doctorAppointmentFilterSchema,
  doctorDaySchema,
  doctorStatusSchema,
} from "./validation";

/**
 * The trust boundary of the doctor workspace.
 *
 * Every hostile field is asserted **one at a time**, and the assertion is
 * that the submission is *rejected* rather than that the field is dropped. A
 * rejected request shows up in a log; a quietly dropped field is how a
 * trusted value starts being read from the request two phases later.
 *
 * The values that matter most here are the ones that would be a claim about
 * *identity* — `doctorId`, `practitionerId` — because `phase_11.md` example
 * 2 is explicit that a doctor id in a request body must never be trusted. The
 * schemas have no field for one, so the strongest possible statement is
 * available: it is not that they are ignored, it is that a request carrying
 * one does not parse.
 */

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const SOURCE = readFileSync(
  new URL("./validation.ts", import.meta.url),
  "utf8",
);

const SCHEMAS = [
  ["carePatientSearchSchema", carePatientSearchSchema],
  ["doctorStatusSchema", doctorStatusSchema],
  ["doctorAppointmentFilterSchema", doctorAppointmentFilterSchema],
  ["doctorDaySchema", doctorDaySchema],
] as const;

describe("no schema has a field that would confer identity or authority", () => {
  /**
   * The names a request would use to claim to be somebody, or to claim a
   * capability. `phase_11.md` sections 4, 43, 47 and 59.
   */
  const FORBIDDEN = [
    "doctorId",
    "doctor_id",
    "practitionerId",
    "practitioner_id",
    "userId",
    "profileId",
    "role",
    "permission",
    "isAdmin",
    "actorRole",
  ];

  for (const [name, schema] of SCHEMAS) {
    for (const field of FORBIDDEN) {
      it(`${name} rejects ${field}`, () => {
        const result = schema.safeParse({ [field]: VALID_UUID });
        expect(result.success).toBe(false);
      });
    }
  }

  it("names none of them anywhere in the module", () => {
    // Belt and braces: a schema could acquire one without a test being
    // written for it. The source itself is scanned, with comments stripped
    // so the prose explaining why they are forbidden does not trip it.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /\/\/[^\n]*/g,
      "",
    );

    for (const field of ["doctorId", "practitionerId", "profileId"]) {
      expect(code).not.toContain(field);
    }
  });
});

describe("no schema has a field for clinical content", () => {
  // `phase_11.md` sections 18, 53 and 54. There is nowhere in this workspace
  // to write a clinical record, and this asserts there is nowhere to *post*
  // one either — so a form that grew one would fail here rather than
  // silently accepting it and discarding it.
  const CLINICAL = [
    "diagnosis",
    "symptoms",
    "medications",
    "allergies",
    "medicalHistory",
    "prescription",
    "treatmentPlan",
    "notes",
    "clinicalNote",
    "assessment",
    "vitals",
    "bloodPressure",
  ];

  for (const [name, schema] of SCHEMAS) {
    for (const field of CLINICAL) {
      it(`${name} rejects ${field}`, () => {
        const result = schema.safeParse({ [field]: "something" });
        expect(result.success).toBe(false);
      });
    }
  }
});

describe("the status schema", () => {
  it("accepts the four statuses a practitioner may set", () => {
    for (const status of [
      "confirmed",
      "in_consultation",
      "completed",
      "no_show",
    ]) {
      const result = doctorStatusSchema.safeParse({
        appointmentId: VALID_UUID,
        status,
      });
      expect(result.success, status).toBe(true);
    }
  });

  it("rejects cancelling and checking in", () => {
    // Refused here, refused again by the database's allowlist, and refused a
    // third time by the transition trigger where the transition is illegal.
    for (const status of ["cancelled", "checked_in"]) {
      const result = doctorStatusSchema.safeParse({
        appointmentId: VALID_UUID,
        status,
      });
      expect(result.success, status).toBe(false);
    }
  });

  it("rejects a status that is not one at all", () => {
    for (const status of ["", "COMPLETED", "admin", "deleted", "*"]) {
      const result = doctorStatusSchema.safeParse({
        appointmentId: VALID_UUID,
        status,
      });
      expect(result.success, status).toBe(false);
    }
  });

  it("rejects an appointment id that is not a uuid", () => {
    for (const id of [
      "",
      "1",
      "not-a-uuid",
      "'; drop table appointments; --",
      "<script>alert(1)</script>",
      "../../etc/passwd",
      `${VALID_UUID} or 1=1`,
    ]) {
      const result = doctorStatusSchema.safeParse({
        appointmentId: id,
        status: "confirmed",
      });
      expect(result.success, id).toBe(false);
    }
  });

  it("has no field for a reason", () => {
    // None of the four transitions writes free text, so there is no
    // parameter for one in the database and no field for one here — which
    // also means there is no place on this path for a clinical note to be
    // typed.
    const result = doctorStatusSchema.safeParse({
      appointmentId: VALID_UUID,
      status: "completed",
      reason: "The patient reported improvement.",
    });
    expect(result.success).toBe(false);
  });

  it("has no field for a patient id, a time or a duration", () => {
    for (const extra of [
      { patientId: VALID_UUID },
      { startsAt: "2026-09-22T10:30:00+05:30" },
      { endsAt: "2026-09-22T11:15:00+05:30" },
      { duration: "45" },
      { durationMinutes: "45" },
    ]) {
      const result = doctorStatusSchema.safeParse({
        appointmentId: VALID_UUID,
        status: "confirmed",
        ...extra,
      });
      expect(result.success, JSON.stringify(extra)).toBe(false);
    }
  });
});

describe("the search schema", () => {
  it("accepts an ordinary term", () => {
    const result = carePatientSearchSchema.safeParse({ query: "Priya" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.query).toBe("Priya");
  });

  it("treats a short term as valid input that finds nothing", () => {
    // Somebody halfway through typing a name has not made a mistake. The
    // "too short" decision is the query layer's and the database's, not the
    // schema's.
    const result = carePatientSearchSchema.safeParse({ query: "P" });
    expect(result.success).toBe(true);
  });

  it("treats an empty box as valid input that finds nothing", () => {
    const result = carePatientSearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(true);
  });

  it("bounds the term", () => {
    const result = carePatientSearchSchema.safeParse({
      query: "a".repeat(CARE_SEARCH_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("has no field for a result count", () => {
    // The caller does not choose how many people come back. The database
    // clamps it, and there is no parameter here to ask with.
    for (const extra of [{ limit: "1000" }, { p_limit: "1000" }]) {
      const result = carePatientSearchSchema.safeParse({
        query: "Priya",
        ...extra,
      });
      expect(result.success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("has no field that would widen the scope", () => {
    for (const extra of [
      { all: "true" },
      { scope: "clinic" },
      { includeAll: "1" },
    ]) {
      const result = carePatientSearchSchema.safeParse({
        query: "Priya",
        ...extra,
      });
      expect(result.success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("keeps a hostile term as data rather than refusing it", () => {
    // A search term is searched for, not executed. The database takes it as
    // a parameter and escapes its wildcards, so `%` finds a percent sign
    // and a SQL fragment finds nothing.
    for (const term of ["%", "_", "'; drop table patients; --", "O'Brien"]) {
      const result = carePatientSearchSchema.safeParse({ query: term });
      expect(result.success, term).toBe(true);
    }
  });
});

describe("the appointment filter schema", () => {
  it("defaults to upcoming", () => {
    const result = doctorAppointmentFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.range).toBe("upcoming");
  });

  it("accepts each range", () => {
    for (const range of DOCTOR_APPOINTMENT_RANGES) {
      const result = doctorAppointmentFilterSchema.safeParse({ range });
      expect(result.success, range).toBe(true);
    }
  });

  it("rejects a range that is not one", () => {
    for (const range of ["everything", "all", "ALL", "1"]) {
      const result = doctorAppointmentFilterSchema.safeParse({ range });
      expect(result.success, range).toBe(false);
    }
  });

  it("treats an absent status or type as no filter", () => {
    const result = doctorAppointmentFilterSchema.safeParse({
      range: "past",
      status: "",
      appointmentTypeId: "all",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
      expect(result.data.appointmentTypeId).toBeUndefined();
    }
  });

  it("rejects an unrecognised status rather than interpreting it", () => {
    const result = doctorAppointmentFilterSchema.safeParse({
      range: "upcoming",
      status: "finished",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an appointment type that is not a uuid", () => {
    const result = doctorAppointmentFilterSchema.safeParse({
      range: "upcoming",
      appointmentTypeId: "'; drop table appointments; --",
    });
    expect(result.success).toBe(false);
  });

  it("has no field for a practitioner", () => {
    // `phase_11.md` section 12: a doctor can only see their own diary, so a
    // practitioner filter would be a control with one option — and a field
    // that accepted somebody else's id would be a claim about scope.
    const result = doctorAppointmentFilterSchema.safeParse({
      range: "upcoming",
      practitionerId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});

describe("the day schema", () => {
  it("accepts a clinic calendar date", () => {
    const result = doctorDaySchema.safeParse({ date: "2026-09-22" });
    expect(result.success).toBe(true);
  });

  it("accepts no date at all", () => {
    const result = doctorDaySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date rather than interpreting it", () => {
    for (const date of ["22-09-2026", "2026/09/22", "today", "2026-13-01x"]) {
      const result = doctorDaySchema.safeParse({ date });
      expect(result.success, date).toBe(false);
    }
  });
});
