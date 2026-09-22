"use client";

import {
  SaveState,
  type SaveStateLabels,
} from "@/components/shared/save-state";
import { CLINICAL_FORM_COPY } from "@/features/clinical/content";

/**
 * The consultation form's save indicator.
 *
 * The presentation moved into `components/shared/save-state.tsx` in Phase 13,
 * when the prescription and treatment plan builders needed exactly the same
 * promise — the words say what the *server* did, not what the button was
 * pressed. This is now the clinical copy bound to that component; the state
 * names, the rendered words and this module's public API are unchanged.
 */
export type SaveIndicatorState =
  "idle" | "dirty" | "saving" | "saved" | "failed" | "completed";

const LABELS: SaveStateLabels = {
  idle: CLINICAL_FORM_COPY.statusIdle,
  dirty: CLINICAL_FORM_COPY.statusDirty,
  saving: CLINICAL_FORM_COPY.statusSaving,
  failed: CLINICAL_FORM_COPY.statusFailed,
  done: CLINICAL_FORM_COPY.statusCompleted,
  saved: CLINICAL_FORM_COPY.statusSaved,
  regionLabel: CLINICAL_FORM_COPY.statusRegionLabel,
};

export function SaveStatus({
  state,
  savedAt,
  className,
}: {
  readonly state: SaveIndicatorState;
  readonly savedAt?: number | undefined;
  readonly className?: string;
}) {
  return (
    <SaveState
      state={state === "completed" ? "done" : state}
      labels={LABELS}
      savedAt={savedAt}
      className={className}
    />
  );
}
