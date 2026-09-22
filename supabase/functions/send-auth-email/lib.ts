/**
 * The logic behind the Send Email hook, kept free of Deno globals.
 *
 * Split out from `index.ts` for one reason: this is the part that has to be
 * *right*, and separating it means it can be unit-tested in the project's own
 * Vitest suite (`tests/integration/auth-email-hook.test.ts`) instead of only
 * being exercised by deploying and hoping. `index.ts` keeps the parts that
 * genuinely need the runtime — reading secrets, serving, calling out.
 *
 * Nothing here imports anything Deno-specific, so the same code runs under
 * Node in the test and under Deno in production.
 */

// Both imports are explicit, including `Buffer`.
//
// `Buffer` is a global in Node but NOT in Deno, which is what this file
// actually runs on. Relying on the global made the tests pass (they run under
// Node) while every real invocation threw `ReferenceError: Buffer is not
// defined` before it reached the provider - so the hook failed with a generic
// 500 and the unit tests said everything was fine. `lib.test`-style coverage
// cannot catch that; the assertion in `auth-email-hook.test.ts` that this file
// imports what it uses is what catches it now.
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

/** The action types Supabase Auth can ask us to send. */
export type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_current"
  | "reauthentication";

export interface SendEmailHookPayload {
  readonly user: { readonly id: string; readonly email: string };
  readonly email_data: {
    readonly token: string;
    readonly token_hash: string;
    readonly redirect_to: string;
    readonly email_action_type: EmailActionType;
    readonly site_url: string;
  };
}

export interface AuthEmailMessage {
  readonly subject: string;
  readonly heading: string;
  readonly body: string;
  readonly action: string;
}

/**
 * Subject and explanation, per action.
 *
 * Kept here rather than in the EmailJS template so that one template serves
 * every auth email and the *words a patient reads about a security link* stay
 * in version control. The template supplies the wrapper; this supplies the
 * meaning.
 *
 * No clinical or personal content appears in any of them
 * (`docs/SECURITY.md` section 24): an authentication email says that an action
 * was requested and offers a link, and nothing else. None of them states that
 * an account exists — "if you didn't ask for this, ignore it" is the strongest
 * phrasing used, so a message delivered to the wrong person reveals nothing.
 */
export const AUTH_EMAIL_MESSAGES: Record<EmailActionType, AuthEmailMessage> = {
  signup: {
    subject: "Confirm your Punarvasu account",
    heading: "Confirm your email address",
    body: "Please confirm this address to finish setting up your Punarvasu account. This link can be used once and expires shortly.",
    action: "Confirm my email address",
  },
  recovery: {
    subject: "Reset your Punarvasu password",
    heading: "Choose a new password",
    body: "We received a request to reset the password for this Punarvasu account. This link can be used once and expires shortly. If you didn't ask for it, you can ignore this email and nothing will change.",
    action: "Choose a new password",
  },
  magiclink: {
    subject: "Your Punarvasu sign-in link",
    heading: "Sign in to Punarvasu",
    body: "Use the link below to sign in. It can be used once and expires shortly.",
    action: "Sign in",
  },
  invite: {
    subject: "You have been invited to Punarvasu",
    heading: "Set up your account",
    body: "You have been invited to create a Punarvasu account. This link can be used once and expires shortly.",
    action: "Set up my account",
  },
  email_change: {
    subject: "Confirm your new Punarvasu email address",
    heading: "Confirm your new email address",
    body: "Please confirm this address so it can be used for your Punarvasu account.",
    action: "Confirm this address",
  },
  email_change_current: {
    subject: "Confirm the change to your Punarvasu email address",
    heading: "Confirm this change",
    body: "A request was made to change the email address on your Punarvasu account. Please confirm it.",
    action: "Confirm this change",
  },
  reauthentication: {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    body: "Please confirm this request to continue.",
    action: "Confirm",
  },
};

/** How far out of date a webhook timestamp may be, in seconds. */
export const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

