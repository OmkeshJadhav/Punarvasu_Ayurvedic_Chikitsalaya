import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EMPTY_APPOINTMENT_COUNTS,
  METRIC_DEFINITIONS,
  acceptanceRate,
  appointmentRates,
  countsArePlausible,
  formatCount,
  formatMinutes,
  formatRate,
  metricDefinition,
  notificationReadRate,
  rate,
  utilization,
} from "./metrics";
import type { AppointmentCounts } from "./types";

/**
 * The metric definitions.
 *
 * `phase_16.md` section 98 asks for metric calculations to be tested against
 * a deterministic fixture and gives one: ten appointments, six completed, two
 * cancelled, one no-show, one pending. That fixture is below, and **every
 * metric and every denominator** is verified against it.
 *
 * The property worth stating: the three rates divide by the *concluded*
 * appointments, not by all ten. Six of nine, two of nine, one of nine — not
 * six of ten. Section 14 asks for the denominator to be explicit, and this is
 * where "explicit" becomes a number somebody can check by hand.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260927120000_analytics_reporting.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * `phase_16.md` section 98's own fixture.
 *
 * Ten appointments: 6 completed, 2 cancelled, 1 no-show, 1 pending. "Pending"
 * is `requested` in this product's vocabulary — the status Phase 09 gives a
 * booking the clinic has not yet agreed to.
 */
const FIXTURE: AppointmentCounts = {
  total: 10,
  requested: 1,
  confirmed: 0,
  checkedIn: 0,
  inConsultation: 0,
  completed: 6,
  cancelled: 2,
  noShow: 1,
  eligible: 9,
};

describe("the specification's fixture", () => {
  it("is ten appointments, six completed, two cancelled, one no-show, one pending", () => {
    expect(FIXTURE.total).toBe(10);
    expect(FIXTURE.completed).toBe(6);
    expect(FIXTURE.cancelled).toBe(2);
    expect(FIXTURE.noShow).toBe(1);
    expect(FIXTURE.requested).toBe(1);
  });

  it("is internally consistent", () => {
    expect(countsArePlausible(FIXTURE)).toBe(true);
  });

  it("counts nine as concluded, not ten", () => {
    // The whole point. The pending appointment has no outcome yet, so it is
    // not in any rate's denominator.
    expect(FIXTURE.eligible).toBe(9);
    expect(FIXTURE.eligible).toBe(
      FIXTURE.completed + FIXTURE.cancelled + FIXTURE.noShow,
    );
    expect(FIXTURE.total - FIXTURE.eligible).toBe(1);
  });
});

