import { describe, expect, it } from "vitest";

import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_LIMITS,
  EMPTY_CONTACT_FORM,
  contactEnquirySchema,
  validateContactForm,
} from "./schema";

/**
 * Contact enquiry validation.
 *
 * This schema is written to run on both sides of the trust boundary, so these
 * are the tests that a future server route inherits: the rules asserted here
 * are the rules the route will enforce, and nothing in the browser is trusted
 * to have applied them (`docs/SECURITY.md` section 9).
 *
 * Every fixture is obviously synthetic (`docs/QA_STRATEGY.md` section 31).
 */

const VALID = {
  name: "Test Patient",
  email: "test.patient@example.test",
  phone: "9999999999",
  message: "I would like to ask about consultations at the clinic.",
} as const;

describe("a valid enquiry", () => {
  it("is accepted", () => {
    const result = contactEnquirySchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("does not require a phone number", () => {
    const result = contactEnquirySchema.safeParse({ ...VALID, phone: "" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.phone).toBeUndefined();
  });

  it("normalises a phone number written with the country code and spaces", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      phone: "+91 99999 99999",
    });
    expect(result.success && result.data.phone).toBe("9999999999");
  });

  it("trims and lower-cases the email address", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      email: "  Test.Patient@Example.Test ",
    });
    expect(result.success && result.data.email).toBe(
      "test.patient@example.test",
    );
  });
});

describe("an invalid enquiry", () => {
  it("rejects an empty form and names every missing field", () => {
    const errors = validateContactForm(EMPTY_CONTACT_FORM);

    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.message).toBeDefined();
    // Phone stays optional even when everything else is missing.
    expect(errors.phone).toBeUndefined();
  });

  it("rejects a malformed email address", () => {
    const errors = validateContactForm({
      ...EMPTY_CONTACT_FORM,
      ...VALID,
      email: "not-an-email",
    });
    expect(errors.email).toMatch(/valid email/i);
  });

  it("rejects a phone number that is not a valid mobile number", () => {
    const errors = validateContactForm({
      ...EMPTY_CONTACT_FORM,
      ...VALID,
      phone: "12345",
    });
    expect(errors.phone).toMatch(/10-digit/i);
  });

  it("asks for more than a one-word message", () => {
    const errors = validateContactForm({
      ...EMPTY_CONTACT_FORM,
      ...VALID,
      message: "hi",
    });
    expect(errors.message).toMatch(/write a little more/i);
  });

  it("gives a message a specific, non-judgemental error", () => {
    const errors = validateContactForm(EMPTY_CONTACT_FORM);
    // "Invalid input" is the failure mode `DESIGN_SYSTEM.md` section 19 names.
    expect(errors.name).not.toMatch(/invalid/i);
    expect(errors.email).not.toMatch(/invalid/i);
  });
});

describe("input is bounded", () => {
  it("rejects an oversized message rather than accepting the payload", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      message: "a".repeat(CONTACT_LIMITS.messageMax + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized name", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      name: "a".repeat(CONTACT_LIMITS.nameMax + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an absurd payload without trying to store it", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      message: "a".repeat(5_000_000),
    });
    expect(result.success).toBe(false);
  });
});

describe("spam protection", () => {
  it("rejects a submission that filled the honeypot", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      [CONTACT_HONEYPOT_FIELD]: "Acme Marketing",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a submission that left it empty", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      [CONTACT_HONEYPOT_FIELD]: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("what the form does not collect", () => {
  it("has no field for health information", () => {
    // A public enquiry form must not become an accidental medical record
    // (`docs/implementation-plan/phase_05.md` sections 36-37, 43 and 71).
    // The type has no such field; this asserts the runtime schema agrees, so
    // a widened shape cannot smuggle one in.
    const shape = Object.keys(contactEnquirySchema.shape);
    for (const banned of [
      "symptoms",
      "condition",
      "medicalHistory",
      "medications",
      "diagnosis",
      "reports",
      "dateOfBirth",
      "age",
      "attachment",
    ]) {
      expect(shape).not.toContain(banned);
    }
  });

  it("strips anything it was not asked for", () => {
    const result = contactEnquirySchema.safeParse({
      ...VALID,
      symptoms: "something a visitor typed into a field we never rendered",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("symptoms");
  });
});

describe("the sensitive-information warning exists", () => {
  it("tells a visitor not to put health details in the form", async () => {
    const { CONTACT_PAGE } = await import("./content");
    expect(CONTACT_PAGE.enquiry.privacyWarning).toMatch(
      /do not include medical history/i,
    );
    expect(CONTACT_PAGE.enquiry.privacyWarning).toMatch(
      /not a secure channel/i,
    );
  });
});
