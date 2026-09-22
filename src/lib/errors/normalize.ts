import { AppError, internalError } from "@/lib/errors/app-error";

/**
 * Converts an unknown thrown value into an `AppError`.
 *
 * Unrecognized failures become a generic internal error with the original
 * value preserved as `cause` for logging. The original message is never
 * promoted to the user-facing message: a driver or database error can contain
 * SQL, connection strings or patient data.
 */
export function toAppError(error: unknown): AppError {
  if (AppError.isAppError(error)) return error;
  return internalError({ cause: error });
}

/** A log-safe description of an unknown failure. Never includes values. */
export function describeErrorForLog(error: unknown): {
  name: string;
  message: string;
} {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: typeof error };
}
