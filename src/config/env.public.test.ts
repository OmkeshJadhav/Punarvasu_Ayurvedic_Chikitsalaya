import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SITE_URL,
  collectPublicEnvProblems,
  getSiteConfig,
  getSupabasePublicConfig,
  resetPublicEnvCache,
} from "@/config/env.public";
import { ConfigurationError } from "@/lib/errors/configuration-error";

function configure(values: Record<string, string | undefined>): void {
  resetPublicEnvCache();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", values.NEXT_PUBLIC_SITE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", values.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    values.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

const validEnv = {
  NEXT_PUBLIC_SITE_URL: "https://punarvasu.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

afterEach(() => {
  resetPublicEnvCache();
});

describe("public environment configuration", () => {
  it("should expose validated values when configuration is complete", () => {
    configure(validEnv);

    expect(getSiteConfig().siteUrl).toBe("https://punarvasu.example");
    expect(getSupabasePublicConfig()).toEqual({
      supabaseUrl: "https://project-ref.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });

  it("should fall back to localhost when the site URL is not configured", () => {
    configure({ ...validEnv, NEXT_PUBLIC_SITE_URL: undefined });

    expect(getSiteConfig().siteUrl).toBe(DEFAULT_SITE_URL);
  });

  it("should fail with the missing variable names when Supabase is not configured", () => {
    configure({ NEXT_PUBLIC_SITE_URL: validEnv.NEXT_PUBLIC_SITE_URL });

    expect(() => getSupabasePublicConfig()).toThrow(ConfigurationError);

    const problems = collectPublicEnvProblems();
    expect(problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(problems.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("should never include configuration values in the reported problems", () => {
    configure({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });

    expect(collectPublicEnvProblems().join(" ")).not.toContain("not-a-url");
  });

  it("should reject an invalid site URL rather than silently accepting it", () => {
    configure({ ...validEnv, NEXT_PUBLIC_SITE_URL: "punarvasu.example" });

    expect(() => getSiteConfig()).toThrow(ConfigurationError);
  });

  it("should let a page that needs only the site URL start without Supabase configured", () => {
    configure({ NEXT_PUBLIC_SITE_URL: validEnv.NEXT_PUBLIC_SITE_URL });

    expect(getSiteConfig().siteUrl).toBe("https://punarvasu.example");
    expect(() => getSupabasePublicConfig()).toThrow(ConfigurationError);
  });
});
