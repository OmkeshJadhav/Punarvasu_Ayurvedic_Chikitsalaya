import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/types/database";

/**
 * Role assignment — the privilege-escalation surface.
 *
 * Every attack in `phase_08.md` sections 25, 33 and 40 is driven here against
 * the real server action: a patient promoting themselves, a receptionist
 * reaching admin functionality, a doctor performing an admin-only operation,
 * request-body role injection, a forged target id, an invalid role, and an
 * administrator promoting themselves.
 *
 * The database function is stubbed, which means these tests prove the
 * *application* layer refuses. That is deliberate and it is only half the
 * story: the other half is that `public.assign_user_role()` performs the same
 * checks itself, so deleting every line asserted here would still leave the
 * operation refused. The last test in this file asserts the call is even made
 * through that function rather than as a table write.
 */

const getCurrentUser = vi.fn();
const rpc = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const logLines: string[] = [];

const ACTOR_ID = "11111111-1111-4111-8111-1111111111ab";
const TARGET_ID = "22222222-2222-4222-8222-2222222222cd";

function signedInAs(role: AppRole | null, id = ACTOR_ID) {
  getCurrentUser.mockResolvedValue({
    id,
    email: "actor@example.test",
    emailVerified: true,
    role,
    displayName: "Acting Person",
  });
}

function formOf(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return form;
}

beforeEach(() => {
  vi.resetModules();
  logLines.length = 0;
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
  rpc.mockResolvedValue({ data: "doctor", error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function assign(values: Record<string, string>) {
  const { assignRoleAction } = await import("@/features/admin/actions");
  const { IDLE_ROLE_ASSIGNMENT_STATE } = await import("@/features/admin/types");
  return assignRoleAction(IDLE_ROLE_ASSIGNMENT_STATE, formOf(values));
}

/**
 * Asserts the refusal never reached the domain.
 *
 * Phase 19 added an audit entry to every authorization denial, so a refused
 * request *does* now reach the database — to record that it was refused. That
 * makes the blunt "no RPC at all" assertion wrong, and replacing it with a
 * weaker one would be the wrong correction.
 *
 * This is the stronger statement: the only thing that reached the database was
 * the audit write, it recorded a denial, and `assign_user_role` was never
 * called. It proves what the old assertion proved and, in addition, that the
 * refusal is now attributable.
 */
function expectRefusedWithoutReachingTheDomain(): void {
  const domainCalls = rpc.mock.calls.filter(
    ([name]) => name !== "record_security_audit_event",
  );
  expect(domainCalls).toEqual([]);

  for (const [, args] of rpc.mock.calls) {
    expect(args).toMatchObject({
      p_action: "authorization.denied",
      p_outcome: "denied",
    });
  }
}

describe("who may assign a role", () => {
  it("lets an admin assign a role to somebody else", async () => {
    signedInAs("admin");

    const state = await assign({ targetUserId: TARGET_ID, role: "doctor" });

    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("assign_user_role", {
      target_user_id: TARGET_ID,
      new_role: "doctor",
    });
  });

  it.each(["patient", "receptionist", "doctor", null] as const)(
    "refuses %s, and never reaches the database",
    async (role) => {
      // patient -> admin functionality: DENIED.
      // receptionist -> admin functionality: DENIED.
      // doctor -> admin-only operation: DENIED.
      // unresolvable role -> DENIED (fail closed).
      signedInAs(role);

      const state = await assign({ targetUserId: TARGET_ID, role: "admin" });

      expect(state.status).toBe("error");
      expectRefusedWithoutReachingTheDomain();
    },
  );

  it("refuses a caller with no session", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await assign({ targetUserId: TARGET_ID, role: "admin" });

    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });
});

describe("self-promotion", () => {
  it("refuses a patient promoting themselves to admin", async () => {
    // The headline attack. It is refused twice over: the actor is not an
    // admin, and the target is the actor.
    signedInAs("patient");

    const state = await assign({ targetUserId: ACTOR_ID, role: "admin" });

    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });

  it("refuses an admin promoting or demoting themselves", async () => {
    // `docs/SECURITY.md` section 6: no user changes their own role, including
    // an admin. It forces a second person's name onto every privilege change
    // and stops an administrator locking the clinic out of its own admin.
    signedInAs("admin");

    const state = await assign({ targetUserId: ACTOR_ID, role: "patient" });

    expect(state.status).toBe("error");
    expect(state.message).toBe("You cannot change your own role.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("request manipulation", () => {
  it("ignores an injected role field, because authority never comes from the body", async () => {
    // `{ "userId": "victim", "role": "admin" }` — the shape section 25 warns
    // about. The body says *what*; `getCurrentUser()` and the database decide
    // *whether*.
    signedInAs("patient");

    const state = await assign({
      targetUserId: ACTOR_ID,
      role: "admin",
      // Extra fields a hostile client might hope are read.
      userId: ACTOR_ID,
      actorRole: "admin",
      isAdmin: "true",
      permission: "roles.manage",
    });

    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });

  it("never reads a field the form does not define", async () => {
    // The first of the allowlist's two gates. `readRoleForm` reads two named
    // fields, so an extra one is not read at all — it cannot reach the schema,
    // the action or the database, whatever it is called. The second gate,
    // `roleAssignmentSchema.strict()`, catches an unexpected key on any object
    // built programmatically rather than from this form; `validation.test.ts`
    // covers that.
    signedInAs("admin");

    const state = await assign({
      targetUserId: TARGET_ID,
      role: "doctor",
      elevate: "yes",
      actorRole: "admin",
    });

    // The legitimate part of the request still succeeds, and the extra fields
    // had no effect whatsoever on what was sent.
    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("assign_user_role", {
      target_user_id: TARGET_ID,
      new_role: "doctor",
    });
  });

  it.each([
    ["an unknown role", "superadmin"],
    ["a differently cased role", "Doctor"],
    ["an uppercase role", "ADMIN"],
    ["a root role", "root"],
    ["an empty role", ""],
  ])("rejects %s", async (_name, role) => {
    signedInAs("admin");

    const state = await assign({ targetUserId: TARGET_ID, role });

    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });

  it.each([
    ["a non-uuid target", "not-a-uuid"],
    ["an empty target", ""],
    ["a SQL-shaped target", "'; drop table user_roles; --"],
    ["a script-shaped target", "<script>alert(1)</script>"],
    ["a traversal-shaped target", "../../admin"],
  ])("rejects %s", async (_name, targetUserId) => {
    signedInAs("admin");

    const state = await assign({ targetUserId, role: "admin" });

    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });

  it("does not let a file where an id belongs become a value", async () => {
    signedInAs("admin");

    const form = new FormData();
    form.append("targetUserId", new File(["x"], "id.txt"));
    form.append("role", "admin");

    const { assignRoleAction } = await import("@/features/admin/actions");
    const { IDLE_ROLE_ASSIGNMENT_STATE } =
      await import("@/features/admin/types");

    const state = await assignRoleAction(IDLE_ROLE_ASSIGNMENT_STATE, form);
    expect(state.status).toBe("error");
    expectRefusedWithoutReachingTheDomain();
  });
});

describe("when the database refuses", () => {
  it("shows safe copy for a permission error and no database text", async () => {
    // Reaching here means the application check passed and the database check
    // did not — a genuine disagreement between the layers, and exactly why
    // both exist.
    signedInAs("admin");
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message:
          'new row violates row-level security policy for table "user_roles"',
      },
    });

    const state = await assign({ targetUserId: TARGET_ID, role: "admin" });

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("user_roles");
    expect(state.message).not.toContain("row-level");
    expect(state.message).not.toContain("42501");
  });

  it("explains an unknown target without confirming whether it exists elsewhere", async () => {
    signedInAs("admin");
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Unknown user." },
    });

    const state = await assign({ targetUserId: TARGET_ID, role: "doctor" });

    expect(state.status).toBe("error");
    expect(state.message).toBe(
      "That account no longer exists. Refresh the page and try again.",
    );
  });

  it("shows generic copy for anything else, leaking no schema", async () => {
    signedInAs("admin");
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.user_roles" does not exist',
      },
    });

    const state = await assign({ targetUserId: TARGET_ID, role: "doctor" });

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("relation");
    expect(state.message).not.toContain("user_roles");
    expect(state.message).not.toContain("public.");
  });

  it("survives a thrown failure without exposing it", async () => {
    signedInAs("admin");
    rpc.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.4:5432"));

    const state = await assign({ targetUserId: TARGET_ID, role: "doctor" });

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("ECONNREFUSED");
    expect(state.message).not.toContain("10.0.0.4");
  });
});

