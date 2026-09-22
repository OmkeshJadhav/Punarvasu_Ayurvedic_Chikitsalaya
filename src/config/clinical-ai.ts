/**
 * Clinical AI configuration — the one place a task, a limit or a bound is
 * named.
 *
 * `phase_17.md` section 15 asks for provider, model, temperature, token
 * limits and timeouts to be centralized rather than scattered, and section 93
 * says the client selects none of them. This module is the centre; nothing
 * outside it names a model, a temperature or a token count, and nothing on the
 * client can influence one because none of them is ever a request parameter.
 *
 * ## Pure data
 *
 * No server imports, no secrets, no Supabase. It is safe for a client
 * component to import the task list in order to render labels — and that is a
 * *usability* decision, never a security one. The task a request carries is
 * re-validated on the server against this same list, and the database's
 * `ai_assistance_task` enum refuses anything else a third time.
 *
 * The **credentials** live in `config/env.server.ts`, which is `server-only`,
 * so a client import of the key is a build error rather than a leak.
 *
 * ## Mirrored against the database
 *
 * `AI_ASSISTANCE_LIMITS` mirrors `public.ai_assistance_limits()` and
 * `CLINICAL_AI_TASKS` mirrors the `public.ai_assistance_task` enum.
 * `clinical-ai.test.ts` parses the migration and asserts both agree — the
 * mirror discipline every phase since 10 has used, because two copies of a
 * rule is a divergence waiting to happen and the divergence here is a task the
 * panel offers and the database refuses.
 */

/**
 * Every task a doctor may ask for.
 *
 * A **closed set**, which is section 16's whole point and section 92's
 * "no generic AI endpoint" expressed as data. There is no free-text prompt
 * task, no "ask anything", and no task whose instructions the caller
 * supplies.
 *
 * Section 80 allows a free-text task eventually, with its own labelling,
 * context limits, validation, rate limits and injection defence. It is not
 * built, and it is not stubbed: adding one means adding an enum value in a
 * migration, a prompt template, a response contract and a safety rule, which
 * is the review that decision deserves.
 */
export const CLINICAL_AI_TASKS = [
  "clinical_summary",
  "missing_information",
  "clinical_considerations",
  "consultation_summary",
] as const;

export type ClinicalAITask = (typeof CLINICAL_AI_TASKS)[number];

export function isClinicalAITask(value: unknown): value is ClinicalAITask {
  return (
    typeof value === "string" &&
    (CLINICAL_AI_TASKS as readonly string[]).includes(value)
  );
}

/**
 * What each task is for, in the practitioner's words.
 *
 * `purpose` is the label on the control; `description` is the sentence under
 * it. Both are written to section 79's standard — an explicit clinical task,
 * never "ask AI" — and to section 20's: nothing here offers a diagnosis.
 *
 * `outputs` says which sections of the result this task actually produces, so
 * the panel can render the shape the practitioner is about to get rather than
 * four headings, three of them empty.
 */
export const CLINICAL_AI_TASK_COPY: Readonly<
  Record<
    ClinicalAITask,
    {
      readonly label: string;
      readonly description: string;
      readonly outputs: readonly ClinicalAISection[];
    }
  >
> = {
  clinical_summary: {
    label: "Summarise this patient's record",
    description:
      "Organises what is already recorded for this patient into a structured summary. It adds no information that is not in the selected context.",
    outputs: ["summary", "missingInformation", "warnings"],
  },
  consultation_summary: {
    label: "Summarise this consultation",
    description:
      "Restates the notes recorded for this consultation in a structured form, for your review before you finish writing them up.",
    outputs: ["summary", "missingInformation", "warnings"],
  },
  missing_information: {
    label: "Identify potentially missing information",
    description:
      "Suggests information that is commonly recorded and is absent here. A prompt for you to consider, not a statement about the patient.",
    outputs: ["missingInformation", "warnings"],
  },
  clinical_considerations: {
    label: "Clinical considerations for review",
    description:
      "Points and questions you may wish to consider. These are not diagnoses, not recommendations and not a differential — you assess each one yourself.",
    outputs: ["considerations", "missingInformation", "warnings"],
  },
};

/**
 * The four sections a result can carry (sections 68, 133).
 *
 * Structured sections rather than one paragraph, because a practitioner reads
 * a clinical screen by scanning it, and because a section is a thing the
 * safety layer can apply a different rule to: a `consideration` is held to
 * "this is not a diagnosis" in a way a `missingInformation` line is not.
 */
export const CLINICAL_AI_SECTIONS = [
  "summary",
  "considerations",
  "missingInformation",
  "warnings",
] as const;

export type ClinicalAISection = (typeof CLINICAL_AI_SECTIONS)[number];

