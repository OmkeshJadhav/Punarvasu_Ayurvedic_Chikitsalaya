/**
 * The application's single error vocabulary.
 *
 * Every failure that crosses a trust boundary is expressed as an `AppError`
 * so that exactly one layer decides what the user is allowed to see. The
 * `message` carried by an `AppError` is always safe to display; anything
 * sensitive belongs in `cause`, which is logged server-side and never
 * serialized to a response.
 */

/** Failure categories the API and UI layers know how to present. */
export const APP_ERROR_CODES = [
  "validation",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "internal",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

/** HTTP status for each category, used by the route-handler response helper. */
export const APP_ERROR_STATUS: Record<AppErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/**
 * Default user-facing copy. Deliberately vague about internals: a message must
 * never reveal whether a record exists, which query failed, or how the system
 * is built.
 */
export const DEFAULT_USER_MESSAGE: Record<AppErrorCode, string> = {
  validation:
    "Some of the details provided aren't valid. Please check them and try again.",
  unauthorized: "Please sign in to continue.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find what you were looking for.",
  conflict:
    "This was changed by someone else in the meantime. Please refresh and try again.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  internal: "Something went wrong. Please try again.",
};

/** Field-level validation feedback: field name to messages about that field. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface AppErrorOptions {
  /** Overrides the default copy. Must stay safe for an end user to read. */
  readonly message?: string;
  /** The underlying failure. Logged, never returned to a client. */
  readonly cause?: unknown;
  /** Field-level detail, for `validation` errors only. */
  readonly fieldErrors?: FieldErrors;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? DEFAULT_USER_MESSAGE[code], {
      cause: options.cause,
    });
    this.name = "AppError";
    this.code = code;
    this.status = APP_ERROR_STATUS[code];
    this.fieldErrors = options.fieldErrors;
  }

  static isAppError(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}

export const validationError = (
  fieldErrors: FieldErrors,
  options?: Omit<AppErrorOptions, "fieldErrors">,
): AppError => new AppError("validation", { ...options, fieldErrors });

export const unauthorizedError = (options?: AppErrorOptions): AppError =>
  new AppError("unauthorized", options);

export const forbiddenError = (options?: AppErrorOptions): AppError =>
  new AppError("forbidden", options);

export const notFoundError = (options?: AppErrorOptions): AppError =>
  new AppError("not_found", options);

export const conflictError = (options?: AppErrorOptions): AppError =>
  new AppError("conflict", options);

export const rateLimitedError = (options?: AppErrorOptions): AppError =>
  new AppError("rate_limited", options);

export const internalError = (options?: AppErrorOptions): AppError =>
  new AppError("internal", options);
