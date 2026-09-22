import { AppError } from "@/lib/errors/app-error";

/**
 * Raised when required configuration is missing or malformed.
 *
 * Presents as a generic internal error to users — a misconfigured deployment
 * must not advertise which variables are absent. `problems` holds variable
 * names and reasons for server-side logs only, and never contains values.
 */
export class ConfigurationError extends AppError {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super("internal", {
      cause: `Invalid configuration: ${problems.join("; ")}`,
    });
    this.name = "ConfigurationError";
    this.problems = problems;
  }
}
