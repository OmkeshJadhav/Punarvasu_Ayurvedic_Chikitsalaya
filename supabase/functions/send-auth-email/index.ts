/**
 * Supabase Auth "Send Email" hook — delivery via EmailJS.
 *
 * ## What this replaces
 *
 * Supabase Auth normally sends verification and password-reset email itself,
 * over SMTP. Its built-in sender is limited to a couple of messages an hour
 * and only delivers to members of the Supabase organisation, so it cannot
 * reach a patient. This hook takes over: Supabase calls it instead of sending,
 * hands over the one-time token, and this function asks EmailJS to deliver.
 *
 * ## Why a hook and not SMTP
 *
 * Custom SMTP and this hook are the only two ways to move Supabase Auth email
 * to another provider, and EmailJS has no SMTP endpoint — it is an HTTP API.
 * So the hook is the only route to it.
 *
 * ## Trade-offs accepted with this provider
 *
 * Recorded because they are properties of the choice, not defects to fix in
 * this file. They were raised before it was built and accepted deliberately
 * (`docs/progress/progress_phase_06.md`):
 *
 *   - EmailJS relays through a connected personal mailbox, so deliverability
 *     and daily volume are that mailbox's, and the visible sender is a
 *     personal address rather than the clinic's own domain.
 *   - The free tier is 200 messages a month.
 *   - The message wrapper lives in EmailJS's dashboard, outside this
 *     repository and outside code review. The wording *about the security
 *     link* is therefore kept in `lib.ts` and passed in, so at least that part
 *     is versioned.
 *   - Patient email addresses and live one-time links transit a third party
 *     (`docs/SECURITY.md` section 23).
 *
 * ## Security properties
 *
 * 1. **Every request is signature-verified** before anything in the payload is
 *    read, and before the provider credentials are even loaded. The function
 *    is deployed with `verify_jwt = false` because Supabase calls it with a
 *    webhook signature rather than a JWT, so that signature is the only
 *    authentication there is. See `verifyWebhookSignature`.
 *    An unauthenticated caller receives 401 whatever the configuration state,
 *    so probing this endpoint reveals nothing about the deployment.
 * 2. **No token is ever logged.** `token_hash` is a bearer credential: whoever
 *    holds it can take over the account. It goes into the outbound link and
 *    nowhere else — not a log line, not an error, not the response body. The
 *    provider's own error text is discarded for the same reason, because it
 *    can echo the request back.
 * 3. **The link's origin comes from `APP_URL`**, never from the payload.
 * 4. **No email address is logged**, here or anywhere else in this phase.
 *
 * ## Required Edge Function secrets
 *
 * Set with `supabase secrets set NAME=value`; never committed.
 *
 *   SEND_EMAIL_HOOK_SECRET   the `v1,whsec_...` secret from the hook settings
 *                            (`SEND_EMAIL_HOOK_SECRETS` is accepted too, and
 *                             may hold several, comma-separated, to rotate)
 *   EMAILJS_SERVICE_ID       EmailJS service id
 *   EMAILJS_AUTH_TEMPLATE_ID EmailJS template id for authentication email
 *   EMAILJS_PUBLIC_KEY       EmailJS public key  (sent as `user_id`)
 *   EMAILJS_PRIVATE_KEY      EmailJS private key (sent as `accessToken`)
 *   APP_URL                  the application origin, e.g. https://punarvasu.in
 *
 * EmailJS additionally requires "Allow EmailJS API for non-browser
 * applications" to be enabled in its account security settings; without it
 * every call from here is refused.
 *
 * ## One template, and why it is not called "welcome"
 *
 * A single EmailJS template serves every authentication action. That is the
 * point of passing `subject`, `heading`, `body` and `action_label` as template
 * parameters: the template is a wrapper, and the words come from `lib.ts`
 * where they are versioned and reviewable.
 *
 * So the secret is `EMAILJS_AUTH_TEMPLATE_ID`, not `..._WELCOME_TEMPLATE_ID`.
 * The same template sends the password-reset email, and a wrapper that says
 * "welcome" around "someone asked to reset your password" is worse than
 * merely untidy - it is confusing at exactly the moment a patient is deciding
 * whether an email about their account is genuine.
 *
 * Application email that is not authentication - appointment confirmations and
 * the like - belongs to a later phase and will have its own templates. It does
 * not come through this hook.
 */

import {
  buildEmailJsRequest,
  sanitizeProviderError,
  verifyWebhookSignature,
  type SendEmailHookPayload,
} from "./lib.ts";

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

