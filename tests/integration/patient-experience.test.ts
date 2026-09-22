/**
 * The patient experience's structural guarantees (Phase 18).
 *
 * ## Why these are source assertions
 *
 * Phase 18 adds no table, no policy and no permission — it composes what
 * Phases 07-15 already secured. So the guarantees it is responsible for are
 * mostly *absences and shapes*:
 *
 *   * no patient-facing query takes a patient id, so there is none to
 *     substitute (sections 16, 49, 135);
 *   * no patient surface reads a clinical table, so internal notes and AI
 *     output are not filtered out — they are unreachable (sections 4, 57);
 *   * every dashboard query is bounded, so the portal does not get slower for
 *     the long-standing patients it most needs to serve (sections 81, 94, 128);
 *   * no storage path, signed URL or identifier crosses into a client
 *     component (sections 31, 142, 143).
 *
 * An absence cannot be exercised by calling something. It is proved by there
 * being nothing to call, which is what these read the source to establish —
 * the technique Phases 13-17 used for the equivalent claims. These are the
 * tests that fail when somebody adds the convenient thing.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PATIENT_NAV_ITEMS } from "@/features/patients/content";
import { PERMISSIONS_BY_ROLE } from "@/config/permissions";
import {
  DASHBOARD_NOTIFICATION_COUNT,
  NOTIFICATION_RECENT_LIMIT_CAP,
} from "@/config/notifications";

/** Source with comments removed, so a file cannot fail for documenting itself. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\r\n/g, "\n");
}

function walk(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const PATIENT_ROUTES = walk("src/app/(app)/patient");
const PATIENT_COMPONENTS = walk("src/components/patient");
const PATIENT_FEATURE = walk("src/features/patients");
const PATIENT_SURFACE = [
  ...PATIENT_ROUTES,
  ...PATIENT_COMPONENTS,
  ...PATIENT_FEATURE,
];

const DASHBOARD_PAGE = "src/app/(app)/patient/page.tsx";

describe("the patient surface exists and is whole", () => {
  it("has a dashboard at /patient", () => {
    expect(PATIENT_ROUTES).toContain(DASHBOARD_PAGE);
  });

  it("has a loading state and an error boundary for it", () => {
    // Section 68: no blank screens. Section 129: one section's failure must
    // not destroy the area.
    expect(PATIENT_ROUTES).toContain("src/app/(app)/patient/loading.tsx");
    expect(PATIENT_ROUTES).toContain("src/app/(app)/patient/error.tsx");
  });

  it("scans a real surface, so an empty glob cannot pass silently", () => {
    expect(PATIENT_SURFACE.length).toBeGreaterThan(15);
  });
});

describe("no patient-facing read takes a patient id", () => {
  /*
   * Sections 16, 49 and 135, and the "bad → good" example in section 148. The
   * strongest version of this rule is not a check — it is an argument list
   * with nothing to substitute, which is the shape Phase 07 established and
   * every patient query since has kept.
   */
  const forbiddenParameters = [
    "patientId",
    "patient_id",
    "userId",
    "user_id",
    "profileId",
    "profile_id",
  ];

  for (const parameter of forbiddenParameters) {
    it(`no patient page reads \`${parameter}\` from a request`, () => {
      for (const path of PATIENT_ROUTES) {
        const source = sourceOf(path);
        expect(
          source,
          `${path} reads ${parameter} from searchParams or params`,
        ).not.toMatch(
          new RegExp(`(searchParams|params)[^\\n]*\\b${parameter}\\b`),
        );
      }
    });
  }

  it("the dashboard passes no identifier into any query", () => {
    const source = sourceOf(DASHBOARD_PAGE);

    // Every dashboard read is called with no argument, a bounded number, or
    // the shared clock. None is called with something taken from the request.
    expect(source).toMatch(/getPatientProfile\(\)/);
    expect(source).toMatch(/getNextAppointment\(now\)/);
    expect(source).toMatch(/listPatientPrescriptions\(1\)/);
    expect(source).toMatch(/listPatientTreatmentPlans\(1\)/);
    expect(source).not.toMatch(/searchParams/);
  });
});

