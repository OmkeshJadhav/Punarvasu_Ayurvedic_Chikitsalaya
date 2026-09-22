import { describe, expect, it } from "vitest";

import {
  createPatientSchema,
  patientSearchSchema,
  scheduleFilterSchema,
  staffBookingSchema,
  staffRescheduleSchema,
  staffStatusSchema,
} from "./validation";

/**
 * The receptionist trust boundary.
 *
 * Every schema here is run by the browser for feedback and by the server for
 * authority, and these tests are about the second job. The property that
 * matters most is not that valid input is accepted — it is that a field the
 * front desk must not control is **rejected** rather than silently stripped,
 * because a rejected request shows up in a log and a dropped field is how a
 * trusted value starts being read from the request two phases later.
 */

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const PRACTITIONER_ID = "22222222-2222-4222-8222-222222222222";
const TYPE_ID = "33333333-3333-4333-8333-333333333333";
const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
const STARTS_AT = "2026-09-22T10:30:00+05:30";

describe("createPatientSchema", () => {
  it("accepts a walk-in with nothing but a name", () => {
    // A receptionist registering somebody who has just arrived should not be
    // blocked from booking them because they have not been asked for a
    // postcode.
    const result = createPatientSchema.safeParse({ fullName: "Test Patient" });

    expect(result.success).toBe(true);
    expect(result.success && result.data.fullName).toBe("Test Patient");
    expect(result.success && result.data.phone).toBeUndefined();
  });

  it("requires a name", () => {
    for (const fullName of ["", "   ", "\t"]) {
      expect(createPatientSchema.safeParse({ fullName }).success).toBe(false);
    }
  });

  it.each([
    "profileId",
    "userId",
    "id",
    "role",
    "email",
    "password",
    "createdAt",
    "updatedAt",
    "createdBy",
  ])("rejects a submission carrying %s rather than dropping it", (field) => {
    // `phase_10.md` sections 34-35. A receptionist must not be able to assign
    // an owner, create an account, invent a credential or grant a role — and
    // the schema refusing outright is what makes that visible rather than
    // quiet.
    const result = createPatientSchema.safeParse({
      fullName: "Test Patient",
      [field]: "anything",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    "diagnosis",
    "symptoms",
    "medications",
    "allergies",
    "medicalHistory",
    "treatmentPlan",
    "prescription",
    "clinicalNotes",
  ])("rejects a submission carrying the clinical field %s", (field) => {
    // The hard boundary of `phase_10.md` sections 4 and 14. There is nowhere
    // for this to go in the database either — `public.patients` has no such
    // column and Phase 07's migration says none may be added — but refusing it
    // here means an attempt is a rejected request rather than a silent no-op.
    const result = createPatientSchema.safeParse({
      fullName: "Test Patient",
      [field]: "anything",
    });

    expect(result.success).toBe(false);
  });

  it("has no field whose name suggests clinical content", () => {
    const fields = Object.keys(createPatientSchema._def.shape ?? {});
    expect(fields.length).toBeGreaterThan(0);

    for (const field of fields) {
      expect(field).not.toMatch(
        /diagnos|symptom|medicat|allerg|prescrib|prescript|treatment|clinical|condition|history/i,
      );
    }
  });

  it("has no field that could confer authority", () => {
    const fields = Object.keys(createPatientSchema._def.shape ?? {});

    for (const field of fields) {
      expect(field).not.toMatch(/role|permission|profileid|userid|password/i);
    }
  });

  it("accepts a landline or an international number, not only a mobile", () => {
    // Deliberately more tolerant than the patient's own profile form. A
    // receptionist is copying a number off a form somebody filled in by hand,
    // and refusing to register a patient because their number is not a mobile
    // is the product getting in the way of care.
    for (const phone of [
      "9999999999",
      "+91 99999 99999",
      "020 1234 5678",
      "(022) 2555-1234",
    ]) {
      const result = createPatientSchema.safeParse({
        fullName: "Test Patient",
        phone,
      });
      expect(result.success, phone).toBe(true);
    }
  });

  it("rejects a phone number that is not one", () => {
    for (const phone of [
      "not a number",
      "12",
      "<script>alert(1)</script>",
      "'; drop table patients; --",
    ]) {
      const result = createPatientSchema.safeParse({
        fullName: "Test Patient",
        phone,
      });
      expect(result.success, phone).toBe(false);
    }
  });

  it("rejects a date of birth that does not exist or is in the future", () => {
    for (const dateOfBirth of [
      "2026-02-30",
      "1899-12-31",
      "3000-01-01",
      "7 April 1990",
    ]) {
      const result = createPatientSchema.safeParse({
        fullName: "Test Patient",
        dateOfBirth,
      });
      expect(result.success, dateOfBirth).toBe(false);
    }
  });

  it("accepts a real date of birth", () => {
    const result = createPatientSchema.safeParse({
      fullName: "Test Patient",
      dateOfBirth: "1990-04-07",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a gender outside the four self-described values", () => {
    const result = createPatientSchema.safeParse({
      fullName: "Test Patient",
      gender: "unknown",
    });

    expect(result.success).toBe(false);
  });

  it("requires an emergency contact to have both a name and a number", () => {
    const nameOnly = createPatientSchema.safeParse({
      fullName: "Test Patient",
      emergencyContactName: "Test Contact",
    });
    const phoneOnly = createPatientSchema.safeParse({
      fullName: "Test Patient",
      emergencyContactPhone: "9999999999",
    });

    expect(nameOnly.success).toBe(false);
    expect(phoneOnly.success).toBe(false);

    // The message is attached to the half that is missing, so the receptionist
    // is told what to fix rather than that something is wrong.
    expect(
      !nameOnly.success &&
        nameOnly.error.issues.some(
          (issue) => issue.path[0] === "emergencyContactPhone",
        ),
    ).toBe(true);
    expect(
      !phoneOnly.success &&
        phoneOnly.error.issues.some(
          (issue) => issue.path[0] === "emergencyContactName",
        ),
    ).toBe(true);
  });

  it("stores hostile input as text rather than interpreting it", () => {
    // A name is a name. React escapes it on render and the Supabase client
    // parameterises it on write; what matters here is that it is not rejected
    // for containing a character somebody's real name might contain.
    const result = createPatientSchema.safeParse({
      fullName: "Robert'); DROP TABLE patients;--",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.fullName).toBe(
      "Robert'); DROP TABLE patients;--",
    );
  });

  it("defaults the duplicate acknowledgement to false", () => {
    // Absent means "not acknowledged", so a submission that never saw the
    // warning is warned. Only the button that carries the value skips it.
    const result = createPatientSchema.safeParse({ fullName: "Test Patient" });

    expect(result.success && result.data.duplicateAcknowledged).toBe(false);
  });
});

describe("staffBookingSchema", () => {
  const valid = {
    patientId: PATIENT_ID,
    practitionerId: PRACTITIONER_ID,
    appointmentTypeId: TYPE_ID,
    startsAt: STARTS_AT,
  };

  it("accepts the five values a booking is made of", () => {
    expect(staffBookingSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    "status",
    "duration",
    "durationMinutes",
    "endsAt",
    "blockedUntil",
    "internalNote",
    "createdBy",
    "role",
    "permission",
  ])("rejects a request carrying %s rather than dropping it", (field) => {
    // `phase_10.md` section 62's manipulation list. None of these is a
    // parameter of `create_appointment_for_patient` either, so even a request
    // that got past this would have nowhere to put it.
    const result = staffBookingSchema.safeParse({ ...valid, [field]: "x" });
    expect(result.success).toBe(false);
  });

  it("takes a patient id, because the receptionist chooses the patient", () => {
    // The one identifier a staff write accepts (`phase_10.md` section 18). It
    // says *which* patient; the database says whether it exists and whether
    // the caller may act at all.
    expect(Object.keys(staffBookingSchema._def.shape)).toContain("patientId");
  });

  it("rejects a patient id that is not an identifier", () => {
    for (const patientId of [
      "not-a-uuid",
      "1; drop table appointments; --",
      "../../etc/passwd",
      "<script>alert(1)</script>",
      "",
    ]) {
      const result = staffBookingSchema.safeParse({ ...valid, patientId });
      expect(result.success, patientId).toBe(false);
    }
  });

  it("refuses a naive local time", () => {
    // `"2026-09-22 10:30"` is not a moment. Resolving it against the server's
    // timezone would make the same request mean different instants on
    // different machines (`phase_09.md` section 12).
    for (const startsAt of [
      "2026-09-22 10:30",
      "2026-09-22T10:30",
      "22/09/2026 10:30",
      "tomorrow",
    ]) {
      const result = staffBookingSchema.safeParse({ ...valid, startsAt });
      expect(result.success, startsAt).toBe(false);
    }
  });

  it("accepts an instant in either offset form", () => {
    for (const startsAt of [
      "2026-09-22T10:30:00+05:30",
      "2026-09-22T05:00:00Z",
    ]) {
      expect(
        staffBookingSchema.safeParse({ ...valid, startsAt }).success,
        startsAt,
      ).toBe(true);
    }
  });
});

describe("staffStatusSchema", () => {
  it.each(["confirmed", "checked_in", "no_show", "cancelled"])(
    "accepts %s, which the front desk may set",
    (status) => {
      const result = staffStatusSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        status,
      });
      expect(result.success).toBe(true);
    },
  );

  it.each(["completed", "in_consultation", "requested"])(
    "rejects %s, which the front desk may not set",
    (status) => {
      // `phase_10.md` section 31: completion stays a clinical responsibility.
      // `requested` is absent because nothing moves an appointment *back* to
      // it — a reschedule does that, and only on the patient path.
      const result = staffStatusSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        status,
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects an invented status", () => {
    for (const status of ["admin", "COMPLETED", "deleted", "", "*"]) {
      expect(
        staffStatusSchema.safeParse({ appointmentId: APPOINTMENT_ID, status })
          .success,
        status,
      ).toBe(false);
    }
  });

  it("rejects an unexpected key rather than dropping it", () => {
    const result = staffStatusSchema.safeParse({
      appointmentId: APPOINTMENT_ID,
      status: "confirmed",
      patientId: PATIENT_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("staffRescheduleSchema", () => {
  it("carries an appointment id and an instant, and nothing else", () => {
    expect(Object.keys(staffRescheduleSchema._def.shape).sort()).toEqual([
      "appointmentId",
      "startsAt",
    ]);
  });

  it("rejects a duration or an end time", () => {
    for (const field of ["duration", "endsAt", "practitionerId", "status"]) {
      const result = staffRescheduleSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        startsAt: STARTS_AT,
        [field]: "x",
      });
      expect(result.success, field).toBe(false);
    }
  });
});

describe("patientSearchSchema", () => {
  it("accepts an empty term, which finds nothing rather than everything", () => {
    const result = patientSearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.query).toBe("");
  });

  it("bounds the term", () => {
    const result = patientSearchSchema.safeParse({ query: "a".repeat(500) });
    expect(result.success).toBe(false);
  });

  it("has no field for a result count", () => {
    // The caller does not choose how many rows come back. `search_patients`
    // clamps its own limit (`phase_10.md` sections 13 and 51).
    const fields = Object.keys(patientSearchSchema._def.shape);
    expect(fields).toEqual(["query"]);
  });

  it("passes wildcard characters through as text to be escaped downstream", () => {
    // `%` must be searched for, not interpreted. The escaping happens in the
    // database function; this asserts the schema does not quietly strip it and
    // hide the need.
    const result = patientSearchSchema.safeParse({ query: "%" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.query).toBe("%");
  });
});

describe("scheduleFilterSchema", () => {
  it("accepts an empty filter set", () => {
    expect(scheduleFilterSchema.safeParse({}).success).toBe(true);
  });

  it("treats 'all' and an empty string as no filter", () => {
    const result = scheduleFilterSchema.safeParse({
      practitionerId: "all",
      status: "",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.practitionerId).toBeUndefined();
    expect(result.success && result.data.status).toBeUndefined();
  });

  it("rejects a malformed date rather than interpreting it", () => {
    for (const date of ["2026-02-30", "yesterday", "2026-13-01", "'; --"]) {
      expect(scheduleFilterSchema.safeParse({ date }).success, date).toBe(
        false,
      );
    }
  });

  it("rejects a practitioner id that is not an identifier", () => {
    expect(
      scheduleFilterSchema.safeParse({ practitionerId: "../../etc/passwd" })
        .success,
    ).toBe(false);
  });

  it("rejects an unrecognised status", () => {
    expect(scheduleFilterSchema.safeParse({ status: "deleted" }).success).toBe(
      false,
    );
  });

  it("has no field that could widen what is read", () => {
    // These filters narrow a view the receptionist may already see in full.
    // There is no "patientId" here, and no "includeClinical".
    const fields = Object.keys(scheduleFilterSchema._def.shape).sort();
    expect(fields).toEqual(["date", "practitionerId", "status"]);
  });
});
