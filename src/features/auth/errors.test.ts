import { describe, expect, it } from "vitest";

import { AUTH_SAFE_MESSAGES, describeAuthFailure } from "./errors";

/**
 * A stand-in for a Supabase `AuthApiError`, built structurally because the
 * mapper reads the shape rather than the class.
 */
function providerError(
  code: string,
  status = 400,
  message = "Provider detail that must never be shown",
): Error & { code: string; status: number } {
  return Object.assign(new Error(message), {
    code,
    status,
    name: "AuthApiError",
  });
}

describe("describeAuthFailure", () => {
  describe("never leaks provider text", () => {
    const codes = [
      "invalid_credentials",
      "email_not_confirmed",
      "user_already_exists",
      "weak_password",
      "otp_expired",
      "over_email_send_rate_limit",
      "unexpected_failure",
      "some_code_added_in_a_later_sdk",
    ];

    it.each(codes)("maps %s to copy of our own", (code) => {
      const error = providerError(
        code,
        400,
        "AuthApiError: relation auth.users does not exist at 10.0.0.4:5432",
      );
      const result = describeAuthFailure("sign-in", error);

      expect(result.message).not.toContain("AuthApiError");
      expect(result.message).not.toContain("auth.users");
      expect(result.message).not.toContain("10.0.0.4");
      expect(result.message).not.toContain(code);
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  it("keeps the original error as `cause` for the log, not the response", () => {
    const original = providerError("invalid_credentials");
    const result = describeAuthFailure("sign-in", original);

    // Diagnosable server-side...
    expect(result.cause).toBe(original);
    // ...and `cause` is not part of the JSON the API envelope serialises.
    expect(JSON.stringify(result)).not.toContain("Provider detail");
  });

  describe("account enumeration", () => {
    it("gives the same message whether the account exists or the password is wrong", () => {
      const missingAccount = describeAuthFailure(
        "sign-in",
        providerError("user_not_found", 400),
      );
      const wrongPassword = describeAuthFailure(
        "sign-in",
        providerError("invalid_credentials", 400),
      );

      expect(missingAccount.message).toBe(wrongPassword.message);
      expect(missingAccount.message).toBe(AUTH_SAFE_MESSAGES.credentials);
    });

    it("never says an account does not exist", () => {
      const result = describeAuthFailure(
        "sign-in",
        providerError("user_not_found"),
      );

      expect(result.message.toLowerCase()).not.toContain("no account");
      expect(result.message.toLowerCase()).not.toContain("not found");
      expect(result.message.toLowerCase()).not.toContain("not registered");
    });

    it("gives one message for every dead-link outcome", () => {
      const expired = describeAuthFailure(
        "callback",
        providerError("otp_expired"),
      );
      const missingFlow = describeAuthFailure(
        "callback",
        providerError("flow_state_not_found"),
      );

      // Expired, already used and never valid are the same instruction to the
      // user, and telling them apart is an oracle about a token they may not
      // hold.
      expect(expired.message).toBe(missingFlow.message);
      expect(expired.message).toBe(AUTH_SAFE_MESSAGES.expiredLink);
    });
  });

  describe("error categories", () => {
    it.each([
      ["invalid_credentials", "unauthorized"],
      ["email_not_confirmed", "forbidden"],
      ["user_banned", "forbidden"],
      ["user_already_exists", "conflict"],
      ["weak_password", "validation"],
      ["same_password", "validation"],
      ["otp_expired", "unauthorized"],
      ["session_expired", "unauthorized"],
      ["over_request_rate_limit", "rate_limited"],
      ["over_email_send_rate_limit", "rate_limited"],
    ])("maps %s to the %s category", (code, expected) => {
      expect(describeAuthFailure("sign-in", providerError(code)).code).toBe(
        expected,
      );
    });

    it("falls back to the rate-limit category on a 429 with no known code", () => {
      expect(
        describeAuthFailure("sign-in", providerError("brand_new_code", 429))
          .code,
      ).toBe("rate_limited");
    });

    it("falls back to an internal error for anything unrecognised", () => {
      const result = describeAuthFailure("sign-up", providerError("???", 500));
      expect(result.code).toBe("internal");
      expect(result.message).toBe(AUTH_SAFE_MESSAGES.generic);
    });
  });

  describe("network failure", () => {
    it.each(["AuthRetryableFetchError", "TypeError"])(
      "recognises %s as the service being unreachable",
      (name) => {
        const error = Object.assign(new Error("fetch failed"), { name });
        const result = describeAuthFailure("sign-in", error);

        expect(result.message).toBe(AUTH_SAFE_MESSAGES.network);
        expect(result.logEvent).toBe("auth.provider_unreachable");
      },
    );

    it("names nothing about our infrastructure", () => {
      expect(AUTH_SAFE_MESSAGES.network).not.toMatch(/supabase|database|api/i);
    });
  });

  describe("the log event", () => {
    it("is a stable low-cardinality category", () => {
      expect(
        describeAuthFailure("sign-in", providerError("invalid_credentials"))
          .logEvent,
      ).toBe("auth.invalid_credentials");
    });

    it("carries no provider text and no email address", () => {
      const error = providerError(
        "invalid_credentials",
        400,
        "Invalid login credentials for patient@example.test",
      );
      const result = describeAuthFailure("sign-in", error);

      expect(result.logEvent).not.toContain("@");
      expect(result.logEvent).not.toContain("example.test");
      expect(result.logEvent).not.toContain("Invalid login");
    });
  });

  describe("field errors", () => {
    it("attaches an email field error for an existing account", () => {
      const result = describeAuthFailure(
        "sign-up",
        providerError("user_already_exists"),
      );
      expect(result.fieldErrors?.["email"]).toBeDefined();
    });

    it("attaches a password field error for a weak password", () => {
      const result = describeAuthFailure(
        "sign-up",
        providerError("weak_password"),
      );
      expect(result.fieldErrors?.["password"]).toBeDefined();
    });

    it("attaches none for a credentials failure", () => {
      // A field-level "this password is wrong" is exactly the distinction
      // sign-in must not draw.
      const result = describeAuthFailure(
        "sign-in",
        providerError("invalid_credentials"),
      );
      expect(result.fieldErrors).toBe(undefined);
    });
  });

  describe("operation context", () => {
    it("chooses credentials copy for an unmapped 401 during sign-in", () => {
      expect(
        describeAuthFailure("sign-in", providerError("mystery", 401)).message,
      ).toBe(AUTH_SAFE_MESSAGES.credentials);
    });

    it("chooses expired-link copy for an unmapped 401 during a callback", () => {
      expect(
        describeAuthFailure("callback", providerError("mystery", 401)).message,
      ).toBe(AUTH_SAFE_MESSAGES.expiredLink);
    });
  });

  it("handles a non-error value without throwing", () => {
    for (const value of [undefined, null, "a string", 42, {}, []]) {
      const result = describeAuthFailure("sign-in", value);
      expect(result.message).toBe(AUTH_SAFE_MESSAGES.generic);
    }
  });
});
