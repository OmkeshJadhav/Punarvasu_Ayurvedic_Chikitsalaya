"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CLINICAL_AI_TASKS,
  CLINICAL_AI_TASK_COPY,
  type ClinicalAITask,
} from "@/config/clinical-ai";
import { generateClinicalAIAction } from "@/features/clinical-ai/actions";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";
import {
  IDLE_CLINICAL_AI_STATE,
  type ClinicalAIUsage,
} from "@/features/clinical-ai/types";

import {
  ClinicalAIBoundaryNotice,
  ClinicalAIDisclaimer,
} from "./ai-disclaimer";
import { ClinicalAIResultView } from "./ai-result";

export interface SelectableDocument {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly addedOn: string;
}

/**
 * The AI clinical support panel.
 *
 * ## It looks like a clinical tool, not a chatbot
 *
 * Section 77. No chat bubbles, no avatar, no gradient, no typing animation, no
 * conversation history. It is a form with a purpose, a context selection and a
 * result — the shape section 78 sketches — built entirely from the Punarvasu
 * design system's existing primitives and tokens. Nothing here introduces a
 * colour, a radius or a spacing value.
 *
 * ## It is secondary, and the layout says so
 *
 * Section 135: AI must not dominate the doctor's workflow. It is a separate
 * route reached from the consultation rather than a block inside it, so a
 * practitioner who never opens it never sees it, and the consultation page is
 * exactly as it was before this phase.
 *
 * ## One form, and what it carries
 *
 * An appointment id, a task, three checkboxes and the selected document ids.
 * There is no model selector, no temperature control, no prompt box and no
 * patient field, because none of those is a parameter the server accepts
 * (sections 79, 80, 92, 93).
 *
 * ## The result lives in React state and nowhere else
 *
 * Sections 25, 28. Not `localStorage`, not `sessionStorage`, not the URL, not
 * the database. Leaving the page loses it, and the panel says so rather than
 * letting a practitioner assume otherwise.
 */
