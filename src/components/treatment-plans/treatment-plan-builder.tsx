"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  activateTreatmentPlanAction,
  cancelTreatmentPlanAction,
  saveTreatmentPlanDraftAction,
} from "@/features/treatment-plans/actions";
import {
  TREATMENT_PLAN_BUILDER_COPY,
  TREATMENT_PLAN_CATEGORY_COPY,
} from "@/features/treatment-plans/content";
import { treatmentPlanActivationBlocker } from "@/features/treatment-plans/status";
import {
  EMPTY_TREATMENT_PLAN_ITEM,
  IDLE_TREATMENT_PLAN_FORM_STATE,
  isTreatmentPlanCategory,
  TREATMENT_PLAN_ITEM_FIELDS,
  type TreatmentPlan,
  type TreatmentPlanItemContent,
} from "@/features/treatment-plans/types";
import {
  dropBlankTreatmentPlanItems,
  TREATMENT_PLAN_FIELD_LIMITS,
} from "@/features/treatment-plans/validation";
import { TreatmentPlanSections } from "./treatment-plan-summary";

/**
 * The treatment plan builder (`phase_13.md` sections 68-69).
 *
 * ```text
 * Title -> summary -> dates -> instructions by section
 *       -> Save draft -> Review -> Give to the patient
 * ```
 *
 * Everything is typed. No section is preselected beyond the first category in
 * the list, no instruction is suggested, and nothing is inferred from the
 * patient — sections 5, 6 and 63.
 *
 * ## Why the review renders from the saved snapshot
 *
 * `activate_treatment_plan` carries **no content**, so what the patient is
 * given is whatever the database already holds. The review therefore renders
 * what was saved, and activating is refused while the form is dirty.
 *
 * ## A follow-up date books nothing
 *
 * Section 47. The field is a note to the patient, the copy beside it says so,
 * and neither the action nor the database function touches
 * `public.appointments`.
 */

interface DraftItem extends TreatmentPlanItemContent {
  readonly key: string;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `plan-item-${keyCounter}`;
}

function stripToContent(
  item: TreatmentPlanItemContent,
): TreatmentPlanItemContent {
  return {
    category: item.category,
    title: item.title,
    instructions: item.instructions,
    frequency: item.frequency,
    duration: item.duration,
  };
}

function toDraft(items: readonly TreatmentPlanItemContent[]): DraftItem[] {
  const drafts = items.map((item) => ({
    ...stripToContent(item),
    key: nextKey(),
  }));
  return drafts.length > 0
    ? drafts
    : [{ ...EMPTY_TREATMENT_PLAN_ITEM, key: nextKey() }];
}

function sameItems(
  a: readonly TreatmentPlanItemContent[],
  b: readonly TreatmentPlanItemContent[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    return TREATMENT_PLAN_ITEM_FIELDS.every((field) =>
      field === "category"
        ? item.category === other.category
        : item[field].trim() === other[field].trim(),
    );
  });
}

