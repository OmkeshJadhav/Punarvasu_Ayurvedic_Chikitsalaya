import { describe, expect, it } from "vitest";

import { APP_ROLES, PERMISSIONS, type Permission } from "@/config/permissions";
import type { AppRole } from "@/types/database";

import {
  can,
  canAll,
  canAny,
  hasAnyRole,
  hasRole,
  permissionsForRole,
} from "./policy";

/**
 * The authorization decision.
 *
 * The exhaustive matrix below is the point of this file: every role against
 * every permission, asserted explicitly rather than derived from the table it
 * is meant to be checking. Deriving it would make the test agree with any
 * table, including a wrong one.
 */

/** role -> permission -> expected. Read it as the permission matrix. */
const MATRIX: Readonly<Record<AppRole, Readonly<Record<Permission, boolean>>>> =
  {
    patient: {
      "profile.read.self": true,
      "profile.write.self": true,
      "appointments.read.self": true,
      "appointments.write.self": true,
      // A patient manages their own appointments and nobody else's. The
      // clinic-wide capabilities are the front desk's.
      "appointments.manage.any": false,
      "patients.read.operational": false,
      "patients.write.operational": false,
      // Nor anything a practitioner holds. A patient is not a doctor with a
      // narrower scope; they are a different kind of actor.
      "appointments.read.own_schedule": false,
      "appointments.manage.own_schedule": false,
      "patients.read.care": false,
      // Phase 12. A patient does not read the doctor-facing clinical record
      // of their own care: `phase_12.md` sections 21 and 53 require a
      // patient-facing view to be a deliberately authorized projection, and
      // Phase 12 does not build one.
      "clinical_records.read": false,
      "clinical_records.write": false,
      // Phase 13. **The first clinical permissions a patient has ever held**,
      // and `docs/SECURITY.md` section 6's matrix has always said so:
      // "Prescriptions | View own". They are read-only and `.self`-scoped,
      // and the database adds the half that matters — a draft is invisible,
      // because `prescriptions_select_patient` carries `status <> 'draft'`.
      "prescriptions.read": false,
      "prescriptions.write": false,
      "prescriptions.read.self": true,
      "treatment_plans.read": false,
      "treatment_plans.write": false,
      "treatment_plans.read.self": true,
      // Phase 14. A patient keeps their own documents: they read them and
      // they upload them. Both are `.self`-scoped, and neither reaches a
      // document on anybody else's record — `patient_documents_select_own`
      // decides that, not this table.
      "documents.read.self": true,
      "documents.write.self": true,
      "documents.read.care": false,
      "documents.write.care": false,
      "clinical_ai.use": false,
      // Phase 15. The first permissions every role holds. A notification is a
      // message addressed to one account — not clinical data, and not anybody
      // else's data — so the capability belongs to being signed in rather
      // than to being a patient. `notifications_select_own` is what scopes it
      // to the caller, and neither confers any ability to send anything.
      "notifications.read.self": true,
      "notifications.write.self": true,
      // Phase 16. A patient reads no internal clinic analytics at all
      // (`phase_16.md` section 6). Their own appointments and prescriptions
      // are a product experience they already have, not a dashboard.
      "analytics.read.operational": false,
      "analytics.read.clinic": false,
      "analytics.read.own_practice": false,
      "reports.export": false,
      "users.read": false,
      "roles.manage": false,
    },
    receptionist: {
      // No `*.self` permission, including the appointment ones. A receptionist
      // who is also a patient of the clinic uses a separate patient account
      // (`docs/SECURITY.md` section 6), which keeps every authorization
      // decision unambiguous — and it is why "manage any appointment" does not
      // imply "manage my own".
      "profile.read.self": false,
      "profile.write.self": false,
      "appointments.read.self": false,
      "appointments.write.self": false,
      // Phase 10. The three front-desk capabilities, granted with the
      // workspace that uses them and to this role alone.
      "appointments.manage.any": true,
      "patients.read.operational": true,
      "patients.write.operational": true,
      // The front desk runs the diary; it does not hold a diary of its own,
      // and it does not hold the practitioner's care-scoped patient access.
      // The two sets are complements, not one narrowed.
      "appointments.read.own_schedule": false,
      "appointments.manage.own_schedule": false,
      "patients.read.care": false,
      // **The hard boundary.** `docs/SECURITY.md` section 6 and
      // `phase_12.md` section 22: a receptionist cannot read clinical notes,
      // assessments, treatment plans or prescriptions, and this is not to be
      // weakened for convenience. It is false here, there is no policy on
      // `clinical_records` that a receptionist matches, and there is no write
      // grant for anybody.
      "clinical_records.read": false,
      "clinical_records.write": false,
      // **The hard boundary, extended.** `docs/SECURITY.md` section 6's
      // matrix marks both treatment plans and prescriptions "No" for a
      // receptionist, and `phase_13.md` section 36 and example 7 say so
      // again: the front desk gets operational patient information and no
      // full clinical prescription access. False here, no policy on any of
      // the four Phase 13 tables that a receptionist matches, and no write
      // grant for anybody.
      "prescriptions.read": false,
      "prescriptions.write": false,
      "prescriptions.read.self": false,
      "treatment_plans.read": false,
      "treatment_plans.write": false,
      "treatment_plans.read.self": false,
      // **The hard boundary, extended again.** `phase_14.md` section 19 is
      // explicit that a receptionist must not be given document access
      // merely for holding the role, and `docs/SECURITY.md` section 6's
      // "Upload only" describes an operational workflow nobody has designed.
      // False here, and **no policy at all** on `public.patient_documents`
      // or on the bucket that a receptionist matches.
      "documents.read.self": false,
      "documents.write.self": false,
      "documents.read.care": false,
      "documents.write.care": false,
      "clinical_ai.use": false,
      // Phase 15. Held by every role, for the reason recorded against the
      // patient above.
      "notifications.read.self": true,
      "notifications.write.self": true,
      // Phase 16. The front desk's own operational numbers: appointment
      // volume, outcomes, practitioner workload and patient growth. Every one
      // is a count of something they already handle one at a time all day.
      "analytics.read.operational": true,
      // Not the full clinic picture. Notification delivery is a systems
      // concern rather than a scheduling one, and clinical activity counts
      // sit on the far side of `docs/SECURITY.md` section 6's "operational,
      // never clinical" boundary.
      "analytics.read.clinic": false,
      "analytics.read.own_practice": false,
      // Section 44: exporting is a stronger capability than viewing, and
      // nobody has asked the front desk to produce files.
      "reports.export": false,
      "users.read": false,
      "roles.manage": false,
    },
    doctor: {
      // No `*.self` permission. A practitioner who is also a patient of the
      // clinic uses a separate patient account (`docs/SECURITY.md` section
      // 6), which keeps every authorization decision unambiguous.
      "profile.read.self": false,
      "profile.write.self": false,
      "appointments.read.self": false,
      "appointments.write.self": false,
      // **Not** the front desk's clinic-wide capabilities. A doctor sees
      // their own diary and the patients they are booked to see, and holds
      // nothing that reaches the whole clinic.
      "appointments.manage.any": false,
      "patients.read.operational": false,
      "patients.write.operational": false,
      // Phase 11. The three granted with `/doctor`, and to this role alone.
      "appointments.read.own_schedule": true,
      "appointments.manage.own_schedule": true,
      "patients.read.care": true,
      // Phase 12. Granted with `public.clinical_records` and the consultation
      // workspace, and to this role alone. Narrower than `patients.read.care`
      // in practice: being booked to see somebody lets a practitioner read
      // who they are, and `clinical_records_select_author` is what decides
      // whether they may read what a colleague concluded — it says no.
      "clinical_records.read": true,
      "clinical_records.write": true,
      // Phase 13. Granted with `public.prescriptions`,
      // `public.treatment_plans` and the builders that write them, and to
      // this role alone. Not the `.self` pair: a practitioner who is also a
      // patient of the clinic uses a separate patient account.
      "prescriptions.read": true,
      "prescriptions.write": true,
      "prescriptions.read.self": false,
      "treatment_plans.read": true,
      "treatment_plans.write": true,
      "treatment_plans.read.self": false,
      // Phase 14. Granted with `public.patient_documents` and the two
      // surfaces that use them. Scoped by the **care relationship** rather
      // than by authorship — deliberately wider than the clinical
      // permissions above, because a lab report is evidence the patient
      // brought for whoever is treating them rather than a colleague's
      // conclusion about them.
      "documents.read.self": false,
      "documents.write.self": false,
      "documents.read.care": true,
      "documents.write.care": true,
      "clinical_ai.use": true,
      // Phase 15. Held by every role, for the reason recorded against the
      // patient above.
      "notifications.read.self": true,
      "notifications.write.self": true,
      // Phase 16. Their own practice, and the scope is not this permission's
      // to decide: there is no practitioner argument on any of the three RPCs
      // it unlocks. A doctor sees no colleague's figures and no clinic total.
      "analytics.read.own_practice": true,
      "analytics.read.operational": false,
      "analytics.read.clinic": false,
      "reports.export": false,
      "users.read": false,
      "roles.manage": false,
    },
    admin: {
      "profile.read.self": false,
      "profile.write.self": false,
      // Not a patient of the clinic. A staff member who is also a patient uses
      // a separate patient account (`docs/SECURITY.md` section 6), which is
      // why no staff role carries any `*.self` permission.
      "appointments.read.self": false,
      "appointments.write.self": false,
      // `docs/SECURITY.md` section 6's matrix marks the front-desk
      // capabilities "Controlled" for an administrator, which is a statement
      // about a surface that does not exist: there is no administrative
      // scheduling screen and no audit trail for administrative access to
      // patient records. Granting them here would grant them through a UI
      // nobody has designed.
      "appointments.manage.any": false,
      "patients.read.operational": false,
      "patients.write.operational": false,
      // An administrator is not also a practitioner. There is no
      // administrative clinical surface, and a clinical capability granted
      // through a UI nobody has designed is one nobody has audited.
      "appointments.read.own_schedule": false,
      "appointments.manage.own_schedule": false,
      "patients.read.care": false,
      // `phase_12.md` section 23: the admin role does not automatically mean
      // unrestricted clinical access, and administrative capability and
      // clinical access are separate concepts. `docs/SECURITY.md` section 6's
      // matrix marks clinical notes "Read, audited" for an administrator —
      // and the audit subsystem that "audited" refers to does not exist, so
      // granting the read now would grant it unaudited.
      "clinical_records.read": false,
      "clinical_records.write": false,
      // The same reasoning, for the same reason. `phase_13.md` section 37:
      // admin does not automatically imply clinical prescription access, and
      // any administrative access must be explicitly authorized **and
      // audited**. The matrix marks prescriptions and treatment plans "Read,
      // audited" — and there is still no audit subsystem, so the read stays
      // ungranted rather than being granted unaudited.
      "prescriptions.read": false,
      "prescriptions.write": false,
      "prescriptions.read.self": false,
      "treatment_plans.read": false,
      "treatment_plans.write": false,
      "treatment_plans.read.self": false,
      // `phase_14.md` section 20, and the same audit argument a third time.
      // The matrix marks patient documents "Controlled, audited" for an
      // administrator; there is still no audit subsystem, so the read stays
      // ungranted rather than being granted unaudited. There is **no policy
      // at all** on `public.patient_documents` or on the bucket that an
      // administrator matches.
      "documents.read.self": false,
      "documents.write.self": false,
      "documents.read.care": false,
      "documents.write.care": false,
      "clinical_ai.use": false,
      // Phase 15. Held by every role, for the reason recorded against the
      // patient above.
      "notifications.read.self": true,
      "notifications.write.self": true,
      // Phase 16. The full clinic picture, and the only role that may export.
      // The administrator holds the operational permission explicitly rather
      // than inheriting it — there is no role hierarchy in this product.
      "analytics.read.operational": true,
      "analytics.read.clinic": true,
      "reports.export": true,
      // Not a practitioner's own practice. An administrator is not a doctor
      // with a wider scope; `analytics.read.own_practice` resolves to whoever
      // the caller's practitioner record is, and an admin has none.
      "analytics.read.own_practice": false,
      "users.read": true,
      "roles.manage": true,
    },
  };