describe("the dashboard is bounded", () => {
  /*
   * Sections 81, 94 and 128. The defect this phase found: the old overview
   * called `getMyAppointments()` — every appointment a patient has ever had —
   * to display one of them. The cost grew with every visit, fastest for the
   * patients the clinic most wants the portal to serve well.
   */
  it("does not load the whole appointment history", () => {
    const source = sourceOf(DASHBOARD_PAGE);
    expect(source).not.toMatch(/getMyAppointments/);
  });

  it("asks the database for the next appointment rather than filtering in JS", () => {
    const source = sourceOf("src/features/appointments/queries.ts");
    const fn = source.slice(
      source.indexOf("export async function getNextAppointment"),
    );

    expect(fn).toMatch(/\.limit\(1\)/);
    expect(fn).toMatch(/\.order\("starts_at", \{ ascending: true \}\)/);
    // And it excludes cancelled appointments in the statement, not afterwards.
    expect(fn).toMatch(/\.neq\("status", "cancelled"\)/);
  });

  it("asks for one prescription and one plan, not a page of each", () => {
    const source = sourceOf(DASHBOARD_PAGE);
    expect(source).toMatch(/listPatientPrescriptions\(1\)/);
    expect(source).toMatch(/listPatientTreatmentPlans\(1\)/);
  });

  it("asks for a handful of notifications, and the cap is smaller than a page", () => {
    expect(DASHBOARD_NOTIFICATION_COUNT).toBeLessThanOrEqual(
      NOTIFICATION_RECENT_LIMIT_CAP,
    );
    expect(NOTIFICATION_RECENT_LIMIT_CAP).toBeLessThan(20);
  });

  it("bounds the recent-notification read inside the query, not only at the call site", () => {
    const source = sourceOf("src/features/notifications/queries.ts");
    const fn = source.slice(
      source.indexOf("export async function listRecentNotifications"),
    );
    expect(fn.slice(0, 900)).toMatch(/Math\.min\(Math\.max\(/);
  });

  it("builds no giant combined query", () => {
    // Section 128, and section 82's named anti-pattern.
    for (const path of PATIENT_SURFACE) {
      expect(sourceOf(path)).not.toMatch(/getEverythingForPatient/);
    }
  });

  it("loads the dashboard's sections concurrently", () => {
    // Section 83: no request waterfall.
    expect(sourceOf(DASHBOARD_PAGE)).toMatch(/await Promise\.all\(\[/);
  });
});

describe("the clinical boundary", () => {
  /*
   * Sections 4, 22, 57 and 107. A patient sees what was written for them. The
   * consultation note, the assessment, the diagnosis and every AI artefact are
   * not filtered out on this surface — they are unreachable, because
   * `clinical_records` has no patient policy and the AI tables have none
   * either. These assertions keep it that way.
   */
  const forbiddenTables = [
    "clinical_records",
    "ai_assistance_sessions",
    "schedule_exceptions",
    "notification_outbox",
    "notification_deliveries",
    "role_assignment_events",
    "user_roles",
  ];

  for (const table of forbiddenTables) {
    it(`no patient surface reads public.${table}`, () => {
      for (const path of PATIENT_SURFACE) {
        expect(sourceOf(path), `${path} reads ${table}`).not.toMatch(
          new RegExp(`from\\(\\s*["']${table}["']`),
        );
      }
    });
  }

  const forbiddenColumns = [
    "internal_note",
    "doctor_notes",
    "diagnosis_or_clinical_impression",
    "clinical_observations",
    "chief_complaint",
    "assessment",
    "history_of_presenting_concern",
  ];

  for (const column of forbiddenColumns) {
    it(`no patient surface reads the ${column} column`, () => {
      for (const path of PATIENT_SURFACE) {
        /*
         * Matched as a *code identifier* — quoted, a property access, or an
         * object key — rather than as a bare word.
         *
         * The bare word would fail on the profile form's own helper text,
         * which legitimately says "Ayurvedic assessment takes age into
         * account". A scan that forces a future author to delete an
         * explanation in order to pass is a scan that will be deleted itself;
         * Phase 16 recorded the same lesson.
         */
        expect(sourceOf(path), `${path} reads ${column}`).not.toMatch(
          new RegExp(`["'\`]${column}["'\`]|\\.${column}\\b|\\b${column}:`),
        );
      }
    });
  }

  it("no patient surface imports the clinical or clinical-AI features", () => {
    for (const path of PATIENT_SURFACE) {
      const source = sourceOf(path);
      expect(source, `${path} imports clinical internals`).not.toMatch(
        /@\/features\/(clinical|clinical-ai)\//,
      );
      expect(source, `${path} imports the AI provider`).not.toMatch(
        /@\/lib\/ai\//,
      );
    }
  });

  it("no patient surface renders an AI component", () => {
    for (const path of PATIENT_SURFACE) {
      expect(sourceOf(path)).not.toMatch(/@\/components\/clinical-ai\//);
    }
  });
});

describe("storage and identifiers", () => {
  /*
   * Sections 31, 32, 142 and 143. Phase 14 keeps the bucket private and mints
   * a short-lived signed URL after authorization. Phase 18 must not undo that
   * by handing a path to the browser.
   */
  it("no patient surface names the storage path or the bucket", () => {
    for (const path of PATIENT_SURFACE) {
      const source = sourceOf(path);
      expect(source, `${path} names storage_path`).not.toMatch(
        /\bstorage_path\b|\bstoragePath\b/,
      );
      expect(source, `${path} names the bucket`).not.toMatch(
        /patient-documents["']/,
      );
    }
  });

  it("no patient surface builds a public storage URL", () => {
    for (const path of PATIENT_SURFACE) {
      expect(sourceOf(path)).not.toMatch(/getPublicUrl/);
    }
  });

  it("no patient surface uses the service-role client", () => {
    for (const path of PATIENT_SURFACE) {
      expect(
        sourceOf(path),
        `${path} reaches for the admin client`,
      ).not.toMatch(/@\/lib\/supabase\/admin/);
    }
  });
});

describe("client state is never the boundary", () => {
  /*
   * Sections 54, 112, 113, 123 and 124. Nothing on this surface persists
   * clinical information to the browser, and nothing reads a role from it.
   */
  it("writes nothing to localStorage or sessionStorage", () => {
    for (const path of PATIENT_SURFACE) {
      expect(sourceOf(path), `${path} writes browser storage`).not.toMatch(
        /localStorage|sessionStorage/,
      );
    }
  });

  it("derives no authority from a client value", () => {
    for (const path of PATIENT_COMPONENTS) {
      const source = sourceOf(path);
      expect(source, `${path} checks a role in the browser`).not.toMatch(
        /role\s*===\s*["'](admin|doctor|receptionist)["']/,
      );
    }
  });
});

describe("navigation exposes only the patient's own area", () => {
  it("offers no staff route", () => {
    // Section 112: the patient UI must not expose staff functionality. Hiding
    // a link is not the control — the guard is — but offering one would be a
    // straightforward defect.
    for (const item of PATIENT_NAV_ITEMS) {
      expect(item.href).toMatch(/^\/patient(\/|$)/);
    }
  });

  it("offers no route the patient role cannot enter", () => {
    const patientPermissions = PERMISSIONS_BY_ROLE.patient;
    expect(patientPermissions).toContain("profile.read.self");
    expect(patientPermissions).toContain("appointments.read.self");
    expect(patientPermissions).toContain("prescriptions.read.self");
    expect(patientPermissions).toContain("treatment_plans.read.self");
    expect(patientPermissions).toContain("documents.read.self");
  });

  it("grants the patient no staff or clinical-authoring capability", () => {
    // The role isolation section 133 asks to be tested, asserted against the
    // policy table rather than against a rendered page.
    const forbidden = [
      "appointments.manage.any",
      "patients.read.operational",
      "patients.read.care",
      "clinical_records.read",
      "clinical_records.write",
      "prescriptions.read",
      "prescriptions.write",
      "treatment_plans.write",
      "documents.read.care",
      "clinical_ai.use",
      "analytics.read.operational",
      "analytics.read.clinic",
      "reports.export",
      "users.read",
      "roles.manage",
    ] as const;

    for (const permission of forbidden) {
      expect(
        PERMISSIONS_BY_ROLE.patient,
        `a patient must not hold ${permission}`,
      ).not.toContain(permission);
    }
  });

  it("gives the patient no write permission over clinician-authored care", () => {
    /*
     * Sections 25, 28, 137 and 138. There is no `prescriptions.write.self` and
     * no `treatment_plans.write.self` in the vocabulary at all, so a patient
     * cannot be granted one by editing a list — and the database refuses the
     * write regardless, because there is no grant and no policy.
     *
     * The four they *do* hold are their own: their booking, their own
     * documents, their own notification settings and their own details.
     * Appointments are a patient write on purpose — sections 15 and 105 give
     * a patient cancellation and rescheduling, through the Phase 09 engine.
     *
     * Written as an exact set rather than a series of `not.toContain` checks,
     * so a permission added to the patient role has to be acknowledged here.
     */
    const patientWrites = PERMISSIONS_BY_ROLE.patient.filter((permission) =>
      permission.includes(".write"),
    );

    expect(patientWrites.toSorted()).toEqual([
      "appointments.write.self",
      "documents.write.self",
      "notifications.write.self",
      "profile.write.self",
    ]);
  });
});

describe("metadata and indexing", () => {
  it("every patient page declares noindex", () => {
    // Sections 97 and 98. `robots.txt` disallows `/patient/` as well, and the
    // `(app)` layout declares it too — this asserts the page-level belt.
    for (const path of PATIENT_ROUTES) {
      const source = sourceOf(path);
      if (!source.includes("export const metadata")) continue;
      expect(source, `${path} is missing noindex`).toMatch(
        /robots:\s*\{\s*index:\s*false/,
      );
    }
  });

  it("puts no patient name or clinical word in a page title", () => {
    // Section 99: a title reaches browser history, a tab strip and a
    // screenshot.
    for (const path of PATIENT_ROUTES) {
      const source = sourceOf(path);
      const match = /title:\s*([^\n]+)/.exec(source);
      if (!match?.[1]) continue;
      expect(match[1], `${path} has a revealing title`).not.toMatch(
        /fullName|preferredName|diagnos|prescription\b.*\$\{/i,
      );
    }
  });
});