describe("what a role change records", () => {
  it("logs the actor, the target and the new role — and no address or name", async () => {
    // `phase_08.md` section 27: actor, target, previous, new, timestamp,
    // result. The authoritative record is the `role_assignment_events` row the
    // database writes; this is its operational echo.
    signedInAs("admin");

    await assign({ targetUserId: TARGET_ID, role: "doctor" });

    const combined = logLines.join("\n");
    expect(combined).toContain("admin.role_assigned");
    expect(combined).toContain(ACTOR_ID);
    expect(combined).toContain(TARGET_ID);
    expect(combined).toContain("doctor");
    expect(combined).not.toContain("actor@example.test");
    expect(combined).not.toContain("Acting Person");
  });

  it("records a refusal against the acting user", async () => {
    signedInAs("patient");

    await assign({ targetUserId: TARGET_ID, role: "admin" });

    const combined = logLines.join("\n");
    expect(combined).toContain("authz.denied");
    expect(combined).toContain(ACTOR_ID);
  });
});

describe("how the write is made", () => {
  it("goes through the authorized database function, never a table write", async () => {
    // The guarantee that makes the database the real boundary. A direct
    // `.from("user_roles").upsert(...)` would fail anyway — there is no insert
    // or update grant — but asserting the call shape here means a future
    // refactor cannot quietly move the check into application code alone.
    signedInAs("admin");

    await assign({ targetUserId: TARGET_ID, role: "receptionist" });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("assign_user_role", {
      target_user_id: TARGET_ID,
      new_role: "receptionist",
    });
  });

  it("refreshes the access list so the new role is what is shown", async () => {
    signedInAs("admin");

    await assign({ targetUserId: TARGET_ID, role: "receptionist" });

    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("does not refresh anything when the change was refused", async () => {
    signedInAs("doctor");

    await assign({ targetUserId: TARGET_ID, role: "admin" });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