export function TreatmentPlanBuilder({
  plan,
}: {
  readonly plan: TreatmentPlan;
}) {
  const router = useRouter();

  const [saveState, saveAction, saving] = useActionState(
    saveTreatmentPlanDraftAction,
    IDLE_TREATMENT_PLAN_FORM_STATE,
  );
  const [activateState, activateAction, activating] = useActionState(
    activateTreatmentPlanAction,
    IDLE_TREATMENT_PLAN_FORM_STATE,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelTreatmentPlanAction,
    IDLE_TREATMENT_PLAN_FORM_STATE,
  );

  const [items, setItems] = useState<DraftItem[]>(() => toDraft(plan.items));
  const [title, setTitle] = useState(plan.title);
  const [summary, setSummary] = useState(plan.summary);
  const [startDate, setStartDate] = useState(plan.startDate ?? "");
  const [followUpOn, setFollowUpOn] = useState(plan.followUpOn ?? "");

  const [saved, setSaved] = useState(() => ({
    items: dropBlankTreatmentPlanItems(plan.items.map(stripToContent)),
    title: plan.title,
    summary: plan.summary,
    startDate: plan.startDate ?? "",
    followUpOn: plan.followUpOn ?? "",
  }));

  const [version, setVersion] = useState(plan.version);
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const liveItems = dropBlankTreatmentPlanItems(items.map(stripToContent));

  const [handledSave, setHandledSave] = useState(saveState);
  if (saveState !== handledSave) {
    setHandledSave(saveState);
    if (saveState.status === "saved" && saveState.version !== undefined) {
      setVersion(saveState.version);
      setSaved({
        items: liveItems,
        title,
        summary,
        startDate,
        followUpOn,
      });
      setSavedAt(saveState.savedAt);
    }
  }

  const [handledActivate, setHandledActivate] = useState(activateState);
  if (activateState !== handledActivate) {
    setHandledActivate(activateState);
    if (activateState.status === "activated") {
      setActivateOpen(false);
      if (activateState.version !== undefined)
        setVersion(activateState.version);
      setSavedAt(activateState.savedAt);
    }
  }

  const [handledCancel, setHandledCancel] = useState(cancelState);
  if (cancelState !== handledCancel) {
    setHandledCancel(cancelState);
    if (cancelState.status === "cancelled") setCancelOpen(false);
  }

  useEffect(() => {
    if (
      activateState.status !== "activated" &&
      cancelState.status !== "cancelled"
    ) {
      return;
    }
    router.refresh();
  }, [activateState.status, cancelState.status, router]);

  const dirty =
    !sameItems(liveItems, saved.items) ||
    title.trim() !== saved.title.trim() ||
    summary.trim() !== saved.summary.trim() ||
    startDate !== saved.startDate ||
    followUpOn !== saved.followUpOn;

  const conflicted =
    saveState.status === "conflict" ||
    activateState.status === "conflict" ||
    cancelState.status === "conflict";

  const busy = saving || activating || cancelling;
  const failed =
    saveState.status === "error" ||
    activateState.status === "error" ||
    cancelState.status === "error";

  const indicator: SaveStateKind = conflicted
    ? "failed"
    : activateState.status === "activated"
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

  const blocker = treatmentPlanActivationBlocker(
    plan.status,
    saved.title,
    saved.items,
    dirty,
  );

  const formMessage =
    saveState.status === "conflict" || saveState.status === "error"
      ? saveState.message
      : activateState.status === "conflict" || activateState.status === "error"
        ? activateState.message
        : cancelState.status === "conflict" || cancelState.status === "error"
          ? cancelState.message
          : undefined;

  const fieldErrors: Record<string, string | undefined> = {
    ...saveState.fieldErrors,
  };

  function updateItem(
    key: string,
    field: keyof TreatmentPlanItemContent,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (field === "category") {
          return isTreatmentPlanCategory(value)
            ? { ...item, category: value }
            : item;
        }
        return { ...item, [field]: value };
      }),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { ...EMPTY_TREATMENT_PLAN_ITEM, key: nextKey() },
    ]);
  }

  function removeItem(key: string) {
    setItems((current) => {
      const next = current.filter((item) => item.key !== key);
      return next.length > 0
        ? next
        : [{ ...EMPTY_TREATMENT_PLAN_ITEM, key: nextKey() }];
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
          title: TREATMENT_PLAN_BUILDER_COPY.leaveDialogTitle,
          body: TREATMENT_PLAN_BUILDER_COPY.leaveDialogBody,
          stay: TREATMENT_PLAN_BUILDER_COPY.leaveStay,
          saveAndGo: TREATMENT_PLAN_BUILDER_COPY.leaveSaveAndGo,
          discard: TREATMENT_PLAN_BUILDER_COPY.leaveDiscard,
          beforeUnload: TREATMENT_PLAN_BUILDER_COPY.beforeUnload,
        }}
      />

      <form ref={formRef} action={saveAction} className="flex flex-col gap-8">
        <input type="hidden" name="treatmentPlanId" value={plan.id} />
        <input type="hidden" name="expectedVersion" value={version} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(liveItems)}
          readOnly
        />

        <div className="flex flex-col gap-6">
          <Field
            name="title"
            label={TREATMENT_PLAN_BUILDER_COPY.titleLabel}
            description={TREATMENT_PLAN_BUILDER_COPY.titleDescription}
            error={fieldErrors.title}
            disabled={busy || conflicted}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={title}
                maxLength={TREATMENT_PLAN_FIELD_LIMITS.title}
                placeholder={TREATMENT_PLAN_BUILDER_COPY.titlePlaceholder}
                autoComplete="off"
                data-1p-ignore
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </Field>

          <Field
            name="summary"
            label={TREATMENT_PLAN_BUILDER_COPY.summaryLabel}
            description={TREATMENT_PLAN_BUILDER_COPY.summaryDescription}
            error={fieldErrors.summary}
            disabled={busy || conflicted}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={TREATMENT_PLAN_FIELD_LIMITS.summary}
                value={summary}
                autoComplete="off"
                data-1p-ignore
                onChange={(event) => setSummary(event.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="startDate"
              label={TREATMENT_PLAN_BUILDER_COPY.startDateLabel}
              description={TREATMENT_PLAN_BUILDER_COPY.startDateDescription}
              error={fieldErrors.startDate}
              disabled={busy || conflicted}
            >
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              )}
            </Field>

            <Field
              name="followUpOn"
              label={TREATMENT_PLAN_BUILDER_COPY.followUpLabel}
              description={TREATMENT_PLAN_BUILDER_COPY.followUpDescription}
              error={fieldErrors.followUpOn}
              disabled={busy || conflicted}
            >
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={followUpOn}
                  onChange={(event) => setFollowUpOn(event.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        <section aria-labelledby="plan-items" className="flex flex-col gap-6">
          <h2
            id="plan-items"
            className="text-h4 text-heading font-sans font-medium"
          >
            {TREATMENT_PLAN_BUILDER_COPY.itemsHeading}
          </h2>

          <ol className="flex flex-col gap-6">
            {items.map((item, index) => (
              <li key={item.key}>
                <PlanItemCard
                  item={item}
                  index={index}
                  total={items.length}
                  disabled={busy || conflicted}
                  onChange={(field, value) =>
                    updateItem(item.key, field, value)
                  }
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
              {TREATMENT_PLAN_BUILDER_COPY.addItemLabel}
            </Button>
          </div>
        </section>

        <div className="border-border flex flex-col gap-4 border-t pt-6">
          <SaveState
            state={indicator}
            savedAt={savedAt}
            labels={{
              idle: TREATMENT_PLAN_BUILDER_COPY.statusIdle,
              dirty: TREATMENT_PLAN_BUILDER_COPY.statusDirty,
              saving: TREATMENT_PLAN_BUILDER_COPY.statusSaving,
              failed: TREATMENT_PLAN_BUILDER_COPY.statusFailed,
              done: TREATMENT_PLAN_BUILDER_COPY.statusActivated,
              saved: TREATMENT_PLAN_BUILDER_COPY.statusSaved,
              regionLabel: TREATMENT_PLAN_BUILDER_COPY.statusRegionLabel,
            }}
          />

          {formMessage ? (
            <Alert
              tone={conflicted ? "warning" : "danger"}
              title={TREATMENT_PLAN_BUILDER_COPY.statusFailed}
            >
              {formMessage}
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              variant="secondary"
              loading={saving}
              loadingLabel={TREATMENT_PLAN_BUILDER_COPY.savingLabel}
              disabled={conflicted || activating || cancelling}
            >
              {TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel}
            </Button>
          </div>
        </div>
      </form>

      <section
        aria-labelledby="plan-review"
        className="border-border mt-10 flex flex-col gap-5 border-t pt-8"
      >
        <h2 id="plan-review" className="text-h3 text-heading font-normal">
          {TREATMENT_PLAN_BUILDER_COPY.reviewHeading}
        </h2>
        <p className="text-body-sm text-muted-foreground measure">
          {TREATMENT_PLAN_BUILDER_COPY.reviewDescription}
        </p>

        {blocker === "unsaved" ? (
          <Alert
            tone="warning"
            title={TREATMENT_PLAN_BUILDER_COPY.reviewUnsavedTitle}
          >
            {TREATMENT_PLAN_BUILDER_COPY.reviewUnsavedBody}
          </Alert>
        ) : null}

        {blocker === "no_title" || blocker === "no_items" ? (
          <Alert
            tone="info"
            title={TREATMENT_PLAN_BUILDER_COPY.reviewBlockedTitle}
          >
            {blocker === "no_title"
              ? TREATMENT_PLAN_BUILDER_COPY.reviewBlockedNoTitle
              : TREATMENT_PLAN_BUILDER_COPY.reviewBlockedNoItems}
          </Alert>
        ) : null}

        {saved.title.trim() ? (
          <p className="text-h4 text-heading font-sans font-medium [overflow-wrap:anywhere]">
            {saved.title.trim()}
          </p>
        ) : null}

        {saved.summary.trim() ? (
          <p className="text-body text-foreground measure font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
            {saved.summary.trim()}
          </p>
        ) : null}

        <TreatmentPlanSections
          items={saved.items}
          emptyMessage={TREATMENT_PLAN_BUILDER_COPY.emptyItemsDescription}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            onClick={() => setActivateOpen(true)}
            disabled={busy || conflicted || blocker !== null}
          >
            {TREATMENT_PLAN_BUILDER_COPY.activateLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCancelOpen(true)}
            disabled={busy || conflicted}
          >
            {TREATMENT_PLAN_BUILDER_COPY.cancelLabel}
          </Button>
        </div>
      </section>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <form action={activateAction} className="flex flex-col gap-5">
            <input type="hidden" name="treatmentPlanId" value={plan.id} />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>
                {TREATMENT_PLAN_BUILDER_COPY.activateDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {TREATMENT_PLAN_BUILDER_COPY.activateDialogBody}
              </DialogDescription>
            </DialogHeader>

            {activateState.status === "error" && activateState.message ? (
              <Alert
                tone="danger"
                title={TREATMENT_PLAN_BUILDER_COPY.statusFailed}
              >
                {activateState.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActivateOpen(false)}
              >
                {TREATMENT_PLAN_BUILDER_COPY.activateDialogDismiss}
              </Button>
              <Button
                type="submit"
                loading={activating}
                loadingLabel={TREATMENT_PLAN_BUILDER_COPY.activatingLabel}
                disabled={activating || blocker !== null}
              >
                {TREATMENT_PLAN_BUILDER_COPY.activateDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <form action={cancelAction} className="flex flex-col gap-5">
            <input type="hidden" name="treatmentPlanId" value={plan.id} />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>
                {TREATMENT_PLAN_BUILDER_COPY.cancelDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {TREATMENT_PLAN_BUILDER_COPY.cancelDialogBody}
              </DialogDescription>
            </DialogHeader>

            {cancelState.status === "error" && cancelState.message ? (
              <Alert
                tone="danger"
                title={TREATMENT_PLAN_BUILDER_COPY.statusFailed}
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
                {TREATMENT_PLAN_BUILDER_COPY.cancelDialogDismiss}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={cancelling}
                loadingLabel={TREATMENT_PLAN_BUILDER_COPY.cancellingLabel}
                disabled={cancelling}
              >
                {TREATMENT_PLAN_BUILDER_COPY.cancelDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlanItemCard({
  item,
  index,
  total,
  disabled,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  readonly item: DraftItem;
  readonly index: number;
  readonly total: number;
  readonly disabled: boolean;
  readonly onChange: (
    field: keyof TreatmentPlanItemContent,
    value: string,
  ) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}) {
  const title = item.title.trim();

  return (
    <fieldset className="border-border bg-card min-w-0 rounded-lg border p-4 sm:p-5">
      <legend className="text-body-sm text-muted-foreground px-1 font-sans font-medium">
        {TREATMENT_PLAN_BUILDER_COPY.itemHeading(index + 1)}
      </legend>

      <div className="mt-2 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name={`category-${item.key}`}
            label={TREATMENT_PLAN_BUILDER_COPY.categoryLabel}
            disabled={disabled}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={item.category}
                onChange={(event) => onChange("category", event.target.value)}
              >
                {TREATMENT_PLAN_CATEGORY_COPY.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name={`itemTitle-${item.key}`}
            label={TREATMENT_PLAN_BUILDER_COPY.itemTitleLabel}
            disabled={disabled}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={item.title}
                maxLength={TREATMENT_PLAN_FIELD_LIMITS.itemTitle}
                placeholder={TREATMENT_PLAN_BUILDER_COPY.itemTitlePlaceholder}
                autoComplete="off"
                data-1p-ignore
                onChange={(event) => onChange("title", event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          name={`itemInstructions-${item.key}`}
          label={TREATMENT_PLAN_BUILDER_COPY.itemInstructionsLabel}
          description={TREATMENT_PLAN_BUILDER_COPY.itemInstructionsDescription}
          disabled={disabled}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={TREATMENT_PLAN_FIELD_LIMITS.itemInstructions}
              value={item.instructions}
              autoComplete="off"
              data-1p-ignore
              onChange={(event) => onChange("instructions", event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name={`itemFrequency-${item.key}`}
            label={TREATMENT_PLAN_BUILDER_COPY.itemFrequencyLabel}
            disabled={disabled}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={item.frequency}
                maxLength={TREATMENT_PLAN_FIELD_LIMITS.itemFrequency}
                autoComplete="off"
                data-1p-ignore
                onChange={(event) => onChange("frequency", event.target.value)}
              />
            )}
          </Field>

          <Field
            name={`itemDuration-${item.key}`}
            label={TREATMENT_PLAN_BUILDER_COPY.itemDurationLabel}
            disabled={disabled}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={item.duration}
                maxLength={TREATMENT_PLAN_FIELD_LIMITS.itemDuration}
                autoComplete="off"
                data-1p-ignore
                onChange={(event) => onChange("duration", event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === 0}
            onClick={onMoveUp}
            aria-label={TREATMENT_PLAN_BUILDER_COPY.moveUpAria(
              title,
              index + 1,
            )}
          >
            <ArrowUp aria-hidden className="size-4" />
            {TREATMENT_PLAN_BUILDER_COPY.moveUpLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === total - 1}
            onClick={onMoveDown}
            aria-label={TREATMENT_PLAN_BUILDER_COPY.moveDownAria(
              title,
              index + 1,
            )}
          >
            <ArrowDown aria-hidden className="size-4" />
            {TREATMENT_PLAN_BUILDER_COPY.moveDownLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label={TREATMENT_PLAN_BUILDER_COPY.removeItemAria(title)}
          >
            <Trash2 aria-hidden className="size-4" />
            {TREATMENT_PLAN_BUILDER_COPY.removeItemLabel}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
