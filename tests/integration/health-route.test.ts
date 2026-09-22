import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/health", { headers });
}

describe("GET /api/health", () => {
  it("should report that the application is serving requests", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { status: "ok" },
    });
  });

  it("should not disclose environment, version or dependency details", async () => {
    const response = await GET(request());
    const body = JSON.stringify(await response.json()).toLowerCase();

    for (const leak of [
      "supabase",
      "postgres",
      "key",
      "url",
      "version",
      "environment",
      "host",
    ]) {
      expect(body).not.toContain(leak);
    }
  });

  it("should return a correlation id, reusing a well-formed upstream one", async () => {
    const generated = await GET(request());
    expect(generated.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);

    const forwarded = await GET(
      request({ [REQUEST_ID_HEADER]: "upstream-request-1" }),
    );
    expect(forwarded.headers.get(REQUEST_ID_HEADER)).toBe("upstream-request-1");
  });

  it("should ignore a malformed correlation id from the caller", async () => {
    const response = await GET(
      request({ [REQUEST_ID_HEADER]: "bad id with spaces" }),
    );

    expect(response.headers.get(REQUEST_ID_HEADER)).not.toContain(" ");
  });
});

describe("route error handling", () => {
  it("should convert an unexpected failure into a safe response and log it", async () => {
    const { createRouteHandler } = await import("@/lib/api/route-handler");
    const { logger } = await import("@/lib/logging/logger");

    const logged = vi.spyOn(logger, "child");
    const handler = createRouteHandler("test-route", async () => {
      throw new Error(
        "select * from patients where email = 'patient@example.test' failed: relation \"patients\" does not exist",
      );
    });

    const response = await handler(request());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "internal" },
    });
    expect(serialized).not.toContain("patients");
    expect(serialized).not.toContain("patient@example.test");
    expect(serialized).not.toContain("select");
    expect(body.requestId).toBeTruthy();
    expect(logged).toHaveBeenCalled();
  });

  it("should pass an expected failure through with its own status and message", async () => {
    const { createRouteHandler } = await import("@/lib/api/route-handler");
    const { forbiddenError } = await import("@/lib/errors/app-error");

    const handler = createRouteHandler("test-route", async () => {
      throw forbiddenError();
    });

    const response = await handler(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "forbidden", message: "You don't have access to this." },
    });
  });
});
