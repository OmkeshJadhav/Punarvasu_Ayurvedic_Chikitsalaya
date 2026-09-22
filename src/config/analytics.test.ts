import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ANALYTICS_RANGE_PRESETS,
  ANALYTICS_RANGE_RULES,
  APPOINTMENT_REPORT,
  DEFAULT_ANALYTICS_PRESET,
  RATE_DECIMAL_PLACES,
  TREND_GRANULARITIES,
  trendGranularityForSpan,
} from "./analytics";

/**
 * The analytics configuration mirror.
 *
 * `src/config/analytics.ts` restates values whose authority is the migration:
 * `analytics_range_rules()` is what actually refuses a two-year report and
 * what actually decides whether a trend is bucketed by day, week or month.
 * The application's copies exist so a form can offer a period the database
 * will accept and a chart can label its buckets correctly.
 *
 * Two copies of a rule is a divergence waiting to happen, so this file reads
 * the SQL and asserts they agree — the same arrangement
 * `config/appointments.test.ts`, `config/documents.test.ts` and
 * `config/notifications.test.ts` have, and the failure it prevents is the
 * same: a UI that confidently offers something the system will refuse.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20260927120000_analytics_reporting.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * The migration, with line endings normalised.
 *
 * This file is read as *text* and matched with patterns that anchor on
 * newlines. A CRLF checkout — or an editing tool that rewrites the file in
 * Windows mode — would otherwise make a mirror assertion match nothing and
 * **pass vacuously**, which is the same failure class
 * `tests/integration/source-hygiene.test.ts` guards from the other direction.
 * It happened once during Phase 16 and is why this line exists.
 */
const SQL = MIGRATION.replaceAll("\r\n", "\n");

describe("the migration this mirrors", () => {
  it("is the file the test thinks it is", () => {
    // A mirror test that silently reads an empty string passes everything.
    expect(SQL.length).toBeGreaterThan(5_000);
    expect(SQL).toContain("create function public.analytics_range_rules()");
  });
});

describe("the range rules", () => {
  /** The body of `analytics_range_rules()`, where the four numbers live. */
  const body =
    /create function public\.analytics_range_rules\(\)[\s\S]*?as \$fn\$([\s\S]*?)\$fn\$;/.exec(
      SQL,
    )?.[1] ?? "";

  it("reads the function body it means to", () => {
    expect(body).toContain("::integer");
  });

  it("bounds a period at the same number of days the database does", () => {
    const declared = /(\d+)::integer,\s*--\s*one year/.exec(body)?.[1];
    expect(declared, "no max range in the migration").toBeDefined();
    expect(Number(declared)).toBe(ANALYTICS_RANGE_RULES.maxRangeDays);
  });

  it("starts from the same earliest date the database does", () => {
    const declared = /date '(\d{4}-\d{2}-\d{2})'/.exec(body)?.[1];
    expect(declared, "no earliest date in the migration").toBeDefined();
    expect(declared).toBe(ANALYTICS_RANGE_RULES.earliestDate);
  });

  it("switches to weekly and monthly buckets where the database does", () => {
    const daily = /(\d+)::integer,\s*--\s*up to a month/.exec(body)?.[1];
    const weekly = /(\d+)::integer;\s*--\s*up to four months/.exec(body)?.[1];

    expect(daily, "no daily threshold in the migration").toBeDefined();
    expect(weekly, "no weekly threshold in the migration").toBeDefined();

    expect(Number(daily)).toBe(ANALYTICS_RANGE_RULES.dailyGranularityMaxDays);
    expect(Number(weekly)).toBe(ANALYTICS_RANGE_RULES.weeklyGranularityMaxDays);
  });

  it("bounds a period at a length somebody would actually ask for", () => {
    // A year plus a leap day. Short enough that a query stays bounded,
    // long enough that "the last twelve months" always fits however the
    // range falls.
    expect(ANALYTICS_RANGE_RULES.maxRangeDays).toBe(366);
    expect(ANALYTICS_RANGE_RULES.dailyGranularityMaxDays).toBeLessThan(
      ANALYTICS_RANGE_RULES.weeklyGranularityMaxDays,
    );
    expect(ANALYTICS_RANGE_RULES.weeklyGranularityMaxDays).toBeLessThan(
      ANALYTICS_RANGE_RULES.maxRangeDays,
    );
  });
});

