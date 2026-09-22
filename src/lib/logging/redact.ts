/**
 * Redaction for structured logs.
 *
 * Logging is a real disclosure channel in healthcare software: a log line is
 * copied into issue trackers, shipped to third-party log services and read by
 * people with no clinical relationship to the patient. Callers are expected to
 * log identifiers rather than content; this is the safety net for the times
 * they don't.
 */

/** Key fragments whose values are replaced wherever they appear. */
const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "passcode",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "servicerole",
  "service_role",
  "credential",
  "otp",
  "email",
  "phone",
  "address",
  "dob",
  "dateofbirth",
  "date_of_birth",
  "diagnosis",
  "symptom",
  "prescription",
  "note",
  "notes",
  // Phase 13. A medicine, a dose, a frequency or an instruction is what a
  // doctor told one identifiable person to do, and it is exactly as
  // confidential as a diagnosis (`docs/SECURITY.md` section 4).
  "medicine",
  "remedy",
  "dose",
  "dosage",
  "instruction",
  "complaint",
  "assessment",
  "treatmentplan",
  "treatment_plan",
] as const;

/**
 * Key names that survive the scan above, because they carry an opaque
 * identifier rather than content.
 *
 * `phase_13.md` section 83's "good" example logs `prescriptionId` — and
 * without this list it would be redacted, because the key contains
 * "prescription". A correlation id is the one thing a log of a clinical
 * operation genuinely needs: it is what lets somebody investigate a failed
 * issue without ever learning what was prescribed.
 *
 * Every entry here must be a uuid by construction. It is an exact-match list,
 * not a pattern, precisely so that adding to it is a deliberate decision
 * somebody reviews — a rule like "anything ending in Id is safe" would exempt
 * `emailId`, which in a great deal of code means an email address.
 */
const IDENTIFIER_KEYS: ReadonlySet<string> = new Set([
  "prescriptionid",
  "prescription_id",
  "prescriptionitemid",
  "prescription_item_id",
  "treatmentplanid",
  "treatment_plan_id",
]);

export const REDACTED = "[redacted]";

const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 20;

export type LogValue =
  string | number | boolean | null | LogValue[] | { [key: string]: LogValue };

export type LogContext = Record<string, unknown>;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (IDENTIFIER_KEYS.has(normalized)) return false;
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
    : value;
}

/**
 * Produces a JSON-safe copy of `context` with sensitive values replaced and
 * unbounded structures clipped, so a single log call cannot dump a record.
 */
export function redact(
  context: LogContext,
  depth = 0,
): Record<string, LogValue> {
  const output: Record<string, LogValue> = {};

  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveKey(key)) {
      output[key] = REDACTED;
      continue;
    }
    output[key] = redactValue(value, depth);
  }

  return output;
}

function redactValue(value: unknown, depth: number): LogValue {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
    case "string":
      return truncate(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    default:
      break;
  }

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error)
    return `${value.name}: ${truncate(value.message)}`;

  if (depth >= MAX_DEPTH) return "[depth-limit]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => redactValue(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `...${value.length - MAX_ARRAY_ITEMS} more`]
      : items;
  }

  if (typeof value === "object") {
    return redact(value as LogContext, depth + 1);
  }

  return "[unserializable]";
}
