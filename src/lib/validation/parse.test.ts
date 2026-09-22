import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { parseInput } from "@/lib/validation/parse";
import {
  emailSchema,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "@/lib/validation/schemas";

const bookingSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  reason: requiredText(200, "Reason for visit"),
});

describe("parseInput", () => {
  it("should return typed data for valid input", () => {
    const parsed = parseInput(bookingSchema, {
      email: "  Patient@Example.Test ",
      phone: "+91 98765-43210",
      reason: "  Follow-up consultation  ",
    });

    expect(parsed).toEqual({
      email: "patient@example.test",
      phone: "9876543210",
      reason: "Follow-up consultation",
    });
  });

  it("should reject invalid input with per-field messages", () => {
    try {
      parseInput(bookingSchema, { email: "nope", phone: "123", reason: "" });
      expect.unreachable("invalid input should not parse");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      const appError = error as AppError;
      expect(appError.code).toBe("validation");
      expect(Object.keys(appError.fieldErrors ?? {})).toEqual([
        "email",
        "phone",
        "reason",
      ]);
    }
  });

  it("should reject input of the wrong shape entirely", () => {
    expect(() => parseInput(bookingSchema, "not-an-object")).toThrow(AppError);
    expect(() => parseInput(bookingSchema, null)).toThrow(AppError);
  });
});

describe("shared schemas", () => {
  it("should accept identifiers only in UUID form", () => {
    expect(
      uuidSchema.safeParse("8f14e45f-ceea-467a-9575-1f1a6b6a5ee2").success,
    ).toBe(true);
    expect(uuidSchema.safeParse("1 OR 1=1").success).toBe(false);
  });

  it("should normalize Indian mobile numbers and reject implausible ones", () => {
    expect(phoneSchema.parse("+919876543210")).toBe("9876543210");
    expect(phoneSchema.parse("98765 43210")).toBe("9876543210");
    expect(phoneSchema.safeParse("1234567890").success).toBe(false);
    expect(phoneSchema.safeParse("98765").success).toBe(false);
  });

  it("should bound free text", () => {
    const schema = requiredText(10);
    expect(schema.safeParse("ok").success).toBe(true);
    expect(schema.safeParse("   ").success).toBe(false);
    expect(schema.safeParse("x".repeat(11)).success).toBe(false);
  });
});
