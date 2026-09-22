"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  completeClinicalRecordAction,
  saveClinicalDraftAction,
} from "@/features/clinical/actions";
import {
  CLINICAL_FORM_COPY,
  CLINICAL_SECTIONS,
  type ClinicalSectionCopy,
} from "@/features/clinical/content";
import {
  isClinicalRequiredField,
  missingClinicalRequirements,
} from "@/features/clinical/status";
import {
  CLINICAL_FIELDS,
  IDLE_CLINICAL_FORM_STATE,
  type ClinicalContent,
  type ClinicalRecord,
} from "@/features/clinical/types";
import { CLINICAL_FIELD_LIMITS } from "@/features/clinical/validation";

import { SaveStatus, type SaveIndicatorState } from "./save-status";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

/**
 * The consultation workspace's clinical form.
 *
 * ## One form, two actions
 *
 * `Save draft` and `Complete consultation` post the **same eight fields** to
 * two different server actions, which is why there is one `<form>` with two
 * submitters rather than two forms. Two forms would mean two copies of the
 * fields in the DOM, and a practitioner typing into one and completing from
 * the other — a defect that would be invisible until it lost somebody's
 * notes.
 *
 * The completion submitter is a hidden `<button formAction={...}>` **inside**
 * the form, triggered by the dialog's confirm through `requestSubmit`. It has
 * to be inside: `DialogContent` renders in a portal, so a submit button in
 * the dialog is not a descendant of the form and would submit nothing.
 *
 * ## Why this is a client component, and how little of the page is one
 *
 * Section 78: prefer server components, and do not make the whole clinical
 * application client-rendered merely to manage form state. So the page around
 * this is a server component — the patient header, the appointment context,
 * the clinical history and every read are rendered on the server — and this
 * island exists for the four things that genuinely need the browser: tracking
 * whether there are unsaved changes, reporting the save state, confirming
 * completion, and warning before navigation.
 *
 * ## Why not autosave
 *
 * Section 32 lists what autosave has to get right — debouncing, races,
 * offline failure, never silently overwriting newer content, never claiming a
 * save that did not happen — and then says plainly that a reliable explicit
 * `Save draft` is preferable to a fragile autosave system. This is the
 * explicit one. Every save is one request the practitioner asked for, and
 * nothing on screen claims to be saved before the server has said so.
 *
 * ## The version travels with the form
 *
 * `expectedVersion` is a hidden field, and it is safe to render for the
 * reason `validation.ts` gives: it selects a *revision*, never a permission.
 * After a successful save the server returns the new version and this adopts
 * it, so a practitioner can keep typing and save again without reloading.
 *
 * After a **conflict** it adopts nothing and stops offering to save: the
 * notes on screen are no longer a revision of anything the database holds, so
 * saving again would perform exactly the overwrite the conflict prevented
 * (section 34).
 */
