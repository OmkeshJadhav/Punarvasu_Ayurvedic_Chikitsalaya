import { describe, expect, it } from "vitest";

import { pageCount, parseRegisterPage, visiblePages } from "./pagination";

describe("parseRegisterPage", () => {
  it("reads a whole page number", () => {
    expect(parseRegisterPage("3")).toBe(3);
  });

  it("falls back to the first page for anything else", () => {
    for (const value of [
      undefined,
      "",
      "0",
      "-1",
      "2.5",
      "abc",
      "1e3",
      "1001",
      "99999",
    ]) {
      expect(parseRegisterPage(value), String(value)).toBe(1);
    }
  });
});

describe("pageCount", () => {
  it("rounds up, and is never zero", () => {
    expect(pageCount(17, 8)).toBe(3);
    expect(pageCount(16, 8)).toBe(2);
    expect(pageCount(0, 8)).toBe(1);
  });
});

describe("visiblePages", () => {
  it("shows every page when there are few", () => {
    expect(visiblePages(2, 3)).toEqual([1, 2, 3]);
  });

  it("keeps the ends and the neighbours, eliding the rest", () => {
    expect(visiblePages(6, 20)).toEqual([1, null, 5, 6, 7, null, 20]);
    expect(visiblePages(1, 20)).toEqual([1, 2, null, 20]);
    expect(visiblePages(20, 20)).toEqual([1, null, 19, 20]);
  });
});