describe("trend granularity", () => {
  it("agrees with the database's own thresholds at every boundary", () => {
    const { dailyGranularityMaxDays: daily, weeklyGranularityMaxDays: weekly } =
      ANALYTICS_RANGE_RULES;

    // The boundaries themselves, which is where an off-by-one would hide.
    expect(trendGranularityForSpan(1)).toBe("day");
    expect(trendGranularityForSpan(daily)).toBe("day");
    expect(trendGranularityForSpan(daily + 1)).toBe("week");
    expect(trendGranularityForSpan(weekly)).toBe("week");
    expect(trendGranularityForSpan(weekly + 1)).toBe("month");
    expect(trendGranularityForSpan(ANALYTICS_RANGE_RULES.maxRangeDays)).toBe(
      "month",
    );
  });

  it("uses the same three units the database names", () => {
    const sqlBody =
      /create function public\.analytics_trend_granularity[\s\S]*?as \$fn\$([\s\S]*?)\$fn\$;/.exec(
        SQL,
      )?.[1] ?? "";

    for (const unit of TREND_GRANULARITIES) {
      expect(sqlBody).toContain(`return '${unit}'`);
    }

    // And no fourth. A unit the application cannot label would render as a
    // bucket with no heading.
    const returned = [...sqlBody.matchAll(/return '([a-z]+)'/g)].map(
      (match) => match[1],
    );
    expect(new Set(returned)).toEqual(new Set(TREND_GRANULARITIES));
  });

  it("bounds how many points a chart can be asked to draw", () => {
    // The reason granularity is derived rather than requested. At most 31
    // daily points, 18 weekly, 13 monthly — none of which is a chart that
    // has to start thinning its labels to stay readable.
    const { dailyGranularityMaxDays, weeklyGranularityMaxDays, maxRangeDays } =
      ANALYTICS_RANGE_RULES;

    expect(dailyGranularityMaxDays).toBeLessThanOrEqual(31);
    expect(Math.ceil(weeklyGranularityMaxDays / 7)).toBeLessThanOrEqual(20);
    expect(Math.ceil(maxRangeDays / 28)).toBeLessThanOrEqual(14);
  });
});

describe("the presets", () => {
  it("offers the periods the specification lists", () => {
    // `phase_16.md` section 24's own list, plus a twelve-month option so the
    // year-long bound is reachable without typing two dates.
    for (const preset of [
      "today",
      "this_week",
      "this_month",
      "last_month",
      "last_3_months",
      "custom",
    ]) {
      expect(ANALYTICS_RANGE_PRESETS as readonly string[]).toContain(preset);
    }
  });

  it("opens on a period that is always inside the bounds", () => {
    expect(ANALYTICS_RANGE_PRESETS as readonly string[]).toContain(
      DEFAULT_ANALYTICS_PRESET,
    );
    // Month-to-date is at most 31 days, so the default can never be refused.
    expect(DEFAULT_ANALYTICS_PRESET).toBe("this_month");
  });
});

describe("the export contract", () => {
  it("names only columns the report actually returns", () => {
    // The RPC's `returns table`, read out of the migration. A column in the
    // export that the function does not produce would be an empty column; a
    // column the function produces that is *not* here is data leaving the
    // building unreviewed, which is the direction that matters.
    const returns =
      /create function public\.analytics_appointment_report\([\s\S]*?returns table \(([\s\S]*?)\)\nlanguage/.exec(
        SQL,
      )?.[1] ?? "";

    expect(returns, "no report signature in the migration").toContain(
      "clinic_date",
    );

    const sqlColumns = [...returns.matchAll(/^\s*([a-z_]+)\s/gm)].map(
      (match) => match[1],
    );

    // snake_case in SQL, camelCase in the row type; compare on the shape.
    const exported = APPOINTMENT_REPORT.columns.map((column) =>
      column.key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    );

    expect(new Set(exported)).toEqual(new Set(sqlColumns));
  });

  it("contains no patient identifier of any kind", () => {
    // `phase_16.md` sections 45, 90 and 104. The report is aggregated, so
    // there is nothing to leave out — this asserts that stays true.
    const forbidden = [
      "patient",
      "email",
      "phone",
      "name_of_patient",
      "diagnosis",
      "note",
      "prescription",
      "document",
      "storage",
      "url",
    ];

    for (const column of APPOINTMENT_REPORT.columns) {
      for (const term of forbidden) {
        expect(column.key.toLowerCase()).not.toContain(term);
        expect(column.header.toLowerCase()).not.toContain(term);
      }
    }
  });

  it("has a filename slug safe to put in a header", () => {
    expect(APPOINTMENT_REPORT.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("rounding", () => {
  it("shows one decimal place, consistently", () => {
    // Section 95: `67.4%`, never `67.437291%`. One place everywhere, so two
    // reports rounded differently cannot look like two different numbers.
    expect(RATE_DECIMAL_PLACES).toBe(1);
  });
});
