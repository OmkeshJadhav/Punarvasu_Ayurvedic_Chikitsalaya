import type { z } from "zod";

/**
 * Turns validation issues into `VARIABLE_NAME: reason` lines.
 *
 * Only variable *names* and generic reasons are included — never the values,
 * which may be secrets.
 */
export function describeIssues(
  error: z.ZodError,
  names: Record<string, string>,
): string[] {
  return error.issues.map((issue) => {
    const key = issue.path[0];
    const name =
      typeof key === "string" ? (names[key] ?? key) : "configuration";
    return `${name}: ${issue.message}`;
  });
}
