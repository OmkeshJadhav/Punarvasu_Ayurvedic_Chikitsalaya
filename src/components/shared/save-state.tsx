"use client";

import { Check, CircleAlert, Clock, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A save indicator that never lies.
 *
 * ## Why this is shared
 *
 * Three clinical surfaces now hold a draft a practitioner can lose — the
 * consultation notes (Phase 12), the prescription and the treatment plan
 * (Phase 13) — and every one of them owes the same promise: the words on
 * screen say what the *server* did, not what the button was pressed. One
 * component keeps that promise identical on all three, and keeps the failure
 * wording from drifting apart.
 *
 * Only the words differ per surface, so they are a prop.
 *
 * ## The rules the states encode
 *
 * ```text
 * idle     nothing to lose
 * dirty    work is at risk        (warning tone)
 * saving   a request is in flight
 * saved    it is in the database, and when
 * failed   it was refused, and the changes are still on screen
 * done     the deliberate act succeeded - issued, completed, given
 * ```
 *
 * `saved` carries a **time**, because "Saved" with no time is
 * indistinguishable from "Saved half an hour ago". It is produced only after
 * the action has returned success, never on submit.
 *
 * It is a `role="status"` live region rather than a toast: a toast that has
 * faded cannot answer "did that save?", and that is the one question this
 * answers.
 */
export type SaveStateKind =
  "idle" | "dirty" | "saving" | "saved" | "failed" | "done";

export interface SaveStateLabels {
  readonly idle: string;
  readonly dirty: string;
  readonly saving: string;
  readonly failed: string;
  readonly done: string;
  readonly saved: (time: string) => string;
  readonly regionLabel: string;
}

const PRESENTATION: Readonly<
  Record<
    SaveStateKind,
    { readonly className: string; readonly Icon: typeof Check }
  >
> = {
  idle: { className: "text-muted-foreground", Icon: PencilLine },
  // Never colour alone: the icon changes with the state as well as the tone.
  dirty: { className: "text-warning", Icon: CircleAlert },
  saving: { className: "text-muted-foreground", Icon: Clock },
  saved: { className: "text-success", Icon: Check },
  failed: { className: "text-destructive", Icon: CircleAlert },
  done: { className: "text-success", Icon: Check },
};

export function SaveState({
  state,
  labels,
  savedAt,
  className,
}: {
  readonly state: SaveStateKind;
  readonly labels: SaveStateLabels;
  readonly savedAt?: number | undefined;
  readonly className?: string;
}) {
  const presentation = PRESENTATION[state];
  const Icon = presentation.Icon;

  return (
    <p
      role="status"
      aria-live="polite"
      aria-label={labels.regionLabel}
      className={cn(
        "text-body-sm inline-flex items-center gap-2 font-sans",
        presentation.className,
        className,
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>{describe(state, labels, savedAt)}</span>
    </p>
  );
}

function describe(
  state: SaveStateKind,
  labels: SaveStateLabels,
  savedAt: number | undefined,
): string {
  switch (state) {
    case "saved":
      return labels.saved(formatSavedTime(savedAt));
    case "dirty":
      return labels.dirty;
    case "saving":
      return labels.saving;
    case "failed":
      return labels.failed;
    case "done":
      return labels.done;
    case "idle":
      return labels.idle;
  }
}

function formatSavedTime(savedAt: number | undefined): string {
  if (!savedAt) return "";
  return new Date(savedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