export function ClinicalAISupportPanel({
  appointmentId,
  currentFingerprint,
  usage,
  documents,
}: {
  readonly appointmentId: string;
  readonly currentFingerprint: string | null;
  readonly usage: ClinicalAIUsage;
  readonly documents: readonly SelectableDocument[];
}) {
  const [state, formAction] = useActionState(
    generateClinicalAIAction,
    IDLE_CLINICAL_AI_STATE,
  );

  const [task, setTask] = useState<ClinicalAITask>("clinical_summary");
  const resultRef = useRef<HTMLDivElement>(null);

  // Focus management (section 136). When a result arrives the practitioner's
  // attention should move to it — but focus goes to the region, not to a
  // control inside it, so a keyboard user lands at the top of what was
  // generated rather than on its Copy button.
  useEffect(() => {
    if (state.status === "ok") resultRef.current?.focus();
  }, [state.status, state.result?.generatedAt]);

  /*
   * Sections 84-85. A result is stale when the consultation has moved on since
   * it was generated. Both fingerprints are computed by the same function over
   * the same inputs, so they differ if and only if something that would change
   * the answer has changed.
   *
   * A null current fingerprint means we could not recompute it. That is
   * treated as *not* stale rather than as stale: marking a perfectly good
   * result stale because a count query failed would train practitioners to
   * ignore the banner, which is worse than the rare case it would catch.
   */
  const stale =
    state.status === "ok" &&
    currentFingerprint !== null &&
    state.result !== undefined &&
    state.result.contextFingerprint !== currentFingerprint;

  const quotaReached = usage.used >= usage.allowed;

  return (
    <div className="flex flex-col gap-8">
      <ClinicalAIDisclaimer />

      <form action={formAction} className="flex flex-col gap-8">
        <input type="hidden" name="appointmentId" value={appointmentId} />

        <fieldset className="flex flex-col gap-4">
          <legend className="text-label text-heading font-sans">
            {CLINICAL_AI_COPY.taskHeading}
          </legend>

          <div className="flex flex-col gap-3">
            {CLINICAL_AI_TASKS.map((option) => (
              <label
                key={option}
                className="border-border hover:bg-muted focus-within:outline-ring flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2"
              >
                <input
                  type="radio"
                  name="task"
                  value={option}
                  checked={task === option}
                  onChange={() => setTask(option)}
                  className="accent-primary mt-1 size-4 shrink-0"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-body text-foreground font-sans font-medium">
                    {CLINICAL_AI_TASK_COPY[option].label}
                  </span>
                  <span className="text-body-sm text-muted-foreground">
                    {CLINICAL_AI_TASK_COPY[option].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-label text-heading font-sans">
            {CLINICAL_AI_COPY.contextHeading}
          </legend>
          <p className="text-body-sm text-muted-foreground measure">
            {CLINICAL_AI_COPY.contextDescription}
          </p>

          <div className="flex flex-col gap-3">
            <ContextToggle
              name="includeHistory"
              defaultChecked
              label={CLINICAL_AI_COPY.contextOptions.history.label}
              description={CLINICAL_AI_COPY.contextOptions.history.description}
            />
            <ContextToggle
              name="includePrescriptions"
              defaultChecked
              label={CLINICAL_AI_COPY.contextOptions.prescriptions.label}
              description={
                CLINICAL_AI_COPY.contextOptions.prescriptions.description
              }
            />
            <ContextToggle
              name="includeTreatmentPlans"
              label={CLINICAL_AI_COPY.contextOptions.treatmentPlans.label}
              description={
                CLINICAL_AI_COPY.contextOptions.treatmentPlans.description
              }
            />
          </div>

          {documents.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-body text-foreground font-sans font-medium">
                {CLINICAL_AI_COPY.contextOptions.documents.label}
              </p>
              <p className="text-body-sm text-muted-foreground measure">
                {CLINICAL_AI_COPY.contextOptions.documents.description}
              </p>
              <ul className="flex flex-col gap-2">
                {documents.map((document) => (
                  <li key={document.id}>
                    <label className="text-body-sm text-foreground flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        name="documentIds"
                        value={document.id}
                        className="accent-primary size-4 shrink-0"
                      />
                      <span>
                        {document.title}{" "}
                        <span className="text-muted-foreground">
                          ({document.kind}, {document.addedOn})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-3">
          <GenerateButton
            disabled={quotaReached}
            hasResult={state.status === "ok"}
          />
          <p className="text-body-sm text-muted-foreground">
            {CLINICAL_AI_COPY.usageLabel(
              usage.used,
              usage.allowed,
              usage.windowMinutes,
            )}
          </p>
        </div>
      </form>

      {/*
        Section 83 and example 10. A failure is a message beside the control.
        Nothing about the consultation changes, and the copy says so — which is
        the first thing a practitioner mid-consultation needs to know.
      */}
      {state.status === "failed" && state.message ? (
        <Alert tone="danger" title={CLINICAL_AI_COPY.unavailable.title}>
          {state.message}
        </Alert>
      ) : null}

      {state.status === "ok" && state.result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          className="focus-visible:outline-ring rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ClinicalAIResultView result={state.result} stale={stale} />
        </div>
      ) : (
        <Alert tone="info" title={CLINICAL_AI_COPY.emptyResult.title}>
          {CLINICAL_AI_COPY.emptyResult.body}
        </Alert>
      )}

      <ClinicalAIBoundaryNotice />
    </div>
  );
}

/**
 * A context toggle.
 *
 * A native checkbox with a real `<label>`, rather than a styled `div`. It is
 * keyboard operable and announced correctly for free, the whole row is the
 * hit area, and the row is at least 44px tall — the same standard every form
 * in this project holds to.
 */
function ContextToggle({
  name,
  label,
  description,
  defaultChecked = false,
}: {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary mt-1 size-4 shrink-0"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-foreground font-sans">{label}</span>
        <span className="text-body-sm text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * The submit control and the loading state.
 *
 * `useFormStatus` rather than a state flag, so "is a request in flight" is
 * answered by the form itself and cannot drift from the truth.
 *
 * Section 81: the label says what is happening — analysing the information you
 * selected — and never "diagnosis in progress". Section 138 asks that the
 * consultation interface not freeze: it does not, because this is a separate
 * route and the practitioner can navigate back to their notes at any point
 * while a request is in flight.
 */
function GenerateButton({
  disabled,
  hasResult,
}: {
  readonly disabled: boolean;
  readonly hasResult: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="submit" loading={pending} disabled={disabled || pending}>
          {hasResult
            ? CLINICAL_AI_COPY.regenerateLabel
            : CLINICAL_AI_COPY.generateLabel}
        </Button>
      </div>

      {/*
        An announced live region rather than a spinner alone (section 136). It
        is present in the tree at all times so a screen reader announces the
        change rather than the region's arrival.
      */}
      <p
        role="status"
        aria-live="polite"
        aria-label={CLINICAL_AI_COPY.loadingRegionLabel}
        className="text-body-sm text-muted-foreground inline-flex min-h-5 items-center gap-2"
      >
        {pending ? (
          <>
            <Loader2
              aria-hidden
              className="size-4 shrink-0 motion-safe:animate-spin"
            />
            {CLINICAL_AI_COPY.loading}
          </>
        ) : null}
      </p>
    </div>
  );
}
