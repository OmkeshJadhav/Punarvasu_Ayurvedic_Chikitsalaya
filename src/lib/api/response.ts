/**
 * The single response shape for route handlers.
 *
 * Every endpoint answers with `{ ok: true, data }` or `{ ok: false, error }`,
 * so clients need one parser and no endpoint invents its own error format.
 * Error bodies carry a category and a safe message - never a stack trace,
 * database message, or internal identifier.
 */
import { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import type { AppErrorCode, FieldErrors } from "@/lib/errors/app-error";
import { toAppError } from "@/lib/errors/normalize";

export interface ApiSuccess<TData> {
  readonly ok: true;
  readonly data: TData;
}

export interface ApiFailure {
  readonly ok: false;
  readonly error: {
    readonly code: AppErrorCode;
    readonly message: string;
    /** Present only for validation failures. */
    readonly fieldErrors?: FieldErrors;
  };
  /** Echoed so a user can quote it in a support request. */
  readonly requestId: string;
}

export type ApiResponseBody<TData> = ApiSuccess<TData> | ApiFailure;

interface SuccessOptions {
  readonly requestId?: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

interface FailureOptions {
  /** Required: an error response without a correlation id cannot be traced. */
  readonly requestId: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

function withRequestId(
  headers: Record<string, string> | undefined,
  requestId: string | undefined,
): Record<string, string> {
  return requestId
    ? { ...headers, [REQUEST_ID_HEADER]: requestId }
    : { ...headers };
}

export function apiSuccess<TData>(
  data: TData,
  options: SuccessOptions = {},
): NextResponse<ApiSuccess<TData>> {
  return NextResponse.json(
    { ok: true as const, data },
    {
      status: options.status ?? 200,
      headers: withRequestId(options.headers, options.requestId),
    },
  );
}

/**
 * Converts any thrown value into a safe response. Unknown failures become a
 * generic internal error; the original is expected to have been logged by the
 * caller, which holds the request context.
 */
export function apiFailure(
  error: unknown,
  options: FailureOptions,
): NextResponse<ApiFailure> {
  const appError = toAppError(error);
  const requestId = options.requestId;

  return NextResponse.json(
    {
      ok: false as const,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
      },
      requestId,
    },
    {
      status: options.status ?? appError.status,
      headers: withRequestId(options.headers, requestId),
    },
  );
}
