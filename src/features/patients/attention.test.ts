import { describe, expect, it } from "vitest";

import type { PatientAppointment } from "@/features/appointments/types";

import { deriveAttentionItems, isImminent } from "./attention";
import { evaluateCompleteness } from "./completeness";
import type { PatientProfile } from "./types";

/**
 * The attention list.
 *
 * These tests exist because the panel's entire value is that a patient can
 * trust it. `phase_18.md` section 7 forbids fabricated personalization and
 * section 62 forbids fake urgency, and the only way to keep both true as the
 * rules grow is to assert, one rule at a time, that an item appears exactly
 * when the underlying record says it should.
 *
 * Every case injects its own clock. Nothing here depends on when it runs.
 */

const COMPLETE_PROFILE: PatientProfile = {
  fullName: "Test Patient",
  preferredName: null,
  phone: "9999999999",
  dateOfBirth: null,
  gender: null,
  addressLine1: "1 Example Road",
  addressLine2: null,
  city: "Satara",
  state: null,
  postalCode: "415001",
  emergencyContactName: "Test Contact",
  emergencyContactRelationship: null,
  emergencyContactPhone: "9888888888",
  preferredLanguage: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function appointment(
  overrides: Partial<PatientAppointment> = {},
): PatientAppointment {
  return {
    id: "appointment-1",
    startsAt: new Date("2026-10-01T09:00:00.000Z"),
    endsAt: new Date("2026-10-01T09:30:00.000Z"),
    status: "confirmed",
    practitionerId: "practitioner-1",
    practitionerName: "Test Doctor",
    appointmentTypeId: "type-1",
    typeName: "Follow-up consultation",
    durationMinutes: 30,
    patientNote: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("deriveAttentionItems", () => {
  it("returns nothing when the record is complete and nothing is pending", () => {
    const items = deriveAttentionItems({
      completeness: evaluateCompleteness(COMPLETE_PROFILE),
      nextAppointment: appointment(),
      unreadNotifications: 0,
    });

    expect(items).toEqual([]);
  });

  it("invents nothing when the patient has no data at all", () => {
    const items = deriveAttentionItems({
      completeness: evaluateCompleteness(COMPLETE_PROFILE),
      nextAppointment: null,
      unreadNotifications: 0,
    });

    // No "book an appointment" nag, no "your care is progressing", no score.
    // An empty account produces an empty list.
    expect(items).toEqual([]);
  });

  describe("an appointment awaiting the clinic's confirmation", () => {
    it("is surfaced as information, not as a task", () => {
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: appointment({ status: "requested" }),
        unreadNotifications: 0,
      });

      expect(item?.id).toBe("appointment-awaiting-confirmation");
      expect(item?.tone).toBe("info");
    });

    it("tells the patient there is nothing for them to do", () => {
      // The point of the item. A patient who thinks they must confirm their
      // own appointment goes looking for a button that does not exist.
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: appointment({ status: "requested" }),
        unreadNotifications: 0,
      });

      expect(item?.description).toMatch(/nothing you need to do/i);
    });

    it("links to that appointment and no other", () => {
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: appointment({ id: "abc-123", status: "requested" }),
        unreadNotifications: 0,
      });

      expect(item?.href).toBe("/patient/appointments/abc-123");
    });

    it.each(["confirmed", "checked_in", "in_consultation"] as const)(
      "does not appear for a %s appointment",
      (status) => {
        const items = deriveAttentionItems({
          completeness: evaluateCompleteness(COMPLETE_PROFILE),
          nextAppointment: appointment({ status }),
          unreadNotifications: 0,
        });

        expect(items).toEqual([]);
      },
    );
  });

  describe("unread notifications", () => {
    it("is absent when everything has been read", () => {
      const items = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: null,
        unreadNotifications: 0,
      });

      expect(items.some((item) => item.id === "unread-notifications")).toBe(
        false,
      );
    });

    it("reads as singular for one", () => {
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: null,
        unreadNotifications: 1,
      });

      expect(item?.title).toBe("You have an unread update");
    });

    it("counts the rest", () => {
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: null,
        unreadNotifications: 4,
      });

      expect(item?.title).toBe("You have 4 unread updates");
    });

    it("never previews what a notification says", () => {
      // Section 39, applied to the dashboard: a count is safe on a screen read
      // over a shoulder; a subject line is a different decision.
      const [item] = deriveAttentionItems({
        completeness: evaluateCompleteness(COMPLETE_PROFILE),
        nextAppointment: null,
        unreadNotifications: 2,
      });

      expect(item?.description).not.toMatch(
        /prescription|diagnosis|medicine|dose|plan/i,
      );
    });
  });

  describe("the patient record", () => {
    it("asks for a profile when none exists", () => {
      const [item] = deriveAttentionItems({
        completeness: null,
        nextAppointment: null,
        unreadNotifications: 0,
      });

      expect(item?.id).toBe("profile-missing");
      expect(item?.href).toBe("/patient/profile");
    });

    it("names the one missing detail when only one is missing", () => {
      const items = deriveAttentionItems({
        completeness: evaluateCompleteness({
          ...COMPLETE_PROFILE,
          phone: null,
        }),
        nextAppointment: null,
        unreadNotifications: 0,
      });

      const profileItem = items.find(
        (item) => item.id === "profile-incomplete",
      );
      expect(profileItem?.description).toMatch(/Add your mobile number/);
      // And the reason the clinic wants it, which is the sentence that makes
      // the prompt something other than nagging.
      expect(profileItem?.description).toMatch(
        /reach you about an appointment/,
      );
    });

    it("summarises when several are missing, without listing all of them", () => {
      const items = deriveAttentionItems({
        completeness: evaluateCompleteness({
          ...COMPLETE_PROFILE,
          phone: null,
          addressLine1: null,
          emergencyContactName: null,
        }),
        nextAppointment: null,
        unreadNotifications: 0,
      });

      const profileItem = items.find(
        (item) => item.id === "profile-incomplete",
      );
      expect(profileItem?.description).toMatch(/^3 details/);
      expect(profileItem?.description).toMatch(/mobile number/);
    });

    it("does not nag about an optional field that completeness excludes", () => {
      // Date of birth, gender and preferred language are deliberately not
      // counted (Phase 07). A patient who gives none of them still reaches
      // the end of this list with nothing to do.
      const items = deriveAttentionItems({
        completeness: evaluateCompleteness({
          ...COMPLETE_PROFILE,
          dateOfBirth: null,
          gender: null,
          preferredLanguage: null,
        }),
        nextAppointment: null,
        unreadNotifications: 0,
      });

      expect(items).toEqual([]);
    });
  });

  describe("ordering", () => {
    it("puts the appointment first and the profile last", () => {
      // Time-sensitivity, not ease of satisfaction. A missing postal code must
      // never push an unconfirmed appointment down the page.
      const items = deriveAttentionItems({
        completeness: evaluateCompleteness({
          ...COMPLETE_PROFILE,
          phone: null,
        }),
        nextAppointment: appointment({ status: "requested" }),
        unreadNotifications: 3,
      });

      expect(items.map((item) => item.id)).toEqual([
        "appointment-awaiting-confirmation",
        "unread-notifications",
        "profile-incomplete",
      ]);
    });
  });

  describe("safety of every generated item", () => {
    const everything = deriveAttentionItems({
      completeness: evaluateCompleteness({ ...COMPLETE_PROFILE, phone: null }),
      nextAppointment: appointment({ status: "requested" }),
      unreadNotifications: 2,
    });

    it("only ever links inside the application", () => {
      for (const item of everything) {
        expect(item.href.startsWith("/")).toBe(true);
        expect(item.href).not.toMatch(/^\/\//);
      }
    });

    it("only links to routes a patient may enter", () => {
      for (const item of everything) {
        expect(item.href).toMatch(/^\/(patient|notifications)(\/|$)/);
      }
    });

    it("carries no clinical content", () => {
      const text = everything
        .map((item) => `${item.title} ${item.description}`)
        .join(" ");

      expect(text).not.toMatch(
        /diagnos|symptom|prescri|dose|mg\b|medicine|assessment|treatment plan/i,
      );
    });

    it("has a unique id per item, so React keys cannot collide", () => {
      const ids = everything.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe("isImminent", () => {
  const now = new Date("2026-10-01T09:00:00.000Z");

  it("is true for an appointment later today", () => {
    expect(isImminent(new Date("2026-10-01T15:00:00.000Z"), now)).toBe(true);
  });

  it("is true just inside the window", () => {
    expect(isImminent(new Date("2026-10-03T08:59:00.000Z"), now)).toBe(true);
  });

  it("is false just outside it", () => {
    expect(isImminent(new Date("2026-10-03T09:01:00.000Z"), now)).toBe(false);
  });

  it("is false for an appointment already under way", () => {
    // "Starts in 0 hours" is not a useful thing to tell somebody who is
    // already in the consulting room.
    expect(isImminent(new Date("2026-10-01T08:30:00.000Z"), now)).toBe(false);
  });

  it("is false at exactly now", () => {
    expect(isImminent(now, now)).toBe(false);
  });

  it("honours a custom window", () => {
    const soon = new Date("2026-10-01T12:00:00.000Z");
    expect(isImminent(soon, now, 2)).toBe(false);
    expect(isImminent(soon, now, 4)).toBe(true);
  });
});
