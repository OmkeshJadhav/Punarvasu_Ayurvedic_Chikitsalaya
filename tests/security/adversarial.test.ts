/**
 * The mandatory adversarial matrix.
 *
 * `phase_19.md` sections 207-211 list twelve attempts that must be denied.
 * Each one is denied by something specific, and this file asserts the
 * *mechanism* rather than re-running a database probe that cannot run here:
 *
 * ```text
 *   Anonymous -> protected route          the proxy, then requireUser()
 *   Patient A -> Patient B anything       RLS, plus queries that take no id
 *   Receptionist -> clinical              no policy at all on the table
 *   Doctor A -> Doctor B's patient        a relationship-scoped policy
 *   Browser -> role=admin                 no writable path to user_roles
 *   Browser -> service-role key           server-only, and a bundle scan
 * ```
 *
 * The live half — real per-role JWTs against the real database — is what
 * Phases 08-17 each ran and what `docs/progress/progress_phase_19.md` records
 * as required before this phase can be signed off. A static suite cannot
 * replace it. What it can do is fail when somebody writes the change that
 * would have broken it, which a live probe only catches after the fact.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PERMISSIONS_BY_ROLE } from "@/config/permissions";
import { PROTECTED_PATH_PREFIXES, isProtectedPath } from "@/lib/auth/paths";
import { safeRedirectPath } from "@/lib/auth/redirect";

const SQL = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) =>
    readFileSync(join("supabase/migrations", name), "utf8")
      .split("\n")
      .map((line) => line.split("--")[0] ?? "")
      .join("\n"),
  )
  .join("\n");

describe("anonymous -> protected route = DENIED", () => {
  it("routes every protected prefix through the proxy's redirect", () => {
    for (const prefix of PROTECTED_PATH_PREFIXES) {
      expect(isProtectedPath(prefix), prefix).toBe(true);
    }
  });

  it("guards each authenticated area in a layout, not in a page", () => {
    // A guard in a layout is inherited by a page added later; a guard in a
    // page is one somebody has to remember.
    for (const layout of [
      "src/app/(app)/layout.tsx",
      "src/app/(app)/patient/layout.tsx",
      "src/app/(app)/doctor/layout.tsx",
      "src/app/(app)/receptionist/layout.tsx",
      "src/app/(app)/admin/layout.tsx",
      "src/app/(app)/notifications/layout.tsx",
    ]) {
      const source = readFileSync(layout, "utf8");
      expect(source, layout).toMatch(
        /requireUser\(|requireAreaAccess\(|requirePermission\(/,
      );
    }
  });

  it("gives anon no table grant anywhere", () => {
    expect(SQL).not.toMatch(/grant\s+[^;]*\bto\s+[^;]*\banon\b[^;]*;/i);
  });
});

describe("patient A -> patient B = DENIED", () => {
  it("has no read that accepts a patient id from the caller", () => {
    // The strongest form of the rule is an argument list with nothing to
    // substitute. Phase 07 established it and every phase since has kept it.
    const source = readFileSync("src/features/patients/queries.ts", "utf8");
    expect(source).toMatch(/export async function getPatientProfile\(\s*\)/);
  });

  it("scopes every patient-facing policy by the caller's own record", () => {
    const patientPolicies = [
      ...SQL.matchAll(
        /create policy\s+([a-z_]+_select_(?:own|patient))\s+on\s+([a-z_.]+)([\s\S]*?);\s*\n/gi,
      ),
    ];

    expect(patientPolicies.length).toBeGreaterThan(5);
    for (const [, name, table, body] of patientPolicies) {
      // Either the policy names the caller's own record directly, or it
      // delegates to a predicate whose name says it does — the item tables use
      // `*_is_visible_to_current_patient(parent_id)`, which resolves the
      // parent and applies the parent's own rule. Both are scoped by the
      // caller; only one says so inline.
      const scoped =
        /current_patient_id\(\)|auth\.uid\(\)/.test(body!) ||
        /is_visible_to_current_patient\(/.test(body!);
      expect(scoped, `${name} on ${table} must scope by the caller`).toBe(true);
    }
  });

  it("resolves the item predicates through the parent, never independently", () => {
    // The risk a delegating predicate carries is that it grows its own,
    // looser, rule. These two must ask the parent.
    for (const helper of [
      "prescription_is_visible_to_current_patient",
      "treatment_plan_is_visible_to_current_patient",
    ]) {
      // `String.raw` because a template literal silently drops `\.` and `\$`,
      // which would leave `$$` as two end-anchors and match nothing. Phase 15
      // lost a whole privacy scanner to exactly this.
      const body = new RegExp(
        String.raw`create function public\.${helper}\(([\s\S]*?)\$\$;`,
        "",
      ).exec(SQL)![0];
      expect(body, helper).toContain("current_patient_id()");
      expect(body, helper).toMatch(/status\s*<>\s*'draft'/);
    }
  });

  it("keeps a draft prescription and plan invisible in the policy itself", () => {
    // A filter a query could forget versus a predicate on the row. Phase 13
    // chose the predicate; this is what stops it becoming a filter.
    for (const table of ["prescriptions", "treatment_plans"]) {
      const policy = new RegExp(
        String.raw`create policy ${table}_select_patient([\s\S]*?);`,
      ).exec(SQL)![0];
      expect(policy, table).toMatch(/status\s*<>\s*'draft'/);
    }
  });
});

describe("receptionist -> clinical = DENIED", () => {
  /**
   * Tables a receptionist must never read, that somebody *else* may.
   *
   * `ai_assistance_sessions` is deliberately absent and is asserted
   * separately: it has no policy at all, for anybody, which is a stronger
   * claim than "no receptionist policy" and would make the scan below look
   * like it had found nothing when in fact there is nothing to find.
   */
  const CLINICAL_TABLES = [
    "clinical_records",
    "prescriptions",
    "prescription_items",
    "treatment_plans",
    "treatment_plan_items",
    "patient_documents",
  ];

  it("gives ai_assistance_sessions no policy at all, for any role", () => {
    // Phase 17. Nobody reads the AI audit table directly; the two admin-gated
    // functions are the only path. An absent policy cannot be weakened by an
    // edit the way a predicate can.
    const policies = [
      ...SQL.matchAll(
        /create policy\s+[a-z_]+\s+on\s+public\.ai_assistance_sessions\b/gi,
      ),
    ];
    expect(policies).toEqual([]);
  });

  it.each(CLINICAL_TABLES)("no receptionist policy on %s", (table) => {
    // `docs/SECURITY.md` section 6's hard boundary. Denied by there being no
    // policy at all, which is stronger than a predicate that evaluates false:
    // a predicate can be weakened by an edit.
    const policies = [
      ...SQL.matchAll(
        // `String.raw`, because a plain template literal collapses `\s` and
        // `\S` to `s` and `S` — leaving `[sS]*?`, which matches nothing here
        // and makes the whole assertion vacuous. Phase 15 lost a privacy
        // scanner to exactly this collapse.
        new RegExp(
          String.raw`create policy\s+([a-z_]+)\s+on\s+public\.${table}\b([\s\S]*?);`,
          "gi",
        ),
      ),
    ];

    // Non-vacuity: every one of these tables has at least one policy, so a
    // scan finding none means the scan is broken rather than the boundary
    // being clean.
    expect(policies.length, `no policy found on ${table}`).toBeGreaterThan(0);

    for (const [, name, body] of policies) {
      expect(body, `${name} on ${table}`).not.toMatch(
        /has_app_role\('receptionist'\)/,
      );
    }
  });

  it("gives the receptionist no clinical permission", () => {
    for (const permission of PERMISSIONS_BY_ROLE.receptionist) {
      expect(permission, "receptionist").not.toMatch(
        /clinical|prescription|treatment_plan|documents|clinical_ai/,
      );
    }
  });
});

