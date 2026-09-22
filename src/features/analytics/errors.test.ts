import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ANALYTICS_ERROR_CODES, describeAnalyticsFailure } from "./errors";

/**
 * Failure copy.
 *
 * Two properties, and the second is the one that matters:
 *
 * 1. Every code the migration raises is recognised, and no code is declared
 *    that it does not raise. A mapping for a code nothing raises is dead
 *    copy; a code with no mapping reaches a reader as a generic failure when
 *    it could have told them what to change.
 * 2. **Nothing internal crosses the boundary.** Not a function name, a table
 *    name, a policy name, a SQLSTATE, a constraint or a fragment of SQL —
 *    `phase_16.md` sections 65 and 119.
 */

const SQL = readFileSync(
  new URL(
    "../../../supabase/migrations/20260927120000_analytics_reporting.sql",
    import.meta.url,
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("the codes this feature declares", () => {
  it("are all raised by the migration", () => {
    for (const code of Object.values(ANALYTICS_ERROR_CODES)) {
      expect(SQL, `nothing raises ${code}`).toContain(`errcode = '${code}'`);
    }
  });

  it("cover every code the migration raises", () => {
    const raised = new Set(
      [...SQL.matchAll(/errcode = '(PV\d{3})'/g)].map((match) => match[1]),
    );
    const declared = new Set<string>(Object.values(ANALYTICS_ERROR_CODES));

    expect(raised).toEqual(declared);
  });

  it("occupy a range no earlier phase uses", () => {
    // Appointments PV001-PV019, prescriptions PV020-PV025, treatment plans
    // PV030-PV035, documents PV040-PV047, notifications PV050-PV059.
    for (const code of Object.values(ANALYTICS_ERROR_CODES)) {
      const number = Number(code.slice(2));
      expect(number, code).toBeGreaterThanOrEqual(60);
      expect(number, code).toBeLessThan(70);
    }
  });

  it("are distinct", () => {
    const codes = Object.values(ANALYTICS_ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("describeAnalyticsFailure", () => {
  it("explains what to change about an invalid period", () => {
    const failure = describeAnalyticsFailure({
      code: ANALYTICS_ERROR_CODES.invalidRange,
    });
    expect(failure.message).toContain("start and end dates");
    expect(failure.forbidden).toBe(false);
  });

  it("names the bound when a period is too long", () => {
    const failure = describeAnalyticsFailure({
      code: ANALYTICS_ERROR_CODES.rangeTooLong,
    });
    expect(failure.message).toContain("one year");
  });

  it("explains a period that starts too early", () => {
    const failure = describeAnalyticsFailure({
      code: ANALYTICS_ERROR_CODES.rangeBeforeRecords,
    });
    expect(failure.message).toContain("later start date");
  });

  it("reports a refusal as a refusal rather than a failure", () => {
    // The distinction the panel renderer acts on: a refused panel renders
    // nothing, a failed one renders a retry.
    const failure = describeAnalyticsFailure({ code: "42501" });
    expect(failure.forbidden).toBe(true);
  });

  it("falls back to one generic message for anything else", () => {
    for (const error of [
      { code: "23505" },
      { code: "08006" },
      new Error("connection terminated unexpectedly"),
      "a string",
      null,
      undefined,
      {},
      { code: 42501 },
    ]) {
      const failure = describeAnalyticsFailure(error);
      expect(failure.message).toBe(
        "We couldn't load this report. Please try again.",
      );
      expect(failure.forbidden).toBe(false);
    }
  });

  it("distinguishes a missing interface in the log without saying so on screen", () => {
    // An operator needs to know the migration has not been applied; a reader
    // does not need to know a function is missing.
    const failure = describeAnalyticsFailure({ code: "42883" });
    expect(failure.logEvent).toBe("analytics.interface_missing");
    expect(failure.message).toBe(
      "We couldn't load this report. Please try again.",
    );
  });
});

describe("nothing internal reaches a reader", () => {
  const everyFailure = [
    ...Object.values(ANALYTICS_ERROR_CODES),
    "42501",
    "42883",
    "23505",
    "unknown",
  ].map((code) => describeAnalyticsFailure({ code }));

  it("names no function, table, policy or column", () => {
    const forbidden = [
      "analytics_",
      "public.",
      "appointments",
      "patients",
      "prescriptions",
      "clinical_records",
      "notification",
      "practitioners",
      "security definer",
      "policy",
      "select",
      "pv06",
      "42501",
      "search_path",
    ];

    for (const failure of everyFailure) {
      const message = failure.message.toLowerCase();
      for (const term of forbidden) {
        expect(
          message,
          `"${failure.message}" contains "${term}"`,
        ).not.toContain(term);
      }
    }
  });

  it("gives every failure a stable, low-cardinality log event", () => {
    for (const failure of everyFailure) {
      expect(failure.logEvent).toMatch(/^analytics\.[a-z_]+$/);
      // A log event must not carry a value — that is what makes "how often
      // does a report fail" one query rather than a guess at event names.
      expect(failure.logEvent).not.toMatch(/\d/);
    }
  });

  it("writes every message as a whole sentence a person can act on", () => {
    for (const failure of everyFailure) {
      expect(failure.message.length).toBeGreaterThan(20);
      expect(failure.message).toMatch(/[.!]$/);
    }
  });
});
