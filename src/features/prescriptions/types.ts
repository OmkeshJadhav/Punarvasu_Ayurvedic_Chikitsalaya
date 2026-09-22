/**
 * The prescription domain model.
 *
 * ## The boundary this file establishes
 *
 * `phase_13.md` section 2 and example 1 draw the line this phase exists to
 * hold:
 *
 * ```text
 * Appointment       when care is scheduled    -> features/appointments
 * Clinical record   what happened in the room -> features/clinical
 * Prescription      what the patient must take -> here
 * Treatment plan    how the patient must live  -> features/treatment-plans
 * ```
 *
 * So `ClinicalRecord` still has no field for a medicine, and `Prescription`
 * still has no field for a chief complaint, an assessment or a diagnosis. The
 * prescription references the consultation; it does not absorb it, and it
 * does not restate it.
 *
 * ## No denormalised identity
 *
 * Section 30: the prescription references `patientId` and `practitionerId`
 * and holds no copy of a name, a phone number or a date of birth. A copy is a
 * second source of truth that goes stale the day somebody corrects a
 * spelling, and on a clinical instruction it would go stale silently.
 *
 * ## What *is* denormalised, deliberately
 *
 * Every field of a prescription item (sections 51-52). The medicine or remedy
 * name, its form, strength, dose, frequency, timing, duration, quantity and
 * instructions are all stored as the doctor wrote them, and there is no
 * reference to a catalog entry. An issued prescription is evidence of what a
 * doctor actually instructed at a moment in time, and a catalog added later
 * must not be able to rewrite it.
 *
 * ## What is deliberately not here
 *
 * A medicine catalog, a drug-interaction rule, a dosing rule, a pharmacy
 * reference, a generated document, a notification, an AI suggestion or a
 * confidence score. Sections 50, 61, 62, 63 and 103 put each somewhere else
 * or nowhere at all. They are absent rather than filtered: the types have
 * nowhere to put one, the schemas have no field for one, and the tables have
 * no column for one.
 */

/**
 * The lifecycle (section 11).
 *
 * `amended` is declared in the database enum and is unreachable in Phase 13 —
 * the guard trigger permits `issued -> amended` and no function sets it. It
 * is in this union so that a row carrying it renders rather than crashing the
 * day the formal amendment workflow arrives.
 */
export type PrescriptionStatus = "draft" | "issued" | "cancelled" | "amended";

/**
 * One line of a prescription, as the doctor typed it.
 *
 * Only `medicineName` is required (section 17): a churna has no strength, a
 * therapy has no quantity, and a remedy taken "as directed" has no numeric
 * duration. Everything else is a string that may be empty, and an empty one
 * is stored as `null` so a stored value always means something.
 *
 * `doseAmount` and `doseUnit` are two fields rather than one so that a dose
 * is structured enough to read and to report on (section 18), and both are
 * **text** rather than numeric because real Ayurvedic dosing includes "1/2",
 * "1-2" and "a pinch" — and a numeric column would push every one of those
 * into the free-text instructions, which is the outcome section 18 exists to
 * prevent.
 */
export interface PrescriptionItemContent {
  readonly medicineName: string;
  readonly form: string;
  readonly strength: string;
  readonly doseAmount: string;
  readonly doseUnit: string;
  readonly frequency: string;
  readonly timing: string;
  readonly duration: string;
  readonly quantity: string;
  readonly quantityUnit: string;
  readonly instructions: string;
}

/** The field list, for iterating a form and for asserting it has not drifted. */
export const PRESCRIPTION_ITEM_FIELDS = [
  "medicineName",
  "form",
  "strength",
  "doseAmount",
  "doseUnit",
  "frequency",
  "timing",
  "duration",
  "quantity",
  "quantityUnit",
  "instructions",
] as const satisfies readonly (keyof PrescriptionItemContent)[];

export type PrescriptionItemField = (typeof PRESCRIPTION_ITEM_FIELDS)[number];

