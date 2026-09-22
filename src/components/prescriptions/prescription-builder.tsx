"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { SaveState, type SaveStateKind } from "@/components/shared/save-state";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelPrescriptionAction,
  issuePrescriptionAction,
  savePrescriptionDraftAction,
} from "@/features/prescriptions/actions";
import {
  PRESCRIPTION_BUILDER_COPY,
  PRESCRIPTION_ITEM_FIELD_COPY,
} from "@/features/prescriptions/content";
import { prescriptionIssueBlocker } from "@/features/prescriptions/status";
import {
  EMPTY_PRESCRIPTION_ITEM,
  IDLE_PRESCRIPTION_FORM_STATE,
  PRESCRIPTION_ITEM_FIELDS,
  type Prescription,
  type PrescriptionItemContent,
} from "@/features/prescriptions/types";
import {
  CANCELLATION_REASON_LIMIT,
  dropBlankPrescriptionItems,
  GENERAL_INSTRUCTIONS_LIMIT,
  PRESCRIPTION_FIELD_LIMITS,
} from "@/features/prescriptions/validation";
import { MedicineNameField } from "./medicine-name-field";
import { PrescriptionItems } from "./prescription-summary";

/**
 * The prescription builder (`phase_13.md` sections 64-67).
 *
 * ```text
 * Add medicine -> dose -> frequency -> timing -> duration -> instructions
 *              -> add another -> Save draft -> Review -> Issue
 * ```
 *
 * ## What the doctor decides, and what the system decides
 *
 * Everything clinical is typed. Nothing is preselected, nothing is inferred
 * from the patient, and no field is filled from anywhere but the doctor's own
 * keyboard — except the medicine suggestions, which offer *names this doctor
 * has written before* and are never applied without a deliberate pick.
 * Sections 5, 6 and 63.
 *
 * ## Why the review renders from the saved snapshot
 *
 * `issue_prescription` takes **no content** — it sends an id and a revision —
 * so what gets issued is whatever the database already holds. The review
 * therefore renders `saved`, not what is in the inputs, and issuing is
 * refused while the form is dirty. A review that showed unsaved edits would
 * be showing something that is not going to be issued, which is the one thing
 * a review must never do.
 *
 * ## Concurrency
 *
 * Every write carries the revision it edited. A stale save is refused as a
 * **conflict**, and the form then stops offering to save at all and asks for
 * a reload — because saving again would perform exactly the overwrite the
 * refusal prevented.
 */

interface DraftItem extends PrescriptionItemContent {
  /** A stable React key. Never sent, never stored. */
  readonly key: string;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `item-${keyCounter}`;
}

function toDraft(items: readonly PrescriptionItemContent[]): DraftItem[] {
  const drafts = items.map((item) => ({
    ...stripToContent(item),
    key: nextKey(),
  }));
  // One empty card at the end, so "add another" is one click rather than two.
  return drafts.length > 0
    ? drafts
    : [{ ...EMPTY_PRESCRIPTION_ITEM, key: nextKey() }];
}

function stripToContent(
  item: PrescriptionItemContent,
): PrescriptionItemContent {
  return {
    medicineName: item.medicineName,
    form: item.form,
    strength: item.strength,
    doseAmount: item.doseAmount,
    doseUnit: item.doseUnit,
    frequency: item.frequency,
    timing: item.timing,
    duration: item.duration,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    instructions: item.instructions,
  };
}

function sameItems(
  a: readonly PrescriptionItemContent[],
  b: readonly PrescriptionItemContent[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    return PRESCRIPTION_ITEM_FIELDS.every(
      (field) => item[field].trim() === other[field].trim(),
    );
  });
}

