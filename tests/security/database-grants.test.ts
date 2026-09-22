/**
 * The database's own privileges, asserted against the migrations.
 *
 * ## Why this file exists
 *
 * Phase 15 shipped an authorization hole and found it by accident. The shape
 * of it is worth restating, because it is not obvious and it will be made
 * again otherwise:
 *
 * > Supabase's project bootstrap carries
 * > `alter default privileges in schema public grant execute on functions to
 * > anon, authenticated, service_role`, so a newly created function is granted
 * > to those roles **by name**. `revoke all on function f() from public`
 * > removes only the PUBLIC grant and leaves all three named ones in place.
 *
 * Every phase since 08 wrote `revoke ... from public` and survived only
 * because each function happened to gate itself. Phase 19 revoked `anon` from
 * every function in `public` and set a default-privilege revoke so new ones
 * inherit it — and these tests are what stop the next migration re-opening it.
 *
 * ## What is asserted here, and what is not
 *
 * This is a **static** audit of migration text. It cannot prove the live
 * database matches: that requires applying the migration and probing with real
 * per-role JWTs, which is recorded in `docs/progress/progress_phase_19.md` as
 * a separate, required verification step. What it can do — and what a live
 * probe cannot — is fail the moment somebody *writes* the next mistake.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = "supabase/migrations";

const FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const SOURCES = FILES.map((name) => ({
  name,
  text: readFileSync(join(MIGRATIONS_DIR, name), "utf8"),
}));

/** All migrations concatenated, with `--` comments removed. */
const SQL = SOURCES.map(({ text }) =>
  text
    .split("\n")
    .map((line) => line.split("--")[0] ?? "")
    .join("\n"),
).join("\n");

interface FunctionDefinition {
  readonly migration: string;
  readonly name: string;
  readonly body: string;
  readonly isDefiner: boolean;
  readonly isTrigger: boolean;
  readonly searchPath: string | null;
}

