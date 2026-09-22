import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The **database's** analytics guarantees, asserted against the migration.
 *
 * ## Why read the SQL
 *
 * A stubbed integration test never reaches a grant, a policy or a
 * `search_path`, so it cannot tell whether the thing that actually refuses an
 * unauthorized caller is in place. Phase 15 learned this the expensive way:
 * its structural test asserted the migration *said*
 * `grant execute ... to service_role`, which it did, while every authenticated
 * user could still call the processor — because `revoke ... from public` does
 * not remove Supabase's default named grants.
 *
 * So this file asserts the properties that failure taught us to assert:
 * revokes name `anon` explicitly, every reachable function authorizes in its
 * **body** rather than trusting its grant, and nothing internal is reachable
 * at all.
 *
 * ## And the application layer
 *
 * The second half asserts what the feature's own source may not contain: a
 * table write, a `select *`, a clinical column, a service-role client, or a
 * log call carrying a figure.
 */

const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260927120000_analytics_reporting.sql",
    import.meta.url,
  ),
);

const SQL = readFileSync(MIGRATION_PATH, "utf8").replaceAll("\r\n", "\n");

/**
 * The migration with its comments stripped.
 *
 * Several scans below ask whether the migration *names* a clinical column, a
 * patient parameter or a delivery claim. This file's header deliberately
 * lists every one of those to say that it does not use them, so scanning the
 * raw text would make the migration fail for documenting itself — and would
 * pressure a future author to delete the explanation rather than the thing.
 *
 * Structural scans that are genuinely about the text as written — `create
 * table`, `create policy`, the grants — keep reading `SQL`.
 */
const SQL_CODE = SQL.replaceAll(/^\s*--.*$/gm, "");

/** Strips TypeScript comments, for the same reason. */
function codeOf(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^\s*\/\/.*$/gm, "");
}

/**
 * The argument text of every `logger.*` call in a module.
 *
 * Scanned with a bracket counter rather than a regex, because a log call's
 * second argument is an object literal and a regex stopping at the first `)`
 * would capture a fragment while one stopping at the last would capture the
 * rest of the file. Phase 14 made the second mistake; this is the fix.
 */
function loggerCalls(source: string): string[] {
  const calls: string[] = [];
  const pattern = /logger\.\w+\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;

    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "(" || character === "{" || character === "[")
        depth += 1;
      else if (character === ")" || character === "}" || character === "]") {
        depth -= 1;
      }
      index += 1;
    }

    calls.push(source.slice(match.index, index));
  }

  return calls;
}

const FEATURE_DIR = fileURLToPath(
  new URL("../../src/features/analytics/", import.meta.url),
);

const FEATURE_SOURCES = readdirSync(FEATURE_DIR)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => ({
    name,
    source: readFileSync(`${FEATURE_DIR}${name}`, "utf8"),
  }));

/**
 * The functions a signed-in user may call. Everything else in the migration
 * is internal and must be unreachable.
 */
const PUBLIC_FUNCTIONS = [
  "analytics_clinic_appointment_summary",
  "analytics_clinic_appointment_trend",
  "analytics_clinic_practitioner_workload",
  "analytics_clinic_patient_summary",
  "analytics_clinic_patient_growth",
  "analytics_notification_delivery_summary",
  "analytics_notification_summary",
  "analytics_clinical_activity_summary",
  "analytics_document_type_summary",
  "analytics_practice_appointment_summary",
  "analytics_practice_appointment_trend",
  "analytics_practice_utilization",
  "analytics_appointment_report",
] as const;

/** Helpers and gates. No client role may execute any of these. */
const INTERNAL_FUNCTIONS = [
  "analytics_range_rules",
  "analytics_range_start",
  "analytics_range_end",
  "analytics_assert_range",
  "analytics_trend_granularity",
  "analytics_multirange_minutes",
  "analytics_appointment_counts",
  "analytics_appointment_buckets",
  "analytics_utilization",
  "assert_operational_analytics_reader",
  "assert_clinic_analytics_reader",
  "assert_report_exporter",
] as const;

