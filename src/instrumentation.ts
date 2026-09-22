/**
 * Startup configuration check.
 *
 * Next.js calls `register` once when a server instance boots. Validating
 * configuration here means a misconfigured deployment announces itself in the
 * logs immediately, instead of failing later inside a patient-facing request.
 *
 * It reports rather than throws: a running server that can still serve public
 * pages and a clear log line is more useful than a crash loop, and every
 * consumer of a missing variable fails safely on its own (a generic internal
 * error, never a partial or unauthenticated result).
 */
export async function register(): Promise<void> {
  // Edge runtime instances do not read the server configuration.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { collectPublicEnvProblems } = await import("@/config/env.public");
  const { collectServerEnvProblems, getServerEnv } =
    await import("@/config/env.server");
  const { logger } = await import("@/lib/logging/logger");

  const problems = [
    ...collectPublicEnvProblems(),
    ...collectServerEnvProblems(),
  ];

  // The site URL falls back to localhost for development convenience, which is
  // wrong in production: it would put localhost links into metadata and email.
  const siteUrlConfigured =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() !== "";
  if (!siteUrlConfigured && getServerEnv().appEnv === "production") {
    problems.push("NEXT_PUBLIC_SITE_URL: must be set in production");
  }

  if (problems.length > 0) {
    logger.error("startup.configuration_invalid", undefined, {
      // Variable names and reasons only - never values.
      problems,
    });
    return;
  }

  logger.info("startup.configuration_valid");
}