/**
 * Verifies the Standard Webhooks signature Supabase sends.
 *
 * **This is the authentication for the endpoint.** The function is deployed
 * with `verify_jwt = false`, because Supabase Auth calls it with a webhook
 * signature rather than a JWT — so without this check the URL is an open relay
 * that will send mail from the clinic's sender, to any address, carrying any
 * link. That is a phishing kit, not a bug.
 *
 * Returns true only when the signature is present, recent and correct. Every
 * failure returns false without indicating which check failed, so probing the
 * endpoint teaches an attacker nothing.
 *
 * @param now Injectable clock, so the skew window can be tested.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: {
    readonly id: string | null;
    readonly timestamp: string | null;
    readonly signature: string | null;
  },
  secret: string,
  now: number = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  // Bound replay: a captured request cannot be resent tomorrow.
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Math.floor(now / 1000) - sentAt) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const keys = parseHookSecrets(secret);
  if (keys.length === 0) return false;

  // The header may carry several space-separated versioned signatures, and the
  // configuration may hold several secrets. Any valid pairing is a pass, which
  // is what makes a zero-downtime rotation possible.
  for (const key of keys) {
    const expected = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest();

    for (const part of signature.split(" ")) {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value) continue;

      const candidate = Buffer.from(value, "base64");
      // Length-checked first because `timingSafeEqual` throws on a mismatch;
      // the comparison itself is constant-time so the signature cannot be
      // recovered a byte at a time by timing the response.
      if (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Decodes one or more hook secrets into signing keys.
 *
 * Supabase issues a hook secret as `v1,whsec_<base64>`, and its own config
 * field is `auth.hook.send_email.secrets` - plural - because a hook may hold
 * more than one during a rotation. This accepts that: a comma-separated list,
 * each entry optionally carrying the `v1,` and `whsec_` prefixes.
 *
 * Rotating without downtime therefore means: add the new secret alongside the
 * old, let Supabase start signing with the new one, then remove the old. At no
 * point is a legitimate call rejected.
 *
 * An entry that is empty or not valid base64 is skipped rather than throwing,
 * so one malformed value cannot take authentication down for the others.
 */
export function parseHookSecrets(raw: string): Buffer[] {
  const keys: Buffer[] = [];

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    // `v1` is the version marker, not a secret; skip it and take what follows.
    if (trimmed === "" || trimmed === "v1") continue;

    // Supabase issues the secret as `v1,whsec_<base64>`. BOTH prefixes have to
    // come off: `v1,` is the signature version, and `whsec_` is the Standard
    // Webhooks secret marker. Only what remains is base64.
    let encoded = trimmed.startsWith("v1,") ? trimmed.slice(3) : trimmed;
    if (encoded.startsWith("whsec_")) encoded = encoded.slice(6);

    // Validated strictly, and this is the important part.
    //
    // `Buffer.from(value, "base64")` is lenient: it silently skips characters
    // outside the alphabet rather than failing. So leaving `whsec_` attached
    // did not throw - it decoded `whsec` as though it were data and produced a
    // key that was wrong but perfectly plausible, and every genuine call from
    // Supabase was rejected with 401 for no visible reason. A validation that
    // silently repairs its input is worse than one that refuses it.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) continue;

    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > 0) keys.push(bytes);
  }

  return keys;
}

/**
 * Builds the link the email carries.
 *
 * It points at **this application's** `/auth/callback` with `token_hash` and
 * `type`, which the callback exchanges for a session using `verifyOtp`. One
 * hop rather than two, and it is the path proven end to end against the live
 * Auth server.
 *
 * The origin comes from `appUrl` and from nothing else. `redirect_to` from the
 * payload contributes only the *path* to land on after the exchange, and only
 * when it is same-origin — so a poisoned value cannot aim a clinic-branded
 * email at somebody else's host. That matters more here than almost anywhere:
 * this link arrives in an inbox wearing the clinic's name.
 */