describe("can", () => {
  for (const role of APP_ROLES) {
    for (const permission of PERMISSIONS) {
      const expected = MATRIX[role][permission];

      it(`${expected ? "allows" : "denies"} ${role} -> ${permission}`, () => {
        expect(can(role, permission)).toBe(expected);
      });
    }
  }

  it("denies every permission when the role could not be resolved", () => {
    // `null` means "identity known, role not resolvable" — a missing
    // assignment row, or a database that could not be reached. Failing closed
    // is the whole reason it is not defaulted to `patient`
    // (`docs/SECURITY.md` section 2.5).
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
    }
  });

  it("denies a role that is not in the model", () => {
    // Defence against a value that got past the enum somehow — a stale row, a
    // hand-edited database, a future migration half-applied. An unknown role
    // must hold nothing rather than everything.
    const rogue = "superadmin" as AppRole;
    for (const permission of PERMISSIONS) {
      expect(can(rogue, permission)).toBe(false);
    }
  });
});

describe("permissionsForRole", () => {
  it("returns nothing for an unresolvable role", () => {
    expect(permissionsForRole(null)).toEqual([]);
  });

  it("agrees with can() for every role", () => {
    for (const role of APP_ROLES) {
      for (const permission of PERMISSIONS) {
        expect(permissionsForRole(role).includes(permission)).toBe(
          can(role, permission),
        );
      }
    }
  });
});

