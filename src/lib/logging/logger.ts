/**
 * Structured server-side logging.
 *
 * One line of JSON per event, so production logs are queryable and a request
 * can be traced end to end by its correlation id. Server-only: application
 * logs must not be emitted from the browser, where they would be visible to
 * anyone with the device.
 */
import "server-only";

import { getServerEnv, type LogLevel } from "@/config/env.server";
import { describeErrorForLog } from "@/lib/errors/normalize";
import { redact, type LogContext } from "@/lib/logging/redact";

export type { LogLevel };

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  /** Dot-separated event name, e.g. `health.check_failed`. */
  readonly event: string;
  readonly [key: string]: unknown;
}

function configuredLevel(): LogLevel {
  try {
    const env = getServerEnv();
    if (env.logLevel) return env.logLevel;
    return env.appEnv === "development" ? "debug" : "info";
  } catch {
    // Logging must survive broken configuration - that failure is precisely
    // what needs to be logged.
    return "info";
  }
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  if (LEVEL_SEVERITY[level] < LEVEL_SEVERITY[configuredLevel()]) return;

  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(context),
  };

  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  /** `error` carries the thrown value; only its name and message are logged. */
  error(event: string, error?: unknown, context?: LogContext): void;
  /** Returns a logger that stamps every record with the given context. */
  child(context: LogContext): Logger;
}

function createLogger(base: LogContext): Logger {
  return {
    debug: (event, context) => write("debug", event, { ...base, ...context }),
    info: (event, context) => write("info", event, { ...base, ...context }),
    warn: (event, context) => write("warn", event, { ...base, ...context }),
    error: (event, error, context) =>
      write("error", event, {
        ...base,
        ...context,
        ...(error === undefined ? {} : { error: describeErrorForLog(error) }),
      }),
    child: (context) => createLogger({ ...base, ...context }),
  };
}

export const logger: Logger = createLogger({});
