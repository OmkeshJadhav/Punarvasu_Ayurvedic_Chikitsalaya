/**
 * The clinical AI domain model.
 *
 * ## The boundary this file holds
 *
 * ```text
 * Clinical record   what the practitioner decided   -> features/clinical
 * AI assistance     what a model said about it      -> here
 * ```
 *
 * Nothing in this file is, or can become, a clinical record. There is no
 * `save`, no `apply`, no `accept` and no type that could carry an AI result
 * into `ClinicalContent` — section 23 and example 8. What a practitioner does
 * with a result is read it, and then type their own words into the
 * consultation form, which is the only thing that writes a clinical record.
 *
 * ## No confidence, anywhere
 *
 * Sections 30, 31. There is no `confidence`, `probability`, `likelihood`,
 * `severity` or `score` field on any type here, so there is nothing for a UI
 * to render as diagnostic certainty and nothing for a model's output to be
 * mapped into.
 *
 * ## Why the context types exist at all
 *
 * The context builder's output is the thing that leaves the building, so it is
 * worth having a type that says exactly what that is. Reading
 * {@link ClinicalAIContext} tells you the complete set of fields any patient's
 * data can be sent as — which is a claim you can check by reading one file
 * rather than by tracing a serializer.
 */

import type { ClinicalAISection, ClinicalAITask } from "@/config/clinical-ai";
import type { ClinicalAIFailureCode } from "@/lib/ai/provider";

export type { ClinicalAISection, ClinicalAITask, ClinicalAIFailureCode };

/**
 * A validated, safety-checked result, ready to render.
 *
 * Every string has been through the response schema's sanitizer, so it
 * contains no control characters, no zero-width characters and no
 * bidirectional overrides. It is rendered as text nodes and never as HTML
 * (section 39).
 */
export interface ClinicalAIResult {
  readonly task: ClinicalAITask;
  readonly summary: string | null;
  readonly considerations: readonly string[];
  readonly missingInformation: readonly string[];
  readonly warnings: readonly string[];
  /**
   * What the model was actually given, in the practitioner's terms.
   *
   * Sections 41 and 132: show which context was considered, so the reader can
   * tell source data from generated interpretation. It lists **kinds** of
   * context — "this consultation", "two previous consultations" — never the
   * content.
   */
  readonly contextSources: readonly string[];
  /**
   * The context this result was generated from (sections 84-85).
   *
   * Compared against the consultation's current fingerprint on every render.
   * When they differ, the result is marked stale and the practitioner is asked
   * to regenerate rather than being left to assume it is current.
   */
  readonly contextFingerprint: string;
  /** Which model said it, shown beside the result (section 124). */
  readonly model: string;
  readonly promptVersion: string;
  readonly generatedAt: number;
}

/** What a generation attempt produced. */
export type ClinicalAIOutcome =
  | { readonly status: "ok"; readonly result: ClinicalAIResult }
  | {
      readonly status: "failed";
      readonly failureCode: ClinicalAIFailureCode;
      /** Safe to render. Never provider text, never a stack trace. */
      readonly message: string;
    };

/**
 * Whether the feature can be used at all, and why not when it cannot.
 *
 * Four states, and they need four different sentences. "Not configured" is an
 * ordinary state of a deployment; "you are not on the roster" is about this
 * account; "unavailable" is a provider problem; "ready" is ready. Collapsing
 * them produces the message that sends somebody to check the wrong thing.
 */
export type ClinicalAIAvailability =
  | { readonly status: "ready"; readonly usage: ClinicalAIUsage }
  | { readonly status: "not_configured" }
  | { readonly status: "no_practitioner_record" }
  | { readonly status: "unavailable" };

/** The caller's own quota, for the panel (section 104). */
export interface ClinicalAIUsage {
  readonly used: number;
  readonly allowed: number;
  readonly windowMinutes: number;
}

/*
 * ---------------------------------------------------------------------------
 * The context — everything that can ever leave the building
 * ---------------------------------------------------------------------------
 */

/**
 * The patient, as the model sees them.
 *
 * **No name, no phone number, no address, no email, no date of birth, no
 * identifier of any kind.** Section 61 asks for de-identification where
 * feasible without removing what the clinical task needs, and for the strategy
 * to be documented. This is the strategy:
 *
 *   * `ageYears` and `gender` stay, because age and sex are clinically
 *     relevant to almost any Ayurvedic or biomedical consideration, and
 *     removing them would degrade the task rather than protect the patient;
 *   * everything that identifies *which person* this is, goes.
 *
 * What remains is a clinical picture that is still sensitive and no longer
 * names anybody. A practitioner reading the result knows who it is about
 * because they opened the consultation; the provider does not, and cannot join
 * it to anything.
 *
 * Age is a **number of years**, not a date of birth: a date of birth is a
 * direct identifier and is one of the fields that re-identifies a
 * pseudonymised record most easily.
 */