describe("canAll and canAny", () => {
  it("requires every permission for canAll", () => {
    expect(canAll("patient", ["profile.read.self", "profile.write.self"])).toBe(
      true,
    );
    expect(canAll("patient", ["profile.read.self", "roles.manage"])).toBe(
      false,
    );
  });

  it("requires one permission for canAny", () => {
    expect(canAny("patient", ["profile.read.self", "roles.manage"])).toBe(true);
    expect(canAny("patient", ["users.read", "roles.manage"])).toBe(false);
  });

  it("treats an empty list as vacuously satisfied for canAll and never for canAny", () => {
    // Stated so the behaviour is a decision rather than a discovery. A guard
    // handed an empty list is a bug in the guard, and neither answer here
    // grants access to anything.
    expect(canAll("patient", [])).toBe(true);
    expect(canAny("patient", [])).toBe(false);
  });

  it("denies both for an unresolvable role", () => {
    expect(canAll(null, ["profile.read.self"])).toBe(false);
    expect(canAny(null, [...PERMISSIONS])).toBe(false);
  });
});

describe("hasRole and hasAnyRole", () => {
  it("matches only the exact role", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("doctor", "admin")).toBe(false);
    expect(hasRole(null, "patient")).toBe(false);
  });

  it("does not imply a hierarchy", () => {
    // An admin is not "also a doctor". There is no inheritance in this model,
    // and a check that assumed one would silently grant clinical access to
    // clinic administrators.
    expect(hasRole("admin", "doctor")).toBe(false);
    expect(hasRole("doctor", "receptionist")).toBe(false);
  });

  it("matches any listed role", () => {
    expect(hasAnyRole("doctor", ["doctor", "admin"])).toBe(true);
    expect(hasAnyRole("patient", ["doctor", "admin"])).toBe(false);
    expect(hasAnyRole(null, [...APP_ROLES])).toBe(false);
  });
});
