/**
 * Route handler wrapper.
 *
 * Gives every endpoint the same skeleton: a correlation id, a same-origin
 * check on state-changing methods, a structured log for failures, and a
 * sanitized error response. Handlers are left to do the rest -
 * authentication, authorization and validation are the handler's
 * responsibility, not something this wrapper can guess.
 *
 * ## Why the origin check lives here and not in each handler
 *
 * Phase 19. Next.js protects Server Actions against cross-site invocation
 * itself; route handlers get no such protection, and two of this
 * application's three `POST` endpoints accept `multipart/form-data` - a
 * content type a cross-site form can send with no CORS preflight, carrying
 * the victim's cookies.
 *
 * Putting the check in the wrapper rather than in the handlers means a route
 * added later inherits it instead of having to remember it, which is the same
 * reasoning that put the authorization guards in layouts rather than pages.
 * `lib/security/same-origin.ts` carries the full argument for what is checked
 * and why a missing `Origin` is allowed through.
 */
import type { NextRequest, NextResponse } from "next/server";
import "server-only";

import { resolveRequestId } from "@/lib/api/request-id";
import { apiFailure } from "@/lib/api/response";
import { AppError, forbiddenError } from "@/lib/errors/app-error";
import { toAppError } from "@/lib/errors/normalize";
import { logger, type Logger } from "@/lib/logging/logger";
import {
  UNSAFE_METHODS,
  isCrossOriginRequest,
} from "@/lib/security/same-origin";

export interface RouteContext {
  readonly requestId: string;
  /** Logger pre-stamped with the request id. */
  readonly log: Logger;
}

type RouteHandler<TResponse> = (
  request: NextRequest,
  context: RouteContext,
) => Promise<NextResponse<TResponse>>;

export function createRouteHandler<TResponse>(
  routeName: string,
  handler: RouteHandler<TResponse>,
) {
  return async (request: NextRequest) => {
    const requestId = resolveRequestId(request.headers);
    const log = logger.child({ requestId, route: routeName });

    try {
      if (UNSAFE_METHODS.has(request.method) && isCrossOriginRequest(request)) {
        // Logged as a security event rather than an ordinary rejection: a
        // cross-site mutation attempt is worth noticing, and the count of
        // them is one of the indicators `phase_19.md` section 157 asks to be
        // watchable. No header value is recorded - an `Origin` is an
        // attacker-controlled string and a log is not the place for one.
        log.warn("security.cross_origin_request_blocked", {
          method: request.method,
        });
        throw forbiddenError({
          cause: new Error("Cross-origin request to a state-changing route."),
        });
      }

      return await handler(request, { requestId, log });
    } catch (error) {
      const appError = toAppError(error);

      // Expected failures (a validation or permission outcome) are ordinary
      // traffic; only unexpected ones deserve an error-level log.
      if (appError.code === "internal") {
        log.error(
          `${routeName}.failed`,
          AppError.isAppError(error) ? error.cause : error,
        );
      } else {
        log.warn(`${routeName}.rejected`, { code: appError.code });
      }

      return apiFailure(appError, { requestId });
    }
  };
}
