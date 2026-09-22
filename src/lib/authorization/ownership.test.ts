import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";

import {
  assertNotSelf,
  assertResourceOwner,
  isResourceOwner,
} from "./ownership";

/**
 * Resource-level authorization.
 *
 * The case role checks cannot reach: two users with the same role, one
 * resource, and only one of them entitled to it (`phase_08.md` sections 16-17
 * and 36).
 */

// Deliberately containing hex letters, so the case-sensitivity assertion
// below is actually testing something.
const PATIENT_A = { id: "11111111-1111-4111-8111-1111111111ab" };
const PATIENT_B = { id: "22222222-2222-4222-8222-2222222222cd" };

describe("isResourceOwner", () => {
  it("allows a user their own resource", () => {
    expect(isResourceOwner(PATIENT_A, PATIENT_A.id)).toBe(true);
  });

  it("denies one patient another patient's resource", () => {
    // The mandatory cross-user case. Both hold role = patient; only ownership
    // separates them.
    expect(isResourceOwner(PATIENT_A, PATIENT_B.id)).toBe(false);
  });

  it("denies an unowned resource to everybody", () => {
    // `patients.profile_id` is nullable so a receptionist can register a
    // walk-in before that person has a login. "Belongs to nobody" must never
    // read as "belongs to whoever is asking".
    expect(isResourceOwner(PATIENT_A, null)).toBe(false);
    expect(isResourceOwner(PATIENT_A, undefined)).toBe(false);
    expect(isResourceOwner(PATIENT_A, "")).toBe(false);
  });

  it("denies everything when there is no actor", () => {
    expect(isResourceOwner(null, PATIENT_A.id)).toBe(false);
    expect(isResourceOwner(null, null)).toBe(false);
  });

  it("compares ids exactly", () => {
    // No trimming, no case folding, no prefix matching. A UUID that differs by
    // a character is a different person, and any leniency here is an IDOR.
    expect(isResourceOwner(PATIENT_A, ` ${PATIENT_A.id} `)).toBe(false);
    expect(isResourceOwner(PATIENT_A, PATIENT_A.id.toUpperCase())).toBe(false);
    expect(isResourceOwner(PATIENT_A, PATIENT_A.id.slice(0, -1))).toBe(false);
    expect(isResourceOwner(PATIENT_A, `${PATIENT_A.id}0`)).toBe(false);
  });
});

describe("assertResourceOwner", () => {
  it("passes for the owner", () => {
    expect(() => assertResourceOwner(PATIENT_A, PATIENT_A.id)).not.toThrow();
  });

  it("throws a forbidden AppError for anybody else", () => {
    try {
      assertResourceOwner(PATIENT_A, PATIENT_B.id);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe("forbidden");
      expect((error as AppError).status).toBe(403);
    }
  });

  it("says nothing about the resource or its owner", () => {
    // `phase_08.md` sections 12 and 26. A refusal that reveals whether the
    // record exists, or whose it is, is an oracle.
    try {
      assertResourceOwner(PATIENT_A, PATIENT_B.id);
      expect.unreachable("should have thrown");
    } catch (error) {
      const message = (error as AppError).message;
      expect(message).not.toContain(PATIENT_A.id);
      expect(message).not.toContain(PATIENT_B.id);
      expect(message.toLowerCase()).not.toContain("owner");
      expect(message.toLowerCase()).not.toContain("policy");
    }
  });
});

describe("assertNotSelf", () => {
  it("allows acting on somebody else", () => {
    expect(() => assertNotSelf(PATIENT_A, PATIENT_B.id)).not.toThrow();
  });

  it("refuses acting on your own account", () => {
    // `docs/SECURITY.md` section 6: no user changes their own role, including
    // an admin acting on their own account. It stops an administrator widening
    // their own access without a second person's name on it, and stops one
    // demoting themselves and locking the clinic out.
    expect(() => assertNotSelf(PATIENT_A, PATIENT_A.id)).toThrow(AppError);
  });

  it("explains the refusal, because it is a rule rather than a denial", () => {
    try {
      assertNotSelf(PATIENT_A, PATIENT_A.id);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("forbidden");
      expect((error as AppError).message).toBe(
        "You cannot change your own role.",
      );
    }
  });

  it("does nothing without an actor, leaving the refusal to the permission check", () => {
    // An anonymous caller is stopped earlier and harder — by `assertPermission`
    // and then by the database function. Having this helper also throw would
    // produce "you cannot change your own role" for somebody with no account.
    expect(() => assertNotSelf(null, PATIENT_A.id)).not.toThrow();
  });
});
