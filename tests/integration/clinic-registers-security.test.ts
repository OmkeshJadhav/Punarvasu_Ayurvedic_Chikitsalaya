import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PERMISSIONS_BY_ROLE } from "@/config/permissions";

/**
 * The clinic registers' guarantees, asserted against the migration and the
 * feature source.
 *
 * These are the dashboard's only patient-level reads, so the properties that
 * make them acceptable are asserted rather than trusted: administrator-only
 * in the database body, audited per patient in the database body, no
 * enumeration parameter, no contact detail, note or clinical column, and no
 * direct table read or name in a log line on the application side.
 */

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20261001120000_clinic_registers.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replaceAll("\r\n", "\n");

/** Comments stripped, so the header's list of what is excluded is not a hit. */
const SQL_CODE = SQL.replaceAll(/^\s*--.*$/gm, "");

const PUBLIC_FUNCTIONS = [
  "clinic_appointment_register",
  "clinic_patient_register",
  "clinic_recent_activity",
] as const;

const INTERNAL_FUNCTIONS = [
  "assert_patient_register_reader",
  "clinic_register_audit",
] as const;

function bodyOf(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\([\\s\\S]*?as \\$fn\\$([\\s\\S]*?)\\$fn\\$;`,
  ).exec(SQL_CODE);
  return match?.[1] ?? "";
}

function declarationOf(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\(([\\s\\S]*?)as \\$fn\\$`,
  ).exec(SQL_CODE);
  return match?.[1] ?? "";
}

