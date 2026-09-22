import { describe, expect, it } from "vitest";

import {
  calculateAge,
  formatAddressLines,
  formatDateOfBirth,
  formatGender,
  formatMemberSince,
  formatPhone,
} from "./format";

/**
 * Display formatting.
 *
 * The tests that matter here are the timezone ones. A date of birth rendered
 * a day early is the kind of defect that is invisible to anyone developing in
 * the clinic's own timezone and obvious to a patient
 * (`phase_07.md` section 27).
 */

describe("formatDateOfBirth", () => {
  it("formats a calendar date as a person would read it", () => {
    expect(formatDateOfBirth("1990-04-07")).toBe("7 April 1990");
  });

  it("does not shift the date across a timezone boundary", () => {
    // `new Date("1990-01-01").toLocaleDateString()` prints 31 December 1989
    // anywhere behind UTC. Reading the parts from the string cannot.
    expect(formatDateOfBirth("1990-01-01")).toBe("1 January 1990");
    expect(formatDateOfBirth("1990-12-31")).toBe("31 December 1990");
  });

  it("drops a leading zero from the day", () => {
    expect(formatDateOfBirth("2001-03-05")).toBe("5 March 2001");
  });

  it("returns null for an absent or unrecognised value", () => {
    expect(formatDateOfBirth(null)).toBeNull();
    expect(formatDateOfBirth("not a date")).toBeNull();
    expect(formatDateOfBirth("1990-13-01")).toBeNull();
  });
});

describe("calculateAge", () => {
  it("counts whole years", () => {
    expect(calculateAge("1990-04-07", new Date(2026, 8, 18))).toBe(36);
  });

  it("does not count a birthday that has not happened yet this year", () => {
    expect(calculateAge("1990-12-25", new Date(2026, 8, 18))).toBe(35);
  });

  it("counts the birthday itself", () => {
    // Off by one here means telling somebody they are a year younger on the
    // one day they are most likely to check.
    expect(calculateAge("1990-09-18", new Date(2026, 8, 18))).toBe(36);
  });

  it("returns null for an unrecognised value", () => {
    expect(calculateAge("whenever")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups a ten-digit number for reading", () => {
    expect(formatPhone("9999999999")).toBe("+91 99999 99999");
  });

  it("returns an unexpected value untouched rather than mangling it", () => {
    // A number that does not match the expected shape is still a number
    // somebody needs to be able to read and dial.
    expect(formatPhone("+44 20 7946 0000")).toBe("+44 20 7946 0000");
  });

  it("returns null when there is no number", () => {
    expect(formatPhone(null)).toBeNull();
  });
});

describe("formatGender", () => {
  it("uses the wording the form offered", () => {
    expect(formatGender("undisclosed")).toBe("Prefer not to say");
    expect(formatGender("female")).toBe("Female");
  });

  it("returns null when not specified", () => {
    expect(formatGender(null)).toBeNull();
  });
});

describe("formatAddressLines", () => {
  const BASE = {
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
  };

  it("writes the address as the lines it would be written on", () => {
    expect(
      formatAddressLines({
        addressLine1: "1 Example Road",
        addressLine2: "Near the Example Garden",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
      }),
    ).toEqual([
      "1 Example Road",
      "Near the Example Garden",
      "Pune, Maharashtra",
      "411001",
    ]);
  });

  it("drops empty parts rather than leaving a blank line", () => {
    expect(
      formatAddressLines({
        ...BASE,
        addressLine1: "1 Example Road",
        city: "Pune",
      }),
    ).toEqual(["1 Example Road", "Pune"]);
  });

  it("does not leave a stray comma when only one of city or state is given", () => {
    expect(formatAddressLines({ ...BASE, state: "Maharashtra" })).toEqual([
      "Maharashtra",
    ]);
  });

  it("returns nothing for an empty address", () => {
    expect(formatAddressLines(BASE)).toEqual([]);
  });
});

describe("formatMemberSince", () => {
  it("reports the month and year, and no more", () => {
    expect(formatMemberSince("2026-09-18T10:00:00.000Z")).toBe(
      "September 2026",
    );
  });

  it("returns null for an unrecognised timestamp", () => {
    expect(formatMemberSince("recently")).toBeNull();
  });
});