/** Reads a required secret, or throws a message naming it without its value. */
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing edge function secret: ${name}`);
  return value;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Nothing may escape this handler uncaught.
 *
 * An uncaught throw becomes a bare "Internal Server Error" with no body and no
 * log line worth reading - which is exactly what a misconfigured `APP_URL`
 * produced during setup, and it cost a deploy cycle to find. Supabase also
 * treats a non-2xx as "the email was not sent", so the failure has to be
 * recorded here or it is recorded nowhere.
 *
 * The error's name and message are logged; no value, address or token is.
 */
Deno.serve(async (request: Request): Promise<Response> => {
  try {
    return await handle(request);
  } catch (error) {
    const e = error as Error;
    console.error("send-auth-email.unhandled", {
      name: e?.name ?? "UnknownError",
      message: e?.message ?? "",
    });
    return json(
      { error: { http_code: 500, message: "The email could not be sent." } },
      500,
    );
  }
});

async function handle(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ---------------------------------------------------------------------
  // Authenticate first, configure second.
  //
  // Only the hook secret is read here, because it is what authentication
  // needs. The provider credentials are read *after* the signature verifies.
  //
  // The order matters. Reading everything up front meant an unconfigured
  // deployment answered an unsigned, unauthenticated request with
  // "Email is not configured" — telling an anonymous caller something about
  // the state of the system, and doing work before establishing who was
  // asking. An unauthenticated caller now gets 401 whatever the
  // configuration, and the operator still learns the real reason from the
  // function log.
  // ---------------------------------------------------------------------
  //
  // Both spellings are accepted. Supabase's own config field is
  // `auth.hook.send_email.secrets` - plural - so naming the Edge Function
  // secret to match it is the natural thing to do, and being strict about
  // which of two identical-meaning names is used would only produce a 401
  // that is tedious to diagnose. The value may hold several comma-separated
  // secrets, which is what the plural is for: see `parseHookSecrets`.
  const hookSecret =
    Deno.env.get("SEND_EMAIL_HOOK_SECRET") ??
    Deno.env.get("SEND_EMAIL_HOOK_SECRETS");

  if (!hookSecret) {
    // Fail closed. Without the secret nothing can be authenticated, so
    // nothing may be sent — and the caller is told only that it was refused.
    console.error(
      "send-auth-email.misconfigured",
      "Missing edge function secret: SEND_EMAIL_HOOK_SECRET (or SEND_EMAIL_HOOK_SECRETS)",
    );
    return new Response("Unauthorized", { status: 401 });
  }

  const rawBody = await request.text();

  // The authentication check. Nothing from the payload may be read above this
  // line, and nothing below it runs if the signature does not verify.
  const verified = verifyWebhookSignature(
    rawBody,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    hookSecret,
  );

  if (!verified) {
    console.warn("send-auth-email.signature_rejected");
    return new Response("Unauthorized", { status: 401 });
  }

  // From here the caller is Supabase Auth, so a configuration error is worth
  // reporting honestly: it is the difference between "retry" and "fix your
  // deployment".
  let config;
  try {
    config = {
      serviceId: requireEnv("EMAILJS_SERVICE_ID"),
      templateId: requireEnv("EMAILJS_AUTH_TEMPLATE_ID"),
      publicKey: requireEnv("EMAILJS_PUBLIC_KEY"),
      privateKey: requireEnv("EMAILJS_PRIVATE_KEY"),
      appUrl: requireEnv("APP_URL"),
    };
  } catch (error) {
    // Names only, never values.
    console.error("send-auth-email.misconfigured", (error as Error).message);
    return json(
      { error: { http_code: 500, message: "Email is not configured." } },
      500,
    );
  }

  let payload: SendEmailHookPayload;
  try {
    payload = JSON.parse(rawBody) as SendEmailHookPayload;
  } catch {
    console.warn("send-auth-email.malformed_payload");
    return new Response("Bad Request", { status: 400 });
  }

  let prepared;
  try {
    prepared = buildEmailJsRequest(config, payload);
  } catch (error) {
    // Reached when APP_URL is not an absolute http(s) URL. That is a
    // deployment fault: the message names the setting, never its value, and
    // the caller here is Supabase rather than a patient.
    console.error("send-auth-email.misconfigured", (error as Error).message);
    return json(
      { error: { http_code: 500, message: "Email is not configured." } },
      500,
    );
  }

  if (!prepared) {
    console.warn("send-auth-email.unsupported_action", {
      action: payload.email_data?.email_action_type ?? "none",
    });
    return new Response("Bad Request", { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: prepared.body,
    });
  } catch {
    console.error("send-auth-email.provider_unreachable");
    return json(
      { error: { http_code: 500, message: "The email could not be sent." } },
      500,
    );
  }

  if (!response.ok) {
    // The status, plus the provider's diagnosis with anything URL-shaped or
    // token-shaped stripped out. Raw text is not logged: an API that echoes
    // the request back would put the one-time link in the log, and a link in
    // a log is a credential in a log. See `sanitizeProviderError`.
    console.error("send-auth-email.provider_failed", {
      status: response.status,
      reason: sanitizeProviderError(await response.text().catch(() => "")),
    });
    return json(
      { error: { http_code: 500, message: "The email could not be sent." } },
      500,
    );
  }

  // The action is a category, not personal data. The address and the token are
  // both absent on purpose.
  console.log("send-auth-email.sent", { action: prepared.action });

  // Supabase treats any 2xx with an empty error as "sent".
  return json({}, 200);
}