export const EMPTY_PRESCRIPTION_ITEM: PrescriptionItemContent = {
  medicineName: "",
  form: "",
  strength: "",
  doseAmount: "",
  doseUnit: "",
  frequency: "",
  timing: "",
  duration: "",
  quantity: "",
  quantityUnit: "",
  instructions: "",
};

/** A stored item. `sortOrder` is the doctor's order, never row order (section 66). */
export interface PrescriptionItem extends PrescriptionItemContent {
  readonly id: string;
  readonly sortOrder: number;
}

/**
 * A prescription and the items it carries.
 *
 * `version` is an optimistic concurrency token (section 72), maintained by a
 * database trigger. It says *which revision I edited*, never *whether I may
 * edit* — a wrong one loses the write, and a right one for somebody else's
 * prescription still reaches no row, because row-level security decided that
 * first.
 */
export interface Prescription {
  readonly id: string;
  readonly clinicalRecordId: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly status: PrescriptionStatus;
  readonly generalInstructions: string;
  readonly version: number;
  readonly issuedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly PrescriptionItem[];
}

/**
 * A row in a prescription list (sections 38-39).
 *
 * It carries **no clinical content** — not a medicine name, not a dose. A
 * list is read at a glance, often with somebody else in the room, and the
 * count is enough to decide whether to open it. The query does not fetch the
 * items either.
 */
export interface PrescriptionSummary {
  readonly id: string;
  readonly appointmentId: string;
  readonly status: PrescriptionStatus;
  readonly itemCount: number;
  readonly issuedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Only resolved for the patient-facing list: a doctor's own name is noise. */
  readonly practitionerName: string | null;
}

/** Who a prescription is for, shown so the wrong patient is hard to document. */
export interface PrescriptionSubject {
  readonly patientId: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: string | null;
  readonly phone: string | null;
  readonly appointmentId: string;
  readonly appointmentStartsAt: Date;
  readonly appointmentTypeName: string;
  readonly practitionerName: string | null;
}

export type PrescriptionResult =
  | { readonly status: "found"; readonly prescription: Prescription }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

/**
 * The four honest answers to "show me the prescription for this appointment".
 *
 * `no_consultation` and `not_started` are separate because the practitioner's
 * next action differs: one means start the consultation, the other means
 * start a prescription. Collapsing them into one empty state would send a
 * doctor looking for a button that is not on this page.
 */
export type PrescriptionWorkspaceResult =
  | {
      readonly status: "found";
      readonly prescription: Prescription;
      readonly subject: PrescriptionSubject;
      readonly clinicalRecordId: string;
    }
  | {
      readonly status: "not_started";
      readonly subject: PrescriptionSubject;
      readonly clinicalRecordId: string;
    }
  | {
      readonly status: "no_consultation";
      readonly subject: PrescriptionSubject;
    }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type PrescriptionListResult =
  | {
      readonly status: "found";
      readonly prescriptions: readonly PrescriptionSummary[];
    }
  | { readonly status: "unavailable" };

/**
 * The outcome of a write, as the form sees it.
 *
 * `conflict` is separate from `error` deliberately: a stale write is neither
 * success nor something worth retrying with the same payload, and the form
 * responds by asking for a reload rather than by offering to save again.
 */
export type PrescriptionSaveStatus =
  "idle" | "saved" | "issued" | "cancelled" | "error" | "conflict";

export interface PrescriptionFormState {
  readonly status: PrescriptionSaveStatus;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly version?: number;
  readonly savedAt?: number;
}

export const IDLE_PRESCRIPTION_FORM_STATE: PrescriptionFormState = {
  status: "idle",
};

export function prescriptionFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): PrescriptionFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

/** One suggestion from the practitioner's own prescribing history (section 65). */
export interface MedicineSuggestion {
  readonly medicineName: string;
  readonly form: string;
}
