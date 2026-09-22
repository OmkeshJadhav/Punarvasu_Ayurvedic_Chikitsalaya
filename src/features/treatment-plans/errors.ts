/**
 * Database failure to safe copy, for treatment plans.
 *
 * The same contract as every other error mapper in this project: no policy
 * error, RLS failure, SQL statement, constraint name, table name or
 * connection string reaches a screen or a log, every message is written here
 * in full, and every message says explicitly what happened to the work.
 *
 * The codes are disjoint from the prescription codes (PV020-PV025) so that
 * the two features stay self-contained — neither imports the other's
 * internals, which is the rule `docs/ARCHITECTURE.md` section 4 sets for
 * sibling features.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

export const TREATMENT_PLAN_ERROR_CODES = {
  notFound: "PV030",
  notEditable: "PV031",
  staleWrite: "PV032",
  incomplete: "PV033",
  invalidTransition: "PV034",
  consultationNotFound: "PV035",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";
const FOREIGN_KEY_VIOLATION = "23503";

export interface TreatmentPlanFailure {
  readonly message: string;
  readonly logEvent: string;
  readonly conflict: boolean;
}

const FAILURES: Readonly<Record<string, TreatmentPlanFailure>> = {
  [TREATMENT_PLAN_ERROR_CODES.notFound]: {
    message: "We couldn't find that treatment plan.",
    logEvent: "treatment_plan.not_found",
    conflict: false,
  },
  [TREATMENT_PLAN_ERROR_CODES.notEditable]: {
    message:
      "This plan has been given to the patient and can no longer be changed. Your changes have not been saved. To revise it, complete or withdraw it and write a new one.",
    logEvent: "treatment_plan.not_editable",
    conflict: true,
  },
  [TREATMENT_PLAN_ERROR_CODES.staleWrite]: {
    message:
      "This treatment plan was updated somewhere else. Reload the page to see the latest version before saving — your changes have not been saved.",
    logEvent: "treatment_plan.stale_write",
    conflict: true,
  },
  [TREATMENT_PLAN_ERROR_CODES.incomplete]: {
    message:
      "A treatment plan needs a title and at least one instruction, and every instruction needs a heading and a section. Nothing has been changed.",
    logEvent: "treatment_plan.incomplete",
    conflict: false,
  },
  [TREATMENT_PLAN_ERROR_CODES.invalidTransition]: {
    message:
      "This treatment plan has already been closed. Nothing has been changed.",
    logEvent: "treatment_plan.invalid_transition",
    conflict: true,
  },
  [TREATMENT_PLAN_ERROR_CODES.consultationNotFound]: {
    message: "We couldn't find that consultation.",
    logEvent: "treatment_plan.consultation_not_found",
    conflict: false,
  },
  [UNIQUE_VIOLATION]: {
    message:
      "A treatment plan for this consultation already exists. Reload the page to open it.",
    logEvent: "treatment_plan.duplicate",
    conflict: true,
  },
  [CHECK_VIOLATION]: {
    message:
      "Some of that couldn't be saved as written. Please shorten any very long entry and try again — nothing has been saved.",
    logEvent: "treatment_plan.check_violation",
    conflict: false,
  },
  [NOT_NULL_VIOLATION]: {
    message: "Every instruction needs a heading. Nothing has been saved.",
    logEvent: "treatment_plan.missing_value",
    conflict: false,
  },
  [FOREIGN_KEY_VIOLATION]: {
    message: "We couldn't find that consultation.",
    logEvent: "treatment_plan.missing_reference",
    conflict: false,
  },
  [INSUFFICIENT_PRIVILEGE]: {
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "treatment_plan.forbidden",
    conflict: false,
  },
};

const GENERIC: TreatmentPlanFailure = {
  message:
    "We couldn't save the treatment plan. Your changes have not been saved — please review the information and try again.",
  logEvent: "treatment_plan.operation_failed",
  conflict: false,
};

export function describeTreatmentPlanFailure(
  error: unknown,
): TreatmentPlanFailure {
  const code = readCode(error);
  if (!code) return GENERIC;
  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
