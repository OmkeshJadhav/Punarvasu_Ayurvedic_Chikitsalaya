import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ANALYTICS_FILTER_FIELDS,
  REPORT_REQUEST_FIELDS,
  analyticsFilterSchema,
  appointmentReportRequestSchema,
  practiceAnalyticsFilterSchema,
} from "./validation";

/**
 * The analytics trust boundary.
 *
 * ## What this file is asserting
 *
 * That a hostile field is **rejected rather than dropped**. A dropped field
 * is invisible; a rejected request appears in a log and tells us somebody
 * tried. Every schema here is `strict()` for that reason, and every hostile
 * name is asserted one at a time so a failure names which one got through.
 *
 * ## And that certain fields do not exist at all
 *
 * `phase_16.md` sections 59, 61 and 101. The strongest guarantee is not a
 * check — it is a parameter that is absent, so there is nothing to
 * manipulate. No schema in this feature has a patient id, a clinic id, an
 * organization id, a report id, an export id, a column list, a table name, a
 * sort expression or a limit; and the practice schema has no practitioner id
 * either.
 */

const VALID = { from: "2026-09-01", to: "2026-09-30" };

const SOURCE = readFileSync(
  new URL("./validation.ts", import.meta.url),
  "utf8",
);

/**
 * The module's source with its comments removed.
 *
 * The scans at the bottom of this file ask whether the module *accepts* a
 * field, and a doc comment explaining why a field is deliberately absent is
 * the opposite of that. Scanning the raw text would make the module fail for
 * documenting itself — and, worse, would pressure a future author to delete
 * the explanation rather than the field.
 */
const CODE = SOURCE.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(
  /\/\/.*$/gm,
  "",
);

/**
 * Field names that must not be accepted anywhere in this feature.
 *
 * Each is a distinct attack from the specification: a patient id would make
 * an analytics endpoint an enumeration API (section 59); a clinic or
 * organization id would let one scope be read as another (sections 51-53); a
 * report or export id is section 101's IDOR; a column, table, sort or limit
 * would make the endpoint the raw-query interface section 61 forbids; and a
 * role or permission is the client trying to authorize itself.
 */
const FORBIDDEN_FIELDS = {
  patientId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  patient_id: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  clinicId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  organizationId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  locationId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  reportId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  exportId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  userId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  doctorId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  role: "admin",
  permission: "analytics.read.clinic",
  isAdmin: "true",
  table: "appointments",
  columns: "diagnosis",
  select: "*",
  where: "1=1",
  orderBy: "created_at",
  sort: "desc",
  limit: "1000000",
  offset: "0",
  granularity: "day",
  scope: "clinic",
} as const;

