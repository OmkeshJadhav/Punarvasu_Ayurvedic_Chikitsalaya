/**
 * Register paging, read from the URL.
 *
 * A page number is harmless to put in a URL — unlike a search term, it says
 * nothing about anybody — so the registers page with plain links, and the
 * view stays shareable and correct under the back button like the rest of
 * the dashboard's filters.
 *
 * Validated here and clamped again in the database. Anything that is not a
 * whole number from 1 to 1,000 is page 1, silently: a mistyped page number is
 * not worth an error message, and nothing widens as a result.
 */

export const REGISTER_MAX_PAGE = 1000;

export const REGISTER_PAGE_PARAMS = {
  appointments: "appointmentsPage",
  patients: "patientsPage",
} as const;

export function parseRegisterPage(value: string | undefined): number {
  if (value === undefined || !/^\d{1,4}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= REGISTER_MAX_PAGE ? page : 1;
}

/** The number of pages a total fills. Never zero, so "page 1 of 1" holds. */
export function pageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/**
 * The page numbers to offer as links: the first, the last, and the current
 * one with a neighbour either side, with `null` where a run is elided.
 */
export function visiblePages(
  current: number,
  count: number,
): readonly (number | null)[] {
  const wanted = new Set(
    [1, count, current - 1, current, current + 1].filter(
      (page) => page >= 1 && page <= count,
    ),
  );
  const sorted = [...wanted].sort((a, b) => a - b);

  const result: (number | null)[] = [];
  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) result.push(null);
    result.push(page);
  }
  return result;
}