describe("appointment rates, over the specification's fixture", () => {
  const rates = appointmentRates(FIXTURE);

  it("completion rate is six of nine, not six of ten", () => {
    expect(rates.completionRate).toBeCloseTo(6 / 9, 10);
    expect(rates.completionRate).not.toBeCloseTo(6 / 10, 3);
    expect(formatRate(rates.completionRate)).toBe("66.7%");
  });

  it("cancellation rate is two of nine", () => {
    expect(rates.cancellationRate).toBeCloseTo(2 / 9, 10);
    expect(formatRate(rates.cancellationRate)).toBe("22.2%");
  });

  it("no-show rate is one of nine", () => {
    expect(rates.noShowRate).toBeCloseTo(1 / 9, 10);
    expect(formatRate(rates.noShowRate)).toBe("11.1%");
  });

  it("the three rates sum to exactly one", () => {
    // A consequence of the denominator being the sum of the three numerators.
    // If this ever fails, the denominator has quietly changed.
    const sum =
      (rates.completionRate ?? 0) +
      (rates.cancellationRate ?? 0) +
      (rates.noShowRate ?? 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("zero is not missing", () => {
  it("reports no rate at all when nothing concluded", () => {
    // Section 96 and example 7. A period in which every appointment is still
    // ahead of the clinic has no cancellation rate — not a cancellation rate
    // of zero.
    const upcomingOnly: AppointmentCounts = {
      ...EMPTY_APPOINTMENT_COUNTS,
      total: 4,
      confirmed: 4,
    };

    const rates = appointmentRates(upcomingOnly);
    expect(rates.completionRate).toBeNull();
    expect(rates.cancellationRate).toBeNull();
    expect(rates.noShowRate).toBeNull();
  });

  it("renders a missing rate as the caller's words, never as 0%", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(null, "No concluded appointments")).toBe(
      "No concluded appointments",
    );
    expect(formatRate(null)).not.toBe("0.0%");
  });

  it("reports a genuine zero as zero", () => {
    // The other half. Nine concluded and none cancelled *is* 0%, and saying
    // "no data" there would be just as wrong in the other direction.
    const noneCancelled: AppointmentCounts = {
      ...EMPTY_APPOINTMENT_COUNTS,
      total: 9,
      completed: 9,
      eligible: 9,
    };

    expect(appointmentRates(noneCancelled).cancellationRate).toBe(0);
    expect(formatRate(appointmentRates(noneCancelled).cancellationRate)).toBe(
      "0.0%",
    );
  });

  it("an empty period has counts of zero and no rates", () => {
    expect(countsArePlausible(EMPTY_APPOINTMENT_COUNTS)).toBe(true);
    expect(
      appointmentRates(EMPTY_APPOINTMENT_COUNTS).completionRate,
    ).toBeNull();
  });
});

describe("rate", () => {
  it("divides", () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(0, 4)).toBe(0);
    expect(rate(4, 4)).toBe(1);
  });

  it("refuses rather than guesses when there is nothing to divide by", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(3, 0)).toBeNull();
    expect(rate(3, -1)).toBeNull();
  });

  it("refuses an impossible ratio rather than returning a plausible wrong one", () => {
    // Section 97. More completed than concluded means the query is wrong;
    // drawing a bar at 140% would teach a reader to trust it.
    expect(rate(7, 5)).toBeNull();
    expect(rate(-1, 5)).toBeNull();
  });

  it("refuses a non-finite input", () => {
    expect(rate(Number.NaN, 5)).toBeNull();
    expect(rate(1, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("data quality (section 97)", () => {
  it("rejects more completed than total", () => {
    expect(
      countsArePlausible({
        ...EMPTY_APPOINTMENT_COUNTS,
        total: 5,
        completed: 9,
        eligible: 9,
      }),
    ).toBe(false);
  });

  it("rejects an eligible count that is not the sum of its parts", () => {
    expect(
      countsArePlausible({ ...FIXTURE, eligible: FIXTURE.eligible + 1 }),
    ).toBe(false);
  });

  it("rejects a negative count", () => {
    expect(countsArePlausible({ ...FIXTURE, cancelled: -1 })).toBe(false);
  });

  it("rejects parts that do not add up to the total", () => {
    // Nine accounted for out of eleven means two appointments in a status
    // nothing counted — a query bug, not a strange month.
    expect(countsArePlausible({ ...FIXTURE, total: 11 })).toBe(false);
  });

  it("accepts a period using every status", () => {
    expect(
      countsArePlausible({
        total: 12,
        requested: 2,
        confirmed: 3,
        checkedIn: 1,
        inConsultation: 1,
        completed: 3,
        cancelled: 1,
        noShow: 1,
        eligible: 5,
      }),
    ).toBe(true);
  });
});

describe("utilization", () => {
  it("is booked over available", () => {
    const result = utilization(180, 480);
    expect(result.utilizationRate).toBeCloseTo(0.375, 10);
    expect(formatRate(result.utilizationRate)).toBe("37.5%");
  });

  it("is null when the practitioner had no working hours", () => {
    // Not 0%. "Did not work this period" and "worked and saw nobody" are
    // different facts, and only one of them is about utilisation.
    expect(utilization(0, 0).utilizationRate).toBeNull();
  });

  it("is zero when they worked and saw nobody", () => {
    expect(utilization(0, 480).utilizationRate).toBe(0);
  });

  it("cannot exceed one", () => {
    // The clamping that guarantees this happens in SQL, by intersecting
    // booked time with available time. This is the second line of defence:
    // a figure that got past it is refused rather than drawn.
    expect(utilization(600, 480).utilizationRate).toBeNull();
  });

  it("keeps the raw minutes whatever the rate does", () => {
    // So a practitioner with no roster still sees what they were booked for.
    const result = utilization(120, 0);
    expect(result.bookedMinutes).toBe(120);
    expect(result.availableMinutes).toBe(0);
    expect(result.utilizationRate).toBeNull();
  });
});

describe("notification acceptance (section 41)", () => {
  it("is accepted over attempted, and excludes what has not been tried", () => {
    // `pending` is deliberately not in the denominator: including it would
    // make the figure drop every time the worker queued something.
    expect(acceptanceRate({ sent: 301, failed: 19 })).toBeCloseTo(
      301 / 320,
      10,
    );
  });

  it("is null when nothing was attempted", () => {
    expect(acceptanceRate({ sent: 0, failed: 0 })).toBeNull();
  });

  it("is not called a delivery rate anywhere in the metric table", () => {
    // The whole point of section 41. No configured provider confirms
    // delivery, so nothing in this product may claim it.
    const definition = metricDefinition("acceptanceRate");
    expect(definition).toBeDefined();
    expect(definition?.label.toLowerCase()).not.toContain("delivery");
    expect(definition?.formula).toContain("not a delivery rate");
  });

  it("reads a notification's opened share against what was shown", () => {
    expect(notificationReadRate({ active: 40, readCount: 10 })).toBe(0.25);
    expect(notificationReadRate({ active: 0, readCount: 0 })).toBeNull();
  });
});

describe("the metric definitions are usable documentation", () => {
  it("gives every definition a key, a label, a formula and date semantics", () => {
    for (const definition of METRIC_DEFINITIONS) {
      expect(definition.key).toMatch(/^[a-zA-Z]+$/);
      expect(definition.label.length).toBeGreaterThan(2);
      expect(definition.formula.length).toBeGreaterThan(10);
      expect(definition.dateSemantics.length).toBeGreaterThan(10);
    }
  });

  it("uses each key once", () => {
    const keys = METRIC_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("documents every figure the dashboards actually render", () => {
    for (const key of [
      "appointments",
      "completed",
      "cancelled",
      "noShow",
      "eligible",
      "completionRate",
      "cancellationRate",
      "noShowRate",
      "utilization",
      "newPatients",
      "returningPatients",
      "activePatients",
      "totalPatients",
      "acceptanceRate",
    ]) {
      expect(metricDefinition(key), `no definition for ${key}`).toBeDefined();
    }
  });

  it("states the denominator wherever a rate is defined", () => {
    for (const key of ["completionRate", "cancellationRate", "noShowRate"]) {
      expect(metricDefinition(key)?.formula).toContain("concluded");
    }

    // And the concluded definition says which statuses it is, and which it
    // is not. Section 14's "define the denominator explicitly".
    const concluded = metricDefinition("eligible");
    expect(concluded?.formula).toContain("Completed");
    expect(concluded?.formula).toContain("cancelled");
    expect(concluded?.formula).toContain("no-show");
    expect(concluded?.formula).toContain("still upcoming");
    expect(concluded?.formula).toContain("final state");
  });

  it("says a new patient is a patient record and not an account", () => {
    // Section 22's warning, written where the reader of the figure sees it.
    const definition = metricDefinition("newPatients");
    expect(definition?.formula).toContain("patient records");
    expect(definition?.formula).toContain("not");
    expect(definition?.formula).toContain("user accounts");
  });

  it("makes no clinical claim in any formula", () => {
    // `docs/HEALTHCARE_AND_AI_SAFETY.md`, and section 38's warning that a
    // plan count invites an efficacy reading.
    const forbidden = [
      "effective",
      "efficacy",
      "outcome",
      "cure",
      "improve",
      "success rate",
      "diagnos",
      "prevalence",
    ];

    for (const definition of METRIC_DEFINITIONS) {
      const text = `${definition.label} ${definition.formula}`.toLowerCase();
      for (const term of forbidden) {
        expect(text, `${definition.key} mentions "${term}"`).not.toContain(
          term,
        );
      }
    }
  });
});

describe("the denominator agrees with the database", () => {
  it("is completed + cancelled + no_show in the SQL too", () => {
    // The definition lives in `analytics_appointment_counts()`. If somebody
    // widens it there, the rates on every screen change and this fails.
    const body =
      /create function public\.analytics_appointment_counts\([\s\S]*?as \$fn\$([\s\S]*?)\$fn\$;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    // The guard: this is the function body, not an empty string. `eligible`
    // is the column name in the signature rather than in the body, so the
    // body is identified by what it actually reads.
    expect(body, "no counts function in the migration").toContain(
      "from public.appointments",
    );
    expect(body).toMatch(
      /count\(\*\) filter \(\s*where a\.status in \('completed', 'cancelled', 'no_show'\)\s*\)/,
    );
  });

  it("excludes the four in-flight statuses from the denominator", () => {
    const body =
      /create function public\.analytics_appointment_counts\([\s\S]*?as \$fn\$([\s\S]*?)\$fn\$;/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const denominator =
      /count\(\*\) filter \(\s*where a\.status in \(([^)]*)\)/.exec(
        body,
      )?.[1] ?? "";

    for (const status of [
      "requested",
      "confirmed",
      "checked_in",
      "in_consultation",
    ]) {
      expect(denominator).not.toContain(status);
    }
  });
});

describe("formatting", () => {
  it("prints a count with thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234)).toBe("1,234");
  });

  it("prints minutes as hours and minutes", () => {
    expect(formatMinutes(45)).toBe("45 minutes");
    expect(formatMinutes(60)).toBe("1 hour");
    expect(formatMinutes(90)).toBe("1 hour 30 minutes");
    expect(formatMinutes(480)).toBe("8 hours");
    expect(formatMinutes(0)).toBe("0 minutes");
  });

  it("rounds a fractional minute rather than printing it", () => {
    // Multirange arithmetic produces fractions; a clinic does not think in
    // tenths of a minute.
    expect(formatMinutes(90.4)).toBe("1 hour 30 minutes");
  });

  it("prints a rate to one decimal place", () => {
    expect(formatRate(0.674372)).toBe("67.4%");
    expect(formatRate(1)).toBe("100.0%");
    expect(formatRate(0)).toBe("0.0%");
  });
});
