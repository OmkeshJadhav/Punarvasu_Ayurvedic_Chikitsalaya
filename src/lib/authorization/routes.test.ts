import { describe, expect, it } from "vitest";

import { APP_ROLES, PERMISSIONS } from "@/config/permissions";
import { AUTHENTICATED_LANDING_PATH, isProtectedPath } from "@/lib/auth/paths";

import {
  ADMIN_AREA_PATH,
  DOCTOR_AREA_PATH,
  FORBIDDEN_PATH,
  PATIENT_AREA_PATH,
  RECEPTIONIST_AREA_PATH,
  PROTECTED_AREAS,
  PROTECTED_AREA_LIST,
  areasForRole,
  landingPathForRole,
  requiredPermissionForPath,
} from "./routes";

describe("the protected-area table", () => {
  it("requires a permission that exists for every area", () => {
    for (const area of PROTECTED_AREA_LIST) {
      expect(PERMISSIONS).toContain(area.permission);
    }
  });

  it("gives every area a path, a permission and a label", () => {
    for (const area of PROTECTED_AREA_LIST) {
      expect(area.path.startsWith("/")).toBe(true);
      expect(area.permission).toBeTruthy();
      expect(area.label).toBeTruthy();
    }
  });

  it("declares no area that the proxy would let through unauthenticated", () => {
    // Every permission-gated area must also be an authentication-gated one, or
    // the early redirect misses it and an unauthenticated visitor reaches a
    // guard that redirects them to sign in a step later than it should.
    for (const area of PROTECTED_AREA_LIST) {
      expect(isProtectedPath(area.path)).toBe(true);
    }
    expect(isProtectedPath(FORBIDDEN_PATH)).toBe(true);
  });

  it("does not fabricate routes for phases that have not been built", () => {
    // `phase_08.md` sections 23 and 37. Each of these arrived in the same
    // change as the workspace it guards: `/receptionist` in Phase 10 and
    // `/doctor` in Phase 11. Nothing here guards a route that does not exist,
    // and the list is written out so adding a fifth is a deliberate edit.
    const paths = PROTECTED_AREA_LIST.map((area) => area.path);
    expect(paths).toEqual([
      PATIENT_AREA_PATH,
      RECEPTIONIST_AREA_PATH,
      DOCTOR_AREA_PATH,
      ADMIN_AREA_PATH,
    ]);
  });
});

describe("requiredPermissionForPath", () => {
  it.each([
    ["/patient", "profile.read.self"],
    ["/patient/profile", "profile.read.self"],
    ["/receptionist", "appointments.manage.any"],
    ["/receptionist/schedule", "appointments.manage.any"],
    ["/receptionist/schedule/new", "appointments.manage.any"],
    ["/receptionist/patients", "appointments.manage.any"],
    ["/doctor", "appointments.read.own_schedule"],
    ["/doctor/appointments", "appointments.read.own_schedule"],
    ["/doctor/appointments/abc", "appointments.read.own_schedule"],
    ["/doctor/appointments/abc/consultation", "appointments.read.own_schedule"],
    ["/doctor/patients", "appointments.read.own_schedule"],
    ["/doctor/patients/abc", "appointments.read.own_schedule"],
    ["/admin", "roles.manage"],
    ["/admin/users", "roles.manage"],
  ])("requires %s -> %s", (pathname, permission) => {
    expect(requiredPermissionForPath(pathname)).toBe(permission);
  });

  it.each(["/", "/account", "/services", "/auth/login", FORBIDDEN_PATH])(
    "requires no particular permission for %s",
    (pathname) => {
      expect(requiredPermissionForPath(pathname)).toBe(null);
    },
  );

  it("does not let a look-alike path inherit a rule", () => {
    // `/administration` is not `/admin`, and `/patients` is not `/patient`.
    // Matching on the bare prefix without checking the separator would give a
    // future route a requirement nobody wrote for it — or, worse, would make
    // somebody assume one was written.
    expect(requiredPermissionForPath("/administration")).toBe(null);
    expect(requiredPermissionForPath("/admin-tools")).toBe(null);
    expect(requiredPermissionForPath("/patients")).toBe(null);
    expect(requiredPermissionForPath("/patientx/profile")).toBe(null);
    expect(requiredPermissionForPath("/receptionists")).toBe(null);
    expect(requiredPermissionForPath("/reception")).toBe(null);
    expect(requiredPermissionForPath("/doctors")).toBe(null);
    expect(requiredPermissionForPath("/doctor-portal")).toBe(null);
  });
});

