import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { notificationActionUrl, notificationLinkPath } from "./links";
import type { NotificationAudience, NotificationSubjectType } from "./types";

/**
 * Where a notification points.
 *
 * Three properties, each for a different reason:
 *
 *   * the TypeScript builder and `public.notification_link_path()` produce the
 *     **same string**, because the database is what actually stores the path
 *     and the application is what predicts it. Asserted by reading the SQL;
 *   * every path is an **application-relative path** — no scheme, no host, no
 *     protocol-relative form, no traversal. Section 19, and the same refusal
 *     Phase 06's `safeRedirectPath` makes;
 *   * a **practitioner is never pointed at a patient's page**, and is pointed
 *     at nothing at all for a prescription or a plan they wrote themselves.
 *
 * ## Which migration this reads
 *
 * The **current** definition, which is `20260930120000`'s three-argument
 * function rather than `20260926120000`'s two-argument one. That one was
 * dropped. A mirror test that kept reading the superseded file would go on
 * passing while describing SQL that is no longer installed — the exact failure
 * `progress_phase_15.md` recorded when the grants fix superseded the original
 * grants.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260930120000_doctor_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The body of `notification_link_path()`, where the routes live. */
const LINK_BODY =
  /create function public\.notification_link_path\([\s\S]*?as \$\$([\s\S]*?)\$\$;/.exec(
    MIGRATION,
  )?.[1] ?? "";

/**
 * The two halves of the `case`, split at the `end` that closes the
 * practitioner branch. Each half holds one audience's routes.
 */
const [PRACTITIONER_BODY = "", PATIENT_BODY = ""] =
  LINK_BODY.split(/\bend\s*\n\s*else\b/);

const RESOURCE_TYPES: readonly NotificationSubjectType[] = [
  "appointment",
  "prescription",
  "treatment_plan",
];

const AUDIENCES: readonly NotificationAudience[] = ["patient", "practitioner"];

const ID = "7d1f6c0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

/** Every (audience, resource) pair that has a route today. */
const ROUTED: readonly {
  readonly audience: NotificationAudience;
  readonly type: NotificationSubjectType;
}[] = [
  { audience: "patient", type: "appointment" },
  { audience: "patient", type: "prescription" },
  { audience: "patient", type: "treatment_plan" },
  { audience: "practitioner", type: "appointment" },
];

describe("the SQL this mirrors", () => {
  it("was actually found, and both audiences with it", () => {
    expect(LINK_BODY.length).toBeGreaterThan(50);
    expect(PRACTITIONER_BODY).toContain("p_audience = 'practitioner'");
    expect(PATIENT_BODY).toContain("'/patient/appointments/'");
  });
});

describe("notificationLinkPath", () => {
  it.each(RESOURCE_TYPES)(
    "agrees with the database for a patient %s",
    (type) => {
      // The SQL branch reads:  when 'appointment' then '/patient/appointments/' || ...
      const pattern = new RegExp(`when '${type}' then '([^']+)'`);
      const prefix = pattern.exec(PATIENT_BODY)?.[1];

      expect(prefix, `no SQL branch for a patient's ${type}`).toBeDefined();
      expect(notificationLinkPath("patient", type, ID)).toBe(`${prefix}${ID}`);
    },
  );

  it("agrees with the database for a practitioner's appointment", () => {
    const prefix = /when 'appointment' then '([^']+)'/.exec(
      PRACTITIONER_BODY,
    )?.[1];

    expect(prefix, "no SQL branch for a practitioner's appointment").toBe(
      "/doctor/appointments/",
    );
    expect(notificationLinkPath("practitioner", "appointment", ID)).toBe(
      `${prefix}${ID}`,
    );
  });

  it("sends a practitioner nowhere for a prescription or a plan", () => {
    // Not an omission. Those are documents the practitioner wrote, and
    // telling somebody they have issued the prescription they just issued is
    // the noise `phase_15.md` section 56 exists to prevent. The database says
    // the same thing — `else null` — and `create_notification` raises PV056
    // rather than storing an empty path.
    expect(notificationLinkPath("practitioner", "prescription", ID)).toBeNull();
    expect(
      notificationLinkPath("practitioner", "treatment_plan", ID),
    ).toBeNull();
    expect(PRACTITIONER_BODY).toContain("else null");
  });

  it("never points a practitioner into the patient area", () => {
    // A practitioner following their own notification must not land on a
    // page built for the person it is about.
    for (const type of RESOURCE_TYPES) {
      const path = notificationLinkPath("practitioner", type, ID);
      if (path === null) continue;
      expect(path.startsWith("/patient/")).toBe(false);
    }
  });

  it("covers every resource type the enum declares", () => {
    const declared =
      /create type public\.notification_subject_type as enum \(([^)]*)\)/.exec(
        readFileSync(
          new URL(
            "../../../supabase/migrations/20260926120000_notifications.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect([...values].sort()).toEqual([...RESOURCE_TYPES].sort());
  });

  it("covers every audience the enum declares", () => {
    const declared =
      /create type public\.notification_audience as enum \(([^)]*)\)/.exec(
        MIGRATION,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect([...values].sort()).toEqual([...AUDIENCES].sort());
  });

  it("produces an application-relative path and nothing else", () => {
    for (const { audience, type } of ROUTED) {
      const path = notificationLinkPath(audience, type, ID);
      expect(path).not.toBeNull();
      if (path === null) continue;

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
    // produces cannot be refused by the column it is written to. The
    // constraint lives in the original migration, which this one does not
    // alter.
    const constraint =
      /link_path ~ '(\^[^']+)'/.exec(
        readFileSync(
          new URL(
            "../../../supabase/migrations/20260926120000_notifications.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      )?.[1] ?? "";
    expect(constraint.length).toBeGreaterThan(10);

    const shape = new RegExp(constraint);

    for (const { audience, type } of ROUTED) {
      const path = notificationLinkPath(audience, type, ID);
      expect(path).not.toBeNull();
      if (path === null) continue;
      expect(shape.test(path)).toBe(true);
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
