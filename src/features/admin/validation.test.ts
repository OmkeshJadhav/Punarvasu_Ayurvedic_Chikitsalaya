import { describe, expect, it } from "vitest";

import { APP_ROLES } from "@/config/permissions";

import { appRoleSchema, roleAssignmentSchema } from "./validation";

const VALID_ID = "11111111-1111-4111-8111-1111111111ab";

describe("appRoleSchema", () => {
  it.each(APP_ROLES)("accepts %s", (role) => {
    expect(appRoleSchema.safeParse(role).success).toBe(true);
  });

  it.each([
    "superadmin",
    "root",
    "Doctor",
    "DOCTOR",
    " admin",
    "admin ",
    "adminx",
    "",
    "patient,admin",
  ])("rejects %j", (value) => {
    // `phase_08.md` section 7. The database enum is the final gate, but a value
    // that gets this far and is only caught there produces a generic failure
    // instead of a message beside the control.
    expect(appRoleSchema.safeParse(value).success).toBe(false);
  });

  it("rejects values that are not strings", () => {
    for (const value of [null, undefined, 1, true, {}, [], ["admin"]]) {
      expect(appRoleSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("roleAssignmentSchema", () => {
  it("accepts a uuid and a known role", () => {
    const result = roleAssignmentSchema.safeParse({
      targetUserId: VALID_ID,
      role: "doctor",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ targetUserId: VALID_ID, role: "doctor" });
  });

  it.each([
    "not-a-uuid",
    "",
    "11111111-1111-4111-8111",
    "'; drop table user_roles; --",
    "<script>alert(1)</script>",
    "../../admin",
    "%2e%2e%2fadmin",
  ])("rejects %j as a target", (targetUserId) => {
    expect(
      roleAssignmentSchema.safeParse({ targetUserId, role: "doctor" }).success,
    ).toBe(false);
  });

  it("rejects an unexpected key rather than dropping it", () => {
    // The second gate. The action's field list means this rarely fires for a
    // form submission; it is what protects a caller that assembles the object
    // itself — a future route handler, say.
    const result = roleAssignmentSchema.safeParse({
      targetUserId: VALID_ID,
      role: "patient",
      actorRole: "admin",
    });

    expect(result.success).toBe(false);
  });

  it("carries no field that could confer authority", () => {
    // The schema describes *what* to do. Nothing in it says who is asking or
    // what they are allowed to do — `assertPermission` and
    // `public.assign_user_role()` answer that, from the session and the
    // database.
    const shape = Object.keys(roleAssignmentSchema.shape);
    expect(shape.sort()).toEqual(["role", "targetUserId"]);

    for (const forbidden of [
      "userId",
      "actorId",
      "actorRole",
      "isAdmin",
      "permission",
      "permissions",
      "token",
      "bypass",
    ]) {
      expect(shape).not.toContain(forbidden);
    }
  });

  it("requires both fields", () => {
    expect(roleAssignmentSchema.safeParse({ role: "doctor" }).success).toBe(
      false,
    );
    expect(
      roleAssignmentSchema.safeParse({ targetUserId: VALID_ID }).success,
    ).toBe(false);
    expect(roleAssignmentSchema.safeParse({}).success).toBe(false);
  });

  it("gives a message a person can act on, and no internal detail", () => {
    const result = roleAssignmentSchema.safeParse({
      targetUserId: VALID_ID,
      role: "superadmin",
    });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages.join(" ")).toContain("Choose one of the available roles.");
    expect(messages.join(" ")).not.toContain("enum");
    expect(messages.join(" ")).not.toContain("app_role");
  });
});