function functions(): FunctionDefinition[] {
  const pattern = /create (?:or replace )?function\s+(public\.[a-z_]+)\s*\(/gi;
  const found: FunctionDefinition[] = [];

  for (const { name: migration, text } of SOURCES) {
    const stripped = text
      .split("\n")
      .map((line) => line.split("--")[0] ?? "")
      .join("\n");
    const starts = [...stripped.matchAll(pattern)].map((match) => ({
      index: match.index,
      name: match[1]!.toLowerCase(),
    }));

    starts.forEach((start, position) => {
      const end = starts[position + 1]?.index ?? stripped.length;
      const body = stripped.slice(start.index, end);
      const head = body.slice(0, 3000);
      const searchPath = /set\s+search_path\s*=\s*([^\n;]+)/i.exec(head);
      found.push({
        migration,
        name: start.name,
        body,
        isDefiner: /security\s+definer/i.test(head),
        isTrigger: /returns\s+trigger/i.test(head.slice(0, 600)),
        searchPath: searchPath ? searchPath[1]!.trim() : null,
      });
    });
  }

  return found;
}

const FUNCTIONS = functions();
const CALLABLE_DEFINERS = FUNCTIONS.filter((f) => f.isDefiner && !f.isTrigger);

/** Roles a function's EXECUTE is revoked from, across every migration. */
function revokedFrom(name: string): Set<string> {
  const roles = new Set<string>();
  const pattern = new RegExp(
    `revoke\\s+all\\s+on\\s+function\\s+${name.replace(".", "\\.")}\\s*\\([^)]*\\)\\s*from\\s+([^;]+);`,
    "gi",
  );
  for (const match of SQL.matchAll(pattern)) {
    for (const role of match[1]!.split(","))
      roles.add(role.trim().toLowerCase());
  }
  return roles;
}

describe("the suite is scanning something", () => {
  it("found every migration", () => {
    // A structural suite that silently matches nothing passes forever.
    expect(FILES.length).toBeGreaterThanOrEqual(16);
  });

  it("found the functions", () => {
    expect(CALLABLE_DEFINERS.length).toBeGreaterThan(80);
  });
});

describe("SECURITY DEFINER functions", () => {
  it("every one pins its search_path", () => {
    // `phase_19.md` sections 32 and 187. A definer function that resolves an
    // unqualified name through the caller's search_path executes whatever the
    // caller put in front of it, as the owner.
    const unpinned = FUNCTIONS.filter((f) => f.isDefiner && !f.searchPath);
    expect(unpinned.map((f) => `${f.migration}: ${f.name}`)).toEqual([]);
  });

  it("every one pins it to empty, not to a schema list", () => {
    // `set search_path = ''` forces every reference to be schema-qualified,
    // which is checked by the parser. A list can still be shadowed.
    const loose = FUNCTIONS.filter(
      (f) => f.isDefiner && f.searchPath && !/^''$/.test(f.searchPath),
    );
    expect(
      loose.map((f) => `${f.migration}: ${f.name} -> ${f.searchPath}`),
    ).toEqual([]);
  });

  it("builds no dynamic SQL from an argument", () => {
    // Section 117. `execute` with an interpolated parameter inside a definer
    // function is SQL injection with the owner's privileges.
    for (const fn of FUNCTIONS) {
      if (!fn.isDefiner) continue;
      const dynamic = /\bexecute\s+(format\s*\(|'|"|\w+\s*\|\|)/i.test(fn.body);
      expect(dynamic, `${fn.migration}: ${fn.name}`).toBe(false);
    }
  });
});

describe("no function is reachable by anon", () => {
  /**
   * The Phase 19 sweep revokes from `anon` for every function in `public`, and
   * `alter default privileges` covers the ones created after it. Both are
   * asserted, because the sweep is a point-in-time fix and the default is what
   * makes it stay fixed.
   */
  const HARDENING = SOURCES.find((s) =>
    s.name.includes("security_hardening"),
  )!.text;

  it("sweeps every existing function", () => {
    expect(HARDENING).toMatch(/revoke all on function %s from anon/);
    expect(HARDENING).toContain("from pg_proc p");
  });

  it("revokes the default privilege, so a future function inherits it", () => {
    expect(HARDENING).toMatch(
      /alter default privileges\s+in schema public\s+revoke execute on functions from anon;/,
    );
  });

  it("a migration added after Phase 19 names anon in its own revoke", () => {
    // Belt as well as braces. `alter default privileges` applies only to
    // objects created by the role that set it; a function created by another
    // owner would not inherit it, and nothing in this project creates one —
    // but the assertion costs nothing and the failure mode is silent.
    const later = SOURCES.filter((s) => s.name > "20260929120000");
    for (const migration of later) {
      const created = [
        ...migration.text.matchAll(
          /create (?:or replace )?function\s+(public\.[a-z_]+)\s*\(/gi,
        ),
      ].map((m) => m[1]!.toLowerCase());

      for (const name of created) {
        const definition = FUNCTIONS.find(
          (f) => f.name === name && f.migration === migration.name,
        );
        if (!definition || definition.isTrigger) continue;
        expect(
          revokedFrom(name).has("anon"),
          `${migration.name}: ${name} must revoke EXECUTE from anon by name`,
        ).toBe(true);
      }
    }
  });
});

describe("functions that must not be callable by a client at all", () => {
  /**
   * Internal gates and one dead predicate. None is called by the application —
   * checked against every `.rpc()` call site — and none appears inside a policy
   * expression, so `authenticated` has no reason to hold EXECUTE.
   *
   * `assert_bookable_slot` is the one that mattered: it is the only definer
   * function in the project with no authorization check of its own, and until
   * Phase 19 any client could call it. It answered, for an arbitrary
   * practitioner and instant, whether that time was inside working hours and
   * whether it overlapped a **blocked period** — a side channel around
   * `schedule_exceptions`, a table with row-level security and no policy at
   * all, for anybody.
   */
  const INTERNAL = [
    "public.assert_bookable_slot",
    "public.assert_care_practitioner",
    "public.assert_appointment_manager",
    "public.assert_document_patient",
    "public.can_read_patient_document",
  ];

  it.each(INTERNAL)("%s is revoked from every client role", (name) => {
    const roles = revokedFrom(name);
    expect(roles.has("anon"), `${name}: anon`).toBe(true);
    expect(roles.has("authenticated"), `${name}: authenticated`).toBe(true);
  });

  it("assert_bookable_slot is never granted back", () => {
    expect(SQL).not.toMatch(
      /grant\s+execute\s+on\s+function\s+public\.assert_bookable_slot[^;]*to[^;]*authenticated/i,
    );
  });
});

describe("row-level security", () => {
  it("is enabled on every table in public", () => {
    const created = new Set(
      [
        ...SQL.matchAll(/create table (?:if not exists )?(public\.[a-z_]+)/gi),
      ].map((m) => m[1]!.toLowerCase()),
    );
    const enabled = new Set(
      [
        ...SQL.matchAll(
          /alter table (public\.[a-z_]+)\s+enable row level security/gi,
        ),
      ].map((m) => m[1]!.toLowerCase()),
    );

    expect([...created].filter((table) => !enabled.has(table))).toEqual([]);
  });

  it("names a role on every policy, never PUBLIC", () => {
    // A policy with no `to` clause applies to PUBLIC, which includes `anon`.
    for (const match of SQL.matchAll(
      /create policy\s+([a-z_]+)\s+on\s+([a-z_.]+)([\s\S]*?);\s*\n/gi,
    )) {
      const [, policy, table, body] = match;
      expect(
        /\bto\s+authenticated\b/i.test(body!),
        `${policy} on ${table}`,
      ).toBe(true);
    }
  });

  it("grants no client role a write on any sensitive table", () => {
    // Section 27: do not only protect SELECT. Every write in this product goes
    // through a `security definer` function, so a table-level insert, update
    // or delete grant would be a path around every check those functions make.
    const SENSITIVE = [
      "appointments",
      "appointment_events",
      "clinical_records",
      "prescriptions",
      "prescription_items",
      "treatment_plans",
      "treatment_plan_items",
      "patient_documents",
      "notifications",
      "notification_outbox",
      "notification_deliveries",
      "user_roles",
      "role_assignment_events",
      "ai_assistance_sessions",
      "security_audit_events",
    ];

    for (const table of SENSITIVE) {
      const pattern = new RegExp(
        `grant\\s+(?:insert|update|delete|all)[^;]*\\bon\\s+(?:table\\s+)?public\\.${table}\\b[^;]*to\\s+([^;]+);`,
        "gi",
      );
      for (const match of SQL.matchAll(pattern)) {
        const roles = match[1]!.toLowerCase();
        expect(roles, `public.${table} write grant`).not.toMatch(
          /\banon\b|\bauthenticated\b/,
        );
      }
    }
  });

  it("gives anon nothing on any table", () => {
    for (const match of SQL.matchAll(
      /grant\s+[^;]*\bon\s+(?:table\s+)?(public\.[a-z_]+)[^;]*to\s+([^;]+);/gi,
    )) {
      expect(match[2]!.toLowerCase(), match[1]!).not.toMatch(/\banon\b/);
    }
  });
});

describe("the audit trail", () => {
  const HARDENING = SOURCES.find((s) =>
    s.name.includes("security_hardening"),
  )!.text;

  it("has no column that could hold clinical content", () => {
    // Comments are stripped before scanning. The table's own documentation
    // explains *why* it holds no reason, no title and no name, and scanning
    // the prose would make the file fail for documenting itself — which is how
    // a future author is pressured into deleting the explanation instead of
    // the field. Phase 16 recorded the same lesson three times over.
    const table = /create table public\.security_audit_events \(([\s\S]*?)\n\);/
      .exec(HARDENING)![1]!
      .split("\n")
      .map((line) => line.split("--")[0] ?? "")
      .join("\n");

    // Sanity: the scan must still be looking at real column declarations.
    expect(table).toContain("occurred_at timestamptz");
    expect(table).toContain("outcome public.security_audit_outcome");

    for (const word of [
      "diagnos",
      "symptom",
      "assessment",
      "complaint",
      "note",
      "medicine",
      "dose",
      "instruction",
      "title",
      "file_name",
      "storage_path",
      "reason",
      "query",
      "term",
      "email",
      "phone",
      "name",
    ]) {
      expect(table.toLowerCase(), `column matching "${word}"`).not.toContain(
        word,
      );
    }
  });

  it("is append-only against every role, including the service role", () => {
    // A trigger rather than a policy, because a policy does not apply to the
    // service role and an audit record an administrator can edit is not one.
    expect(HARDENING).toContain(
      "before update or delete on public.security_audit_events",
    );
    expect(HARDENING).toMatch(
      /raise exception 'Security audit events cannot be/,
    );
  });

  it("has no update or delete policy", () => {
    expect(HARDENING).not.toMatch(
      /create policy [a-z_]+\s+on public\.security_audit_events\s+for (update|delete|insert|all)/i,
    );
  });

  it("is readable by administrators only", () => {
    expect(HARDENING).toMatch(
      /create policy security_audit_events_select_admin[\s\S]*?using \(public\.has_app_role\('admin'\)\)/,
    );
  });

  it("derives the actor rather than accepting one", () => {
    // An actor who could name themselves in the audit trail could write a
    // trail that exonerates them.
    const writer =
      /create function public\.record_security_audit_event\(([\s\S]*?)\)\s*\nreturns/.exec(
        HARDENING,
      )![1]!;
    expect(writer).not.toMatch(/p_actor|p_user|p_role/);
    expect(HARDENING).toContain("v_actor uuid := (select auth.uid());");
  });

  it("never fails the operation it is recording", () => {
    // A practitioner must not be unable to open a record mid-consultation
    // because an audit insert timed out.
    expect(HARDENING).toMatch(/exception\s+when others then/);
  });

  it("carries no foreign key that its own immutability trigger would break", () => {
    // `on delete set null` performs an UPDATE, and the trigger refuses every
    // UPDATE — so deleting a staff account would fail with an audit error.
    const table =
      /create table public\.security_audit_events \(([\s\S]*?)\n\);/.exec(
        HARDENING,
      )![1]!;
    expect(table).not.toMatch(/references\s+auth\.users/);
  });

  it("bounds its own read rather than letting the caller choose", () => {
    expect(HARDENING).toMatch(/limit least\(greatest\(coalesce\(p_limit/);
  });
});

describe("the migration changes nothing it should not", () => {
  const HARDENING = SOURCES.find((s) =>
    s.name.includes("security_hardening"),
  )!.text;

  it("drops no policy", () => {
    // Phase 19 is not a phase that loosens anything. Every change either
    // removes a privilege or adds an append-only record.
    expect(HARDENING).not.toMatch(/drop policy/i);
  });

  it("alters no existing table", () => {
    const alters = [
      ...HARDENING.matchAll(/alter table\s+(public\.[a-z_]+)/gi),
    ].map((m) => m[1]!.toLowerCase());
    expect(alters).toEqual(["public.security_audit_events"]);
  });

  it("replaces no existing function", () => {
    expect(HARDENING).not.toMatch(/create or replace function/i);
  });
});
