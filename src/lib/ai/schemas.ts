/**
 * The contract a provider response must satisfy before anybody reads it.
 *
 * ## Provider output is untrusted input
 *
 * `phase_17.md` section 38: never blindly render arbitrary provider output,
 * and treat it as untrusted text. That is not a stylistic preference — a model
 * is a remote system returning a string, and the string was influenced by
 * patient-entered text and document titles the clinic did not write. So it
 * gets the same treatment as a request body: a `strict()` schema, explicit
 * bounds, and a rejection rather than a repair when it does not fit.
 *
 * ## Why `strict()` and not `passthrough()`
 *
 * A model that returns `{"summary": "...", "diagnosis": "..."}` is trying to
 * do something this system does not permit. Stripping the extra key would let
 * it fail quietly and repeatedly; rejecting it makes it visible in the
 * operational metrics as a `rejected` session, which is the number worth
 * watching (sections 107, 156).
 *
 * ## No confidence field, anywhere
 *
 * Sections 30, 31 and the acceptance criteria: a numeric confidence beside a
 * clinical consideration reads as diagnostic probability, and it is not one.
 * The schema has no field for it, so a model that returns one is refused
 * rather than having it silently dropped — which is the difference between
 * "we do not display that" and "we could not display that".
 *
 * ## No HTML, no markdown, no links
 *
 * Section 39. Every string is plain text and is rendered as a text node. The
 * sanitizer below strips control characters and collapses whitespace; it does
 * not "clean" HTML, because nothing here ever renders HTML and a sanitizer
 * that implies otherwise is an invitation to start.
 */

import { z } from "zod";

import { CLINICAL_AI_RESPONSE_LIMITS } from "@/config/clinical-ai";

/**
 * Removes what must never reach a screen or a clipboard.
 *
 * Control characters — including the ones a formatter or a terminal would
 * interpret — plus zero-width and bidirectional-override characters, which are
 * the ones that make text display differently from what it says. A model
 * echoing a bidi override out of a maliciously titled document must not be
 * able to make a warning read as its opposite.
 *
 * Newlines and tabs survive, because a summary legitimately has paragraphs.
 */
function sanitizeText(value: string): string {
  let out = "";

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    // C0 controls except tab (9) and newline (10); DEL and C1 controls.
    if (code < 0x20 && code !== 0x09 && code !== 0x0a) continue;
    if (code >= 0x7f && code <= 0x9f) continue;
    // Zero-width and bidirectional formatting.
    if (code >= 0x200b && code <= 0x200f) continue;
    if (code >= 0x202a && code <= 0x202e) continue;
    if (code >= 0x2066 && code <= 0x2069) continue;
    if (code === 0xfeff) continue;

    out += character;
  }

  return out
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const boundedText = (max: number) =>
  z.string().transform(sanitizeText).pipe(z.string().min(1).max(max));

/**
 * One item in a list section.
 *
 * A plain string, not an object. An object invites a `confidence`, a
 * `severity` or a `likelihood`, and every one of those is a clinical claim
 * this system is not entitled to make (section 31).
 */
const itemSchema = boundedText(CLINICAL_AI_RESPONSE_LIMITS.maxItemChars);

const itemListSchema = z
  .array(itemSchema)
  .max(CLINICAL_AI_RESPONSE_LIMITS.maxItems)
  .optional()
  .transform((items) => items ?? []);

/**
 * The shape every task's response must take (sections 37, 68, 133).
 *
 * Every section is optional, because a task that produces no considerations
 * should return none rather than an empty-sounding sentence. The task's own
 * declared `outputs` decide which sections are *rendered*, so a model
 * volunteering a section the task did not ask for simply has it ignored — the
 * one place this schema is deliberately permissive, because the alternative is
 * refusing a useful answer over a formatting difference.
 */
export const clinicalAIResponseSchema = z
  .object({
    summary: boundedText(
      CLINICAL_AI_RESPONSE_LIMITS.maxSummaryChars,
    ).optional(),
    considerations: itemListSchema,
    missingInformation: itemListSchema,
    warnings: itemListSchema,
  })
  .strict();

export type ClinicalAIResponse = z.infer<typeof clinicalAIResponseSchema>;

/**
 * Parses a provider's raw text into a validated response.
 *
 * ## Why the JSON is extracted rather than trusted
 *
 * Models wrap JSON in prose and in code fences however firmly they are asked
 * not to. Extracting the outermost braced span is pragmatic and bounded; what
 * makes it safe is that whatever comes out still has to satisfy the schema
 * above. The alternative — refusing a correct answer because it arrived inside
 * a fence — would make the feature unreliable for no security gain.
 *
 * ## Failure is a category, never a message
 *
 * The caller gets `invalid_response` and nothing else. A parse error's text
 * can contain a fragment of the document it was parsing, and that document is
 * a clinical response (section 90).
 */
export function parseClinicalAIResponse(
  raw: string,
):
  | { readonly ok: true; readonly response: ClinicalAIResponse }
  | { readonly ok: false } {
  const candidate = extractJsonObject(raw);
  if (!candidate) return { ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false };
  }

  const result = clinicalAIResponseSchema.safeParse(parsed);
  if (!result.success) return { ok: false };

  // A response whose every section is empty is not a response. It renders as
  // four blank headings, which reads as a broken feature rather than as "there
  // was nothing to say" — and a task with nothing to say should say so in its
  // summary.
  const { summary, considerations, missingInformation, warnings } = result.data;
  if (
    !summary &&
    considerations.length === 0 &&
    missingInformation.length === 0 &&
    warnings.length === 0
  ) {
    return { ok: false };
  }

  return { ok: true, response: result.data };
}

/**
 * The outermost `{...}` span, or `null`.
 *
 * Brace-counting rather than a regex, because a regex either stops at the
 * first closing brace (truncating every nested object) or is greedy in a way
 * that depends on what follows. Quoted strings and escapes are tracked so a
 * brace inside a clinical note does not end the object.
 */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      if (inString) escaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }

  return null;
}