/** The body of a named function, or an empty string. */
function bodyOf(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\([\\s\\S]*?as \\$fn\\$([\\s\\S]*?)\\$fn\\$;`,
  ).exec(SQL);
  return match?.[1] ?? "";
}

/** The declaration of a named function, up to its body. */
function declarationOf(name: string): string {
  const match = new RegExp(
    `create function public\\.${name}\\(([\\s\\S]*?)as \\$fn\\$`,
  ).exec(SQL);
  return match?.[1] ?? "";
}

describe("the migration this reads", () => {
  it("is the file the test thinks it is", () => {
    expect(SQL.length).toBeGreaterThan(10_000);
    expect(SQL).toContain("Phase 16 — Analytics & Reporting");
  });

  it("declares every function this file names", () => {
    for (const name of [...PUBLIC_FUNCTIONS, ...INTERNAL_FUNCTIONS]) {
      expect(SQL, `no such function: ${name}`).toContain(
        `create function public.${name}(`,
      );
    }
  });
});

describe("analytics is read-only with respect to the domain", () => {
  it("creates, alters and drops no table", () => {
    // `phase_16.md` sections 5, 30 and 103, and example 1. Analytics is not a
    // second source of truth, and the surest form of that is a diff with no
    // table in it.
    expect(SQL).not.toMatch(/create table/i);
    expect(SQL).not.toMatch(/alter table public\.\w+\s+add column/i);
    expect(SQL).not.toMatch(/drop table/i);
  });

  it("writes no domain row", () => {
    expect(SQL).not.toMatch(/\binsert into\b/i);
    expect(SQL).not.toMatch(/\bupdate public\./i);
    expect(SQL).not.toMatch(/\bdelete from\b/i);
  });

  it("creates no trigger", () => {
    // A trigger would make analytics part of a domain write's transaction,
    // which is exactly the coupling this phase must not introduce.
    expect(SQL).not.toMatch(/create trigger/i);
  });

  it("creates, alters and drops no policy", () => {
    // Nothing here widens what any Phase 07-15 policy admits. The functions
    // read as the definer, after their own gate has decided the caller is
    // staff.
    expect(SQL).not.toMatch(/create policy/i);
    expect(SQL).not.toMatch(/drop policy/i);
    expect(SQL).not.toMatch(/alter policy/i);
  });

  it("replaces no existing function", () => {
    // `create or replace` on a Phase 09-15 function would silently change
    // behaviour those phases' own mirror tests describe.
    expect(SQL).not.toMatch(/create or replace function/i);
  });

  it("widens no column grant", () => {
    // A column grant belongs to a database role, so widening one for an
    // administrator would widen it for every patient too — the trap Phase 10
    // recorded about `internal_note`.
    expect(SQL).not.toMatch(/grant select \(/i);
    expect(SQL).not.toMatch(/grant (insert|update|delete)/i);
  });

  it("adds only indexes", () => {
    const created = [...SQL.matchAll(/^create (\w+)/gm)].map(
      (match) => match[1],
    );
    expect(new Set(created)).toEqual(new Set(["function", "index"]));
  });
});

describe("every reachable function authorizes in its body", () => {
  it.each(PUBLIC_FUNCTIONS)("%s calls a gate first", (name) => {
    const body = bodyOf(name);
    expect(body, `no body for ${name}`).not.toBe("");

    // Phase 15's lesson: a grant is not the authorization. The gate has to be
    // in the body, so restoring a grant by accident does not restore access.
    const gated =
      /perform public\.assert_(operational_analytics_reader|clinic_analytics_reader|report_exporter)\(\)/.test(
        body,
      ) || /public\.assert_care_practitioner\(\)/.test(body);

    expect(gated, `${name} does not call an authorization gate`).toBe(true);
  });

  it.each(PUBLIC_FUNCTIONS)("%s authorizes before it reads", (name) => {
    const body = bodyOf(name);
    const gateAt = Math.min(
      ...[
        body.indexOf("assert_operational_analytics_reader"),
        body.indexOf("assert_clinic_analytics_reader"),
        body.indexOf("assert_report_exporter"),
        body.indexOf("assert_care_practitioner"),
      ].filter((index) => index >= 0),
    );
    const readAt = body.indexOf("return query");

    expect(gateAt).toBeGreaterThanOrEqual(0);
    if (readAt >= 0) expect(gateAt).toBeLessThan(readAt);
  });

  it.each(PUBLIC_FUNCTIONS)("%s bounds its range", (name) => {
    // Section 26 and example 6. Every reachable function validates the range
    // itself, so a request that skipped the form is still bounded.
    expect(bodyOf(name), `${name} does not bound its range`).toContain(
      "analytics_assert_range",
    );
  });

  it.each([...PUBLIC_FUNCTIONS, ...INTERNAL_FUNCTIONS])(
    "%s pins its search_path",
    (name) => {
      // Section 56. `analytics_range_rules` is the one exception: it is
      // `immutable` and references nothing, so it has no path to pin.
      if (name === "analytics_range_rules") return;
      expect(declarationOf(name), `${name} has no search_path`).toContain(
        "set search_path = ''",
      );
    },
  );

  it("uses no dynamic SQL anywhere", () => {
    // Section 56 and section 57. Every filter is a parameter; nothing is
    // concatenated into a statement.
    expect(SQL).not.toMatch(/\bexecute\b\s+(format|'|\|\|)/i);
    expect(SQL).not.toContain("quote_ident");
    expect(SQL).not.toMatch(/\|\|\s*p_/);
  });
});

describe("grants", () => {
  it.each(INTERNAL_FUNCTIONS)(
    "%s is revoked from every client role",
    (name) => {
      // Phase 15's defect, asserted so it cannot recur: `from public` alone
      // leaves Supabase's default named grants in place.
      const revoke = new RegExp(
        `revoke all on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*from public, anon, authenticated;`,
      );
      expect(revoke.test(SQL), `${name} is not revoked by name`).toBe(true);
    },
  );

  it.each(INTERNAL_FUNCTIONS)("%s is granted to nobody", (name) => {
    const grant = new RegExp(`grant execute on function public\\.${name}\\(`);
    expect(grant.test(SQL), `${name} is granted to somebody`).toBe(false);
  });

  it.each(PUBLIC_FUNCTIONS)("%s is revoked from anon by name", (name) => {
    const revoke = new RegExp(
      `revoke all on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*from public, anon;`,
    );
    expect(revoke.test(SQL), `${name} is not revoked from anon`).toBe(true);
  });

  it.each(PUBLIC_FUNCTIONS)("%s is granted only to authenticated", (name) => {
    const grants = [
      ...SQL.matchAll(
        new RegExp(
          `grant execute on function public\\.${name}\\([^)]*\\)\\s*\\n?\\s*to ([a-z_, ]+);`,
          "g",
        ),
      ),
    ].map((match) => match[1]?.trim());

    expect(grants, `${name} has no grant`).toHaveLength(1);
    expect(grants[0]).toBe("authenticated");
  });

  it("grants anon nothing at all", () => {
    // A signed-out request has no business asking the clinic how many
    // appointments it had. Read from the comment-stripped SQL, because the
    // header explains Supabase's default `... to anon, authenticated` grant
    // in order to say why every revoke below names those roles.
    expect(SQL_CODE).not.toMatch(/grant [\s\S]{0,80}? to [^;]*\banon\b/i);
  });
});

describe("scope is never a parameter", () => {
  it("has no patient parameter anywhere", () => {
    // Section 59. An analytics endpoint must not become an enumeration API,
    // and the surest form of that is an argument that does not exist.
    expect(SQL_CODE).not.toContain("p_patient_id");
  });

  it("has no clinic, organization or location parameter", () => {
    for (const parameter of [
      "p_clinic_id",
      "p_organization_id",
      "p_location_id",
      "p_tenant_id",
    ]) {
      expect(SQL_CODE).not.toContain(parameter);
    }
  });

  it("has no role, permission or actor parameter", () => {
    // Word-boundary matched, not substring: `p_role` is inside
    // `has_app_role`, which is the gate's own predicate and exactly the thing
    // that should be there. A scan that flagged it would be reporting the
    // authorization check as an authorization hole.
    for (const parameter of [
      "p_role",
      "p_permission",
      "p_user_id",
      "p_actor",
    ]) {
      expect(SQL_CODE, `the migration takes ${parameter}`).not.toMatch(
        new RegExp(`\\b${parameter}\\b`),
      );
    }
  });

  it.each([
    "analytics_practice_appointment_summary",
    "analytics_practice_appointment_trend",
    "analytics_practice_utilization",
  ])("%s takes no practitioner argument", (name) => {
    // Section 54 and example 3. The doctor's scope is resolved from
    // `auth.uid()`, so "Doctor A → Doctor B metrics" has no request that
    // expresses it.
    const declaration = declarationOf(name);
    expect(declaration).not.toContain("p_practitioner_id");
    expect(bodyOf(name)).toContain("assert_care_practitioner()");
  });

  it("has no column, table, sort or limit parameter", () => {
    // Section 61's raw-query endpoint has no parameter to become.
    for (const parameter of [
      "p_column",
      "p_columns",
      "p_table",
      "p_order",
      "p_sort",
      "p_limit",
      "p_offset",
      "p_where",
    ]) {
      expect(SQL_CODE).not.toContain(parameter);
    }
  });
});

describe("privacy", () => {
  it("selects no clinical column", () => {
    // Sections 3, 88 and example 2. Not one of these appears anywhere in the
    // migration — not in a select list, not in a join, not in a return type.
    for (const column of [
      "diagnosis_or_clinical_impression",
      "chief_complaint",
      "history_of_presenting_concern",
      "symptoms",
      "clinical_observations",
      "assessment",
      "doctor_notes",
      "follow_up_notes",
      "medicine_name",
      "dose_amount",
      "instructions",
      "general_instructions",
      "cancellation_reason",
      "internal_note",
      "patient_note",
      "storage_path",
      "checksum_sha256",
      "file_name",
    ]) {
      expect(SQL_CODE, `the migration names ${column}`).not.toContain(column);
    }
  });

  it("returns no patient identifier", () => {
    // Every `returns table` in the file, checked together.
    const returnBlocks = [
      ...SQL.matchAll(/returns table \(([\s\S]*?)\)\nlanguage/g),
    ].map((match) => match[1] ?? "");

    expect(returnBlocks.length).toBeGreaterThan(10);

    for (const block of returnBlocks) {
      expect(block).not.toContain("patient_id");
      expect(block).not.toContain("patient_name");
      expect(block).not.toContain("full_name");
      expect(block).not.toContain("email");
      expect(block).not.toContain("phone");
      expect(block).not.toContain("date_of_birth");
    }
  });

  it("returns no notification content", () => {
    // Section 40 and example 8. A title or a body reaching a dashboard would
    // be a patient's own words about their health on a manager's screen.
    for (const column of [
      "n.title",
      "n.body",
      "deep_link",
      "provider_message_id",
    ]) {
      expect(SQL_CODE, `the migration returns ${column}`).not.toContain(column);
    }
  });

  it("claims no delivery, only acceptance", () => {
    // Section 41. Phase 15 has no `delivered` status because no configured
    // provider reports one, and nothing here may invent it.
    expect(SQL_CODE).not.toContain("delivered");
  });

  it("selects no whole row", () => {
    // Section 89. `select *` in an aggregate would mean a column added to a
    // domain table later starts reaching a dashboard.
    const starSelects = [...SQL.matchAll(/select \*/g)];

    // The two that exist are `select * from` an internal aggregate whose own
    // return type is a list of counts, and `select * into rules` from the
    // rules function. Neither reads a domain table.
    for (const match of starSelects) {
      const context = SQL.slice(match.index, match.index + 120);
      expect(
        /from public\.analytics_\w+\(|into rules/.test(context),
        `select * over ${context.slice(0, 60)}`,
      ).toBe(true);
    }
  });
});

describe("the application layer", () => {
  it("never writes a table", () => {
    for (const { name, source } of FEATURE_SOURCES) {
      expect(source, `${name} writes`).not.toMatch(
        /\.(insert|update|delete|upsert)\(/,
      );
    }
  });

  it("never reads a table directly", () => {
    // Section 60 and 61: every read is a purpose-built aggregate. A
    // `.from("appointments")` here would be the raw table read this phase
    // must not have.
    for (const { name, source } of FEATURE_SOURCES) {
      expect(source, `${name} reads a table directly`).not.toMatch(
        /supabase\s*\n?\s*\.from\(/,
      );
    }
  });

  it("never touches the service-role client", () => {
    // Section 55: no broad service-role analytics endpoint. Every read here
    // goes through the caller's own client, and the definer functions are
    // what read privileged tables.
    for (const { name, source } of FEATURE_SOURCES) {
      expect(source, `${name} uses the admin client`).not.toContain(
        "supabase/admin",
      );
      expect(source, `${name} uses the service role`).not.toContain(
        "SERVICE_ROLE",
      );
    }
  });

  it("checks a permission on every exported read", () => {
    const queries = codeOf(
      FEATURE_SOURCES.find((file) => file.name === "queries.ts")?.source ?? "",
    );
    expect(queries).not.toBe("");

    const exported = [
      ...queries.matchAll(/export async function (\w+)\(/g),
    ].map((match) => match[1] as string);

    // Five: four reads plus the export's own. `currentUserMayExport` is a
    // presentation helper and is excluded by name below.
    expect(exported.length).toBeGreaterThanOrEqual(4);

    const assertions = (queries.match(/assertPermission\(/g) ?? []).length;
    expect(assertions).toBe(
      exported.filter((name) => name !== "currentUserMayExport").length,
    );
  });

  it("caches nothing across requests", () => {
    // Sections 33-34. A cache that does not exist cannot leak a scope. If one
    // is ever added, it must be keyed on the authorized scope plus the range
    // — and this assertion is what forces that to be a deliberate change.
    for (const { name, source } of FEATURE_SOURCES) {
      const code = codeOf(source);
      expect(code, `${name} caches`).not.toContain("unstable_cache");
      expect(code, `${name} sets revalidate`).not.toMatch(
        /export const revalidate/,
      );
      expect(code, `${name} uses a global cache key`).not.toMatch(
        /cache\(\s*["']analytics["']/,
      );
    }
  });

  it("logs no figure, no name and no period's contents", () => {
    // Section 119 and `docs/SECURITY.md` section 16. A log line carries an
    // operation, an opaque user id and a failure category.
    const queries =
      FEATURE_SOURCES.find((file) => file.name === "queries.ts")?.source ?? "";

    const logCalls = loggerCalls(queries);

    // The guard: a scan that finds no log calls asserts nothing.
    expect(logCalls.length).toBeGreaterThanOrEqual(3);

    for (const call of logCalls) {
      for (const term of [
        "displayName",
        "practitionerName",
        "fullName",
        "rows",
        "result.data",
        "bookedMinutes",
        "newPatients",
      ]) {
        expect(call, `a log call carries ${term}`).not.toContain(term);
      }
    }
  });

  it("logs only an operation, an opaque id and a category", () => {
    const queries = codeOf(
      FEATURE_SOURCES.find((file) => file.name === "queries.ts")?.source ?? "",
    );

    // The allowlist, rather than a deny-list of things somebody thought of.
    // Every identifier a log call may name: the event, the actor's opaque id,
    // which read it was, and — for the export audit (section 48) — which
    // report, over which period, at which scope.
    const permitted = new Set([
      "logger",
      "warn",
      "error",
      "info",
      "userId",
      "user",
      "id",
      "operation",
      "failure",
      "logEvent",
      "cause",
      "report",
      "APPOINTMENT_REPORT",
      "slug",
      "from",
      "to",
      "range",
      "scoped",
      "practitionerId",
      "Error",
      "new",
      "analytics",
      "data_quality",
      "read_failed",
      "export_requested",
      // Phase 19. The rate-limit refusal. An operation name and nothing else —
      // the log line carries the opaque user id already on the allowlist.
      "export_rate_limited",
      "appointment",
      "counts",
      "are",
      "practitioner",
      "clinic",
      "internally",
      "inconsistent",
    ]);

    for (const call of loggerCalls(queries)) {
      for (const identifier of call.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        expect(
          permitted.has(identifier),
          `a log call names "${identifier}", which is not on the allowlist`,
        ).toBe(true);
      }
    }
  });

  it("names no clinical field anywhere in the feature", () => {
    for (const { name, source } of FEATURE_SOURCES) {
      // Comments are stripped: several modules legitimately *explain* which
      // clinical fields are excluded, and a scan that punished them would
      // pressure somebody to delete the explanation rather than the field.
      const code = source
        .replaceAll(/\/\*[\s\S]*?\*\//g, "")
        .replaceAll(/\/\/.*$/gm, "");

      for (const term of [
        "diagnosis",
        "chief_complaint",
        "doctor_notes",
        "clinical_observations",
        "medicine_name",
        "storage_path",
        "signed_url",
        "signedUrl",
      ]) {
        expect(code, `${name} names ${term}`).not.toContain(term);
      }
    }
  });
});

describe("indexes", () => {
  it("adds one for every range scan the aggregates make", () => {
    for (const index of [
      "patients_created_at_idx",
      "prescriptions_issued_at_idx",
      "treatment_plans_activated_at_idx",
      "clinical_records_completed_at_idx",
      "patient_documents_created_at_idx",
      "notifications_created_at_idx",
      "notification_deliveries_created_at_idx",
    ]) {
      expect(SQL, `no index ${index}`).toContain(`create index ${index}`);
    }
  });

  it("adds none that no query here uses", () => {
    const created = [...SQL.matchAll(/create index (\w+)/g)].map(
      (match) => match[1],
    );
    // Seven, and each is named after the column an aggregate scans.
    expect(created).toHaveLength(7);
    for (const name of created) {
      expect(name).toMatch(
        /_(created_at|issued_at|activated_at|completed_at)_idx$/,
      );
    }
  });
});
