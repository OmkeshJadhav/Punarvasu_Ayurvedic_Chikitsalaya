/**
 * Every word the treatment plan feature shows anybody.
 *
 * ## Nothing here recommends anything
 *
 * The category labels and descriptions name *sections of a plan*, not
 * treatments. There is no list of diets, no list of therapies and no default
 * instruction anywhere — a new plan starts empty, and every word in it is one
 * the practitioner typed. `phase_13.md` sections 5, 6 and 63.
 *
 * ## The plan the patient reads
 *
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` and `AGENTS.md` section 15: no
 * guaranteed outcome, no claim that following the plan will cure anything,
 * and a clear line between a plan written for this person and general wellness
 * information.
 */

import type { TreatmentPlanCategory, TreatmentPlanStatus } from "./types";

export const TREATMENT_PLAN_AREA = {
  builder: { title: "Treatment plan" },
  detail: { title: "Treatment plan" },
  patientList: { title: "Your treatment plans" },
  patientDetail: { title: "Treatment plan" },
} as const;

export interface TreatmentPlanCategoryCopy {
  readonly value: TreatmentPlanCategory;
  readonly label: string;
  readonly description: string;
}

/** Sections, in the order a plan reads. */
export const TREATMENT_PLAN_CATEGORY_COPY: readonly TreatmentPlanCategoryCopy[] =
  [
    {
      value: "diet",
      label: "Diet",
      description: "What to eat, what to avoid, and when.",
    },
    {
      value: "lifestyle",
      label: "Lifestyle",
      description: "Daily routine, sleep, activity and rest.",
    },
    {
      value: "therapy",
      label: "Therapy",
      description: "Procedures and therapies, and how often.",
    },
    {
      value: "follow_up",
      label: "Follow-up",
      description: "What to watch for, and when to come back.",
    },
    {
      value: "other",
      label: "Other instructions",
      description: "Anything the sections above do not cover.",
    },
  ];

export const TREATMENT_PLAN_CATEGORY_LABELS: Readonly<
  Record<TreatmentPlanCategory, string>
> = {
  diet: "Diet",
  lifestyle: "Lifestyle",
  therapy: "Therapy",
  follow_up: "Follow-up",
  other: "Other instructions",
};

export const TREATMENT_PLAN_STATUS_LABELS: Readonly<
  Record<TreatmentPlanStatus, string>
> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Withdrawn",
};

