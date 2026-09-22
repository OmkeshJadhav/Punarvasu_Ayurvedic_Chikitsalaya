"use client";

import {
  UnsavedChangesGuard as SharedUnsavedChangesGuard,
  type UnsavedChangesCopy,
} from "@/components/shared/unsaved-changes-guard";
import { CLINICAL_FORM_COPY } from "@/features/clinical/content";

/**
 * The consultation form's unsaved-changes guard.
 *
 * The mechanism moved into `components/shared/unsaved-changes-guard.tsx` in
 * Phase 13, when the prescription and treatment plan builders needed the same
 * behaviour with different words. This is the clinical copy bound to it; the
 * behaviour, the rendered words and this module's public API are unchanged.
 */
const COPY: UnsavedChangesCopy = {
  title: CLINICAL_FORM_COPY.leaveDialogTitle,
  body: CLINICAL_FORM_COPY.leaveDialogBody,
  stay: CLINICAL_FORM_COPY.leaveStay,
  saveAndGo: CLINICAL_FORM_COPY.leaveSaveAndGo,
  discard: CLINICAL_FORM_COPY.leaveDiscard,
  beforeUnload: CLINICAL_FORM_COPY.beforeUnload,
};

export function UnsavedChangesGuard({
  active,
  saving,
  onSave,
}: {
  readonly active: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
}) {
  return (
    <SharedUnsavedChangesGuard
      active={active}
      saving={saving}
      onSave={onSave}
      copy={COPY}
    />
  );
}
