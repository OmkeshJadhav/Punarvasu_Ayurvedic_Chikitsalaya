/**
 * Cross-site request forgery.
 *
 * `phase_19.md` sections 14 and 129. Next.js protects Server Actions itself;
 * route handlers get no such protection, and two of this application's three
 * `POST` endpoints accept `multipart/form-data` — a content type a cross-site
 * form can send with no CORS preflight, carrying the victim's cookies.
 *
 * These tests exercise the check itself. That it is *applied* to every unsafe
 * method is asserted at the bottom, against the wrapper's own source, because
 * that is the property a future route inherits rather than remembers.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  UNSAFE_METHODS,
  isCrossOriginRequest,
} from "@/lib/security/same-origin";

const ORIGIN = "https://punarvasu.example";

function request(headers: Record<string, string>) {
  return {
    headers: new Headers({ host: "punarvasu.example", ...headers }),
    url: `${ORIGIN}/api/patient-documents`,
  };
}

describe("fetch metadata decides when the browser sent it", () => {
  it("allows the application's own pages", () => {
    expect(
      isCrossOriginRequest(request({ "sec-fetch-site": "same-origin" })),
    ).toBe(false);
  });

  it("allows a user-initiated navigation", () => {
    // `none` is a bookmark or a typed URL — a person, not a page.
    expect(isCrossOriginRequest(request({ "sec-fetch-site": "none" }))).toBe(
      false,
    );
  });

  it("refuses another site", () => {
    expect(
      isCrossOriginRequest(request({ "sec-fetch-site": "cross-site" })),
    ).toBe(true);
  });

  it("refuses a sibling subdomain", () => {
    // `same-site` is the position a compromised sibling subdomain attacks
    // from, and nothing in this product posts across subdomains.
    expect(
      isCrossOriginRequest(request({ "sec-fetch-site": "same-site" })),
    ).toBe(true);
  });

  it("is preferred over Origin, because a page cannot forge it", () => {
    // `Sec-Fetch-Site` is a forbidden header name: script cannot set it. When
    // both are present and disagree, the one the browser computed wins.
    expect(
      isCrossOriginRequest(
        request({ "sec-fetch-site": "cross-site", origin: ORIGIN }),
      ),
    ).toBe(true);
  });
});

describe("Origin is the fallback", () => {
  it("allows a matching origin", () => {
    expect(
      isCrossOriginRequest(
        request({ origin: ORIGIN, "x-forwarded-proto": "https" }),
      ),
    ).toBe(false);
  });

  it("refuses a different origin", () => {
    for (const origin of [
      "https://evil.example",
      "https://punarvasu.example.evil",
      "http://punarvasu.example",
      "null",
    ]) {
      expect(
        isCrossOriginRequest(request({ origin, "x-forwarded-proto": "https" })),
        origin,
      ).toBe(true);
    }
  });

  it("compares against the forwarded host, so a proxy does not break it", () => {
    // Behind a proxy the host on the URL is internal and would never match
    // the Origin the browser sent — a check that fails every request in
    // production is a check somebody removes.
    const forwarded = {
      headers: new Headers({
        host: "internal-7f3a.vercel.internal",
        "x-forwarded-host": "punarvasu.example",
        "x-forwarded-proto": "https",
        origin: ORIGIN,
      }),
      url: "http://internal-7f3a.vercel.internal/api/patient-documents",
    };
    expect(isCrossOriginRequest(forwarded)).toBe(false);
  });
});

describe("a missing Origin is allowed, deliberately", () => {
  it("allows a request with no browser evidence at all", () => {
    // A browser always sends `Origin` on a POST, including the cross-site
    // form post that is the attack. No Origin and no fetch metadata is not a
    // browser: it is curl, a scheduler or a probe, and CSRF is not the
    // control that stops those — their own authentication is.
    expect(isCrossOriginRequest(request({}))).toBe(false);
  });

  it("does not throw on a malformed URL", () => {
    // A check that throws inside a wrapper is a denial of service on every
    // endpoint it wraps.
    expect(() =>
      isCrossOriginRequest({ headers: new Headers(), url: "not a url" }),
    ).not.toThrow();
  });
});

describe("which methods are checked", () => {
  it("covers every method that can change state", () => {
    expect([...UNSAFE_METHODS].sort()).toEqual([
      "DELETE",
      "PATCH",
      "POST",
      "PUT",
    ]);
  });

  it("does not check GET or HEAD", () => {
    // Not an omission. This application has no GET that mutates
    // (`phase_19.md` section 75); adding one would be the defect, not a
    // reason to widen the list.
    expect(UNSAFE_METHODS.has("GET")).toBe(false);
    expect(UNSAFE_METHODS.has("HEAD")).toBe(false);
  });
});

describe("the check is applied by the wrapper, not by each route", () => {
  const wrapper = readFileSync("src/lib/api/route-handler.ts", "utf8");

  it("runs the check inside createRouteHandler", () => {
    // Structural, because that is the property that matters: a route added in
    // a later phase inherits the check instead of having to remember it, in
    // the same way the authorization guards sit in layouts rather than pages.
    expect(wrapper).toContain("UNSAFE_METHODS.has(request.method)");
    expect(wrapper).toContain("isCrossOriginRequest(request)");
  });

  it("refuses before the handler runs", () => {
    const check = wrapper.indexOf("isCrossOriginRequest");
    const handler = wrapper.indexOf("await handler(request");
    expect(check).toBeGreaterThan(-1);
    expect(handler).toBeGreaterThan(check);
  });

  it("records the attempt without recording the attacker's header", () => {
    // An Origin is an attacker-controlled string and a log is not the place
    // for one.
    expect(wrapper).toContain("security.cross_origin_request_blocked");
    expect(wrapper).not.toMatch(/origin:\s*request\.headers\.get/);
  });
});

describe("every POST route is behind the wrapper", () => {
  const ROUTES = [
    "src/app/api/patient-documents/route.ts",
    "src/app/api/reports/appointments/route.ts",
    "src/app/api/notifications/process/route.ts",
  ];

  it.each(ROUTES)(
    "%s exports its handler through createRouteHandler",
    (path) => {
      const source = readFileSync(path, "utf8");
      // A route that exported a bare function would bypass the correlation id,
      // the sanitized error response and this check in one go.
      expect(source).toMatch(
        /export const (POST|PUT|PATCH|DELETE) = createRouteHandler\(/,
      );
    },
  );
});
