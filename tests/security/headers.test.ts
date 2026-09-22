/**
 * Content-Security-Policy, and the headers around it.
 *
 * `phase_19.md` sections 76-80. These assert the *policy*, not the plumbing:
 * that the strict tier refuses inline script, that neither tier permits an
 * origin nothing uses, and that the two tiers cannot quietly converge.
 *
 * The header being emitted at all is verified against a running production
 * build, and recorded in `docs/progress/progress_phase_19.md`; jsdom has no
 * CSP engine, so a unit test cannot stand in for that.
 */
import { describe, expect, it } from "vitest";

import {
  buildBaselineCsp,
  buildStrictCsp,
  createCspNonce,
  supabaseOriginFor,
} from "@/lib/security/csp";
import {
  DYNAMIC_AUTH_PATHS,
  PROTECTED_PATH_PREFIXES,
  isStrictCspPath,
} from "@/lib/auth/paths";

const SUPABASE = "https://project.supabase.co";
const PRODUCTION = { supabaseOrigin: SUPABASE, isDevelopment: false };
const DEVELOPMENT = { supabaseOrigin: SUPABASE, isDevelopment: true };

/** Reads one directive out of a serialized policy. */
function directive(policy: string, name: string): string | undefined {
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe("the strict policy", () => {
  const policy = buildStrictCsp("NONCE", PRODUCTION);

  it("refuses inline script", () => {
    // The whole point of the tier. A page holding a clinical record must not
    // execute a script somebody injected into it.
    expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("refuses eval in production", () => {
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("carries the nonce and strict-dynamic", () => {
    expect(directive(policy, "script-src")).toContain("'nonce-NONCE'");
    expect(directive(policy, "script-src")).toContain("'strict-dynamic'");
  });

  it("closes the directives that make an injected tag useful", () => {
    // `object-src` is a script context; `base-uri` rewrites every relative
    // URL including form targets; `form-action` is what turns an injected
    // form into a dead end.
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("lets the browser reach this origin and the storage origin, and nothing else", () => {
    // Nothing in the application uses the browser Supabase client, so the
    // database is not a browser-reachable origin.
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    // A signed document preview is served from the storage origin.
    expect(directive(policy, "frame-src")).toBe(`frame-src 'self' ${SUPABASE}`);
    expect(directive(policy, "img-src")).toContain(SUPABASE);
  });

  it("frames nothing at all when storage is unconfigured", () => {
    // The failure direction matters: an unconfigured deployment must close,
    // not open.
    const unconfigured = buildStrictCsp("NONCE", {
      supabaseOrigin: null,
      isDevelopment: false,
    });
    expect(directive(unconfigured, "frame-src")).toBe("frame-src 'none'");
    expect(directive(unconfigured, "img-src")).not.toContain("supabase");
  });

  it("names each directive exactly once", () => {
    // A browser honours the *first* occurrence of a directive and ignores the
    // rest, so a duplicate reads as a widening and behaves as nothing. The
    // strict tier overrides the shared `img-src`, which is precisely where
    // that mistake would be made.
    const names = policy.split(";").map((part) => part.trim().split(/\s+/)[0]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("does not upgrade insecure requests in development", () => {
    // The dev server is plain HTTP; upgrading would break every asset.
    expect(buildStrictCsp("N", DEVELOPMENT)).not.toContain(
      "upgrade-insecure-requests",
    );
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("permits eval only in development, and says so", () => {
    expect(buildStrictCsp("N", DEVELOPMENT)).toContain("'unsafe-eval'");
  });
});

describe("the baseline policy", () => {
  const policy = buildBaselineCsp(PRODUCTION);

  it("permits inline script, which is the documented cost of static rendering", () => {
    // Not an oversight. A prerendered page cannot be given a nonce, and these
    // routes render no user-controlled content. `lib/security/csp.ts` carries
    // the argument; this test exists so that the day somebody tightens it,
    // they do it deliberately.
    expect(directive(policy, "script-src")).toContain("'unsafe-inline'");
  });

  it("still closes everything an injected script would want", () => {
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
  });

  it("frames the clinic's map and nothing else", () => {
    expect(directive(policy, "frame-src")).toBe(
      "frame-src 'self' https://www.google.com",
    );
  });

  it("never frames the storage origin", () => {
    // A public page has no business rendering a patient's document, so the
    // origin it would come from is not permitted there.
    expect(directive(policy, "frame-src")).not.toContain("supabase");
  });
});

describe("which routes get which tier", () => {
  it("gives the strict tier to every protected prefix", () => {
    for (const prefix of PROTECTED_PATH_PREFIXES) {
      expect(isStrictCspPath(prefix), prefix).toBe(true);
      expect(isStrictCspPath(`${prefix}/anything/below`), prefix).toBe(true);
    }
  });

  it("gives the strict tier to the auth pages that handle a credential", () => {
    for (const path of DYNAMIC_AUTH_PATHS) {
      expect(isStrictCspPath(path), path).toBe(true);
    }
  });

  it("leaves the statically prerendered auth pages on the baseline", () => {
    // Giving either of these a nonce would emit scripts that carry none,
    // which breaks the page. They are static; this is the assertion that
    // notices if somebody adds them to the strict list without making them
    // dynamic first.
    expect(isStrictCspPath("/auth/register")).toBe(false);
    expect(isStrictCspPath("/auth/forgot-password")).toBe(false);
  });

  it("leaves the public marketing site on the baseline", () => {
    for (const path of [
      "/",
      "/services",
      "/about",
      "/contact",
      "/services/x",
    ]) {
      expect(isStrictCspPath(path), path).toBe(false);
    }
  });

  it("does not treat a prefix-lookalike as protected", () => {
    // `/patients-public` must not inherit a protected route's handling just
    // because it starts with the same letters.
    expect(isStrictCspPath("/patient-information")).toBe(false);
    expect(isStrictCspPath("/administration")).toBe(false);
  });
});

describe("the nonce", () => {
  it("is different every time", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => createCspNonce()));
    expect(nonces.size).toBe(200);
  });

  it("carries at least 128 bits", () => {
    // A guessable nonce is not a nonce, and `strict-dynamic` makes the whole
    // policy rest on it.
    const decoded = Buffer.from(createCspNonce(), "base64");
    expect(decoded.byteLength).toBeGreaterThanOrEqual(16);
  });

  it("contains nothing that would terminate a directive", () => {
    // A nonce carrying `;` or a quote would let its own value rewrite the
    // policy it is embedded in.
    for (let index = 0; index < 100; index += 1) {
      expect(createCspNonce()).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });
});

describe("the storage origin", () => {
  it("reduces a project URL to an origin", () => {
    expect(supabaseOriginFor("https://p.supabase.co/rest/v1?x=1")).toBe(
      "https://p.supabase.co",
    );
  });

  it("refuses anything that is not an http origin", () => {
    // A CSP source expression carrying a scheme like `javascript:` would be a
    // policy that permits exactly what it exists to forbid.
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,x",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(supabaseOriginFor(value), String(value)).toBeNull();
    }
  });

  it("never returns a path, a query or credentials", () => {
    const origin = supabaseOriginFor("https://user:pass@p.supabase.co/a/b?c=d");
    expect(origin).toBe("https://p.supabase.co");
    expect(origin).not.toContain("user");
    expect(origin).not.toContain("pass");
  });
});