describe("doctor A -> doctor B's patient = DENIED", () => {
  it("scopes the care policies by relationship, never by the doctor role alone", () => {
    for (const policy of [
      "patients_select_doctor_care",
      "patient_documents_select_doctor_care",
    ]) {
      const body = new RegExp(
        String.raw`create policy ${policy}([\s\S]*?);`,
      ).exec(SQL)![0];
      expect(body, policy).toContain("doctor_has_care_relationship");
      // The role predicate sits *alongside* ownership, never instead of it.
      expect(body, policy).toContain("has_app_role('doctor')");
    }
  });

  it("scopes the clinical record to the practitioner who authored it", () => {
    const body = /create policy clinical_records_select_author([\s\S]*?);/.exec(
      SQL,
    )![0];
    expect(body).toContain("current_practitioner_id()");
  });

  it("asks the care predicate only about the caller's own scope", () => {
    // `doctor_has_care_relationship(patient)` takes no practitioner argument,
    // so a doctor cannot ask whether *somebody else* treats a patient.
    const signature =
      /create function public\.doctor_has_care_relationship\(([^)]*)\)/.exec(
        SQL,
      )![1]!;
    expect(signature).not.toMatch(/practitioner|doctor/i);
  });
});

describe("browser -> role=admin = DENIED", () => {
  it("gives no client role any write on user_roles", () => {
    expect(SQL).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]*on\s+(?:table\s+)?public\.user_roles[^;]*to[^;]*(anon|authenticated)/i,
    );
  });

  it("has no insert, update or delete policy on user_roles", () => {
    const policies = [
      ...SQL.matchAll(
        /create policy\s+([a-z_]+)\s+on\s+public\.user_roles\s+for\s+([a-z]+)/gi,
      ),
    ];
    expect(policies.length).toBeGreaterThan(0);
    for (const [, name, operation] of policies) {
      expect(operation!.toLowerCase(), name).toBe("select");
    }
  });

  it("assigns the new-user role as a literal, never from client metadata", () => {
    // A registration form that could ask for a role would be given one.
    const trigger =
      /create (?:or replace )?function public\.handle_new_user\(\)([\s\S]*?)\$\$;/.exec(
        SQL,
      )![0];
    expect(trigger).not.toMatch(/raw_user_meta_data\s*->>?\s*'role'/);
    expect(trigger).toMatch(/'patient'/);
  });

  it("refuses an administrator changing their own role", () => {
    const fn = /create function public\.assign_user_role([\s\S]*?)\$\$;/.exec(
      SQL,
    )![0];
    expect(fn).toMatch(/auth\.uid\(\)/);
  });
});

