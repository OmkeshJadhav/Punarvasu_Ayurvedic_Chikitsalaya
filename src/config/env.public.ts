/**
 * Public application configuration.
 *
 * Every value here is embedded into the browser bundle at build time and must
 * be treated as public knowledge. Server-only secrets live in `env.server.ts`,
 * which cannot be imported from client code.
 *
 * Configuration is validated per consumer rather than all at once: a page that
 * only needs the site URL should not fail because a capability it never uses
 * is unconfigured. `collectPublicEnvProblems` still reports the complete
 * picture at startup, so a misconfigured deployment is never silent.
 *
 * `process.env.NEXT_PUBLIC_*` is referenced with literal property access on
 * purpose: Next.js only inlines public variables into the client bundle when
 * it can see the access statically.
 */
import { z } from "zod";

import { describeIssues } from "@/config/env-issues";
import { ConfigurationError } from "@/lib/errors/configuration-error";

export const DEFAULT_SITE_URL = "http://localhost:3000";

const siteSchema = z.object({
  /**
   * Defaults to localhost so the application runs with no configuration at
   * all. Production must set it - the startup check reports a production
   * instance that has not, because the default would put localhost links into
   * metadata and email.
   */
  siteUrl: z
    .url({ message: "must be an absolute URL" })
    .default(DEFAULT_SITE_URL),
  monitoringDsn: z.string().optional(),
  analyticsSiteId: z.string().optional(),
});

const supabaseSchema = z.object({
  supabaseUrl: z.url({ message: "must be an absolute URL" }),
  supabaseAnonKey: z.string().min(1, { message: "must not be empty" }),
});

export type SiteConfig = z.infer<typeof siteSchema>;
export type SupabasePublicConfig = z.infer<typeof supabaseSchema>;
export type PublicEnv = SiteConfig & SupabasePublicConfig;

/** Maps config keys back to the variable names a developer has to fix. */
const PUBLIC_ENV_VARIABLE_NAMES: Record<keyof PublicEnv, string> = {
  siteUrl: "NEXT_PUBLIC_SITE_URL",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  monitoringDsn: "NEXT_PUBLIC_MONITORING_DSN",
  analyticsSiteId: "NEXT_PUBLIC_ANALYTICS_SITE_ID",
};

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

function readPublicEnv(): Record<keyof PublicEnv, string | undefined> {
  return {
    siteUrl: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
    supabaseUrl: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: emptyToUndefined(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    monitoringDsn: emptyToUndefined(process.env.NEXT_PUBLIC_MONITORING_DSN),
    analyticsSiteId: emptyToUndefined(
      process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID,
    ),
  };
}

function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
): z.output<TSchema> {
  const result = schema.safeParse(readPublicEnv());
  if (!result.success) {
    throw new ConfigurationError(
      describeIssues(result.error, PUBLIC_ENV_VARIABLE_NAMES),
    );
  }
  return result.data;
}

let cachedSite: SiteConfig | undefined;
let cachedSupabase: SupabasePublicConfig | undefined;

/**
 * Site-level configuration: canonical URL and optional observability ids.
 *
 * Throws {@link ConfigurationError} naming the offending variables. Variable
 * *names* are safe to surface to a developer; values never appear.
 */
export function getSiteConfig(): SiteConfig {
  cachedSite ??= parseOrThrow(siteSchema);
  return cachedSite;
}

/**
 * Supabase configuration for the browser and for user-scoped server clients.
 *
 * The anonymous key is public by design; it is safe only because Row Level
 * Security is enabled and deny-by-default on every table holding user or
 * clinical data (`docs/DATABASE.md` section 6).
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  cachedSupabase ??= parseOrThrow(supabaseSchema);
  return cachedSupabase;
}

/**
 * Names of public variables that are missing or malformed, for startup
 * diagnostics. Returns an empty array when the configuration is valid.
 */
export function collectPublicEnvProblems(): string[] {
  const result = siteSchema
    .extend(supabaseSchema.shape)
    .safeParse(readPublicEnv());
  return result.success
    ? []
    : describeIssues(result.error, PUBLIC_ENV_VARIABLE_NAMES);
}

/** Test seam: clears the memoized configuration. */
export function resetPublicEnvCache(): void {
  cachedSite = undefined;
  cachedSupabase = undefined;
}