export const TREATMENT_PLAN_BUILDER_COPY = {
  heading: "Treatment plan",
  backLabel: "Back to the consultation",
  introDescription:
    "How you are asking this patient to eat, live and be treated between now and the next visit. Medicines belong on the prescription, not here. Nothing is visible to the patient until you give them the plan.",

  patientHeading: "Patient",
  appointmentHeading: "This consultation",
  identityHint:
    "Check this is the patient in front of you before you write the plan.",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  phoneLabel: "Phone",
  whenLabel: "Date and time",
  typeLabel: "Consultation",

  titleLabel: "Plan title",
  titleDescription:
    "A short name the patient will recognise — what this plan is for.",
  titlePlaceholder: "Digestive care over the next month",
  summaryLabel: "Summary",
  summaryDescription:
    "A sentence or two in plain language, for the patient to read first.",
  startDateLabel: "Start from",
  startDateDescription: "Optional. When the patient should begin.",
  followUpLabel: "Follow up on",
  followUpDescription:
    "Optional. A date for the patient's reference. This does not book an appointment — the front desk still arranges that.",

  itemsHeading: "Instructions",
  itemHeading: (index: number) => `Instruction ${index}`,
  categoryLabel: "Section",
  itemTitleLabel: "Heading",
  itemTitlePlaceholder: "Warm, freshly cooked food",
  itemInstructionsLabel: "Details",
  itemInstructionsDescription: "What to do, in words the patient can follow.",
  itemFrequencyLabel: "How often",
  itemDurationLabel: "For how long",

  addItemLabel: "Add another instruction",
  removeItemLabel: "Remove this instruction",
  removeItemAria: (title: string) =>
    title ? `Remove ${title}` : "Remove this empty instruction",
  moveUpLabel: "Move up",
  moveDownLabel: "Move down",
  moveUpAria: (title: string, index: number) =>
    `Move ${title || `instruction ${index}`} up`,
  moveDownAria: (title: string, index: number) =>
    `Move ${title || `instruction ${index}`} down`,

  emptyItemsTitle: "No instructions yet",
  emptyItemsDescription:
    "Add an instruction for each thing you are asking the patient to do.",

  saveDraftLabel: "Save draft",
  savingLabel: "Saving…",
  statusIdle: "No changes yet",
  statusDirty: "Unsaved changes",
  statusSaving: "Saving…",
  statusSaved: (time: string) => `Saved at ${time}`,
  statusFailed: "Not saved",
  statusActivated: "Plan given to the patient",
  statusRegionLabel: "Save status",

  reviewHeading: "Review and give to the patient",
  reviewDescription:
    "This is exactly what the patient will see. Check it before you confirm.",
  reviewUnsavedTitle: "Save your draft first",
  reviewUnsavedBody:
    "The review below shows what is currently saved. Save your changes so that what the patient is given is what you have written.",
  reviewBlockedTitle: "Not ready yet",
  reviewBlockedNoTitle:
    "The plan needs a title before the patient can be given it.",
  reviewBlockedNoItems:
    "The plan needs at least one instruction before the patient can be given it.",

  activateLabel: "Give plan to the patient",
  activatingLabel: "Saving…",
  activateDialogTitle: "Give this plan to the patient?",
  activateDialogBody:
    "The plan becomes visible to the patient and can no longer be edited. If it needs revising later, complete or withdraw it and write a new one.",
  activateDialogConfirm: "Give plan to the patient",
  activateDialogDismiss: "Keep editing",

  completeLabel: "Mark plan complete",
  completingLabel: "Completing…",
  completeDialogTitle: "Mark this plan complete?",
  completeDialogBody:
    "The patient keeps it in their records, and you can write a new plan for this consultation.",
  completeDialogConfirm: "Mark complete",
  completeDialogDismiss: "Keep it active",

  cancelLabel: "Withdraw plan",
  cancellingLabel: "Withdrawing…",
  cancelDialogTitle: "Withdraw this plan?",
  cancelDialogBody:
    "The plan is kept for the record and marked as withdrawn, and the patient is shown that it is no longer to be followed.",
  cancelDialogConfirm: "Withdraw plan",
  cancelDialogDismiss: "Keep it",

  draftNotice: {
    title: "This plan is a draft",
    body: "The patient cannot see it. It becomes visible to them only when you give it to them.",
  },
  activeNotice: {
    title: "This plan is with the patient",
    body: "It is visible to them and cannot be edited. To revise it, complete or withdraw it and write a new one — the original is kept either way.",
  },
  completedNotice: {
    title: "This plan is complete",
    body: "The patient keeps it in their records. You can write a new plan for this consultation.",
  },
  cancelledNotice: {
    title: "This plan has been withdrawn",
    body: "It is kept for the record and the patient is shown that it is no longer to be followed.",
  },

  leaveDialogTitle: "You have unsaved changes",
  leaveDialogBody:
    "This treatment plan has not been saved. If you leave now your changes will be lost.",
  leaveStay: "Stay on this page",
  leaveSaveAndGo: "Save draft and leave",
  leaveDiscard: "Leave without saving",
  beforeUnload: "Your treatment plan has not been saved.",

  startTitle: "No treatment plan for this consultation yet",
  startDescription:
    "Start one when you know what you are asking the patient to do. You can save it as a draft and give it to them when you are ready.",
  startLabel: "Start a treatment plan",
  startingLabel: "Starting…",

  notFoundTitle: "We couldn't find that treatment plan",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your appointments to find it.",
  notFoundAction: "Back to your appointments",
  loadErrorTitle: "We couldn't load this treatment plan",
  loadErrorDescription:
    "Something went wrong at our end. Nothing has been changed. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

/** One plan, read back from the practitioner's own history. */
export const TREATMENT_PLAN_DETAIL_COPY = {
  heading: "Treatment plan",
  backLabel: "Back to the patient",
  metaHeading: "This plan",
  startedOnLabel: "Started on",
  givenOnLabel: "Given to the patient on",
  completedOnLabel: "Completed on",
  withdrawnOnLabel: "Withdrawn on",
  startsLabel: "Start from",
  followUpOnLabel: "Follow up on",
  openConsultationLabel: "Open the consultation",
  continueDraftLabel: "Continue this plan",
  instructionsHeading: "Instructions",
  untitled: "Untitled plan",
  notFoundTitle: "We couldn't find that treatment plan",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to the patient to find it.",
  notFoundAction: "Back to your patients",
  loadErrorTitle: "We couldn't load that treatment plan",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

export const TREATMENT_PLAN_HISTORY_COPY = {
  heading: "Treatment plans",
  description: "Plans you have written for this patient.",
  caption: "Treatment plans you have written, most recent first",
  titleHeading: "Plan",
  statusHeading: "Status",
  followUpHeading: "Follow-up",
  actionsHeading: "Actions",
  viewLabel: "Open",
  untitled: "Untitled plan",
  itemCount: (count: number) =>
    count === 1 ? "1 instruction" : `${count} instructions`,
  emptyTitle: "No treatment plans yet",
  emptyDescription:
    "You have not written a treatment plan for this patient. They appear here once you save or give one.",
  errorTitle: "We couldn't load the treatment plans",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  boundedNotice: "The most recent plans are listed.",
  scopeNotice: {
    title: "You see the plans you wrote",
    body: "Treatment plans are readable by the practitioner who wrote them. Anything a colleague planned is not shown here.",
  },
} as const;

export const PATIENT_TREATMENT_PLAN_COPY = {
  heading: "Your treatment plans",
  description:
    "How your practitioner has asked you to eat, live and be treated. Only plans your practitioner has given you appear here.",

  listCaption: "Your treatment plans, most recent first",
  planHeading: "Plan",
  statusHeading: "Status",
  followUpHeading: "Follow-up",
  viewLabel: "Open",
  untitled: "Treatment plan",

  emptyTitle: "No treatment plans yet",
  emptyDescription:
    "When your practitioner gives you a treatment plan it will appear here.",
  errorTitle: "We couldn't load your treatment plans",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  errorRetryLabel: "Try again",

  detailHeading: "Treatment plan",
  backLabel: "Back to your treatment plans",
  givenOnLabel: "Given on",
  givenByLabel: "Written by",
  startsLabel: "Start from",
  followUpOnLabel: "Follow up on",
  followUpHint:
    "This is a date to keep in mind, not a booked appointment. Contact the clinic to arrange your next visit.",

  notFoundTitle: "We couldn't find that treatment plan",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your treatment plans to find it.",
  notFoundAction: "Back to your treatment plans",

  completedNotice: {
    title: "This plan is complete",
    body: "Your practitioner has marked it finished. It is kept here so you have a record of it.",
  },
  withdrawnNotice: {
    title: "This plan has been withdrawn",
    body: "Your practitioner has withdrawn it, so it should no longer be followed. It is shown here so you have a record of it. If you are unsure what to do, please contact the clinic.",
  },

  safetyNotice: {
    title: "This plan was written for you",
    body: "It was written for you by your practitioner at a particular consultation, and it is not general health advice for anyone else. If anything is unclear, or if you feel unwell while following it, contact the clinic. Ayurvedic care is not a replacement for treatment prescribed to you by another doctor.",
  },
} as const;

export const TREATMENT_PLAN_ERRORS = {
  forbidden: "You don't have permission to do that.",
  generic:
    "We couldn't save the treatment plan. Your changes have not been saved — please try again.",
  sessionEnded:
    "Your session has ended. Your changes have not been saved. Sign in again in another tab, then save.",
} as const;