export function buildActionLink(
  appUrl: string,
  action: EmailActionType,
  tokenHash: string,
  redirectTo: string,
): string {
  const origin = parseOrigin(appUrl);
  if (origin === null) {
    // `APP_URL` is operator configuration, so this is a deployment fault, not
    // a request fault. Thrown with a message that names the variable and not
    // its value; the handler turns it into a logged 500.
    throw new Error(
      "APP_URL is not an absolute http(s) URL, e.g. https://punarvasu.in",
    );
  }

  const url = new URL(`${origin}/auth/callback`);

  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", action);

  // Recovery has to land on the page that sets a new password. Everything else
  // takes the callback's own authenticated default.
  let next = action === "recovery" ? "/auth/reset-password" : "";

  if (redirectTo) {
    try {
      const requested = new URL(redirectTo, origin);
      if (requested.origin === origin) {
        const path = requested.pathname + requested.search;
        // Landing back on the callback would loop.
        if (path !== "/auth/callback" && !path.startsWith("/auth/callback?")) {
          next = path;
        }
      }
    } catch {
      // Unparseable: keep the default chosen above.
    }
  }

  if (next) url.searchParams.set("next", next);

  return url.toString();
}

/**
 * The origin of an absolute http(s) URL, or `null`.
 *
 * `new URL()` throws on anything it cannot parse, and a throw inside a hook
 * handler becomes an opaque "Internal Server Error" that says nothing about
 * which setting is wrong. Returning `null` lets the caller say so precisely.
 *
 * Only `http:` and `https:` are accepted: `APP_URL` ends up as the origin of a
 * link in a patient's inbox, and a `javascript:` or `data:` value there would
 * be a scheme this application put in an email itself.
 */
export function parseOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim().replace(/\/+$/, ""));
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.origin;
}

/**
 * A provider error message that is safe to put in a log.
 *
 * The provider's own text is not logged raw, because an API that echoes the
 * request back would put the one-time link into the log - and a link in a log
 * is a credential in a log. But discarding it entirely left "the email could
 * not be sent" as the only signal, which is untriageable: it cannot
 * distinguish a disabled API from a wrong template id from a rejected key.
 *
 * So: strip anything URL-shaped, strip anything token-shaped, bound the
 * length. What survives is the provider's diagnosis - "The user ID is
 * invalid", "API calls are disabled for non-browser applications" - which is
 * exactly what an operator needs and contains nothing of the patient's.
 */
export function sanitizeProviderError(text: string): string {
  return (
    text
      .replace(/https?:\/\/\S+/gi, "[url]")
      // Long opaque runs are token-shaped; a real diagnosis is words.
      .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200)
  );
}

/** The EmailJS request body, built from a verified payload. */
export function buildEmailJsRequest(
  config: {
    readonly serviceId: string;
    readonly templateId: string;
    readonly publicKey: string;
    readonly privateKey: string;
    readonly appUrl: string;
  },
  payload: SendEmailHookPayload,
): { readonly body: string; readonly action: EmailActionType } | null {
  const action = payload.email_data?.email_action_type;
  const message = action ? AUTH_EMAIL_MESSAGES[action] : undefined;
  const recipient = payload.user?.email;
  const tokenHash = payload.email_data?.token_hash;

  // An unrecognised action is a Supabase feature this application has not
  // opted into. Guessing a subject line for it would put unreviewed words in
  // front of a patient, so it is refused instead.
  if (!message || !recipient || !tokenHash) return null;

  const actionUrl = buildActionLink(
    config.appUrl,
    action,
    tokenHash,
    payload.email_data.redirect_to ?? "",
  );

  return {
    action,
    body: JSON.stringify({
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: config.publicKey,
      accessToken: config.privateKey,
      template_params: {
        // The recipient under both conventional names.
        //
        // EmailJS resolves the template's "To Email" field from a template
        // parameter, and which name it uses is the template author's choice -
        // `{{email}}` and `{{to_email}}` are both common, and the template
        // lives in EmailJS's dashboard rather than in this repository. A
        // mismatch is not a loud failure either: EmailJS answers
        // "422 The recipients address is empty", which says nothing about
        // which name it wanted. This project's template turned out to use
        // `{{email}}` while the function sent `to_email`, and that cost two
        // deploy cycles to find.
        //
        // Supplying both removes the whole class of breakage, including
        // someone editing the template later. It is the same address either
        // way, to the same third party, so it costs nothing in exposure.
        to_email: recipient,
        email: recipient,
        subject: message.subject,
        heading: message.heading,
        body: message.body,
        action_label: message.action,
        action_url: actionUrl,
        // A plain-text copy for templates that offer a text part, so the link
        // is still reachable if the HTML is stripped.
        action_url_plain: actionUrl,
      },
    }),
  };
}
