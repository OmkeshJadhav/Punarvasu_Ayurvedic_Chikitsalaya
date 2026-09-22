import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENT_TEXT,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "./validation";

/**
 * Every fixture here is synthetic - `example.test` addresses and passwords
 * that exist nowhere (`docs/QA_STRATEGY.md` section 31).
 */
const VALID_PASSWORD = "sandalwood-harbour-41";

describe("password rules", () => {
  /** A varied password trimmed to an exact length, for the bound tests. */
  function passwordOfLength(length: number): string {
    return "kEtaki-vAcha-brAhmI-ashwagandhA-guDUchI-shatAvarI-punarnavA"
      .repeat(3)
      .slice(0, length);
  }

  it("accepts a password at the minimum length", () => {
    const atMinimum = passwordOfLength(PASSWORD_MIN_LENGTH);
    expect(newPasswordSchema.safeParse(atMinimum).success).toBe(true);
  });

  it("rejects one character below the minimum", () => {
    const tooShort = passwordOfLength(PASSWORD_MIN_LENGTH - 1);
    expect(newPasswordSchema.safeParse(tooShort).success).toBe(false);
  });

  it("rejects a single character held down to reach the length", () => {
    // Long enough to satisfy the bound, and not a password.
    expect(newPasswordSchema.safeParse("a".repeat(30)).success).toBe(false);
    expect(newPasswordSchema.safeParse("ababababababab").success).toBe(false);
  });

  it("rejects a password longer than bcrypt will hash", () => {
    // Accepting it would authenticate the user on a 72-byte prefix of a
    // password they believe is longer. Rejecting is honest.
    const tooLong = passwordOfLength(PASSWORD_MAX_LENGTH + 1);
    expect(newPasswordSchema.safeParse(tooLong).success).toBe(false);
  });

  it("accepts a password at exactly the maximum", () => {
    const atMaximum = passwordOfLength(PASSWORD_MAX_LENGTH);
    expect(newPasswordSchema.safeParse(atMaximum).success).toBe(true);
  });

  it.each(["password123", "PASSWORD123", "1234567890", "punarvasu1"])(
    "rejects the obviously weak password %s",
    (weak) => {
      // Long enough to pass the length rule, so this asserts the screen and
      // not the bound.
      expect(weak.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
      expect(newPasswordSchema.safeParse(weak).success).toBe(false);
    },
  );

  it("imposes no composition rules", () => {
    // Modern guidance: length and a common-password screen, not a demand for
    // a symbol that produces `Password1!` across the whole user base.
    const lowercaseOnly = "riverstoneharbour";
    expect(newPasswordSchema.safeParse(lowercaseOnly).success).toBe(true);
  });

  it("preserves leading and trailing spaces", () => {
    // Trimming would mean the password a manager stored is not the password
    // the account has.
    const padded = `  ${VALID_PASSWORD}  `;
    const result = newPasswordSchema.safeParse(padded);
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(padded);
  });

  it("states the enforced minimum in the copy shown to the user", () => {
    // `phase_06.md` section 10: never display a requirement the backend does
    // not enforce. Deriving the sentence from the constant is what keeps the
    // two from drifting.
    expect(PASSWORD_REQUIREMENT_TEXT).toContain(String(PASSWORD_MIN_LENGTH));
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "patient@example.test",
      password: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("normalises the email address", () => {
    const result = loginSchema.safeParse({
      email: "  Patient@Example.TEST  ",
      password: VALID_PASSWORD,
    });
    expect(result.success && result.data.email).toBe("patient@example.test");
  });

  it("does not hold an existing password to the strength rules", () => {
    // An account created under an older policy still has to be able to sign
    // in, and "your password is too weak" at the sign-in prompt helps nobody.
    const result = loginSchema.safeParse({
      email: "patient@example.test",
      password: "short",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "patient@example.test", password: "" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed email address", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: VALID_PASSWORD })
        .success,
    ).toBe(false);
  });
});

describe("registerSchema", () => {
  const validRegistration = {
    fullName: "Test Patient",
    email: "patient@example.test",
    phone: "",
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("treats an empty phone number as absent", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success && result.data.phone).toBe(undefined);
  });

  it("accepts and normalises a phone number when given", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      phone: "+91 99999 99999",
    });
    expect(result.success && result.data.phone).toBe("9999999999");
  });

  it("rejects a malformed phone number", () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, phone: "12345" })
        .success,
    ).toBe(false);
  });

  it("rejects mismatched passwords, against the confirm field", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "something-else-entirely",
    });
    expect(result.success).toBe(false);
    // The message has to land under the field the user changes, not at the
    // top of the form.
    expect(result.success === false && result.error.issues[0]?.path).toEqual([
      "confirmPassword",
    ]);
  });

  it("rejects a missing name", () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, fullName: "   " })
        .success,
    ).toBe(false);
  });

  describe("collects no health information", () => {
    it("has no field for anything clinical", () => {
      const result = registerSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);

      const keys = Object.keys(
        (result.success ? result.data : {}) as Record<string, unknown>,
      );

      // `phase_06.md` sections 7-8. The surest way to keep clinical data out
      // of the authentication tables is to have nowhere for it to go.
      for (const forbidden of [
        "symptoms",
        "medicalHistory",
        "medications",
        "diagnosis",
        "conditions",
        "allergies",
        "dateOfBirth",
        "gender",
        "bloodGroup",
        "treatment",
      ]) {
        expect(keys).not.toContain(forbidden);
      }
    });

    it("discards an unknown field rather than carrying it through", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        symptoms: "headache and fatigue for three weeks",
      });

      expect(result.success).toBe(true);
      expect(
        (result.success ? result.data : {}) as Record<string, unknown>,
      ).not.toHaveProperty("symptoms");
    });

    it("never carries a role, so registration cannot request one", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        role: "admin",
      });

      expect(result.success).toBe(true);
      expect(
        (result.success ? result.data : {}) as Record<string, unknown>,
      ).not.toHaveProperty("role");
    });
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a matching pair", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      }).success,
    ).toBe(true);
  });

  it("rejects a mismatched pair", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: VALID_PASSWORD,
        confirmPassword: `${VALID_PASSWORD}x`,
      }).success,
    ).toBe(false);
  });

  it("applies the same strength rules as registration", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid address", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "patient@example.test" }).success,
    ).toBe(true);
  });

  it("rejects a malformed address", () => {
    // The one thing the recovery flow does not hide: telling someone their
    // input is not an email address reveals nothing about who is registered.
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });
});