export function PrescriptionBuilder({
  prescription,
}: {
  readonly prescription: Prescription;
}) {
  const router = useRouter();
  const listId = useId();

  const [saveState, saveAction, saving] = useActionState(
    savePrescriptionDraftAction,
    IDLE_PRESCRIPTION_FORM_STATE,
  );
  const [issueState, issueAction, issuing] = useActionState(
    issuePrescriptionAction,
    IDLE_PRESCRIPTION_FORM_STATE,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelPrescriptionAction,
    IDLE_PRESCRIPTION_FORM_STATE,
  );

  const [items, setItems] = useState<DraftItem[]>(() =>
    toDraft(prescription.items),
  );
  const [instructions, setInstructions] = useState(
    prescription.generalInstructions,
  );

  const [saved, setSaved] = useState<{
    items: readonly PrescriptionItemContent[];
    instructions: string;
  }>(() => ({
    items: dropBlankPrescriptionItems(prescription.items.map(stripToContent)),
    instructions: prescription.generalInstructions,
  }));

  const [version, setVersion] = useState(prescription.version);
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  // Reconcile an action result exactly once, during render rather than in an
  // effect — the React-documented pattern for deriving state from a changed
  // prop, and it avoids a frame in which the form reports itself dirty after
  // a successful save.
  const [handledSave, setHandledSave] = useState(saveState);
  if (saveState !== handledSave) {
    setHandledSave(saveState);
    if (saveState.status === "saved" && saveState.version !== undefined) {
      setVersion(saveState.version);
      // Taken from local state rather than from the response, because the
      // response deliberately carries no clinical content back.
      setSaved({
        items: dropBlankPrescriptionItems(items.map(stripToContent)),
        instructions,
      });
      setSavedAt(saveState.savedAt);
    }
  }

  const [handledIssue, setHandledIssue] = useState(issueState);
  if (issueState !== handledIssue) {
    setHandledIssue(issueState);
    if (issueState.status === "issued") {
      setIssueOpen(false);
      if (issueState.version !== undefined) setVersion(issueState.version);
      setSavedAt(issueState.savedAt);
    }
  }

  const [handledCancel, setHandledCancel] = useState(cancelState);
  if (cancelState !== handledCancel) {
    setHandledCancel(cancelState);
    if (cancelState.status === "cancelled") setCancelOpen(false);
  }

  // The page re-renders read-only once the server confirms. Never before:
  // the UI reflects server state, it does not predict it (example 3).
  useEffect(() => {
    if (issueState.status !== "issued" && cancelState.status !== "cancelled") {
      return;
    }
    router.refresh();
  }, [issueState.status, cancelState.status, router]);

  const liveItems = dropBlankPrescriptionItems(items.map(stripToContent));
  const dirty =
    !sameItems(liveItems, saved.items) ||
    instructions.trim() !== saved.instructions.trim();

  const conflicted =
    saveState.status === "conflict" ||
    issueState.status === "conflict" ||
    cancelState.status === "conflict";

  const busy = saving || issuing || cancelling;
  const failed =
    saveState.status === "error" ||
    issueState.status === "error" ||
    cancelState.status === "error";

  const indicator: SaveStateKind = conflicted
    ? "failed"
    : issueState.status === "issued"
      ? "done"
      : busy
        ? "saving"
        : failed
          ? "failed"
          : dirty
            ? "dirty"
            : savedAt
              ? "saved"
              : "idle";

  const blocker = prescriptionIssueBlocker(
    prescription.status,
    saved.items,
    dirty,
  );

  const formMessage =
    saveState.status === "conflict" || saveState.status === "error"
      ? saveState.message
      : issueState.status === "conflict" || issueState.status === "error"
        ? issueState.message
        : cancelState.status === "conflict" || cancelState.status === "error"
          ? cancelState.message
          : undefined;

  const fieldErrors: Record<string, string | undefined> = {
    ...saveState.fieldErrors,
  };

  function updateItem(
    key: string,
    field: keyof PrescriptionItemContent,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { ...EMPTY_PRESCRIPTION_ITEM, key: nextKey() },
    ]);
  }

  function removeItem(key: string) {
    setItems((current) => {
      const next = current.filter((item) => item.key !== key);
      // Never leave the builder with nothing to type into.
      return next.length > 0
        ? next
        : [{ ...EMPTY_PRESCRIPTION_ITEM, key: nextKey() }];
    });
  }

  function move(key: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const moved = next[index];
      const displaced = next[target];
      if (!moved || !displaced) return current;
      next[index] = displaced;
      next[target] = moved;
      return next;
    });
  }

  return (
    <>
      <UnsavedChangesGuard
        active={dirty && !conflicted}
        saving={saving}
        onSave={() => formRef.current?.requestSubmit()}
        copy={{
          title: PRESCRIPTION_BUILDER_COPY.leaveDialogTitle,
          body: PRESCRIPTION_BUILDER_COPY.leaveDialogBody,
          stay: PRESCRIPTION_BUILDER_COPY.leaveStay,
          saveAndGo: PRESCRIPTION_BUILDER_COPY.leaveSaveAndGo,
          discard: PRESCRIPTION_BUILDER_COPY.leaveDiscard,
          beforeUnload: PRESCRIPTION_BUILDER_COPY.beforeUnload,
        }}
      />

      <form ref={formRef} action={saveAction} className="flex flex-col gap-8">
        {/*
          Safe to render. They say *which* prescription and *which revision*,
          never *whether the caller may* — the practitioner is resolved from
          `auth.uid()` inside the database, and the prescription is resolved
          by id **and** by that practitioner.
        */}
        <input type="hidden" name="prescriptionId" value={prescription.id} />
        <input type="hidden" name="expectedVersion" value={version} />
        {/*
          The items, as one JSON array. Blank cards are dropped here rather
          than on the server so a trailing empty row never becomes an error
          the doctor has to clear — while a half-filled row survives and is
          told it needs a name.
        */}
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(liveItems)}
          readOnly
        />

        <ol className="flex flex-col gap-6">
          {items.map((item, index) => (
            <li key={item.key}>
              <ItemCard
                item={item}
                index={index}
                total={items.length}
                disabled={busy || conflicted}
                listId={listId}
                onChange={(field, value) => updateItem(item.key, field, value)}
                onRemove={() => removeItem(item.key)}
                onMoveUp={() => move(item.key, -1)}
                onMoveDown={() => move(item.key, 1)}
              />
            </li>
          ))}
        </ol>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addItem}
            disabled={busy || conflicted}
          >
            <Plus aria-hidden className="size-4" />
            {PRESCRIPTION_BUILDER_COPY.addItemLabel}
          </Button>
        </div>

        <Field
          name="generalInstructions"
          label={PRESCRIPTION_BUILDER_COPY.generalInstructionsLabel}
          description={PRESCRIPTION_BUILDER_COPY.generalInstructionsDescription}
          error={fieldErrors.generalInstructions}
          disabled={busy || conflicted}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              maxLength={GENERAL_INSTRUCTIONS_LIMIT}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              autoComplete="off"
              data-1p-ignore
            />
          )}
        </Field>

        <div className="border-border flex flex-col gap-4 border-t pt-6">
          <SaveState
            state={indicator}
            savedAt={savedAt}
            labels={{
              idle: PRESCRIPTION_BUILDER_COPY.statusIdle,
              dirty: PRESCRIPTION_BUILDER_COPY.statusDirty,
              saving: PRESCRIPTION_BUILDER_COPY.statusSaving,
              failed: PRESCRIPTION_BUILDER_COPY.statusFailed,
              done: PRESCRIPTION_BUILDER_COPY.statusIssued,
              saved: PRESCRIPTION_BUILDER_COPY.statusSaved,
              regionLabel: PRESCRIPTION_BUILDER_COPY.statusRegionLabel,
            }}
          />

          {formMessage ? (
            <Alert
              tone={conflicted ? "warning" : "danger"}
              title={PRESCRIPTION_BUILDER_COPY.statusFailed}
            >
              {formMessage}
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              variant="secondary"
              loading={saving}
              loadingLabel={PRESCRIPTION_BUILDER_COPY.savingLabel}
              disabled={conflicted || issuing || cancelling}
            >
              {PRESCRIPTION_BUILDER_COPY.saveDraftLabel}
            </Button>
          </div>
        </div>
      </form>

      {/* The phrasing lists, rendered once and shared by every card. */}
      <FieldSuggestionLists listId={listId} />

      <section
        aria-labelledby="prescription-review"
        className="border-border mt-10 flex flex-col gap-5 border-t pt-8"
      >
        <h2
          id="prescription-review"
          className="text-h3 text-heading font-normal"
        >
          {PRESCRIPTION_BUILDER_COPY.reviewHeading}
        </h2>
        <p className="text-body-sm text-muted-foreground measure">
          {PRESCRIPTION_BUILDER_COPY.reviewDescription}
        </p>

        {blocker === "unsaved" ? (
          <Alert
            tone="warning"
            title={PRESCRIPTION_BUILDER_COPY.reviewUnsavedTitle}
          >
            {PRESCRIPTION_BUILDER_COPY.reviewUnsavedBody}
          </Alert>
        ) : null}

        {blocker === "no_items" ? (
          <Alert tone="info" title={PRESCRIPTION_BUILDER_COPY.reviewEmptyTitle}>
            {PRESCRIPTION_BUILDER_COPY.reviewEmptyBody}
          </Alert>
        ) : null}

        <PrescriptionItems
          items={saved.items}
          emptyMessage={PRESCRIPTION_BUILDER_COPY.emptyItemsDescription}
        />

        {saved.instructions.trim() ? (
          <p className="text-body text-foreground measure font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
            {saved.instructions.trim()}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            onClick={() => setIssueOpen(true)}
            disabled={busy || conflicted || blocker !== null}
          >
            {PRESCRIPTION_BUILDER_COPY.issueLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCancelOpen(true)}
            disabled={busy || conflicted}
          >
            {PRESCRIPTION_BUILDER_COPY.cancelLabel}
          </Button>
        </div>
      </section>

      {/*
        A deliberate, explicit act (section 15). The dialog names what to
        check before confirming, and the form inside it carries an id and a
        revision — no clinical content, so confirming cannot change what is
        issued.
      */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <form action={issueAction} className="flex flex-col gap-5">
            <input
              type="hidden"
              name="prescriptionId"
              value={prescription.id}
            />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>
                {PRESCRIPTION_BUILDER_COPY.issueDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {PRESCRIPTION_BUILDER_COPY.issueDialogBody}
              </DialogDescription>
            </DialogHeader>

            {issueState.status === "error" && issueState.message ? (
              <Alert
                tone="danger"
                title={PRESCRIPTION_BUILDER_COPY.statusFailed}
              >
                {issueState.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIssueOpen(false)}
              >
                {PRESCRIPTION_BUILDER_COPY.issueDialogDismiss}
              </Button>
              <Button
                type="submit"
                loading={issuing}
                loadingLabel={PRESCRIPTION_BUILDER_COPY.issuingLabel}
                disabled={issuing || blocker !== null}
              >
                {PRESCRIPTION_BUILDER_COPY.issueDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <form action={cancelAction} className="flex flex-col gap-5">
            <input
              type="hidden"
              name="prescriptionId"
              value={prescription.id}
            />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>
                {PRESCRIPTION_BUILDER_COPY.cancelDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {PRESCRIPTION_BUILDER_COPY.cancelDialogBody}
              </DialogDescription>
            </DialogHeader>

            <Field
              name="reason"
              label={PRESCRIPTION_BUILDER_COPY.cancelReasonLabel}
              description={PRESCRIPTION_BUILDER_COPY.cancelReasonDescription}
              disabled={cancelling}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  maxLength={CANCELLATION_REASON_LIMIT}
                  autoComplete="off"
                  data-1p-ignore
                />
              )}
            </Field>

            {cancelState.status === "error" && cancelState.message ? (
              <Alert
                tone="danger"
                title={PRESCRIPTION_BUILDER_COPY.statusFailed}
              >
                {cancelState.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCancelOpen(false)}
              >
                {PRESCRIPTION_BUILDER_COPY.cancelDialogDismiss}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={cancelling}
                loadingLabel={PRESCRIPTION_BUILDER_COPY.cancellingLabel}
                disabled={cancelling}
              >
                {PRESCRIPTION_BUILDER_COPY.cancelDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * One medicine, as a card (section 87).
 *
 * A card rather than a table row: eleven fields do not fit across a phone,
 * and a horizontally scrolling table is not a thing anybody wants to
 * prescribe through. The fields stack on a phone and become two, then three
 * columns as there is room.
 */
function ItemCard({
  item,
  index,
  total,
  disabled,
  listId,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  readonly item: DraftItem;
  readonly index: number;
  readonly total: number;
  readonly disabled: boolean;
  readonly listId: string;
  readonly onChange: (
    field: keyof PrescriptionItemContent,
    value: string,
  ) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}) {
  const name = item.medicineName.trim();

  return (
    <fieldset className="border-border bg-card min-w-0 rounded-lg border p-4 sm:p-5">
      <legend className="text-body-sm text-muted-foreground px-1 font-sans font-medium">
        {PRESCRIPTION_BUILDER_COPY.itemHeading(index + 1)}
      </legend>

      <div className="mt-2 flex flex-col gap-5">
        <Field
          name={`medicineName-${item.key}`}
          label={PRESCRIPTION_BUILDER_COPY.medicineLabel}
          description={PRESCRIPTION_BUILDER_COPY.medicineDescription}
          disabled={disabled}
        >
          {(control) => (
            <MedicineNameField
              controlProps={control}
              value={item.medicineName}
              disabled={disabled}
              onChange={(value) => onChange("medicineName", value)}
              onPickForm={(form) => {
                if (!item.form.trim()) onChange("form", form);
              }}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESCRIPTION_ITEM_FIELD_COPY.map((field) => {
            const key = field.name as keyof PrescriptionItemContent;
            return (
              <Field
                key={field.name}
                name={`${field.name}-${item.key}`}
                label={field.label}
                description={field.description}
                disabled={disabled}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    value={item[key]}
                    maxLength={PRESCRIPTION_FIELD_LIMITS[key]}
                    placeholder={field.placeholder}
                    {...(field.suggestions
                      ? { list: `${listId}-${field.name}` }
                      : {})}
                    autoComplete="off"
                    data-1p-ignore
                    onChange={(event) => onChange(key, event.target.value)}
                  />
                )}
              </Field>
            );
          })}
        </div>

        <Field
          name={`instructions-${item.key}`}
          label={PRESCRIPTION_BUILDER_COPY.itemInstructionsLabel}
          description={PRESCRIPTION_BUILDER_COPY.itemInstructionsDescription}
          disabled={disabled}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              maxLength={PRESCRIPTION_FIELD_LIMITS.instructions}
              value={item.instructions}
              onChange={(event) => onChange("instructions", event.target.value)}
              autoComplete="off"
              data-1p-ignore
            />
          )}
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === 0}
            onClick={onMoveUp}
            aria-label={PRESCRIPTION_BUILDER_COPY.moveUpAria(name, index + 1)}
          >
            <ArrowUp aria-hidden className="size-4" />
            {PRESCRIPTION_BUILDER_COPY.moveUpLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === total - 1}
            onClick={onMoveDown}
            aria-label={PRESCRIPTION_BUILDER_COPY.moveDownAria(name, index + 1)}
          >
            <ArrowDown aria-hidden className="size-4" />
            {PRESCRIPTION_BUILDER_COPY.moveDownLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label={PRESCRIPTION_BUILDER_COPY.removeItemAria(name)}
          >
            <Trash2 aria-hidden className="size-4" />
            {PRESCRIPTION_BUILDER_COPY.removeItemLabel}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}

/**
 * The phrasing lists (sections 19-21).
 *
 * A `<datalist>` for these, rather than the full combobox the medicine field
 * gets: they are conveniences on ordinary text inputs — the field accepts
 * anything typed, nothing is preselected, and no clinical decision rides on
 * them. Six more hand-built comboboxes would be six more things to get wrong
 * for no gain a practitioner would notice.
 *
 * Rendered once and shared by every card, because a datalist may be
 * referenced by any number of inputs.
 */
function FieldSuggestionLists({ listId }: { readonly listId: string }) {
  return (
    <>
      {PRESCRIPTION_ITEM_FIELD_COPY.filter((field) => field.suggestions).map(
        (field) => (
          <datalist key={field.name} id={`${listId}-${field.name}`}>
            {field.suggestions?.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        ),
      )}
    </>
  );
}
