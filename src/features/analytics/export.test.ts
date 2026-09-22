import { describe, expect, it } from "vitest";

import { APPOINTMENT_REPORT } from "@/config/analytics";

import {
  appointmentReportCsv,
  appointmentReportFilename,
  csvField,
} from "./export";
import type { AppointmentReportRow } from "./types";

/**
 * The CSV export.
 *
 * ## Two things this file is protecting
 *
 * **The approved columns.** `phase_16.md` sections 45 and 92 and example 4.
 * The writer reads each row through `APPOINTMENT_REPORT.columns` and can emit
 * nothing else, so a column added to the RPC later does not silently start
 * leaving the building.
 *
 * **The spreadsheet that opens it.** A cell beginning `=`, `+`, `-`, `@`, a
 * tab or a carriage return is a formula, and `=HYPERLINK(...)` in a cell is a
 * phishing link that runs when somebody double-clicks a file they were sent
 * by their own clinic. One field in this report is not a developer-authored
 * constant — a practitioner's display name — so every value is guarded.
 */

const ROW: AppointmentReportRow = {
  clinicDate: "2026-09-17",
  practitionerName: "Dr Example",
  appointmentTypeName: "Initial consultation",
  status: "completed",
  appointmentCount: 4,
};

describe("csvField", () => {
  it("passes an ordinary value through unchanged", () => {
    expect(csvField("Dr Example")).toBe("Dr Example");
    expect(csvField(4)).toBe("4");
    expect(csvField("2026-09-17")).toBe("2026-09-17");
  });

  it("quotes a value containing a comma, a quote or a newline", () => {
    expect(csvField("Nair, A")).toBe('"Nair, A"');
    expect(csvField('He said "hello"')).toBe('"He said ""hello"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
  });

  it("neutralises every formula prefix", () => {
    // The six characters a spreadsheet treats as the start of an expression.
    // `=HYPERLINK(...)` is the one that matters: a link that runs when
    // somebody opens a file their own clinic sent them.
    expect(csvField('=HYPERLINK("http://evil","Click")')).toContain("'=");

    for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
      const output = csvField(`${prefix}CMD|'/c calc'!A1`);
      expect(output.startsWith("'") || output.startsWith("\"'"), prefix).toBe(
        true,
      );
    }
  });

  it("neutralises a formula even after quoting is applied", () => {
    // A value that needs both: the guard runs first, so the quote wraps the
    // already-guarded text rather than the other way round.
    const output = csvField("=SUM(A1,A2)");
    expect(output).toBe('"\'=SUM(A1,A2)"');
  });

  it("leaves a negative number readable while still guarding it", () => {
    // A leading `-` is both a minus sign and a formula prefix. Guarding wins:
    // a wrong-looking number in a spreadsheet is recoverable, a formula that
    // runs is not. No column in this report is ever negative, so nothing is
    // lost in practice.
    expect(csvField("-5")).toBe("'-5");
  });
});

describe("the report document", () => {
  it("starts with a byte-order mark so Excel reads it as UTF-8", () => {
    // Without it a non-ASCII practitioner name is mojibake, which for a
    // clinic whose brand is written in Devanagari is not hypothetical.
    expect(appointmentReportCsv([ROW]).startsWith("﻿")).toBe(true);
  });

  it("uses CRLF line endings, as RFC 4180 specifies", () => {
    const csv = appointmentReportCsv([ROW]);
    expect(csv).toContain("\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes the approved headers, in order", () => {
    const [header] = appointmentReportCsv([ROW]).replace("﻿", "").split("\r\n");
    expect(header).toBe(
      "Date,Practitioner,Appointment type,Status,Appointments",
    );
  });

  it("writes one line per row", () => {
    const csv = appointmentReportCsv([ROW, { ...ROW, status: "cancelled" }]);
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      "2026-09-17,Dr Example,Initial consultation,completed,4",
    );
  });

  it("writes a header and nothing else for an empty report", () => {
    // An empty file would be indistinguishable from a failed download.
    const csv = appointmentReportCsv([]);
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(1);
  });

  it("emits exactly five fields per line, whatever the data", () => {
    const hostile: AppointmentReportRow = {
      clinicDate: "2026-09-17",
      practitionerName: '=cmd|"/c calc"!A1',
      appointmentTypeName: "Follow-up, extended",
      status: "no_show",
      appointmentCount: 1,
    };

    const line = appointmentReportCsv([hostile])
      .replace("﻿", "")
      .split("\r\n")[1] as string;

    // Parsed properly rather than split on commas, because two of these
    // fields are quoted and contain one.
    expect(parseCsvLine(line)).toHaveLength(APPOINTMENT_REPORT.columns.length);
    expect(parseCsvLine(line)[1]).toBe('\'=cmd|"/c calc"!A1');
  });

  it("emits no field that is not an approved column", () => {
    // The contract. An object carrying an extra property produces the same
    // five fields, because the writer reads through the column list rather
    // than over the row's own keys.
    const smuggled = {
      ...ROW,
      patientName: "Someone Real",
      diagnosis: "Something private",
    } as AppointmentReportRow;

    const csv = appointmentReportCsv([smuggled]);
    expect(csv).not.toContain("Someone Real");
    expect(csv).not.toContain("Something private");
    expect(csv).not.toContain("patientName");
    expect(csv).not.toContain("diagnosis");
  });
});

describe("the filename", () => {
  it("names the report and the period, and nothing about a patient", () => {
    expect(appointmentReportFilename("2026-09-01", "2026-09-30")).toBe(
      "punarvasu-appointments-2026-09-01-to-2026-09-30.csv",
    );
  });

  it("carries no character a Content-Disposition header would have to escape", () => {
    const filename = appointmentReportFilename("2026-09-01", "2026-09-30");
    expect(filename).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(filename).not.toContain('"');
    expect(filename).not.toContain(";");
    expect(filename).not.toContain("\n");
  });
});

/** A minimal RFC 4180 reader, so a quoted comma is not counted as a separator. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  fields.push(current);
  return fields;
}
