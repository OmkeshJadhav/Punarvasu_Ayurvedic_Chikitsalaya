import { describe, expect, it } from "vitest";

import { REDACTED, redact } from "@/lib/logging/redact";

describe("redact", () => {
  it("should replace credentials and tokens", () => {
    const output = redact({
      password: "hunter2",
      accessToken: "ey.jwt.value",
      serviceRoleKey: "service-role-secret",
      authorization: "Bearer ey.jwt.value",
      cookie: "sb-access-token=abc",
    });

    expect(Object.values(output)).toEqual([
      REDACTED,
      REDACTED,
      REDACTED,
      REDACTED,
      REDACTED,
    ]);
  });

  it("should replace patient-identifying and clinical fields", () => {
    const output = redact({
      email: "patient@example.test",
      phone: "9999999999",
      dateOfBirth: "1980-01-01",
      diagnosis: "sample finding",
      notes: "consultation notes",
    });

    for (const value of Object.values(output)) {
      expect(value).toBe(REDACTED);
    }
  });

  it("should keep identifiers and operational context", () => {
    const output = redact({
      requestId: "d2c6b8f0-0a1e-4f1a-9a2f-1b2c3d4e5f60",
      patientId: "8f14e45f-ceea-467a-9575-1f1a6b6a5ee2",
      durationMs: 42,
      cached: false,
    });

    expect(output).toEqual({
      requestId: "d2c6b8f0-0a1e-4f1a-9a2f-1b2c3d4e5f60",
      patientId: "8f14e45f-ceea-467a-9575-1f1a6b6a5ee2",
      durationMs: 42,
      cached: false,
    });
  });

  it("should redact sensitive keys nested inside objects and arrays", () => {
    const output = redact({
      payload: { user: { email: "patient@example.test", id: "abc" } },
      items: [{ token: "secret-token" }],
    });

    expect(output).toEqual({
      payload: { user: { email: REDACTED, id: "abc" } },
      items: [{ token: REDACTED }],
    });
  });

  it("should redact a prescription's clinical content", () => {
    // Phase 13. A medicine, a dose, a frequency or an instruction is what a
    // doctor told one identifiable person to do, and it is exactly as
    // confidential as a diagnosis (`docs/SECURITY.md` section 4).
    const output = redact({
      medicineName: "Ashwagandha churna",
      doseAmount: "1",
      doseUnit: "teaspoon",
      dosage: "1 teaspoon twice daily",
      remedy: "Triphala",
      instructions: "Take with warm water.",
      chiefComplaint: "Recorded.",
      assessment: "Recorded.",
      treatmentPlan: "Recorded.",
    });

    for (const value of Object.values(output)) {
      expect(value).toBe(REDACTED);
    }
  });

  it("should keep the opaque identifiers a clinical log needs", () => {
    // `phase_13.md` section 83's "good" example logs `prescriptionId`.
    // Without the identifier allowlist it would be redacted, because the key
    // contains "prescription" — and a log of a clinical operation with no
    // correlation id cannot be investigated at all.
    const output = redact({
      prescriptionId: "8f14e45f-ceea-467a-9575-1f1a6b6a5ee2",
      treatmentPlanId: "d2c6b8f0-0a1e-4f1a-9a2f-1b2c3d4e5f60",
      userId: "abc",
    });

    expect(output).toEqual({
      prescriptionId: "8f14e45f-ceea-467a-9575-1f1a6b6a5ee2",
      treatmentPlanId: "d2c6b8f0-0a1e-4f1a-9a2f-1b2c3d4e5f60",
      userId: "abc",
    });
  });

  it("should not exempt a key merely because it ends in Id", () => {
    // The allowlist is exact-match, not a pattern, precisely so that a rule
    // like "anything ending in Id is safe" cannot exempt `emailId` — which in
    // a great deal of code means an email address.
    const output = redact({
      emailId: "patient@example.test",
      sessionId: "a-session",
      prescriptionText: "Ashwagandha churna, 1 teaspoon",
    });

    expect(output).toEqual({
      emailId: REDACTED,
      sessionId: REDACTED,
      prescriptionText: REDACTED,
    });
  });

  it("should bound long strings, wide arrays and deep objects", () => {
    const long = "x".repeat(900);
    const wide = Array.from({ length: 25 }, (_, index) => index);
    const deep = { a: { b: { c: { d: { e: "too deep" } } } } };

    const output = redact({ long, wide, deep });

    expect(String(output.long)).toHaveLength(512 + "...[truncated]".length);
    expect(output.wide).toHaveLength(21);
    expect(JSON.stringify(output.deep)).toContain("[depth-limit]");
  });
});
