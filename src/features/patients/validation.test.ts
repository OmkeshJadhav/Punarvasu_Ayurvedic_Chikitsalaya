import { describe, expect, it } from "vitest";

import {
  patientProfileSchema,
  postalCodeSchema,
  todayIsoDate,
} from "./validation";

/**
 * Patient profile validation.
 *
 * Three groups, in order of how much damage a failure would do:
 *
 *   1. The boundary. That nothing clinical and nothing protected can enter the
 *      profile, whatever a request carries.
 *   2. Correctness. That a valid profile is accepted and an invalid one is
 *      refused with a message somebody can act on.
 *   3. Hostile input. That malicious strings are treated as text, not as
 *      instructions.
 *
 * Test data is clearly synthetic throughout (`docs/QA_STRATEGY.md` section
 * 31). No real patient information appears here or anywhere else in the suite.
 */

/** A minimal valid submission: the one required field, everything else blank. */
function minimalForm(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Test Patient",
    preferredName: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    preferredLanguage: "",
    ...overrides,
  };
}

function messageFor(
  result: ReturnType<typeof patientProfileSchema.safeParse>,
  field: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("the profile/clinical boundary", () => {
  // The single most important property in this phase. A demographic record
  // that can absorb clinical data is a clinical record with no policies
  // (`phase_07.md` sections 8 and 77).
  const CLINICAL_FIELDS = [
    "symptoms",
    "diagnosis",
    "medications",
    "allergies",
    "medicalHistory",
    "previousTreatments",
    "labResults",
    "prescription",
    "consultationNotes",
    "treatmentPlan",
    "bloodGroup",
  ];

  it.each(CLINICAL_FIELDS)("rejects a submission carrying %s", (field) => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ [field]: "anything at all" }),
    );

    // Rejected outright, not silently dropped. A rejected request is visible
    // in a log; a dropped field is how a clinical column arrives by accident.
    expect(result.success).toBe(false);
  });

  it("has no clinical key in its own shape", () => {
    const keys = Object.keys(patientProfileSchema.shape);

    for (const field of CLINICAL_FIELDS) {
      expect(keys).not.toContain(field);
    }
  });
});

describe("protected fields", () => {
  // `phase_07.md` sections 49-51. None of these may be set by a client, and
  // the schema is the first of three places that refuse them - the column
  // grants and the guard trigger are the other two.
  const PROTECTED_FIELDS = [
    "id",
    "profileId",
    "profile_id",
    "userId",
    "user_id",
    "role",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
  ];

  it.each(PROTECTED_FIELDS)("rejects a submission carrying %s", (field) => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ [field]: "00000000-0000-4000-8000-000000000000" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an attempt to claim the admin role", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ role: "admin" }),
    );

    expect(result.success).toBe(false);
  });
});

describe("required and optional fields", () => {
  it("accepts a profile carrying only a name", () => {
    const result = patientProfileSchema.safeParse(minimalForm());

    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ fullName: "   " }),
    );

    expect(messageFor(result, "fullName")).toBe("Your full name is required.");
  });

  it("bounds the name rather than truncating it", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ fullName: "a".repeat(121) }),
    );

    expect(result.success).toBe(false);
  });

  it("treats an untouched optional field as absent, not as an empty string", () => {
    const result = patientProfileSchema.safeParse(minimalForm());

    expect(result.success).toBe(true);
    if (!result.success) return;

    // The distinction matters at the database: `undefined` becomes a null
    // column, an empty string would become a stored blank that formats,
    // sorts and compares differently from "not given".
    expect(result.data.preferredName).toBeUndefined();
    expect(result.data.city).toBeUndefined();
    expect(result.data.gender).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ fullName: "  Test Patient  ", city: "  Pune  " }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fullName).toBe("Test Patient");
    expect(result.data.city).toBe("Pune");
  });
});

describe("phone numbers", () => {
  it("normalises an Indian mobile number to ten digits", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ phone: "+91 99999 99999" }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    // The same number typed three ways has to be one value in the record, or
    // a later lookup by phone finds nothing.
    expect(result.data.phone).toBe("9999999999");
  });

  it("rejects a number that is not a mobile number", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ phone: "12345" }),
    );

    expect(messageFor(result, "phone")).toBe(
      "Enter a valid 10-digit mobile number.",
    );
  });
});

