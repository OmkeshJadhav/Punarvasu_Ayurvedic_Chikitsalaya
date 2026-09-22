import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { APPOINTMENT_ERROR_CODES, describeAppointmentFailure } from "./errors";

/**
 * Database failure to something a patient can read.
 *
 * `phase_09.md` section 41 gives the rule and the example: a patient must see
 * "That time slot is no longer available", never "duplicate key value violates
 * exclusion constraint". These tests assert both halves — that the right
 * message comes out, and that nothing from the database gets through.
 */

/**
 * Every migration that raises an application SQLSTATE.
 *
 * Phase 09 introduced the vocabulary; Phase 10 added `PV014` — no such
 * patient record — which only the staff write path can raise, because a
 * patient id is only an input there. Phase 11 added no new code at all: the
 * doctor path raises `PV008` and `PV009`, which already meant exactly what
 * it needs them to mean. Phase 12 added `PV019` — the consultation notes for
 * this appointment are still a draft — which is raised by a trigger on
 * `appointments` and therefore reaches a practitioner through *this* mapper
 * when they try to complete an appointment from the appointment page.
 *
 * Reading all four keeps the "every declared code is really raised"
 * assertion honest as the engine grows.
 */
function migration(file: string): string {
  return readFileSync(
    new URL(`../../../supabase/migrations/${file}`, import.meta.url),
    "utf8",
  );
}

/**
 * The one part of the Phase 12 migration that belongs to *this* mapper.
 *
 * `appointments_guard_clinical_documentation()` is a trigger on
 * `public.appointments`, so it fires on the Phase 11 status action and its
 * refusal reaches a practitioner through `describeAppointmentFailure`.
 *
 * The rest of that migration raises `PV015`–`PV018` inside clinical functions
 * this feature never calls, and those belong to `features/clinical/errors.ts`.
 * Declaring them here would be declaring codes this mapper cannot receive,
 * and reading the whole file would make the coverage assertion demand exactly
 * that. So the trigger is extracted instead — and if it is ever renamed this
 * throws, rather than silently narrowing the check to nothing.
 */
const APPOINTMENT_TRIGGER_IN_CLINICAL_MIGRATION = (() => {
  const source = migration("20260923120000_clinical_records.sql");
  const match =
    /create function public\.appointments_guard_clinical_documentation\(\)[\s\S]*?\$\$;/.exec(
      source,
    );

  if (!match) {
    throw new Error(
      "appointments_guard_clinical_documentation() is no longer in the Phase 12 migration under that name.",
    );
  }

  return match[0];
})();

const MIGRATION = [
  migration("20260920120000_appointment_engine.sql"),
  migration("20260921120000_receptionist_workspace.sql"),
  migration("20260922120000_doctor_workspace.sql"),
  APPOINTMENT_TRIGGER_IN_CLINICAL_MIGRATION,
].join("\n");

/** A PostgREST error, in the shape `supabase-js` hands back. */
function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

describe("the error vocabulary", () => {
  it("covers every code the migration raises", () => {
    const raised = new Set(
      [...MIGRATION.matchAll(/errcode = '(PV\d{3})'/g)].map(
        (match) => match[1] as string,
      ),
    );

    expect(raised.size).toBeGreaterThan(0);

    const known = new Set<string>(Object.values(APPOINTMENT_ERROR_CODES));
    for (const code of raised) {
      // A code the database raises and the application does not recognise
      // falls through to the generic message — safe, but it tells the patient
      // nothing they can act on.
      expect(known).toContain(code);
    }
  });

  it("declares no code the migrations never raise", () => {
    for (const code of Object.values(APPOINTMENT_ERROR_CODES)) {
      expect(MIGRATION).toContain(`errcode = '${code}'`);
    }
  });

  it("gives the staff-only unknown-patient code its own message", () => {
    // `PV014` is distinct from `PV009` — no such appointment — because the two
    // send a receptionist to different places: one means "search again", the
    // other means "this booking has gone".
    const unknownPatient = describeAppointmentFailure(
      pgError("PV014", "Unknown patient record."),
    );
    const unknownAppointment = describeAppointmentFailure(
      pgError("PV009", "Appointment not found."),
    );

    expect(unknownPatient.message).not.toBe(unknownAppointment.message);
    expect(unknownPatient.message).toMatch(/patient/i);
    expect(unknownPatient.slotConflict).toBe(false);
    // And neither carries the database's own words.
    expect(unknownPatient.message).not.toContain("Unknown patient record.");
  });
});