describe("browser -> service-role key = MUST NOT EXIST", () => {
  it("never names the key with a NEXT_PUBLIC prefix", () => {
    expect(readFileSync(".env.example", "utf8")).not.toMatch(
      /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/,
    );
  });

  it("keeps a bundle scan in the project's scripts", () => {
    // The static assertions in `browser-surface.test.ts` cover the source; the
    // bundle scan covers what the compiler actually emitted, which is the
    // question section 176 asks.
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["security:scan-bundle"]).toBeTruthy();
  });
});

describe("manipulated redirect = DENIED", () => {
  const HOSTILE = [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/%2f%2fevil.example",
    "/../../etc/passwd",
    "/auth/login",
    "/api/health",
    `/patient${String.fromCharCode(10)}Location: https://evil.example`,
    "/".padEnd(600, "a"),
  ];

  it.each(HOSTILE)("refuses %j", (value) => {
    const result = safeRedirectPath(value, "/fallback");
    expect(result).toBe("/fallback");
  });

  it("accepts a real internal destination", () => {
    expect(safeRedirectPath("/patient/appointments?tab=past")).toBe(
      "/patient/appointments?tab=past",
    );
  });

  it("never returns anything carrying a scheme or an authority", () => {
    for (const value of [...HOSTILE, "/patient", "/doctor/patients"]) {
      const result = safeRedirectPath(value, "/fallback");
      expect(result.startsWith("/"), value).toBe(true);
      expect(result.startsWith("//"), value).toBe(false);
      expect(result, value).not.toMatch(/^[a-z]+:/i);
    }
  });
});

describe("status tampering = DENIED", () => {
  it("has no status parameter on any prescription transition", () => {
    // Each transition is its own function, so `{"status":"issued"}` has
    // nowhere to arrive.
    for (const fn of [
      "issue_prescription",
      "cancel_prescription",
      "activate_treatment_plan",
      "complete_treatment_plan",
    ]) {
      const signature = new RegExp(
        `create function public\\.${fn}\\(([^)]*)\\)`,
      ).exec(SQL)?.[1];
      expect(signature, fn).toBeDefined();
      expect(signature, fn).not.toMatch(/p_status/);
    }
  });

  it("guards the appointment transition in the database", () => {
    expect(SQL).toContain("appointments_guard_transition");
  });

  it("refuses a receptionist the two statuses that describe the consulting room", () => {
    // An **allowlist**, not a deny-list — which is the stronger shape: a
    // status added to the enum later is refused by default rather than
    // permitted by omission. `completed` and `in_consultation` are clinical
    // (`phase_10.md` section 31) and are simply not on it.
    const fn =
      /create function public\.update_appointment_status_as_staff([\s\S]*?)\$\$;/.exec(
        SQL,
      )![0];
    const allowlist = /p_status not in \(([^)]*)\)/.exec(fn)![1]!;

    expect(allowlist).toContain("'confirmed'");
    expect(allowlist).toContain("'checked_in'");
    expect(allowlist).not.toContain("'completed'");
    expect(allowlist).not.toContain("'in_consultation'");
  });
});

describe("AI -> autonomous clinical action = IMPOSSIBLE", () => {
  it("writes nothing clinical from the AI feature", () => {
    const sources = [
      "src/features/clinical-ai/service.ts",
      "src/features/clinical-ai/actions.ts",
      "src/features/clinical-ai/queries.ts",
    ];
    const FORBIDDEN_WRITES = [
      "issue_prescription",
      "save_clinical_draft",
      "complete_clinical_record",
      "activate_treatment_plan",
      "create_notification",
      "book_appointment",
    ];

    for (const path of sources) {
      const code = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.split("//")[0] ?? "")
        .join("\n");
      for (const rpc of FORBIDDEN_WRITES) {
        expect(code, `${path} must not call ${rpc}`).not.toContain(rpc);
      }
    }
  });

  it("gives clinical AI to the doctor role alone", () => {
    for (const [role, permissions] of Object.entries(PERMISSIONS_BY_ROLE)) {
      const holds = permissions.includes("clinical_ai.use");
      expect(holds, role).toBe(role === "doctor");
    }
  });
});
