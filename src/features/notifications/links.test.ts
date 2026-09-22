import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { notificationActionUrl, notificationLinkPath } from "./links";
import type { NotificationSubjectType } from "./types";

/**
 * Where a notification points.
 *
 * Two properties, and both matter for a different reason:
 *
 *   * the TypeScript builder and `public.notification_link_path()` produce the
 *     **same string**, because the database is what actually stores the path
 *     and the application is what predicts it. Asserted by reading the SQL;
 *   * every path is an **application-relative path** — no scheme, no host, no
 *     protocol-relative form, no traversal. Section 19, and the same refusal
 *     Phase 06's `safeRedirectPath` makes.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260926120000_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The body of `notification_link_path()`, where the routes live. */
const LINK_BODY =
  /create function public\.notification_link_path\([\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
    MIGRATION,
  )?.[1] ?? "";

const RESOURCE_TYPES: readonly NotificationSubjectType[] = [
  "appointment",
  "prescription",
  "treatment_plan",
];

const ID = "7d1f6c0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

describe("the SQL this mirrors", () => {
  it("was actually found", () => {
    expect(LINK_BODY.length).toBeGreaterThan(50);
  });
});

describe("notificationLinkPath", () => {
  it.each(RESOURCE_TYPES)("agrees with the database for %s", (type) => {
    // The SQL branch reads:  when 'appointment' then '/patient/appointments/' || ...
    const pattern = new RegExp(`when '${type}' then '([^']+)'`);
    const prefix = pattern.exec(LINK_BODY)?.[1];

    expect(prefix, `no SQL branch for ${type}`).toBeDefined();
    expect(notificationLinkPath(type, ID)).toBe(`${prefix}${ID}`);
  });

  it("covers every resource type the enum declares", () => {
    const declared =
      /create type public\.notification_subject_type as enum \(([^)]*)\)/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect([...values].sort()).toEqual([...RESOURCE_TYPES].sort());
  });

  it("produces an application-relative path and nothing else", () => {
    for (const type of RESOURCE_TYPES) {
      const path = notificationLinkPath(type, ID);

      expect(path.startsWith("/")).toBe(true);
      // Not protocol-relative: `//evil.test` is a same-looking string that
      // navigates off-origin.
      expect(path.startsWith("//")).toBe(false);
      expect(path).not.toMatch(/^[a-z]+:/i);
      expect(path).not.toContain("..");
      expect(path).not.toContain("\\");
      expect(path).not.toContain("@");
    }
  });

  it("satisfies the database's own shape constraint", () => {
    // The same regex the check constraint applies, so a path this builder
    // produces cannot be refused by the column it is written to.
    const constraint = /link_path ~ '(\^[^']+)'/.exec(MIGRATION)?.[1] ?? "";
    expect(constraint.length).toBeGreaterThan(10);

    const shape = new RegExp(constraint);

    for (const type of RESOURCE_TYPES) {
      expect(shape.test(notificationLinkPath(type, ID))).toBe(true);
    }
  });
});

describe("notificationActionUrl", () => {
  it("joins the configured origin to the path", () => {
    expect(
      notificationActionUrl(
        "https://punarvasu.test",
        "/patient/appointments/1",
      ),
    ).toBe("https://punarvasu.test/patient/appointments/1");
  });

  it("tolerates a trailing slash on the configured origin", () => {
    expect(
      notificationActionUrl("https://punarvasu.test/", "/patient/documents"),
    ).toBe("https://punarvasu.test/patient/documents");
  });

  it("never invents an origin of its own", () => {
    // The origin is configuration. A request's Host header is what it must
    // never be — that is host header injection, and it would let a poisoned
    // request aim a clinic-branded email at another host. Phase 06 recorded
    // the same reasoning for authentication email.
    const source = readFileSync(new URL("./links.ts", import.meta.url), "utf8");

    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(code).not.toMatch(/headers\(\)/);
    expect(code).not.toMatch(/\brequest\b/i);
    expect(code).not.toContain("http://");
    expect(code).not.toContain("https://");
  });
});