describe("date of birth", () => {
  it("accepts a plausible date", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: "1990-04-07" }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dateOfBirth).toBe("1990-04-07");
  });

  it("rejects a date in the future", () => {
    const nextYear = `${new Date().getFullYear() + 1}-01-01`;
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: nextYear }),
    );

    expect(messageFor(result, "dateOfBirth")).toBe(
      "A date of birth can't be in the future.",
    );
  });

  it("accepts today", () => {
    // A newborn registered on the day of birth. The bound is "not in the
    // future", not "not today".
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: todayIsoDate() }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a day that does not exist", () => {
    // `new Date("2024-02-30")` silently rolls over to 1 March, which would
    // store a date the patient never entered.
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: "2024-02-30" }),
    );

    expect(messageFor(result, "dateOfBirth")).toBe(
      "That date doesn't exist. Please check the day and month.",
    );
  });

  it("accepts 29 February in a leap year", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: "2024-02-29" }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a date before 1900", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: "1889-01-01" }),
    );

    expect(messageFor(result, "dateOfBirth")).toBe(
      "Please enter a date of birth after 1900.",
    );
  });

  it("rejects free text where a date belongs", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ dateOfBirth: "sometime in the nineties" }),
    );

    expect(result.success).toBe(false);
  });
});

describe("gender", () => {
  it.each(["female", "male", "other", "undisclosed"])(
    "accepts %s",
    (gender) => {
      const result = patientProfileSchema.safeParse(minimalForm({ gender }));
      expect(result.success).toBe(true);
    },
  );

  it("rejects a value that is not one of the listed options", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ gender: "anything" }),
    );

    expect(messageFor(result, "gender")).toBe(
      "Please choose one of the listed options.",
    );
  });
});

describe("postal codes", () => {
  it("accepts an Indian PIN code", () => {
    expect(postalCodeSchema.safeParse("411001").success).toBe(true);
  });

  it("accepts an international postal code", () => {
    // `phase_07.md` section 26: support Indian formats without excluding a
    // patient who lives elsewhere.
    expect(postalCodeSchema.safeParse("SW1A 1AA").success).toBe(true);
    expect(postalCodeSchema.safeParse("K1A-0B1").success).toBe(true);
  });

  it("normalises case so one code is one value", () => {
    const result = postalCodeSchema.safeParse("sw1a 1aa");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe("SW1A 1AA");
  });

  it("rejects punctuation that belongs to no postal system", () => {
    expect(postalCodeSchema.safeParse("<script>").success).toBe(false);
    expect(postalCodeSchema.safeParse("41;1001").success).toBe(false);
  });
});

describe("emergency contact", () => {
  it("accepts a complete contact", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({
        emergencyContactName: "Test Contact",
        emergencyContactRelationship: "Spouse",
        emergencyContactPhone: "9999999999",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("asks for a number when only a name is given", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ emergencyContactName: "Test Contact" }),
    );

    // A name with no number is not a contact. The message is attached to the
    // missing half, so it appears under the field to fill in.
    expect(messageFor(result, "emergencyContactPhone")).toBe(
      "Please add a number for your emergency contact, or clear the name.",
    );
  });

  it("asks for a name when only a number is given", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ emergencyContactPhone: "9999999999" }),
    );

    expect(messageFor(result, "emergencyContactName")).toBe(
      "Please add a name for your emergency contact, or clear the number.",
    );
  });
});

describe("hostile input", () => {
  it("keeps a script tag as text rather than rejecting the name", () => {
    // A name is free text and this is not an XSS defence — React escaping is.
    // What matters is that the value survives as the characters typed, so the
    // defence is one layer (rendering) rather than a filter that can be
    // bypassed.
    const result = patientProfileSchema.safeParse(
      minimalForm({ fullName: "<script>alert('x')</script>" }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fullName).toBe("<script>alert('x')</script>");
  });

  it("keeps SQL-shaped text as text", () => {
    // Queries are parameterised by the Supabase client, so this is data. The
    // assertion is that nothing here tries to be clever about it.
    const result = patientProfileSchema.safeParse(
      minimalForm({ city: "'; drop table patients; --" }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.city).toBe("'; drop table patients; --");
  });

  it("rejects an oversized payload rather than accepting it", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ addressLine1: "x".repeat(100_000) }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a non-string value where text belongs", () => {
    const result = patientProfileSchema.safeParse(
      minimalForm({ fullName: { toString: () => "Test Patient" } }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a submission that is not an object at all", () => {
    expect(patientProfileSchema.safeParse("fullName=Test").success).toBe(false);
    expect(patientProfileSchema.safeParse(null).success).toBe(false);
  });
});
