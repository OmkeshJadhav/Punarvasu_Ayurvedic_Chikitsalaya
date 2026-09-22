/**
 * Report export: CSV generation, server-side.
 *
 * ## One format, because one is required
 *
 * Section 85: implement only the formats actually required, and do not create
 * a massive reporting engine. CSV, and nothing else. An administrator opens
 * it in a spreadsheet, and that is the whole requirement; XLSX and PDF would
 * each be a dependency and a rendering surface added for a need nobody has
 * stated.
 *
 * ## The columns are a closed list
 *
 * Sections 45 and 92, example 4. `APPOINTMENT_REPORT.columns` in
 * `config/analytics.ts` is the export contract: this writer reads each row
 * through those keys and can emit nothing else. A column added to the RPC
 * later does not silently start leaving the building, and "dump every joined
 * table" is not an option the code has.
 *
 * There is no patient identifier in the report at all — the rows are counts
 * per clinic day, practitioner, type and status — so section 90's "if a
 * report genuinely needs patient identifiers it must be separately
 * authorized" does not arise here. That report does not exist.
 *
 * ## CSV injection
 *
 * A spreadsheet treats a cell beginning `=`, `+`, `-`, `@`, a tab or a
 * carriage return as a formula, and `=HYPERLINK(...)` in a cell is a
 * phishing link that runs on open. One field in this report is not a
 * developer-authored constant — the practitioner's display name — so every
 * value is guarded rather than the one that looks risky today. The guard
 * prefixes a single quote, which spreadsheets strip on display and which
 * keeps the value readable.
 *
 * This is not paranoia about our own practitioners: it is that an export is a
 * file that leaves the building and is opened by somebody with no reason to
 * suspect it.
 *
 * ## The filename
 *
 * Section 46. The report name and the period, and nothing about a patient —
 * there is nothing about a patient in the file either. Built from validated
 * ISO dates, so it carries no character a `Content-Disposition` header would
 * have to escape.
 */

import { APPOINTMENT_REPORT } from "@/config/analytics";

import type { AppointmentReportRow } from "./types";

/** Characters a spreadsheet may read as the start of a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * One CSV field: formula-guarded, then quoted if it needs to be.
 *
 * Always quoting would also be correct and is what most writers do; quoting
 * only when necessary keeps a column of counts readable as numbers when the
 * file is read by something other than a spreadsheet.
 */
export function csvField(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value;

  const guarded = FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))
    ? `'${text}`
    : text;

  return /["\n\r,]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/**
 * The appointment report as a CSV document.
 *
 * `\r\n` line endings, which RFC 4180 specifies and which Excel on Windows —
 * the machine a clinic administrator is most likely using — handles without
 * putting the whole file in one row.
 *
 * A BOM is prepended so that Excel reads the file as UTF-8. Without it a
 * practitioner's name containing a non-ASCII character is mojibake, which for
 * a clinic whose brand is written in Devanagari is not a hypothetical.
 */
export function appointmentReportCsv(
  reportRows: readonly AppointmentReportRow[],
): string {
  const header = APPOINTMENT_REPORT.columns
    .map((column) => csvField(column.header))
    .join(",");

  const body = reportRows.map((row) =>
    APPOINTMENT_REPORT.columns
      .map((column) => csvField(readColumn(row, column.key)))
      .join(","),
  );

  return `﻿${[header, ...body].join("\r\n")}\r\n`;
}

/**
 * One approved column of one row.
 *
 * Typed against the row shape, so a key that is not a field of
 * `AppointmentReportRow` is a compile error rather than an empty column.
 */
function readColumn(
  row: AppointmentReportRow,
  key: (typeof APPOINTMENT_REPORT.columns)[number]["key"],
): string | number {
  return row[key];
}

/** `punarvasu-appointments-2026-09-01-to-2026-09-30.csv`. */
export function appointmentReportFilename(from: string, to: string): string {
  return `punarvasu-${APPOINTMENT_REPORT.slug}-${from}-to-${to}.csv`;
}
