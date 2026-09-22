import { describe, expect, it } from "vitest";

import {
  APP_ROLES,
  PERMISSIONS,
  PERMISSIONS_BY_ROLE,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "./permissions";

/**
 * The policy table itself.
 *
 * These are not tests of behaviour — `policy.ts` covers that. They are tests
 * that the *table* says what the project's security documentation says it
 * should, so that a future edit which quietly widens a role fails here rather
 * than being discovered by whoever it lets in.
 */

describe("the role model", () => {
  it("is exactly the four canonical roles", () => {
    // `docs/SECURITY.md` section 6 is canonical and defines four. SUPER_ADMIN
    // is deliberately absent; a fifth appearing here without that document
    // changing is a defect.
    expect([...APP_ROLES]).toEqual([
      "patient",
      "receptionist",
      "doctor",
      "admin",
    ]);
  });

  it("gives every role a label and a description", () => {
    for (const role of APP_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });

  it("assigns permissions to every role, with no role missing from the table", () => {
    for (const role of APP_ROLES) {
      expect(Array.isArray(PERMISSIONS_BY_ROLE[role])).toBe(true);
    }
    expect(Object.keys(PERMISSIONS_BY_ROLE).sort()).toEqual(
      [...APP_ROLES].sort(),
    );
  });
});

describe("the permission vocabulary", () => {
  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("grants only permissions that exist", () => {
    // A typo in a grant would otherwise be a permission nobody holds and
    // nobody notices, which reads as "this role can do it" while denying.
    for (const role of APP_ROLES) {
      for (const permission of PERMISSIONS_BY_ROLE[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("does not declare permissions for functionality that does not exist", () => {
    // `phase_08.md` section 13: implement only what current functionality
    // needs. A permission that protects nothing is one that gets granted
    // casually and then inherited by the feature it was invented for.
    //
    // `appointments.read.self` and `appointments.write.self` came off this
    // list in Phase 09, `appointments.manage.any`,
    // `patients.read.operational` and `patients.write.operational` in Phase
    // 10, and `appointments.read.own_schedule`,
    // `appointments.manage.own_schedule` and `patients.read.care` in Phase
    // 11 — each in the same change as the screens they guard, which is
    // exactly the rule this test exists to enforce.
    //
    // `clinical_records.read` and `clinical_records.write` came off this list
    // in Phase 12, alongside `public.clinical_records` and the consultation
    // workspace — the rule holding again on the first genuinely clinical
    // capability, which is the case it was written for.
    //
    // The six Phase 13 permissions came off this list alongside
    // `public.prescriptions`, `public.treatment_plans` and the builders that
    // write them — the rule holding again, and for the first time on a
    // permission granted to a **patient**.
    //
    // Phase 14 declares four document permissions and **none of them is
    // unscoped**. The three document entries below stay on this list for
    // that reason rather than because the table is missing: `phase_14.md`
    // section 19 is explicit that a broad `documents.read.all` must not
    // exist, so the assertion now guards the *shape* of the permission
    // rather than its absence.
    //
    // Phase 16 declares three analytics permissions and **not one of them is
    // unscoped**. `analytics.read` therefore stays on this list for the same
    // reason the document entries do: `phase_16.md` sections 6 and 8 require
    // an audience and a scope for every analytics capability, and a bare
    // `analytics.read` would be the permission somebody grants to a role
    // without deciding which figures it reaches.
    const speculative = [
      "appointments.manage",
      "appointments.read.any",
      "appointments.confirm",
      "prescriptions.issue",
      "prescriptions.read.any",
      "treatment_plans.read.any",
      "documents.read",
      "documents.write",
      "documents.read.all",
      "analytics.read",
    ];

    for (const permission of speculative) {
      expect(PERMISSIONS as readonly string[]).not.toContain(permission);
    }
  });

  it("grants no role a permission twice", () => {
    for (const role of APP_ROLES) {
      const granted = PERMISSIONS_BY_ROLE[role];
      expect(new Set(granted).size).toBe(granted.length);
    }
  });
});

describe("the policy matrix", () => {
  it("gives only the patient role access to their own patient record", () => {
    // `docs/SECURITY.md` section 6: a staff member who is also a patient of
    // the clinic uses a separate patient account, so no staff role carries
    // the self-profile permissions.
    expect(PERMISSIONS_BY_ROLE.patient).toContain("profile.read.self");
    expect(PERMISSIONS_BY_ROLE.patient).toContain("profile.write.self");

    for (const role of ["receptionist", "doctor", "admin"] as const) {
      expect(PERMISSIONS_BY_ROLE[role]).not.toContain("profile.read.self");
      expect(PERMISSIONS_BY_ROLE[role]).not.toContain("profile.write.self");
    }
  });

  it("gives only the admin role user and role management", () => {
    expect(PERMISSIONS_BY_ROLE.admin).toContain("users.read");
    expect(PERMISSIONS_BY_ROLE.admin).toContain("roles.manage");

    for (const role of ["patient", "receptionist", "doctor"] as const) {
      expect(PERMISSIONS_BY_ROLE[role]).not.toContain("users.read");
      expect(PERMISSIONS_BY_ROLE[role]).not.toContain("roles.manage");
    }
  });

  it("gives a receptionist no administrative capability", () => {
    // The explicit form of `phase_08.md` section 35's receptionist case. It is
    // trivially true while the list is empty, and it is the assertion that
    // fails the day somebody adds `roles.manage` to the wrong line.
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("roles.manage");
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("users.read");
  });

  it("gives a doctor no administrative capability", () => {
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("roles.manage");
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("users.read");
  });

  it("gives a doctor exactly the thirteen clinical-workspace capabilities, plus their own notifications", () => {
    // Written out rather than compared by length, so adding a thirteenth is a
    // deliberate edit to this list — the same guard the receptionist's carry.
    // Three arrived with `/doctor` in Phase 11, two with
    // `public.clinical_records` in Phase 12, four with
    // `public.prescriptions` and `public.treatment_plans` in Phase 13, two
    // with `public.patient_documents` in Phase 14, and one with
    // `/doctor/analytics` in Phase 16.
    //
    // Note what is **not** here: no `.self` permission of any kind. A
    // practitioner who is also a patient of the clinic uses a separate patient
    // account (`docs/SECURITY.md` section 6).
    expect([...PERMISSIONS_BY_ROLE.doctor].sort()).toEqual([
      "analytics.read.own_practice",
      "appointments.manage.own_schedule",
      "appointments.read.own_schedule",
      "clinical_ai.use",
      "clinical_records.read",
      "clinical_records.write",
      "documents.read.care",
      "documents.write.care",
      "notifications.read.self",
      "notifications.write.self",
      "patients.read.care",
      "prescriptions.read",
      "prescriptions.write",
      "treatment_plans.read",
      "treatment_plans.write",
    ]);
  });

  it("gives a doctor none of the front desk's clinic-wide capabilities", () => {
    // `phase_11.md` section 25: the doctor and the receptionist have
    // different responsibilities, and the doctor's workspace is not the front
    // desk's with a different heading. A doctor sees their own diary and the
    // patients they are booked to see; the clinic-wide ones stay at the desk.
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("appointments.manage.any");
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain(
      "patients.read.operational",
    );
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain(
      "patients.write.operational",
    );
  });

  it("gives the two clinical permissions to the doctor and to nobody else", () => {
    // `phase_12.md` sections 21, 22 and 23, in one assertion.
    //
    //   * a **receptionist** cannot read clinical records — the hard boundary
    //     in `docs/SECURITY.md` section 6, not to be weakened for
    //     convenience;
    //   * a **patient** does not get the doctor-facing record of their own
    //     care, because a patient-facing view must be a deliberately
    //     authorized projection and Phase 12 does not build one;
    //   * an **administrator** does not get it either: administrative
    //     capability and clinical access are separate concepts, and the
    //     matrix's "Read, audited" needs an audit subsystem that does not
    //     exist.
    for (const permission of [
      "clinical_records.read",
      "clinical_records.write",
    ] as const) {
      expect(PERMISSIONS_BY_ROLE.doctor).toContain(permission);

      for (const role of ["patient", "receptionist", "admin"] as const) {
        expect(PERMISSIONS_BY_ROLE[role]).not.toContain(permission);
      }
    }
  });

  it("declares nothing AI-shaped, and nothing the product does not store", () => {
    // `phase_14.md` sections 90-92 put AI clinical decision support in Phase
    // 17. A permission that protects nothing gets granted casually and is
    // then inherited by the feature it was invented for, so none is declared
    // until the thing it guards exists.
    //
    // `prescription`, `treatment` and now `document` are deliberately no
    // longer in this pattern: the tables they guard exist. `medication`,
    // `vital` and `diagnos` still are, because nothing in the product stores
    // a structured medication record, a vital sign or a coded diagnosis —
    // and `ocr` and `interpret` are added, because Phase 14 stores files and
    // never reads one.
    for (const permission of PERMISSIONS) {
      expect(permission).not.toMatch(
        /medication|vital|diagnos|ocr|suggest|recommend|interpret/i,
      );
    }
  });

  it("declares no permission whose scope is an AI capability", () => {
    // Asserted by segment rather than by a word-boundary regex, and
    // deliberately so: the Phase 13 version of the check above contained
    // backslash-b escapes inside a regex literal, and the formatter rewrote
    // one into a literal backspace byte — so the `ai` alternative silently
    // matched nothing for a whole phase. That is the same corruption Phase
    // 06 recorded in `lib/auth/redirect.ts`, and it is invisible in a diff.
    //
    // Comparing the dot-separated segments needs no escape at all.
    for (const permission of PERMISSIONS) {
      for (const segment of permission.split(".")) {
        expect(segment).not.toBe("ai");
      }
    }
  });

  it("gives a patient exactly the ten self-scoped capabilities", () => {
    // The mirror of the doctor's list. Four arrived in Phases 07 and 09, two
    // with `public.prescriptions` and `public.treatment_plans` in Phase 13,
    // and two with `public.patient_documents` in Phase 14 —
    // `documents.write.self` being the **first write permission a patient
    // has ever held over anything clinical-adjacent**, which is why the list
    // is written out rather than counted.
    //
    // Every one is `.self`. A patient holds nothing scoped to anybody else
    // and nothing clinic-wide.
    expect([...PERMISSIONS_BY_ROLE.patient].sort()).toEqual([
      "appointments.read.self",
      "appointments.write.self",
      "documents.read.self",
      "documents.write.self",
      "notifications.read.self",
      "notifications.write.self",
      "prescriptions.read.self",
      "profile.read.self",
      "profile.write.self",
      "treatment_plans.read.self",
    ]);
  });

  it("grants no clinical permission to a receptionist or an administrator", () => {
    // `docs/SECURITY.md` section 6's hard boundary, and `phase_13.md`
    // sections 36-37 and example 7. Asserted by name rather than by pattern,
    // so a permission added later cannot slip past by being spelled
    // differently.
    for (const permission of [
      "clinical_records.read",
      "clinical_records.write",
      "prescriptions.read",
      "prescriptions.write",
      "prescriptions.read.self",
      "treatment_plans.read",
      "treatment_plans.write",
      "treatment_plans.read.self",
      // Phase 14. `phase_14.md` sections 19 and 20: a receptionist does not
      // get document access for holding the role, and an administrator's
      // "Controlled, audited" needs an audit subsystem that does not exist.
      // Neither has any policy on `public.patient_documents` or on the
      // bucket either, which is the half that actually holds.
      "documents.read.self",
      "documents.write.self",
      "documents.read.care",
      "documents.write.care",
    ] as const) {
      expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain(permission);
      expect(PERMISSIONS_BY_ROLE.admin).not.toContain(permission);
    }
  });

  it("gives a patient exactly two clinical read permissions, and no write", () => {
    // The first clinical permissions a patient has ever held (Phase 13).
    // They are read-only and `.self`-scoped, and the half that matters — that
    // a **draft is invisible** — is not in this table at all: it lives in
    // `prescriptions_select_patient` and `treatment_plans_select_patient` as
    // `status <> 'draft'`, so no query can forget it.
    expect(PERMISSIONS_BY_ROLE.patient).toContain("prescriptions.read.self");
    expect(PERMISSIONS_BY_ROLE.patient).toContain("treatment_plans.read.self");

    for (const permission of [
      "prescriptions.read",
      "prescriptions.write",
      "treatment_plans.read",
      "treatment_plans.write",
      "clinical_records.read",
      "clinical_records.write",
    ] as const) {
      expect(PERMISSIONS_BY_ROLE.patient).not.toContain(permission);
    }
  });

  it("gives the doctor's permissions to the doctor and to nobody else", () => {
    for (const permission of [
      "appointments.read.own_schedule",
      "appointments.manage.own_schedule",
      "patients.read.care",
    ] as const) {
      expect(PERMISSIONS_BY_ROLE.doctor).toContain(permission);

      for (const role of ["patient", "receptionist", "admin"] as const) {
        expect(PERMISSIONS_BY_ROLE[role]).not.toContain(permission);
      }
    }
  });

  it("gives a receptionist exactly the four front-desk capabilities, plus their own notifications", () => {
    // Written out rather than compared by length, so adding a fifth is a
    // deliberate edit to this list.
    //
    // `analytics.read.operational` is Phase 16's, and it is deliberately the
    // *operational* one: the front desk reads appointment volume, outcomes,
    // practitioner workload and patient growth, and holds neither
    // `analytics.read.clinic` (notification delivery and clinical activity)
    // nor `reports.export`.
    //
    // The two notification permissions are Phase 15's, and they are the only
    // ones in this table every role holds: a notification is a message
    // addressed to an account rather than data about a patient, and neither
    // confers any ability to send anything.
    expect([...PERMISSIONS_BY_ROLE.receptionist].sort()).toEqual([
      "analytics.read.operational",
      "appointments.manage.any",
      "notifications.read.self",
      "notifications.write.self",
      "patients.read.operational",
      "patients.write.operational",
    ]);
  });

  it("gives every role its own notifications, and the ability to send none", () => {
    // `phase_15.md` section 109: no arbitrary notification-sending surface
    // exists. Asserted here because this table is where somebody would add
    // one.
    for (const role of APP_ROLES) {
      expect(PERMISSIONS_BY_ROLE[role]).toContain("notifications.read.self");
      expect(PERMISSIONS_BY_ROLE[role]).toContain("notifications.write.self");
    }

    for (const permission of PERMISSIONS) {
      expect(permission).not.toMatch(/notifications\.(send|create|write\.any)/);
    }
  });

  it("does not let the doctor's permissions imply self-service ones", () => {
    // A practitioner who is also a patient of the clinic uses a separate
    // patient account (`docs/SECURITY.md` section 6), so "manage my own
    // schedule" must not quietly mean "manage my own bookings as a patient".
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("appointments.read.self");
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("appointments.write.self");
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("profile.read.self");
    expect(PERMISSIONS_BY_ROLE.doctor).not.toContain("profile.write.self");
  });

  it("gives a receptionist no clinical or administrative capability", () => {
    // The hard boundary of `docs/SECURITY.md` section 6, asserted rather than
    // assumed. A receptionist is an operational role; the day a clinical
    // permission exists, this test is what refuses to let it drift here.
    for (const permission of PERMISSIONS_BY_ROLE.receptionist) {
      expect(permission).not.toMatch(/clinical|prescription|treatment|record/i);
    }

    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("roles.manage");
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("users.read");
  });

  it("does not let the front-desk permissions imply self-service ones", () => {
    // A receptionist who is also a patient of the clinic uses a separate
    // patient account (`docs/SECURITY.md` section 6), so "manage any
    // appointment" must not quietly mean "manage my own".
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain(
      "appointments.read.self",
    );
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain(
      "appointments.write.self",
    );
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("profile.read.self");
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain(
      "profile.write.self",
    );
  });

  it("does not make any role a superset of every other", () => {
    // There is no role hierarchy: a doctor does not inherit a receptionist's
    // permissions, and an admin is not "every role at once". If one role ever
    // holds all of them, the matrix has stopped being a policy.
    for (const role of APP_ROLES) {
      expect(PERMISSIONS_BY_ROLE[role].length).toBeLessThan(PERMISSIONS.length);
    }
  });
});
