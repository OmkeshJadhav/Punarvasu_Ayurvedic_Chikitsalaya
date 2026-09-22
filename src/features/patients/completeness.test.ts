import { describe, expect, it } from "vitest";

import { evaluateCompleteness } from "./completeness";
import type { PatientProfile } from "./types";

/**
 * Profile completeness.
 *
 * The behaviour worth protecting is not the arithmetic — it is which fields
 * are counted. A future change that adds date of birth or gender to the list
 * would turn an honest progress indicator into a nudge towards giving up
 * information the patient chose not to, which `phase_07.md` sections 19-20
 * rule out. That is what the last group here asserts.
 */

const EMPTY_PROFILE: PatientProfile = {
  fullName: "",
  preferredName: null,
  phone: null,
  dateOfBirth: null,
  gender: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactPhone: null,
  preferredLanguage: null,
  createdAt: "2026-09-18T10:00:00.000Z",
};

function profile(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return { ...EMPTY_PROFILE, ...overrides };
}

const COMPLETE = profile({
  fullName: "Test Patient",
  phone: "9999999999",
  addressLine1: "1 Example Road",
  city: "Pune",
  postalCode: "411001",
  emergencyContactName: "Test Contact",
  emergencyContactPhone: "9999999998",
});

describe("evaluateCompleteness", () => {
  it("reports nothing complete for a record with no values", () => {
    const result = evaluateCompleteness(EMPTY_PROFILE);

    expect(result.percentage).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.missing).toHaveLength(result.items.length);
  });

  it("reports nothing complete when there is no profile at all", () => {
    // The onboarding case. It must not throw and must not report progress.
    const result = evaluateCompleteness(null);

    expect(result.percentage).toBe(0);
    expect(result.complete).toBe(false);
  });

  it("reports a full profile as complete", () => {
    const result = evaluateCompleteness(COMPLETE);

    expect(result.percentage).toBe(100);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("counts a name alone as partial progress", () => {
    const result = evaluateCompleteness(profile({ fullName: "Test Patient" }));

    expect(result.percentage).toBeGreaterThan(0);
    expect(result.percentage).toBeLessThan(100);
  });

  it("does not count whitespace as a value", () => {
    const result = evaluateCompleteness(profile({ fullName: "   " }));

    expect(result.percentage).toBe(0);
  });

  it("treats a partial address as no address", () => {
    // A street with no city is not an address the clinic could write to, so
    // showing progress for it would be showing progress for nothing usable.
    const result = evaluateCompleteness(
      profile({ fullName: "Test Patient", addressLine1: "1 Example Road" }),
    );

    expect(result.missing.map((item) => item.id)).toContain("address");
  });

  it("treats an emergency contact with no number as no contact", () => {
    const result = evaluateCompleteness(
      profile({
        fullName: "Test Patient",
        emergencyContactName: "Test Contact",
      }),
    );

    expect(result.missing.map((item) => item.id)).toContain("emergencyContact");
  });

  it("gives every missing item a reason the patient can read", () => {
    for (const item of evaluateCompleteness(EMPTY_PROFILE).missing) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
      // The reason is shown on the page. It has to be a sentence, not a key.
      expect(item.reason).toMatch(/\.$/);
    }
  });
});

describe("what completeness deliberately ignores", () => {
  const SENSITIVE_OPTIONAL: readonly (keyof PatientProfile)[] = [
    "dateOfBirth",
    "gender",
    "preferredName",
    "preferredLanguage",
  ];

  it("does not count sensitive or preference fields", () => {
    const ids = evaluateCompleteness(EMPTY_PROFILE).items.map(
      (item) => item.id,
    );

    for (const field of SENSITIVE_OPTIONAL) {
      expect(ids).not.toContain(field);
    }
  });

  it("reaches 100% without a date of birth or a gender", () => {
    // The consequence of the rule above, stated as behaviour: a patient who
    // declines both is not left permanently short of complete.
    const result = evaluateCompleteness(COMPLETE);

    expect(COMPLETE.dateOfBirth).toBeNull();
    expect(COMPLETE.gender).toBeNull();
    expect(result.complete).toBe(true);
  });
});