describe("describeAppointmentFailure", () => {
  it("turns an exclusion-constraint violation into an answer a patient can act on", () => {
    const failure = describeAppointmentFailure(
      pgError(
        "23P01",
        'conflicting key value violates exclusion constraint "appointments_practitioner_no_overlap"',
      ),
    );

    expect(failure.message).toContain("just been taken");
    expect(failure.slotConflict).toBe(true);
    expect(failure.logEvent).toBe("appointment.slot_taken");
  });

  it("distinguishes the reasons a time might not be bookable", () => {
    expect(
      describeAppointmentFailure(pgError(APPOINTMENT_ERROR_CODES.tooSoon))
        .message,
    ).toContain("too soon");
    expect(
      describeAppointmentFailure(pgError(APPOINTMENT_ERROR_CODES.tooFarAhead))
        .message,
    ).toContain("further ahead");
    expect(
      describeAppointmentFailure(pgError(APPOINTMENT_ERROR_CODES.inThePast))
        .message,
    ).toContain("already passed");
  });

  it("asks a patient without a record to complete their profile", () => {
    const failure = describeAppointmentFailure(
      pgError(APPOINTMENT_ERROR_CODES.noPatientRecord),
    );

    expect(failure.message).toContain("complete your profile");
  });

  it("answers the same way for a missing appointment and somebody else's", () => {
    // An appointment id must not be an oracle for whether another patient's
    // appointment exists (`phase_09.md` section 35). The database raises one
    // code for both, and this is the message it maps to.
    const failure = describeAppointmentFailure(
      pgError(APPOINTMENT_ERROR_CODES.notFound),
    );

    expect(failure.message).toBe("We couldn't find that appointment.");
    expect(failure.message).not.toMatch(/another|belongs|owner|permission/i);
  });

  it("says nothing about roles or permissions on a refusal", () => {
    const failure = describeAppointmentFailure(
      pgError("42501", "permission denied for function book_appointment"),
    );

    expect(failure.message).toBe("You don't have access to this.");
    expect(failure.message).not.toMatch(/patient|role|permission denied/i);
  });

  it("falls back to a generic message for anything unrecognised", () => {
    for (const value of [
      pgError("99999"),
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      { message: "no code here" },
      null,
      undefined,
      "a string",
      42,
    ]) {
      const failure = describeAppointmentFailure(value);
      expect(failure.message).toBe(
        "We couldn't complete that just now. Please try again.",
      );
      expect(failure.logEvent).toBe("appointment.operation_failed");
    }
  });

  it("never lets database text reach the patient", () => {
    // The whole point of the module. Every mapped message is fixed copy from
    // this file; nothing is interpolated from the error.
    const hostile = [
      'relation "appointments" does not exist',
      'conflicting key value violates exclusion constraint "appointments_practitioner_no_overlap"',
      "permission denied for table patients",
      "PGRST301",
      "postgres://user:password@db.example:5432",
      "public.book_appointment(uuid,uuid,timestamptz,text)",
    ];

    const codes: string[] = [
      ...Object.values(APPOINTMENT_ERROR_CODES),
      "23P01",
      "42501",
      "23514",
      "23503",
      "99999",
    ];

    for (const code of codes) {
      for (const message of hostile) {
        const failure = describeAppointmentFailure(pgError(code, message));

        expect(failure.message).not.toContain(message);
        for (const leak of [
          "relation",
          "constraint",
          "postgres",
          "public.",
          "PGRST",
          "uuid",
          "table",
        ]) {
          expect(failure.message.toLowerCase()).not.toContain(
            leak.toLowerCase(),
          );
        }
      }
    }
  });

  it("logs a category, never the provider's words", () => {
    const failure = describeAppointmentFailure(
      pgError(
        "23P01",
        'violates constraint "appointments_practitioner_no_overlap"',
      ),
    );

    expect(failure.logEvent).toMatch(/^appointment\.[a-z_]+$/);
    expect(failure.logEvent).not.toContain("constraint");
  });
});
