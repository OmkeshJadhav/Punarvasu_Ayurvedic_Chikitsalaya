import { describe, expect, it } from "vitest";

import {
  APP_ERROR_CODES,
  APP_ERROR_STATUS,
  AppError,
  DEFAULT_USER_MESSAGE,
  validationError,
} from "@/lib/errors/app-error";
import { ConfigurationError } from "@/lib/errors/configuration-error";
import { toAppError } from "@/lib/errors/normalize";

describe("AppError", () => {
  it("should map every error category to an HTTP status and a user message", () => {
    for (const code of APP_ERROR_CODES) {
      const error = new AppError(code);
      expect(error.status).toBe(APP_ERROR_STATUS[code]);
      expect(error.message).toBe(DEFAULT_USER_MESSAGE[code]);
    }
  });

  it("should keep the underlying failure out of the user-facing message", () => {
    const error = new AppError("internal", {
      cause: new Error('relation "patients" does not exist'),
    });

    expect(error.message).not.toContain("patients");
    expect(error.message).toBe(DEFAULT_USER_MESSAGE.internal);
  });

  it("should carry field errors for validation failures", () => {
    const error = validationError({ email: ["Enter a valid email address."] });

    expect(error.code).toBe("validation");
    expect(error.status).toBe(400);
    expect(error.fieldErrors?.email).toEqual(["Enter a valid email address."]);
  });
});

describe("toAppError", () => {
  it("should return an existing application error unchanged", () => {
    const original = new AppError("forbidden");
    expect(toAppError(original)).toBe(original);
  });

  it("should convert an unknown database failure into a generic internal error", () => {
    const dbError = new Error(
      "insert into clinical_notes failed: duplicate key value violates unique constraint",
    );

    const appError = toAppError(dbError);

    expect(appError.code).toBe("internal");
    expect(appError.message).toBe(DEFAULT_USER_MESSAGE.internal);
    expect(appError.message).not.toContain("clinical_notes");
    expect(appError.cause).toBe(dbError);
  });

  it("should convert a thrown non-error value without exposing it", () => {
    const appError = toAppError("SUPABASE_SERVICE_ROLE_KEY=abc123");

    expect(appError.code).toBe("internal");
    expect(appError.message).not.toContain("abc123");
  });
});

describe("ConfigurationError", () => {
  it("should report a generic message to users while naming variables for logs", () => {
    const error = new ConfigurationError([
      "NEXT_PUBLIC_SUPABASE_URL: must be an absolute URL",
    ]);

    expect(error.code).toBe("internal");
    expect(error.message).toBe(DEFAULT_USER_MESSAGE.internal);
    expect(error.problems).toContain(
      "NEXT_PUBLIC_SUPABASE_URL: must be an absolute URL",
    );
  });
});