describe("the clinic registers migration", () => {
  it.each([...PUBLIC_FUNCTIONS, ...INTERNAL_FUNCTIONS])(
    "%s is a pinned security definer",
    (name) => {
      const declaration = declarationOf(name);
      expect(declaration, `no such function: ${name}`).not.toBe("");
      expect(declaration).toContain("security definer");
      expect(declaration).toContain("set search_path = ''");
    },
  );

  it.each(PUBLIC_FUNCTIONS)(
    "%s authorizes, bounds its range, then audits",
    (name) => {
      const body = bodyOf(name);
      const gate = body.indexOf("assert_patient_register_reader()");
      const range = body.indexOf("analytics_assert_range(");
      const read = body.indexOf("from public.");
      const audit = body.indexOf("clinic_register_audit(");

      expect(gate, `${name} has no gate`).toBeGreaterThan(-1);
      expect(range, `${name} does not bound its range`).toBeGreaterThan(gate);
      expect(read, `${name} reads before it authorizes`).toBeGreaterThan(range);
      expect(audit, `${name} does not audit`).toBeGreaterThan(read);
    },
  );

  it("admits the administrator alone", () => {
    const gate = bodyOf("assert_patient_register_reader");
    expect(gate).toContain("public.has_app_role('admin')");
    expect(gate).not.toContain("receptionist");
    expect(gate).not.toContain("doctor");
    expect(gate).toContain("insufficient_privilege");
  });

  it("audits one entry per distinct patient, through Phase 19's writer", () => {
    const audit = bodyOf("clinic_register_audit");
    expect(audit).toContain("select distinct");
    expect(audit).toContain("public.record_security_audit_event(");
    expect(audit).toContain("'patient_register.read'");
  });

  it("creates no table, policy or trigger, and writes no domain row", () => {
    expect(SQL_CODE).not.toMatch(/create table/i);
    expect(SQL_CODE).not.toMatch(/create policy/i);
    expect(SQL_CODE).not.toMatch(/create trigger/i);
    expect(SQL_CODE).not.toMatch(
      /\b(insert into|update|delete from)\s+public\./i,
    );
  });

  it("has no enumeration or raw-query parameter", () => {
    for (const parameter of [
      "p_patient_id",
      "p_limit",
      "p_offset",
      "p_sort",
      "p_order",
      "p_column",
      "p_search",
      "p_role",
    ]) {
      expect(SQL_CODE, `the migration takes ${parameter}`).not.toMatch(
        new RegExp(`\\b${parameter}\\b`),
      );
    }
  });

  it("clamps the page and fixes the page size in the database", () => {
    for (const name of [
      "clinic_appointment_register",
      "clinic_patient_register",
    ]) {
      const body = bodyOf(name);
      expect(body).toMatch(/c_page_size constant integer := \d+;/);
      expect(body).toContain("least(greatest(coalesce(p_page, 1), 1), 1000)");
    }
    expect(bodyOf("clinic_recent_activity")).toMatch(
      /c_limit constant integer := \d+;/,
    );
  });

  it("returns a name and appointment facts — no contact detail, note or clinical field", () => {
    const returnBlocks = [
      ...SQL.matchAll(/returns table \(([\s\S]*?)\)\nlanguage/g),
    ].map((match) => match[1] ?? "");
    expect(returnBlocks).toHaveLength(3);

    for (const block of returnBlocks) {
      for (const column of [
        "phone",
        "email",
        "date_of_birth",
        "gender",
        "address",
        "postal_code",
        "emergency",
        "note",
        "reason",
        "diagnosis",
        "prescription",
      ]) {
        expect(block, `a register returns ${column}`).not.toContain(column);
      }
    }
  });

  it("selects no free text or clinical column anywhere", () => {
    for (const column of [
      "patient_note",
      "internal_note",
      "cancellation_reason",
      ".phone",
      ".email",
      "date_of_birth",
      "address_line",
      "diagnosis",
      "chief_complaint",
      "medicine_name",
      "select *\n    from public.",
    ]) {
      expect(SQL_CODE, `the migration names ${column}`).not.toContain(column);
    }
  });

  it("revokes internals from every client role and grants them to nobody", () => {
    for (const name of INTERNAL_FUNCTIONS) {
      expect(SQL).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*from public, anon, authenticated;`,
        ),
      );
      expect(SQL).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}\\(`),
      );
    }
  });

  it("grants the public functions to authenticated only, never anon", () => {
    for (const name of PUBLIC_FUNCTIONS) {
      expect(SQL).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*from public, anon;`,
        ),
      );
      const grants = [
        ...SQL.matchAll(
          new RegExp(
            `grant execute on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*to ([a-z_, ]+);`,
            "g",
          ),
        ),
      ].map((match) => match[1]?.trim());
      expect(grants).toEqual(["authenticated"]);
    }
    expect(SQL_CODE).not.toMatch(/grant [\s\S]{0,80}? to [^;]*\banon\b/i);
  });
});

describe("the permission", () => {
  it("is held by the administrator and nobody else", () => {
    expect(PERMISSIONS_BY_ROLE.admin).toContain("registers.read.patients");
    for (const role of ["patient", "receptionist", "doctor"] as const) {
      expect(PERMISSIONS_BY_ROLE[role]).not.toContain(
        "registers.read.patients",
      );
    }
  });
});

describe("the application layer", () => {
  const dir = fileURLToPath(
    new URL("../../src/features/clinic-registers/", import.meta.url),
  );
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({ name, source: readFileSync(`${dir}${name}`, "utf8") }));

  const queries = sources.find((file) => file.name === "queries.ts")?.source;

  it("checks the register permission on every exported read", () => {
    expect(queries).toBeDefined();
    const exported = [
      ...(queries ?? "").matchAll(/export async function (\w+)\(/g),
    ];
    expect(exported.length).toBeGreaterThanOrEqual(1);
    expect(
      (queries ?? "").match(/assertPermission\("registers\.read\.patients"\)/g),
    ).toHaveLength(exported.length);
  });

  it("never reads or writes a table directly, or uses the service role", () => {
    for (const { name, source } of sources) {
      expect(source, `${name} reads a table`).not.toMatch(/\.from\(/);
      expect(source, `${name} writes`).not.toMatch(
        /\.(insert|update|delete|upsert)\(/,
      );
      expect(source, `${name} uses the admin client`).not.toContain(
        "supabase/admin",
      );
    }
  });

  it("puts no name or patient id in a log line", () => {
    const logCalls = (queries ?? "").match(/logger\.\w+\([^;]*;/g) ?? [];
    expect(logCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of logCalls) {
      expect(call).not.toMatch(/patient|name|rows|data\b/i);
    }
  });
});
