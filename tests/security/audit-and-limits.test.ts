/**
 * The audit trail's behaviour, and the rate limits.
 *
 * `phase_19.md` sections 69-70 and 89-91. The database's side of both is
 * asserted in `database-grants.test.ts`; this is the application's.
 */
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allowOperation, resetRateLimits } from "@/lib/security/rate-limit";
import {
  DOCUMENT_UPLOAD_RATE_LIMIT,
  PATIENT_SEARCH_RATE_LIMIT,
  REPORT_EXPORT_RATE_LIMIT,
} from "@/config/security";

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const logLines: string[] = [];

beforeEach(() => {
  resetRateLimits();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  logLines.length = 0;
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function audit() {
  return import("@/lib/security/audit");
}

describe("what the audit trail is told", () => {
  it("sends the action, the resource and the outcome, and nothing else", async () => {
    const { recordSecurityAuditEvent } = await audit();

    await recordSecurityAuditEvent({
      action: "clinical_record.read",
      resourceType: "clinical_record",
      outcome: "allowed",
      resourceId: "record-1",
      subjectPatientId: "patient-1",
    });

    expect(rpc).toHaveBeenCalledWith("record_security_audit_event", {
      p_action: "clinical_record.read",
      p_resource_type: "clinical_record",
      p_outcome: "allowed",
      p_resource_id: "record-1",
      p_subject_patient_id: "patient-1",
      p_request_id: null,
    });
  });

  it("has no parameter through which a caller could name the actor", async () => {
    const { recordSecurityAuditEvent } = await audit();
    await recordSecurityAuditEvent({
      action: "document.access_granted",
      resourceType: "document",
      outcome: "allowed",
    });

    // The actor and their role come from `auth.uid()` inside the database. An
    // actor who could name themselves could write a trail that exonerates
    // them.
    const [, args] = rpc.mock.calls[0]!;
    for (const key of Object.keys(args as object)) {
      expect(key).not.toMatch(/actor|user|role/);
    }
  });

  it("carries no clinical content, whatever the call site passes", async () => {
    const { recordSecurityAuditEvent } = await audit();
    await recordSecurityAuditEvent({
      action: "prescription.read",
      resourceType: "prescription",
      outcome: "allowed",
      resourceId: "rx-1",
      subjectPatientId: "patient-1",
    });

    const [, args] = rpc.mock.calls[0]!;
    // The interface has no field for any of these, so this asserts the shape
    // rather than a filter — which is the point: there is nothing to filter.
    expect(Object.keys(args as object).sort()).toEqual([
      "p_action",
      "p_outcome",
      "p_request_id",
      "p_resource_id",
      "p_resource_type",
      "p_subject_patient_id",
    ]);
  });

  it("records a route denial with no resource id", async () => {
    // The database refuses an entry claiming to be about a route and a record
    // at the same time; this is the application agreeing with it.
    const { recordAuthorizationDenied } = await audit();
    await recordAuthorizationDenied();

    expect(rpc).toHaveBeenCalledWith("record_security_audit_event", {
      p_action: "authorization.denied",
      p_resource_type: "route",
      p_outcome: "denied",
      p_resource_id: null,
      p_subject_patient_id: null,
      p_request_id: null,
    });
  });

  it("drops a resource id that was passed with a route denial", async () => {
    const { recordAuthorizationDenied } = await audit();
    await recordAuthorizationDenied({ resourceId: "should-not-survive" });

    const [, args] = rpc.mock.calls[0]!;
    expect((args as { p_resource_id: unknown }).p_resource_id).toBeNull();
  });
});

describe("the audit trail never breaks the operation", () => {
  it("swallows a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { recordSecurityAuditEvent } = await audit();

    await expect(
      recordSecurityAuditEvent({
        action: "patient_record.read",
        resourceType: "patient",
        outcome: "allowed",
      }),
    ).resolves.toBeUndefined();
  });

  it("swallows a thrown failure", async () => {
    rpc.mockRejectedValue(new Error("connection reset"));
    const { recordSecurityAuditEvent } = await audit();

    await expect(
      recordSecurityAuditEvent({
        action: "report.exported",
        resourceType: "report",
        outcome: "allowed",
      }),
    ).resolves.toBeUndefined();
  });

  it("does not log what it failed to record", async () => {
    // A failed audit write must not become a second disclosure channel for
    // the thing it failed to write down.
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { recordSecurityAuditEvent } = await audit();

    await recordSecurityAuditEvent({
      action: "clinical_record.read",
      resourceType: "clinical_record",
      outcome: "allowed",
      resourceId: "record-secret",
      subjectPatientId: "patient-secret",
    });

    const logged = logLines.join("\n");
    expect(logged).toContain("security.audit_write_failed");
    expect(logged).not.toContain("record-secret");
    expect(logged).not.toContain("patient-secret");
  });
});

describe("which accesses are instrumented", () => {
  const SITES: readonly [string, string][] = [
    ["src/features/clinical/queries.ts", "clinical_record.read"],
    ["src/features/prescriptions/queries.ts", "prescription.read"],
    ["src/features/documents/actions.ts", "document.access_granted"],
    ["src/features/reception/queries.ts", "patient_record.read"],
    ["src/features/doctor/queries.ts", "patient_record.read"],
    ["src/features/analytics/queries.ts", "report.exported"],
  ];

  it.each(SITES)("%s records %s", (path, action) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("recordSecurityAuditEvent");
    expect(source).toContain(action);
  });

  it("records every authorization denial from the guards", () => {
    // The guards are the one place a refusal is centralised, so instrumenting
    // them covers every route and every action rather than the ones somebody
    // remembered.
    const guards = readFileSync("src/lib/authorization/guards.ts", "utf8");
    expect(guards).toContain("recordAuthorizationDenied");
  });

  it("awaits the denial before redirecting", () => {
    // `redirect()` throws. Anything left dangling after it is abandoned, so a
    // denial recorded after the redirect would be a denial never recorded.
    const guards = readFileSync("src/lib/authorization/guards.ts", "utf8");

    const count = (pattern: RegExp) => [...guards.matchAll(pattern)].length;

    // Every mention of the helper is either its own declaration or an awaited
    // call. A bare `logDenial(...)` would compile, pass every other test, and
    // silently lose the audit entry for every refusal in the application.
    const total = count(/logDenial\(/g);
    const declaration = count(/function logDenial\(/g);
    const awaited = count(/await logDenial\(/g);

    expect(total).toBeGreaterThan(1);
    expect(declaration).toBe(1);
    expect(awaited).toBe(total - declaration);
  });

  it("does not audit a patient reading their own record", () => {
    // Not privileged access, happens constantly, and recording it would bury
    // the entries that matter — which is how an audit trail becomes something
    // nobody reads.
    const patientReads = readFileSync(
      "src/features/patients/queries.ts",
      "utf8",
    );
    expect(patientReads).not.toContain("recordSecurityAuditEvent");
  });
});

describe("rate limits", () => {
  const USER = "user-1";

  it("allows a normal amount of work and then stops", () => {
    for (let i = 0; i < DOCUMENT_UPLOAD_RATE_LIMIT.maxRequests; i += 1) {
      expect(allowOperation("document_upload", USER), `call ${i}`).toBe(true);
    }
    expect(allowOperation("document_upload", USER)).toBe(false);
  });

  it("bounds each surface separately", () => {
    // Exhausting uploads must not stop the same person searching. They are
    // different costs and they get different allowances.
    for (let i = 0; i <= DOCUMENT_UPLOAD_RATE_LIMIT.maxRequests; i += 1) {
      allowOperation("document_upload", USER);
    }
    expect(allowOperation("document_upload", USER)).toBe(false);
    expect(allowOperation("patient_search", USER)).toBe(true);
    expect(allowOperation("report_export", USER)).toBe(true);
  });

  it("bounds each account separately", () => {
    // One receptionist hitting a ceiling must not take the front desk down.
    for (let i = 0; i <= PATIENT_SEARCH_RATE_LIMIT.maxRequests; i += 1) {
      allowOperation("patient_search", "receptionist-a");
    }
    expect(allowOperation("patient_search", "receptionist-a")).toBe(false);
    expect(allowOperation("patient_search", "receptionist-b")).toBe(true);
  });

  it("is tightest on the most expensive operation", () => {
    // An export runs a year-wide aggregate and produces a file of clinic
    // operations; a search reads a bounded list. The ceilings should reflect
    // that, and this is the assertion that notices if somebody levels them.
    expect(REPORT_EXPORT_RATE_LIMIT.maxRequests).toBeLessThan(
      DOCUMENT_UPLOAD_RATE_LIMIT.maxRequests,
    );
    expect(DOCUMENT_UPLOAD_RATE_LIMIT.maxRequests).toBeLessThan(
      PATIENT_SEARCH_RATE_LIMIT.maxRequests,
    );
  });

  it("is applied after authorization, never before", () => {
    // A limiter consulted before authorization can be exhausted by an
    // unauthenticated caller on a real user's behalf, and its key would have
    // to come from somewhere less trustworthy than a session.
    const upload = readFileSync("src/features/documents/upload.ts", "utf8");
    expect(upload.indexOf("documents.write.care")).toBeLessThan(
      upload.indexOf('allowOperation("document_upload"'),
    );

    const analytics = readFileSync("src/features/analytics/queries.ts", "utf8");
    expect(
      analytics.indexOf('assertPermission("reports.export")'),
    ).toBeLessThan(analytics.indexOf('allowOperation("report_export"'));
  });

  it("keys on the authenticated account, never on a header", () => {
    const limiter = readFileSync("src/lib/security/rate-limit.ts", "utf8");
    expect(limiter).toContain("userId");
    // An IP or a header is both shared and rotatable, and keying an in-memory
    // map on an attacker-controlled value is a memory leak an attacker
    // controls.
    expect(limiter).not.toMatch(/x-forwarded-for|request\.headers/);
  });
});
