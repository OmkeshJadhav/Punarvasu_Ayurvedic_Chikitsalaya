import { NextResponse, type NextRequest } from "next/server";

import { describeAuthFailure } from "@/features/auth/errors";
import {
  AUTHENTICATED_LANDING_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_PATH,
} from "@/lib/auth/paths";
import { NEXT_PARAM, safeRedirectPath } from "@/lib/auth/redirect";
import { resolveRequestId } from "@/lib/api/request-id";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The single entry point for every link Supabase puts in an email.
 *
 * ## Why one route and not three
 *
 * `phase_06.md` section 5 says not to create unnecessary routes, and
 * verification, password recovery and any future magic link are the same
 * operation from the application's side: turn a one-time credential in a URL
 * into a session, then send the user somewhere safe. They differ only in where
 * "somewhere safe" is, and that arrives as a parameter.
 *
 * ## The two shapes a link can take
 *
 * Which one Supabase sends depends on the project's email templates, and a
 * project can be changed after this code ships, so both are handled:
 *
 *   - `?code=...` - the PKCE authorization code, exchanged for a session.
 *   - `?token_hash=...&type=...` - the one-time token used by the default
 *     email templates, verified with `verifyOtp`.
 *
 * A link carrying neither is not a link this application issued.
 *
 * ## What never happens here
 *
 * No token, code or hash is ever logged, returned in a response body, or put
 * into the redirect target (`phase_06.md` sections 57-58 and 76). Nothing from
 * the query string is echoed back to the browser. The one value that survives
 * into the response is `next`, and only after {@link safeRedirectPath} has
 * reduced it to an internal path.
 *
 * Supabase's own failures arrive here as `?error=` and `?error_description=`
 * in the URL - the description is provider text and is never rendered; the
 * user gets our copy for "this link no longer works".
 */

/**
 * Where to send someone whose link did not work.
 *
 * Recovery goes to the reset page, which explains expiry and offers a new
 * link; everything else goes to the verification page, which carries the
 * resend form. Both are static destinations chosen here, never taken from the
 * request.
 */
function failureDestination(origin: string, isRecovery: boolean): URL {
  const url = new URL(isRecovery ? RESET_PASSWORD_PATH : VERIFY_PATH, origin);
  url.searchParams.set("status", "link-invalid");
  return url;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = logger.child({ requestId, route: "auth.callback" });

  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const providerError = searchParams.get("error");

  const destination = safeRedirectPath(
    searchParams.get(NEXT_PARAM),
    AUTHENTICATED_LANDING_PATH,
  );
  // `next` is the authoritative signal for a recovery link, because a PKCE
  // `code` carries no type. It is compared against a constant, not parsed.
  const isRecovery =
    type === "recovery" || destination.startsWith(RESET_PASSWORD_PATH);

  // Supabase rejected the link before the user ever reached us - usually an
  // expired one. The description it sends is provider text; it is recorded as
  // a category and never shown.
  if (providerError) {
    log.warn("auth.callback_rejected_by_provider", {
      errorCode: searchParams.get("error_code") ?? "unknown",
    });
    return NextResponse.redirect(failureDestination(origin, isRecovery));
  }

  if (!code && !(tokenHash && type)) {
    log.warn("auth.callback_missing_credential");
    return NextResponse.redirect(failureDestination(origin, isRecovery));
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          type: asOtpType(type),
          token_hash: tokenHash!,
        });

    if (error) {
      const failure = describeAuthFailure("callback", error);
      log.warn(failure.logEvent, { operation: "callback" });
      return NextResponse.redirect(failureDestination(origin, isRecovery));
    }
  } catch (error) {
    const failure = describeAuthFailure("callback", error);
    log.error(failure.logEvent, error, { operation: "callback" });
    return NextResponse.redirect(failureDestination(origin, isRecovery));
  }

  log.info("auth.callback_succeeded", { recovery: isRecovery });

  // Built from this request's own origin and a validated path. There is no
  // input to this expression that can produce a different host.
  const response = NextResponse.redirect(new URL(destination, origin));

  // The redirect itself is a step in an authenticated flow and carries
  // Set-Cookie headers for the new session. Nothing about it may be stored by
  // a shared cache (`phase_06.md` section 74).
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  return response;
}

/**
 * Narrows the `type` parameter to the one-time token types this application
 * issues.
 *
 * An unrecognised value becomes `email`, which Supabase will reject as an
 * invalid token rather than acting on. The alternative - passing the caller's
 * string straight into the client - would let a request choose which
 * verification flow to run.
 */
function asOtpType(
  type: string | null,
): "signup" | "recovery" | "email_change" | "email" {
  switch (type) {
    case "signup":
    case "recovery":
    case "email_change":
      return type;
    default:
      return "email";
  }
}