export interface ClinicalAIPatientContext {
  readonly ageYears: number | null;
  readonly gender: string | null;
}

/** The consultation being documented, as the model sees it. */
export interface ClinicalAIConsultationContext {
  readonly recordedOn: string;
  readonly appointmentType: string;
  readonly status: string;
  readonly chiefComplaint: string | null;
  readonly historyOfPresentingConcern: string | null;
  readonly symptoms: string | null;
  readonly clinicalObservations: string | null;
  readonly assessment: string | null;
  readonly diagnosisOrClinicalImpression: string | null;
  readonly doctorNotes: string | null;
  readonly followUpNotes: string | null;
}

/** An earlier consultation, summarised (sections 55-56). */
export interface ClinicalAIHistoryEntry {
  readonly occurredOn: string;
  readonly appointmentType: string;
  readonly chiefComplaint: string | null;
  readonly assessment: string | null;
  readonly diagnosisOrClinicalImpression: string | null;
}

/** A prescription, as context. No patient, no practitioner, no identifier. */
export interface ClinicalAIPrescriptionContext {
  readonly issuedOn: string;
  readonly status: string;
  readonly items: readonly string[];
  readonly generalInstructions: string | null;
}

export interface ClinicalAITreatmentPlanContext {
  readonly status: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly items: readonly string[];
}

/**
 * A document the practitioner explicitly attached (section 58).
 *
 * **Metadata only.** Phase 14 stores no text extracted from a file and section
 * 59 forbids adding OCR for this phase, so there is nothing else to send. The
 * model is told a lab report dated the 3rd exists; it is not told what the
 * report says, and it is told so explicitly in the context so it does not
 * assume otherwise.
 *
 * No storage path, no file name, no MIME type, no size, no identifier
 * (section 60).
 */
export interface ClinicalAIDocumentContext {
  readonly kind: string;
  readonly title: string;
  readonly description: string | null;
  readonly addedOn: string;
  readonly addedBy: "patient" | "practitioner";
}

/**
 * Everything a request can carry.
 *
 * This type is the data-minimization claim, written down. If a field is not
 * here, it is not sent — and a reviewer can check that by reading this
 * interface rather than by auditing a serializer.
 */
export interface ClinicalAIContext {
  readonly patient: ClinicalAIPatientContext;
  readonly consultation: ClinicalAIConsultationContext | null;
  readonly previousConsultations: readonly ClinicalAIHistoryEntry[];
  readonly prescriptions: readonly ClinicalAIPrescriptionContext[];
  readonly treatmentPlans: readonly ClinicalAITreatmentPlanContext[];
  readonly documents: readonly ClinicalAIDocumentContext[];
  /** Kinds of context included, for the "Based on" block (section 41). */
  readonly sources: readonly string[];
  /** Sections 84-85. */
  readonly fingerprint: string;
  /**
   * Whether the serialized context had to be truncated to fit the bound.
   *
   * Surfaced in the prompt, so a model working from a shortened history is
   * told that it is — rather than being left to treat an incomplete record as
   * a complete one, which is precisely how a hallucinated "no relevant
   * history" gets generated (sections 55, 128).
   */
  readonly truncated: boolean;
}

/** What the builder can return. */
export type ClinicalAIContextResult =
  | { readonly status: "ok"; readonly context: ClinicalAIContext }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

/**
 * The client-visible state of the AI panel.
 *
 * `result` is held in React state only. It is not written to `localStorage`,
 * not written to `sessionStorage`, not put in the URL and not persisted in the
 * database (sections 25, 28). Navigating away loses it, and the panel says so
 * — which is honest, and is what section 382 of this project's habits would
 * call the state telling the truth.
 */
export interface ClinicalAIPanelState {
  readonly status: "idle" | "ok" | "failed";
  readonly result?: ClinicalAIResult;
  readonly message?: string;
  /** Distinguishes a refused request from a provider failure, for the copy. */
  readonly failureCode?: ClinicalAIFailureCode;
}

export const IDLE_CLINICAL_AI_STATE: ClinicalAIPanelState = { status: "idle" };
