import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROLES } from "@/config/permissions";
import type { AppRole } from "@/types/database";

/**
 * Server-side authorization guards, driven against each of the five actors
 * `phase_08.md` section 40 asks to be verified: unauthenticated, patient,
 * receptionist, doctor and admin.
 *
 * The role is stubbed at `getCurrentUser`, which is the *only* function in the
 * application that produces one and which reads it from the database. That is
 * the boundary worth stubbing: everything below it is what these tests are
 * about, and everything above it is covered by `auth-session.test.ts`.
 */

const getCurrentUser = vi.fn();
const requireUser = vi.fn();

const redirect = vi.fn((path: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;${path}`,
  });
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: (intendedPath?: string) => requireUser(intendedPath),
}));

const logLines: string[] = [];

const USER_ID = "11111111-1111-4111-8111-111111111111";

function signedInAs(role: AppRole | null) {
  const user = {
    id: USER_ID,
    email: "someone@example.test",
    emailVerified: true,
    role,
    displayName: "Test Person",
  };

  getCurrentUser.mockResolvedValue(user);
  requireUser.mockResolvedValue(user);
  return user;
}

function signedOut() {
  getCurrentUser.mockResolvedValue(null);
  // The real `requireUser` redirects rather than returning null.
  requireUser.mockImplementation((intendedPath?: string) => {
    redirect(`/auth/login?next=${encodeURIComponent(intendedPath ?? "/")}`);
  });
}

beforeEach(() => {
  vi.resetModules();
  logLines.length = 0;
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadGuards() {
  return import("@/lib/authorization/guards");
}

/** Runs `fn` and reports the path it redirected to, or `null`. */
async function redirectedTo(
  fn: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    return digest.startsWith("NEXT_REDIRECT;")
      ? digest.slice("NEXT_REDIRECT;".length)
      : null;
  }
}

describe("requirePermission", () => {
  it("returns the user when they hold the permission", async () => {
    signedInAs("patient");
    const { requirePermission } = await loadGuards();

    const user = await requirePermission("profile.read.self");
    expect(user.id).toBe(USER_ID);
  });

  it.each(["receptionist", "doctor", "admin"] as const)(
    "sends %s away from a patient-only capability",
    async (role) => {
      signedInAs(role);
      const { requirePermission } = await loadGuards();

      expect(
        await redirectedTo(() => requirePermission("profile.read.self")),
      ).toBe("/forbidden");
    },
  );

  it.each(["patient", "receptionist", "doctor"] as const)(
    "sends %s away from an admin-only capability",
    async (role) => {
      // `phase_08.md` section 35: patient -> admin DENIED,
      // receptionist -> admin DENIED, doctor -> admin DENIED.
      signedInAs(role);
      const { requirePermission } = await loadGuards();

      expect(await redirectedTo(() => requirePermission("roles.manage"))).toBe(
        "/forbidden",
      );
    },
  );

  it("allows an admin an admin-only capability", async () => {
    signedInAs("admin");
    const { requirePermission } = await loadGuards();

    await expect(requirePermission("roles.manage")).resolves.toMatchObject({
      id: USER_ID,
    });
  });

  it("denies everything when the role could not be resolved", async () => {
    signedInAs(null);
    const { requirePermission } = await loadGuards();

    expect(
      await redirectedTo(() => requirePermission("profile.read.self")),
    ).toBe("/forbidden");
    expect(await redirectedTo(() => requirePermission("roles.manage"))).toBe(
      "/forbidden",
    );
  });

  it("sends an unauthenticated visitor to sign in, not to forbidden", async () => {
    // Being told "you don't have permission" for something you have not yet
    // identified yourself for is both unhelpful and a small disclosure.
    signedOut();
    const { requirePermission } = await loadGuards();

    const destination = await redirectedTo(() =>
      requirePermission("roles.manage", "/admin"),
    );
    expect(destination).toContain("/auth/login");
    expect(destination).not.toContain("/forbidden");
  });
});

describe("requireAreaAccess", () => {
  it("admits a patient to the patient area and refuses everyone else", async () => {
    const { PROTECTED_AREAS } = await import("@/lib/authorization/routes");

    for (const role of APP_ROLES) {
      vi.resetModules();
      signedInAs(role);
      const { requireAreaAccess } = await loadGuards();

      const destination = await redirectedTo(() =>
        requireAreaAccess(PROTECTED_AREAS.patient),
      );
      expect(destination).toBe(role === "patient" ? null : "/forbidden");
    }
  });

  it("admits an admin to administration and refuses everyone else", async () => {
    const { PROTECTED_AREAS } = await import("@/lib/authorization/routes");

    for (const role of APP_ROLES) {
      vi.resetModules();
      signedInAs(role);
      const { requireAreaAccess } = await loadGuards();

      const destination = await redirectedTo(() =>
        requireAreaAccess(PROTECTED_AREAS.admin),
      );
      expect(destination).toBe(role === "admin" ? null : "/forbidden");
    }
  });
});

describe("requireRole and requireAnyRole", () => {
  it("admits only the exact role", async () => {
    signedInAs("doctor");
    const { requireRole } = await loadGuards();

    await expect(requireRole("doctor")).resolves.toMatchObject({ id: USER_ID });
    expect(await redirectedTo(() => requireRole("admin"))).toBe("/forbidden");
  });

  it("does not treat admin as implying every other role", async () => {
    // No hierarchy. An administrator is not thereby a practitioner, which
    // matters the moment clinical authoring exists.
    signedInAs("admin");
    const { requireRole } = await loadGuards();

    expect(await redirectedTo(() => requireRole("doctor"))).toBe("/forbidden");
  });

  it("admits any listed role", async () => {
    signedInAs("receptionist");
    const { requireAnyRole } = await loadGuards();

    await expect(
      requireAnyRole(["receptionist", "admin"]),
    ).resolves.toMatchObject({ id: USER_ID });
    expect(await redirectedTo(() => requireAnyRole(["doctor", "admin"]))).toBe(
      "/forbidden",
    );
  });
});

describe("assertPermission", () => {
  it("returns the user when they hold the permission", async () => {
    signedInAs("admin");
    const { assertPermission } = await loadGuards();

    await expect(assertPermission("roles.manage")).resolves.toMatchObject({
      id: USER_ID,
    });
  });

  it("throws rather than redirecting, so an action can report it", async () => {
    signedInAs("patient");
    const { assertPermission } = await loadGuards();
    const { AppError } = await import("@/lib/errors/app-error");

    await expect(assertPermission("roles.manage")).rejects.toBeInstanceOf(
      AppError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws a 403 with a message that reveals nothing", async () => {
    signedInAs("patient");
    const { assertPermission } = await loadGuards();

    try {
      await assertPermission("roles.manage");
      expect.unreachable("should have thrown");
    } catch (error) {
      const appError = error as { status: number; message: string };
      expect(appError.status).toBe(403);
      // Not the role held, not the role required, not the permission, not a
      // policy name (`phase_08.md` section 12 and example 6).
      expect(appError.message).not.toContain("roles.manage");
      expect(appError.message).not.toContain("admin");
      expect(appError.message).not.toContain("patient");
      expect(appError.message.toLowerCase()).not.toContain("policy");
    }
  });

  it("refuses an unauthenticated caller", async () => {
    signedOut();
    const { assertPermission } = await loadGuards();

    await expect(assertPermission("roles.manage")).rejects.toThrow();
  });

  it("refuses when the role could not be resolved", async () => {
    signedInAs(null);
    const { assertPermission } = await loadGuards();

    await expect(assertPermission("roles.manage")).rejects.toThrow();
  });
});

describe("currentUserCan", () => {
  it("answers without denying anything, for presentation only", async () => {
    signedInAs("admin");
    const { currentUserCan } = await loadGuards();

    expect(await currentUserCan("roles.manage")).toBe(true);
    expect(await currentUserCan("profile.read.self")).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("answers false for a signed-out visitor", async () => {
    signedOut();
    const { currentUserCan } = await loadGuards();

    expect(await currentUserCan("roles.manage")).toBe(false);
  });
});

describe("what a refusal records", () => {
  it("logs the user id and the permission, and nothing about the person", async () => {
    signedInAs("patient");
    const { assertPermission } = await loadGuards();

    await assertPermission("roles.manage").catch(() => undefined);

    const combined = logLines.join("\n");
    expect(combined).toContain("authz.denied");
    // The opaque id is what makes a real escalation attempt investigable.
    expect(combined).toContain(USER_ID);
    expect(combined).toContain("roles.manage");
    // An authorization log that records addresses is a list of the clinic's
    // patients (`docs/SECURITY.md` section 15).
    expect(combined).not.toContain("someone@example.test");
    expect(combined).not.toContain("Test Person");
  });

  it("records nothing when access is granted", async () => {
    signedInAs("admin");
    const { assertPermission } = await loadGuards();

    await assertPermission("roles.manage");
    expect(logLines.join("\n")).not.toContain("authz.denied");
  });
});