describe("the dashboard filter", () => {
  it("accepts an empty request", () => {
    // A bare `/admin/analytics` is legitimate; the page falls back to the
    // default period.
    expect(analyticsFilterSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a named preset", () => {
    expect(
      analyticsFilterSchema.safeParse({ preset: "last_month" }).success,
    ).toBe(true);
  });

  it("rejects a preset it does not know", () => {
    for (const preset of ["all_time", "everything", "", "LAST_MONTH", "1"]) {
      expect(analyticsFilterSchema.safeParse({ preset }).success, preset).toBe(
        false,
      );
    }
  });

  it("accepts a custom period with both dates", () => {
    expect(
      analyticsFilterSchema.safeParse({ preset: "custom", ...VALID }).success,
    ).toBe(true);
  });

  it("rejects a custom period missing a date", () => {
    expect(
      analyticsFilterSchema.safeParse({ preset: "custom", from: VALID.from })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed date", () => {
    for (const from of [
      "2026-9-1",
      "20260901",
      "01/09/2026",
      "yesterday",
      "2026-09-01T00:00:00Z",
      "",
    ]) {
      expect(
        analyticsFilterSchema.safeParse({ from, to: VALID.to }).success,
        from,
      ).toBe(false);
    }
  });

  it("rejects a date that does not exist", () => {
    expect(
      analyticsFilterSchema.safeParse({ from: "2026-02-30", to: VALID.to })
        .success,
    ).toBe(false);
  });

  it("rejects a date below the floor", () => {
    expect(
      analyticsFilterSchema.safeParse({ from: "1999-01-01", to: VALID.to })
        .success,
    ).toBe(false);
  });

  it("accepts a practitioner filter as a uuid and nothing else", () => {
    expect(
      analyticsFilterSchema.safeParse({
        practitionerId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
      }).success,
    ).toBe(true);

    for (const practitionerId of [
      "not-a-uuid",
      "1",
      "' or 1=1 --",
      "../../etc/passwd",
      "<script>alert(1)</script>",
      "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f'",
    ]) {
      expect(
        analyticsFilterSchema.safeParse({ practitionerId }).success,
        practitionerId,
      ).toBe(false);
    }
  });

  it("rejects every forbidden field, one at a time", () => {
    for (const [field, value] of Object.entries(FORBIDDEN_FIELDS)) {
      const result = analyticsFilterSchema.safeParse({
        ...VALID,
        [field]: value,
      });
      expect(result.success, `${field} was accepted`).toBe(false);
    }
  });

  it("rejects rather than silently drops an unexpected field", () => {
    // The distinction that matters: a dropped field leaves no trace.
    const result = analyticsFilterSchema.safeParse({
      ...VALID,
      patientId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("unrecognized");
    }
  });
});

describe("the practice filter", () => {
  it("has no practitioner field at all", () => {
    // Section 54 and example 3. Not optional, not ignored — **absent**, so
    // there is nothing for `Doctor A → Doctor B metrics` to be expressed as.
    const result = practiceAnalyticsFilterSchema.safeParse({
      ...VALID,
      practitionerId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
    });
    expect(result.success).toBe(false);
  });

  it("rejects every forbidden field, one at a time", () => {
    for (const [field, value] of Object.entries(FORBIDDEN_FIELDS)) {
      expect(
        practiceAnalyticsFilterSchema.safeParse({ ...VALID, [field]: value })
          .success,
        `${field} was accepted`,
      ).toBe(false);
    }
  });

  it("accepts a plain period", () => {
    expect(practiceAnalyticsFilterSchema.safeParse(VALID).success).toBe(true);
    expect(practiceAnalyticsFilterSchema.safeParse({}).success).toBe(true);
  });
});

describe("the export request", () => {
  it("requires a period", () => {
    // An export with no period would have to mean "everything", which is the
    // unbounded query section 82 rules out.
    expect(appointmentReportRequestSchema.safeParse({}).success).toBe(false);
    expect(
      appointmentReportRequestSchema.safeParse({ from: VALID.from }).success,
    ).toBe(false);
  });

  it("accepts a period, optionally narrowed to a practitioner", () => {
    expect(appointmentReportRequestSchema.safeParse(VALID).success).toBe(true);
    expect(
      appointmentReportRequestSchema.safeParse({
        ...VALID,
        practitionerId: "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
      }).success,
    ).toBe(true);
  });

  it("has no format, column list or report identifier", () => {
    // Section 101's "change the reportId" and section 45's "dump every joined
    // table" both need a parameter that does not exist here.
    for (const field of [
      "format",
      "columns",
      "fields",
      "reportId",
      "report",
      "includePatients",
      "includeClinical",
    ]) {
      expect(
        appointmentReportRequestSchema.safeParse({ ...VALID, [field]: "x" })
          .success,
        field,
      ).toBe(false);
    }
  });

  it("rejects every forbidden field, one at a time", () => {
    for (const [field, value] of Object.entries(FORBIDDEN_FIELDS)) {
      if (field === "granularity" || field === "scope") continue;
      expect(
        appointmentReportRequestSchema.safeParse({ ...VALID, [field]: value })
          .success,
        `${field} was accepted`,
      ).toBe(false);
    }
  });
});

describe("the field lists the forms are read through", () => {
  it("matches the dashboard schema exactly", () => {
    // The first of the three layers: a field not on this list is never read
    // from the form at all, before `strict()` and before the RPC's fixed
    // argument list. They must not drift.
    expect([...ANALYTICS_FILTER_FIELDS].sort()).toEqual([
      "from",
      "practitionerId",
      "preset",
      "to",
    ]);
  });

  it("matches the export schema exactly", () => {
    expect([...REPORT_REQUEST_FIELDS].sort()).toEqual([
      "from",
      "practitionerId",
      "to",
    ]);
  });

  it("names no forbidden field", () => {
    const named = [...ANALYTICS_FILTER_FIELDS, ...REPORT_REQUEST_FIELDS];
    for (const field of named) {
      expect(Object.keys(FORBIDDEN_FIELDS)).not.toContain(field);
    }
  });

  it("is what actually stops an extra form field, and the schema is the second layer", () => {
    // The distinction Phase 08 got wrong in a docblock and Phase 16's live
    // verification caught again. A field not on this list is never *read*
    // from the form, so it never reaches `strict()` at all — dropped at the
    // first layer rather than rejected at the second.
    //
    // Asserting it here means the two layers are described accurately: the
    // list is what protects a posted form, and `strict()` is what protects
    // an object assembled in code.
    const posted = new FormData();
    posted.set("from", "2026-09-01");
    posted.set("to", "2026-09-30");
    posted.set("columns", "diagnosis");
    posted.set("patientId", "b3f1b9d0-1a2b-4c3d-9e8f-0a1b2c3d4e5f");

    const read: Record<string, string> = {};
    for (const field of REPORT_REQUEST_FIELDS) {
      const value = posted.get(field);
      if (typeof value === "string" && value.length > 0) read[field] = value;
    }

    // The hostile fields are simply absent from what was read.
    expect(Object.keys(read).sort()).toEqual(["from", "to"]);
    expect(appointmentReportRequestSchema.safeParse(read).success).toBe(true);

    // And had they been read — an object built in code — the schema refuses.
    expect(
      appointmentReportRequestSchema.safeParse({
        ...read,
        columns: "diagnosis",
      }).success,
    ).toBe(false);
  });
});

describe("the module's own source", () => {
  it("names no patient, clinic, organization or report identifier", () => {
    // A field cannot be accepted by a schema that never mentions it. This is
    // the assertion that fails if somebody adds one in a refactor.
    for (const term of [
      "patientId",
      "patient_id",
      "clinicId",
      "organizationId",
      "reportId",
      "exportId",
      "p_patient_id",
    ]) {
      expect(CODE, `validation.ts names ${term}`).not.toContain(term);
    }
  });

  it("names no clinical field", () => {
    for (const term of [
      "diagnosis",
      "symptom",
      "assessment",
      "doctorNotes",
      "medicine",
      "dose",
      "prescriptionId",
      "storagePath",
    ]) {
      expect(CODE, `validation.ts names ${term}`).not.toContain(term);
    }
  });

  it("accepts no free-form SQL fragment", () => {
    for (const term of ["orderBy", "groupBy", "whereClause", "rawSql", "sql"]) {
      expect(CODE, `validation.ts names ${term}`).not.toContain(term);
    }
  });

  it("uses strict() on every schema", () => {
    // Three schemas, three `.strict()` calls. A schema that stripped instead
    // would drop a hostile field silently.
    const strictCount = (CODE.match(/\.strict\(\)/g) ?? []).length;
    expect(strictCount).toBe(3);
  });
});