describe("areasForRole", () => {
  it("offers the patient area to a patient and to nobody else", () => {
    expect(areasForRole("patient")).toContainEqual(PROTECTED_AREAS.patient);

    for (const role of ["receptionist", "doctor", "admin"] as const) {
      expect(areasForRole(role)).not.toContainEqual(PROTECTED_AREAS.patient);
    }
  });

  it("offers administration to an admin and to nobody else", () => {
    expect(areasForRole("admin")).toContainEqual(PROTECTED_AREAS.admin);

    for (const role of ["patient", "receptionist", "doctor"] as const) {
      expect(areasForRole(role)).not.toContainEqual(PROTECTED_AREAS.admin);
    }
  });

  it("offers the front desk to a receptionist and to nobody else", () => {
    expect(areasForRole("receptionist")).toContainEqual(
      PROTECTED_AREAS.receptionist,
    );

    for (const role of ["patient", "doctor", "admin"] as const) {
      expect(areasForRole(role)).not.toContainEqual(
        PROTECTED_AREAS.receptionist,
      );
    }
  });

  it("offers the clinical workspace to a doctor and to nobody else", () => {
    expect(areasForRole("doctor")).toContainEqual(PROTECTED_AREAS.doctor);

    for (const role of ["patient", "receptionist", "admin"] as const) {
      expect(areasForRole(role)).not.toContainEqual(PROTECTED_AREAS.doctor);
    }
  });

  it("offers exactly one area to every role in the model", () => {
    // Not a design rule, an observation worth asserting: each role has one
    // place its work lives, so `landingPathForRole` is unambiguous. A role
    // that acquires a second area should make somebody decide which is the
    // landing rather than inherit whichever happens to be first.
    for (const role of APP_ROLES) {
      expect(areasForRole(role)).toHaveLength(1);
    }
  });

  it("offers nothing when the role could not be resolved", () => {
    expect(areasForRole(null)).toEqual([]);
  });

  it("only ever offers an area the role's permission actually opens", () => {
    // The property that makes navigation and the guards inseparable: a link is
    // offered exactly when `requireAreaAccess` would let the user in.
    for (const role of [...APP_ROLES, null]) {
      for (const area of areasForRole(role)) {
        expect(requiredPermissionForPath(area.path)).toBe(area.permission);
      }
    }
  });
});

describe("landingPathForRole", () => {
  it("sends a patient to the patient area", () => {
    expect(landingPathForRole("patient")).toBe(PATIENT_AREA_PATH);
  });

  it("sends an admin to administration", () => {
    expect(landingPathForRole("admin")).toBe(ADMIN_AREA_PATH);
  });

  it("sends a receptionist to the front desk", () => {
    expect(landingPathForRole("receptionist")).toBe(RECEPTIONIST_AREA_PATH);
  });

  it("sends a doctor to the clinical workspace", () => {
    expect(landingPathForRole("doctor")).toBe(DOCTOR_AREA_PATH);
  });

  it("sends an unresolvable role to the account page, which explains why there is nowhere else", () => {
    expect(landingPathForRole(null)).toBe(AUTHENTICATED_LANDING_PATH);
  });

  it("never returns a path the role cannot enter", () => {
    for (const role of [...APP_ROLES, null]) {
      const path = landingPathForRole(role);
      const required = requiredPermissionForPath(path);

      if (required !== null) {
        expect(areasForRole(role).map((area) => area.path)).toContain(path);
      }
    }
  });
});