/**
 * The quota. Mirrors `public.ai_assistance_limits()`.
 *
 * Read by the panel so a practitioner can see the limit before they hit it.
 * **Not** the enforcement: the database counts rows in a window and refuses,
 * which is what survives a server restart and what holds across instances
 * (section 104).
 */
export const AI_ASSISTANCE_LIMITS = {
  windowMinutes: 60,
  maxPerPractitioner: 40,
  maxPerPatient: 12,
} as const;

/**
 * How the provider is called.
 *
 * ## Timeout
 *
 * Section 51: a consultation request must not hang. Twenty-five seconds is
 * long enough for a flash model on a long context and short enough that a
 * practitioner mid-consultation gets an answer — "it is unavailable" is an
 * answer — rather than a spinner.
 *
 * ## Retry
 *
 * Section 52: retry transient failures only, and do not repeatedly resubmit
 * sensitive clinical context. **One** retry, and only for a timeout, a 5xx or
 * a transport failure. A 4xx is not retried at all, because a request the
 * provider refused will be refused again, and every retry is the patient's
 * clinical context crossing the wire a second time.
 *
 * ## Temperature
 *
 * Low. This is not a creative task: the value of a clinical summary is that it
 * restates what is there, and a model asked to be interesting invents.
 *
 * ## Token limits
 *
 * Sections 55, 147. `maxContextChars` bounds what leaves the building — the
 * context builder truncates to it and says so in the context rather than
 * silently dropping the tail. `maxOutputTokens` bounds what comes back, which
 * is both a cost control and the first defence against section 144's
 * oversized response.
 *
 * **A reasoning model spends this budget on thinking as well as on answering.**
 * Measured against the configured model on a deliberately small context: 786
 * reasoning tokens for 115 tokens of answer. At the first value tried — 1,400
 * — that fits, but only just, and a full-length context would exhaust it: the
 * generation is then truncated mid-JSON, the schema refuses it, and the
 * practitioner sees "could not produce a usable answer" having been billed for
 * the whole call.
 *
 * So the ceiling is set with headroom for the reasoning rather than for the
 * answer. It is still a bound — the answer itself is capped far more tightly
 * by `CLINICAL_AI_RESPONSE_LIMITS`, which is what actually decides how much
 * text reaches a screen.
 */
export const CLINICAL_AI_RUNTIME = {
  timeoutMs: 25_000,
  maxAttempts: 2,
  retryDelayMs: 750,
  temperature: 0.2,
  maxOutputTokens: 3_000,
  /**
   * The ceiling on the serialized clinical context, in characters.
   *
   * Characters rather than tokens deliberately: a token count is the
   * provider's arithmetic and differs per model, and a bound that depends on
   * the provider is a bound that silently changes when the model does. This
   * one is ours, it is checked before anything is sent, and roughly four
   * characters to a token makes it about 3,500 tokens of context.
   */
  maxContextChars: 14_000,
  /**
   * The ceiling on a provider response body, in characters.
   *
   * Applied before parsing, so an oversized response is refused rather than
   * parsed (section 144).
   */
  maxResponseChars: 60_000,
} as const;

/**
 * Bounds on the validated response, applied by the schema.
 *
 * A model that returns forty considerations has not been more helpful; it has
 * produced something no practitioner will read and that costs more to
 * generate. These are caps, not targets.
 */
export const CLINICAL_AI_RESPONSE_LIMITS = {
  maxSummaryChars: 2_400,
  maxItems: 8,
  maxItemChars: 400,
} as const;

/**
 * How much history a context may carry (sections 55-56).
 *
 * "Current consultation + relevant recent history", never the whole record.
 * These bounds are what makes that concrete, and they are deliberately small:
 * a practitioner asking about today's consultation is not helped by six years
 * of it, and every extra row is more of one person's medical history sent to
 * a third party.
 */
export const CLINICAL_AI_CONTEXT_LIMITS = {
  maxPreviousConsultations: 3,
  maxPreviousPrescriptions: 3,
  maxPrescriptionItems: 10,
  maxTreatmentPlans: 2,
  maxTreatmentPlanItems: 10,
  /**
   * How many documents a practitioner may attach to one request.
   *
   * Section 58: authorized documents, explicitly selected, never "every
   * patient document automatically". And what is sent is the **metadata** —
   * kind, title, when it was added — because Phase 14 deliberately stores no
   * text from a file and section 59 forbids adding OCR for this phase. The
   * model is told the document exists, not what it says.
   */
  maxDocuments: 5,
  /** A single free-text field is truncated to this before being sent. */
  maxFieldChars: 1_200,
} as const;

/**
 * The default provider identifier when none is configured.
 *
 * Used only for labelling a mock run; a real deployment sets `AI_PROVIDER`.
 */
export const CLINICAL_AI_MOCK_PROVIDER = "mock";