export function ConsultationForm({
  record,
}: {
  readonly record: ClinicalRecord;
}) {
  const router = useRouter();

  const [saveState, saveAction, saving] = useActionState(
    saveClinicalDraftAction,
    IDLE_CLINICAL_FORM_STATE,
  );
  const [completeState, completeAction, completing] = useActionState(
    completeClinicalRecordAction,
    IDLE_CLINICAL_FORM_STATE,
  );

  /**
   * The content, held in React rather than left to the DOM.
   *
   * Needed for three things the DOM cannot answer on its own: whether
   * anything has changed since the last save, whether the completion
   * requirements are met, and what the navigation guard should warn about.
   */
  const [content, setContent] = useState<ClinicalContent>(() =>
    pickContent(record),
  );

  /** What the database is known to hold. Changed only by a successful save. */
  const [savedContent, setSavedContent] = useState<ClinicalContent>(() =>
    pickContent(record),
  );
  const [version, setVersion] = useState(record.version);
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  const [completeOpen, setCompleteOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const completeSubmitRef = useRef<HTMLButtonElement>(null);

  /**
   * Adopts a server result during render.
   *
   * React's documented pattern for reacting to a changed value, rather than
   * an effect — so the new version is in place in the same frame as the
   * result. Keyed on the state object's identity, because `useActionState`
   * returns a fresh object per submission and a second attempt after a
   * failure is a separate event.
   */
  const [handledSave, setHandledSave] = useState(saveState);
  if (saveState !== handledSave) {
    setHandledSave(saveState);
    if (saveState.status === "saved" && saveState.version !== undefined) {
      setVersion(saveState.version);
      // What is on screen is now what the database holds, so the form is no
      // longer dirty. Taken from the local content rather than from the
      // response, because the response deliberately carries no clinical data
      // back (section 76).
      setSavedContent(content);
      setSavedAt(saveState.savedAt);
    }
  }

  const [handledComplete, setHandledComplete] = useState(completeState);
  if (completeState !== handledComplete) {
    setHandledComplete(completeState);
    if (completeState.status === "completed") {
      setCompleteOpen(false);
      setSavedContent(content);
      if (completeState.version !== undefined)
        setVersion(completeState.version);
      setSavedAt(completeState.savedAt);
    }
  }

  /**
   * After a completion the whole page changes meaning.
   *
   * The form becomes a read-only record, the appointment becomes completed,
   * and the clinical history gains an entry — all of which are server-rendered
   * from the database. `router.refresh()` re-reads them rather than this
   * component inventing the new state locally, which is example 9's rule: the
   * UI reflects what the server actually holds.
   */
  useEffect(() => {
    if (completeState.status !== "completed") return;
    router.refresh();
  }, [completeState.status, router]);

  const dirty = !sameContent(content, savedContent);
  const conflicted =
    saveState.status === "conflict" || completeState.status === "conflict";
  const missing = missingClinicalRequirements(content);
  const busy = saving || completing;
  const failed =
    saveState.status === "error" || completeState.status === "error";

  const indicator: SaveIndicatorState = conflicted
    ? "failed"
    : completeState.status === "completed"
      ? "completed"
      : busy
        ? "saving"
        : failed
          ? "failed"
          : dirty
            ? "dirty"
            : savedAt
              ? "saved"
              : "idle";

  /**
   * The field-level errors from whichever action produced them.
   *
   * Merged rather than chosen, so a length error raised by a save is not lost
   * when the practitioner then tries to complete.
   */
  const fieldErrors: Record<string, string | undefined> = {
    ...saveState.fieldErrors,
    ...completeState.fieldErrors,
  };

  /**
   * The form-level message.
   *
   * Only ever a failure. A success has the save indicator, and an `Alert`
   * saying "saved" beside an indicator saying "Saved at 14:32" would be two
   * components competing to answer one question.
   */
  const formMessage =
    saveState.status === "conflict" || saveState.status === "error"
      ? saveState.message
      : completeState.status === "conflict" || completeState.status === "error"
        ? completeState.message
        : undefined;

  return (
    <>
      {/*
        Sections 67-68. A sibling of the form rather than part of it, so it
        keeps working while the form is submitting — and it triggers the same
        submit the Save draft button does rather than being a second
        implementation of saving.
      */}
      <UnsavedChangesGuard
        active={dirty && !conflicted}
        saving={saving}
        onSave={() => formRef.current?.requestSubmit()}
      />

      <form ref={formRef} action={saveAction} className="flex flex-col gap-10">
        {/*
          Safe to render. They say *which* record and *which revision*, never
          *whether the caller may*: the practitioner identity, the ownership of
          the record, its editability and the completion rules are all resolved
          server-side and again inside the database function.
        */}
        <input type="hidden" name="recordId" value={record.id} />
        <input type="hidden" name="expectedVersion" value={version} />

        {CLINICAL_SECTIONS.map((section) => (
          <ClinicalFormSection
            key={section.id}
            section={section}
            content={content}
            fieldErrors={fieldErrors}
            disabled={busy || conflicted}
            onChange={(name, value) =>
              setContent((current) => ({ ...current, [name]: value }))
            }
          />
        ))}

        <div className="border-border flex flex-col gap-4 border-t pt-6">
          <SaveStatus state={indicator} savedAt={savedAt} />

          {formMessage ? (
            <Alert
              tone={conflicted ? "warning" : "danger"}
              title={CLINICAL_FORM_COPY.statusFailed}
            >
              {formMessage}
            </Alert>
          ) : null}

          {/*
            Completion needs two fields, and the reason is a sentence rather
            than a control that silently does nothing (sections 37-38). The
            confirm button inside the dialog is what is disabled, so pressing
            "Complete consultation" still opens the dialog and explains.
          */}
          {missing.length > 0 && !conflicted ? (
            <Alert tone="info" title={CLINICAL_FORM_COPY.completeBlockedTitle}>
              {CLINICAL_FORM_COPY.completeBlockedBody}
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              variant="secondary"
              loading={saving}
              loadingLabel={CLINICAL_FORM_COPY.savingLabel}
              disabled={conflicted || completing}
            >
              {CLINICAL_FORM_COPY.saveDraftLabel}
            </Button>

            <Button
              type="button"
              onClick={() => setCompleteOpen(true)}
              disabled={busy || conflicted}
            >
              {CLINICAL_FORM_COPY.completeLabel}
            </Button>
          </div>
        </div>

        {/*
          The completion submitter.

          Hidden and unreachable by keyboard or assistive technology — it is a
          mechanism, not a control. It exists because `DialogContent` renders
          in a portal: a submit button inside the dialog is not a descendant of
          this form, so it could not carry these fields. `requestSubmit` with
          this as the submitter is what routes the same eight fields to the
          completion action instead of the save action.
        */}
        <button
          ref={completeSubmitRef}
          type="submit"
          formAction={completeAction}
          hidden
          tabIndex={-1}
          aria-hidden
        >
          {CLINICAL_FORM_COPY.completeLabel}
        </button>
      </form>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <div className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>
                {CLINICAL_FORM_COPY.completeDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {CLINICAL_FORM_COPY.completeDialogBody}
              </DialogDescription>
            </DialogHeader>

            {missing.length > 0 ? (
              <Alert
                tone="warning"
                title={CLINICAL_FORM_COPY.completeBlockedTitle}
              >
                {CLINICAL_FORM_COPY.completeBlockedBody}
              </Alert>
            ) : null}

            {completeState.status === "error" && completeState.message ? (
              <Alert tone="danger" title={CLINICAL_FORM_COPY.statusFailed}>
                {completeState.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCompleteOpen(false)}
              >
                {CLINICAL_FORM_COPY.completeDialogDismiss}
              </Button>
              <Button
                type="button"
                loading={completing}
                loadingLabel={CLINICAL_FORM_COPY.completingLabel}
                disabled={missing.length > 0 || completing}
                onClick={() =>
                  formRef.current?.requestSubmit(completeSubmitRef.current)
                }
              >
                {CLINICAL_FORM_COPY.completeDialogConfirm}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * One titled group of clinical fields.
 *
 * Sections 27, 31 and 66: clear section headings, textareas for narrative
 * notes, logical grouping, and not one giant undifferentiated form. Three
 * groups of two or three fields each, in the order a consultation runs.
 *
 * A real `<fieldset>` with a `<legend>`, so the group's name is part of each
 * field's context rather than a visual heading a screen reader passes over.
 */
function ClinicalFormSection({
  section,
  content,
  fieldErrors,
  disabled,
  onChange,
}: {
  readonly section: ClinicalSectionCopy;
  readonly content: ClinicalContent;
  readonly fieldErrors: Readonly<Record<string, string | undefined>>;
  readonly disabled: boolean;
  readonly onChange: (name: keyof ClinicalContent, value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-h4 text-heading font-sans font-medium">
        {section.title}
      </legend>
      <p className="text-body-sm text-muted-foreground measure mt-1">
        {section.description}
      </p>

      <div className="mt-5 flex flex-col gap-6">
        {section.fields.map((field) => (
          <Field
            key={field.name}
            name={field.name}
            label={field.label}
            description={field.description}
            error={fieldErrors[field.name]}
            disabled={disabled}
            /*
              Marked required *for completion*. `Field` renders the marker and
              sets `aria-required`, and the control is deliberately not
              `required` in the HTML sense: a draft may be incomplete (section
              15), and a browser refusing to submit would make "save what I
              have so far" impossible — which is the whole point of a draft.
            */
            required={isClinicalRequiredField(field.name)}
          >
            {(control) => (
              <Textarea
                {...control}
                /*
                  **Required for completion, not for saving.**

                  `Field` marks the field and sets `aria-required`, and this
                  turns the *HTML* attribute back off — deliberately, and
                  after the spread so it wins.

                  With it on, the browser's own constraint validation refuses
                  to submit the form while either required field is empty,
                  which is precisely the state a draft exists to hold
                  (section 15). A practitioner who had written half a history
                  and no assessment would press "Save draft" and get nothing:
                  no request, no error, no saved notes.

                  Found by `tests/components/clinical.test.tsx`, which
                  measured zero submissions and no `submit` event at all.
                */
                required={false}
                rows={field.rows}
                maxLength={CLINICAL_FIELD_LIMITS[field.name]}
                value={content[field.name]}
                onChange={(event) => onChange(field.name, event.target.value)}
                spellCheck
                /*
                  Never offer a stored suggestion from another patient's
                  consultation on a shared consulting-room machine, and keep
                  password managers out of a clinical field.
                */
                autoComplete="off"
                data-1p-ignore
              />
            )}
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

/** The eight clinical fields, lifted off a record. */
function pickContent(record: ClinicalRecord): ClinicalContent {
  return {
    chiefComplaint: record.chiefComplaint,
    historyOfPresentingConcern: record.historyOfPresentingConcern,
    symptoms: record.symptoms,
    clinicalObservations: record.clinicalObservations,
    assessment: record.assessment,
    diagnosisOrClinicalImpression: record.diagnosisOrClinicalImpression,
    doctorNotes: record.doctorNotes,
    followUpNotes: record.followUpNotes,
  };
}

/**
 * Whether two sets of content are the same.
 *
 * Compares **trimmed** values, because the database normalises whitespace the
 * same way — so a trailing newline the practitioner did not mean to type does
 * not make the form claim unsaved changes forever, and the navigation guard
 * does not warn about a difference that would not survive a save.
 */
export function sameContent(a: ClinicalContent, b: ClinicalContent): boolean {
  return CLINICAL_FIELDS.every((field) => a[field].trim() === b[field].trim());
}
