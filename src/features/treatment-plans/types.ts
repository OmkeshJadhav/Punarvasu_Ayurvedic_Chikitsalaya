/**
 * The treatment plan domain model.
 *
 * ## Separate from a prescription, on purpose
 *
 * `phase_13.md` section 28: a prescription is a specific therapeutic
 * instruction — medicine, dose, frequency, duration — and a treatment plan is
 * the broader care plan around it — diet, lifestyle, therapy, follow-up. A
 * plan **may reference** a prescription and must not duplicate it, so there is
 * no `medication` category here and no field anywhere for a dose. The two
 * features do not import each other; both hang off the same consultation.
 *
 * ## No denormalised identity
 *
 * Like the prescription, the plan references `patientId` and
 * `practitionerId` and holds no copy of a name or a phone number.
 *
 * ## What is frozen, and when
 *
 * Section 44 asks that a plan distinguish "existing plan" from "new plan or
 * update", and warns against silently changing historical instructions. A
 * plan is editable while it is a **draft** and frozen the moment it becomes
 * **active**, because an active plan is what the patient was actually told to
 * do. Revising it means completing or withdrawing it and writing a new one,
 * which the database allows and which leaves the original intact.
 */

/** Section 45. All four are reachable. */
export type TreatmentPlanStatus =
  "draft" | "active" | "completed" | "cancelled";

/**
 * The structured sections (sections 27 and 68, example 8).
 *
 * Five, because five are what the workflow needs. `exercise` is lifestyle and
 * `medication` is a prescription — a different table, a different lifecycle
 * and a different visibility rule.
 */
export type TreatmentPlanCategory =
  "diet" | "lifestyle" | "therapy" | "follow_up" | "other";

export const TREATMENT_PLAN_CATEGORIES = [
  "diet",
  "lifestyle",
  "therapy",
  "follow_up",
  "other",
] as const satisfies readonly TreatmentPlanCategory[];

export function isTreatmentPlanCategory(
  value: string,
): value is TreatmentPlanCategory {
  return (TREATMENT_PLAN_CATEGORIES as readonly string[]).includes(value);
}

/** One instruction in a plan. Only the category and the heading are required. */
export interface TreatmentPlanItemContent {
  readonly category: TreatmentPlanCategory;
  readonly title: string;
  readonly instructions: string;
  readonly frequency: string;
  readonly duration: string;
}

export const TREATMENT_PLAN_ITEM_FIELDS = [
  "category",
  "title",
  "instructions",
  "frequency",
  "duration",
] as const satisfies readonly (keyof TreatmentPlanItemContent)[];

export const EMPTY_TREATMENT_PLAN_ITEM: TreatmentPlanItemContent = {
  category: "diet",
  title: "",
  instructions: "",
  frequency: "",
  duration: "",
};

export interface TreatmentPlanItem extends TreatmentPlanItemContent {
  readonly id: string;
  readonly sortOrder: number;
}

export interface TreatmentPlan {
  readonly id: string;
  readonly clinicalRecordId: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly status: TreatmentPlanStatus;
  readonly title: string;
  readonly summary: string;
  /** ISO calendar dates, never `Date`: these are days, not instants. */
  readonly startDate: string | null;
  readonly followUpOn: string | null;
  readonly version: number;
  readonly activatedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly TreatmentPlanItem[];
}

/** A row in a plan list. No clinical content — a title and a count. */
export interface TreatmentPlanSummary {
  readonly id: string;
  readonly appointmentId: string;
  readonly status: TreatmentPlanStatus;
  readonly title: string;
  readonly itemCount: number;
  readonly followUpOn: string | null;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
  readonly practitionerName: string | null;
}

export interface TreatmentPlanSubject {
  readonly patientId: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: string | null;
  readonly appointmentId: string;
  readonly appointmentStartsAt: Date;
  readonly appointmentTypeName: string;
}

export type TreatmentPlanResult =
  | { readonly status: "found"; readonly plan: TreatmentPlan }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type TreatmentPlanWorkspaceResult =
  | {
      readonly status: "found";
      readonly plan: TreatmentPlan;
      readonly subject: TreatmentPlanSubject;
      readonly clinicalRecordId: string;
    }
  | {
      readonly status: "not_started";
      readonly subject: TreatmentPlanSubject;
      readonly clinicalRecordId: string;
    }
  | {
      readonly status: "no_consultation";
      readonly subject: TreatmentPlanSubject;
    }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type TreatmentPlanListResult =
  | {
      readonly status: "found";
      readonly plans: readonly TreatmentPlanSummary[];
    }
  | { readonly status: "unavailable" };

export type TreatmentPlanSaveStatus =
  | "idle"
  | "saved"
  | "activated"
  | "completed"
  | "cancelled"
  | "error"
  | "conflict";

export interface TreatmentPlanFormState {
  readonly status: TreatmentPlanSaveStatus;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly version?: number;
  readonly savedAt?: number;
}

export const IDLE_TREATMENT_PLAN_FORM_STATE: TreatmentPlanFormState = {
  status: "idle",
};

export function treatmentPlanFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): TreatmentPlanFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}
