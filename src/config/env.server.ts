/**
 * Server-only application configuration.
 *
 * `import "server-only"` makes a client-side import of this module a build
 * error rather than a silent secret leak, which is the enforcement behind
 * "server-only variables cannot be imported into client code".
 *
 * Variables are added here by the phase that first uses them. `.env.example`
 * documents the full configuration boundary, including variables reserved for
 * later phases; modelling them before anything reads them would be noise.
 */
import "server-only";

import { z } from "zod";

import { describeIssues } from "@/config/env-issues";
import { ConfigurationError } from "@/lib/errors/configuration-error";

export const APP_ENVIRONMENTS = [
  "development",
  "preview",
  "production",
] as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

const serverEnvSchema = z.object({
  appEnv: z.enum(APP_ENVIRONMENTS).default("development"),
  logLevel: z.enum(LOG_LEVELS).optional(),
  /**
   * Optional here on purpose: the service-role key is required only by the
   * admin client, which demands it explicitly. A deployment that never
   * performs a service-role operation should not have to hold the key at all.
   */
  supabaseServiceRoleKey: z.string().min(1).optional(),

  /**
   * Phase 15. The shared secret that authenticates the notification worker
   * endpoint.
   *
   * Optional, and its absence is not a misconfiguration to be flagged: a
   * deployment with no scheduler has no worker to authenticate. The endpoint
   * refuses every request when it is unset rather than defaulting to open,
   * which is the difference between "not configured" and "configured wrong".
   */
  notificationsWorkerSecret: z.string().min(16).optional(),

  /**
   * Phase 15. The email provider, all four values or none.
   *
   * Every one is optional here so that a deployment without email is a valid
   * deployment; `getNotificationEmailConfig()` is what insists they arrive
   * together. Three of four present yields no email channel at all rather
   * than a channel that fails on every send.
   */
  notificationsEmailjsServiceId: z.string().min(1).optional(),
  notificationsEmailjsTemplateId: z.string().min(1).optional(),
  notificationsEmailjsPublicKey: z.string().min(1).optional(),
  notificationsEmailjsPrivateKey: z.string().min(1).optional(),

  /** The sender name a recipient sees. Defaults to the clinic's name. */
  emailFromName: z.string().min(1).optional(),

  /**
   * Phase 17. Clinical AI.
   *
   * Every one is optional, and all four are read only through
   * {@link getClinicalAIConfig}, which insists the ones that matter arrive
   * together. A deployment with no AI is a valid deployment (section 122): the
   * panel says AI assistance is not switched on, and the consultation works
   * exactly as it did before.
   *
   * `clinicalAiEnabled` is deliberately **not** a boolean with a default of
   * `true`. `docs/HEALTHCARE_AND_AI_SAFETY.md` section 9 is binding: AI
   * features are disabled by default, so that a misconfigured or partially
   * deployed environment never silently enables AI in a clinical setting. The
   * string is parsed in {@link getClinicalAIConfig}, and anything that is not
   * exactly `"true"` means off.
   */
  aiProvider: z.enum(["gemini", "mock"]).optional(),
  aiProviderApiKey: z.string().min(1).optional(),
  aiModel: z.string().min(1).max(120).optional(),
  clinicalAiEnabled: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const SERVER_ENV_VARIABLE_NAMES: Record<keyof ServerEnv, string> = {
  appEnv: "APP_ENV",
  logLevel: "LOG_LEVEL",
  supabaseServiceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  notificationsWorkerSecret: "NOTIFICATIONS_WORKER_SECRET",
  notificationsEmailjsServiceId: "NOTIFICATIONS_EMAILJS_SERVICE_ID",
  notificationsEmailjsTemplateId: "NOTIFICATIONS_EMAILJS_TEMPLATE_ID",
  notificationsEmailjsPublicKey: "NOTIFICATIONS_EMAILJS_PUBLIC_KEY",
  notificationsEmailjsPrivateKey: "NOTIFICATIONS_EMAILJS_PRIVATE_KEY",
  emailFromName: "EMAIL_FROM_NAME",
  aiProvider: "AI_PROVIDER",
  aiProviderApiKey: "AI_PROVIDER_API_KEY",
  aiModel: "AI_MODEL",
  clinicalAiEnabled: "CLINICAL_AI_ENABLED",
};

function readServerEnv(): Record<string, string | undefined> {
  return {
    appEnv: emptyToUndefined(process.env.APP_ENV),
    logLevel: emptyToUndefined(process.env.LOG_LEVEL),
    supabaseServiceRoleKey: emptyToUndefined(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    notificationsWorkerSecret: emptyToUndefined(
      process.env.NOTIFICATIONS_WORKER_SECRET,
    ),
    notificationsEmailjsServiceId: emptyToUndefined(
      process.env.NOTIFICATIONS_EMAILJS_SERVICE_ID,
    ),
    notificationsEmailjsTemplateId: emptyToUndefined(
      process.env.NOTIFICATIONS_EMAILJS_TEMPLATE_ID,
    ),
    notificationsEmailjsPublicKey: emptyToUndefined(
      process.env.NOTIFICATIONS_EMAILJS_PUBLIC_KEY,
    ),
    notificationsEmailjsPrivateKey: emptyToUndefined(
      process.env.NOTIFICATIONS_EMAILJS_PRIVATE_KEY,
    ),
    emailFromName: emptyToUndefined(process.env.EMAIL_FROM_NAME),
    aiProvider: emptyToUndefined(process.env.AI_PROVIDER),
    aiProviderApiKey: emptyToUndefined(process.env.AI_PROVIDER_API_KEY),
    aiModel: emptyToUndefined(process.env.AI_MODEL),
    clinicalAiEnabled: emptyToUndefined(process.env.CLINICAL_AI_ENABLED),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

let cached: ServerEnv | undefined;

/**
 * Validated server configuration.
 *
 * Throws {@link ConfigurationError}, which surfaces to users as a generic
 * internal error while the offending variable names reach the server log.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const result = serverEnvSchema.safeParse(readServerEnv());
  if (!result.success) {
    throw new ConfigurationError(
      describeIssues(result.error, SERVER_ENV_VARIABLE_NAMES),
    );
  }

  cached = result.data;
  return cached;
}

/**
 * The Supabase service-role key, for the admin client only.
 *
 * Separated from {@link getServerEnv} so that the one place allowed to bypass
 * Row Level Security is the only place that can reach the key.
 */
export function requireSupabaseServiceRoleKey(): string {
  const key = getServerEnv().supabaseServiceRoleKey;
  if (!key) {
    throw new ConfigurationError([
      "SUPABASE_SERVICE_ROLE_KEY: is required for service-role operations",
    ]);
  }
  return key;
}

/**
 * The email provider's configuration, or `null` when email is not configured.
 *
 * All four credentials or none. A deployment holding three of the four gets no
 * email channel — no delivery rows are created, nothing accumulates in a queue
 * that will never drain, and the preferences screen says email is not switched
 * on. `phase_15.md` sections 12 and 14: only enable channels that are actually
 * configured, and do not pretend delivery works.
 *
 * Reached only by `lib/notifications/providers/emailjs.ts`, which is
 * `server-only`. The keys never appear in a log or a response.
 */
export function getNotificationEmailConfig(): {
  readonly serviceId: string;
  readonly templateId: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly fromName: string;
} | null {
  const env = getServerEnv();

  const {
    notificationsEmailjsServiceId: serviceId,
    notificationsEmailjsTemplateId: templateId,
    notificationsEmailjsPublicKey: publicKey,
    notificationsEmailjsPrivateKey: privateKey,
  } = env;

  if (!serviceId || !templateId || !publicKey || !privateKey) return null;

  return {
    serviceId,
    templateId,
    publicKey,
    privateKey,
    fromName: env.emailFromName ?? "Punarvasu",
  };
}

/**
 * The notification worker's shared secret, or `null` when none is set.
 *
 * `null` means the worker endpoint refuses every request, which is the right
 * behaviour for a deployment that has not been given a scheduler: an endpoint
 * that drains a queue must never be open, and defaulting to open because a
 * variable is missing is how that happens.
 */
export function getNotificationsWorkerSecret(): string | null {
  return getServerEnv().notificationsWorkerSecret ?? null;
}

/**
 * The clinical AI configuration, or `null` when AI is not available.
 *
 * ## Why one function decides, and returns `null` rather than a partial
 *
 * Three states have to be distinguishable and only one of them is "on":
 *
 *   * the flag is off, or unset          -> `null` (the default, section 9)
 *   * the flag is on but a credential is missing -> `null`
 *   * everything is present              -> the configuration
 *
 * A deployment holding a key and no flag gets no AI, and a deployment holding
 * a flag and no key gets no AI — rather than a feature that appears in the UI
 * and fails on every request. `docs/HEALTHCARE_AND_AI_SAFETY.md` section 9:
 * "a misconfigured or partially deployed environment must not silently enable
 * AI in a clinical setting."
 *
 * ## The flag is availability, never authorization
 *
 * Section 161. A deployment with the flag on does not give anybody AI: a
 * doctor still needs the permission, the practitioner record, the appointment
 * and the patient scope, and the database re-checks every one of them. The
 * flag only decides whether the capability exists at all — it is the switch
 * section 119 asks for, so clinical AI can be turned off without a
 * deployment and without touching anything else in the consultation.
 *
 * ## `mock` is a real, selectable provider
 *
 * Sections 65 and 121: local development and automated tests must not depend
 * on live provider responses, and synthetic test data must not be sent to a
 * production model. Setting `AI_PROVIDER=mock` needs no key and reaches no
 * network.
 *
 * The API key is reached only from here and only by
 * `lib/ai/gemini.ts`, both `server-only`. It is never logged, never
 * serialized and never returned to a caller.
 */
export function getClinicalAIConfig(): {
  readonly provider: "gemini" | "mock";
  readonly apiKey: string | null;
  readonly model: string;
} | null {
  const env = getServerEnv();

  // Disabled by default. Only the exact string "true" enables it, so a
  // half-written value, a "1", a "yes" or a typo all mean off — which is the
  // safe direction for a clinical feature.
  if (env.clinicalAiEnabled?.trim().toLowerCase() !== "true") return null;

  const provider = env.aiProvider ?? "gemini";

  if (provider === "mock") {
    return { provider, apiKey: null, model: env.aiModel ?? "mock" };
  }

  if (!env.aiProviderApiKey || !env.aiModel) return null;

  return { provider, apiKey: env.aiProviderApiKey, model: env.aiModel };
}

/** Whether clinical AI is configured at all. Never the key, never the model. */
export function isClinicalAIConfigured(): boolean {
  return getClinicalAIConfig() !== null;
}

/** Names of server variables that are present but malformed. */
export function collectServerEnvProblems(): string[] {
  const result = serverEnvSchema.safeParse(readServerEnv());
  return result.success
    ? []
    : describeIssues(result.error, SERVER_ENV_VARIABLE_NAMES);
}

/** Test seam: clears the memoized configuration. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
