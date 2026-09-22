/**
 * Every word the prescription feature shows anybody.
 *
 * Copy lives here rather than in components so a practitioner or a clinic
 * manager can review what the product says without reading React, and so that
 * the same sentence cannot drift between two screens.
 *
 * ## Two rules this copy follows
 *
 * **Nothing here recommends anything.** The suggestion lists below are
 * *phrasings* — ways of writing a frequency, a timing or a duration — offered
 * so two practitioners write "Twice daily" the same way and a patient reads
 * one vocabulary. Not one of them is preselected, none is required, and the
 * fields they sit beside accept anything the doctor types. `phase_13.md`
 * sections 5, 6 and 19: the doctor supplies the clinical decision, and
 * suggesting a *spelling* is not suggesting a *treatment*.
 *
 * **Where a capability does not exist, the words say so.** Printing, sending
 * a prescription to a patient's phone and pharmacy integration are all out of
 * scope (sections 61, 62 and 103), so nothing here implies any of them.
 */

export const PRESCRIPTION_AREA = {
  builder: { title: "Prescription" },
  detail: { title: "Prescription" },
  patientList: { title: "Your prescriptions" },
  patientDetail: { title: "Prescription" },
} as const;

export interface PrescriptionFieldCopy {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  /** Phrasings offered through a datalist. Never preselected. */
  readonly suggestions?: readonly string[];
}

/**
 * The item fields, in the order a doctor fills them (section 65).
 *
 * `medicineName` is handled separately by the autocomplete field, so it is
 * not in this list.
 */
export const PRESCRIPTION_ITEM_FIELD_COPY: readonly PrescriptionFieldCopy[] = [
  {
    name: "form",
    label: "Form",
    placeholder: "Churna, tablet, kashaya, taila…",
    suggestions: [
      "Churna",
      "Tablet",
      "Capsule",
      "Kashaya",
      "Arishta",
      "Taila",
      "Ghrita",
      "Lehya",
      "Bhasma",
      "Syrup",
    ],
  },
  {
    name: "strength",
    label: "Strength",
    placeholder: "250 mg, 5%…",
  },
  {
    name: "doseAmount",
    label: "Dose",
    placeholder: "1, 1–2, half…",
  },
  {
    name: "doseUnit",
    label: "Dose unit",
    placeholder: "tablet, teaspoon, ml…",
    suggestions: [
      "tablet",
      "capsule",
      "teaspoon",
      "tablespoon",
      "ml",
      "g",
      "pinch",
      "drop",
      "application",
    ],
  },
  {
    name: "frequency",
    label: "Frequency",
    // Section 19. Ayurvedic practice is not limited to pharmaceutical
    // conventions, so the list carries both and the field accepts neither.
    suggestions: [
      "Once daily",
      "Twice daily",
      "Three times daily",
      "Every morning",
      "Every evening",
      "Alternate days",
      "Weekly",
      "As directed",
    ],
  },
  {
    name: "timing",
    label: "Timing",
    // Section 20: explicit words rather than abbreviations somebody has to
    // decode at a chemist's counter.
    suggestions: [
      "Before breakfast",
      "After breakfast",
      "Before meals",
      "After meals",
      "With food",
      "On an empty stomach",
      "At bedtime",
      "Morning and evening",
    ],
  },
  {
    name: "duration",
    label: "Duration",
    // Section 21. "Until follow-up" and "As directed" are why this is one
    // free-text field rather than a number and a unit.
    suggestions: [
      "3 days",
      "5 days",
      "7 days",
      "2 weeks",
      "1 month",
      "3 months",
      "Until follow-up",
      "As directed",
    ],
  },
  {
    name: "quantity",
    label: "Quantity",
    description: "Only where it is meaningful.",
    placeholder: "10, 100…",
  },
  {
    name: "quantityUnit",
    label: "Quantity unit",
    placeholder: "tablets, ml, bottle…",
    suggestions: ["tablets", "capsules", "ml", "g", "bottle", "packet"],
  },
];

export const PRESCRIPTION_BUILDER_COPY = {
  heading: "Prescription",
  backLabel: "Back to the consultation",
  introDescription:
    "What you are asking this patient to take. Add a line for each medicine or remedy. Nothing here is visible to the patient until you issue it.",

  // Sections 80-81. Who this is for and which visit it belongs to, shown
  // above the builder so documenting the wrong patient takes effort.
  patientHeading: "Patient",
  appointmentHeading: "This consultation",
  identityHint:
    "Check this is the patient in front of you before you prescribe.",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  phoneLabel: "Phone",
  whenLabel: "Date and time",
  typeLabel: "Consultation",
  practitionerLabel: "Prescribing practitioner",

  medicineLabel: "Medicine or remedy",
  medicineDescription:
    "Type to see what you have prescribed before. You can write anything — the list is only your own past prescriptions.",
  medicinePlaceholder: "Ashwagandha churna…",
  suggestionsLabel: "Medicines you have prescribed before",
  suggestionsLoading: "Looking through your past prescriptions…",
  suggestionsEmpty: "Nothing you have prescribed before starts with that.",

  itemHeading: (index: number) => `Item ${index}`,
  itemInstructionsLabel: "Instructions for this item",
  itemInstructionsDescription:
    "Anything the fields above cannot carry. The patient reads this.",

  addItemLabel: "Add another medicine",
  removeItemLabel: "Remove this item",
  removeItemAria: (name: string) =>
    name ? `Remove ${name}` : "Remove this empty item",
  moveUpLabel: "Move up",
  moveDownLabel: "Move down",
  moveUpAria: (name: string, index: number) =>
    `Move ${name || `item ${index}`} up`,
  moveDownAria: (name: string, index: number) =>
    `Move ${name || `item ${index}`} down`,

  generalInstructionsLabel: "Instructions for the whole prescription",
  generalInstructionsDescription:
    "Advice that applies to everything above — how to take it, what to avoid, when to stop. The patient reads this.",

  emptyItemsTitle: "No medicines yet",
  emptyItemsDescription:
    "Add a line for each medicine or remedy you are prescribing.",

  saveDraftLabel: "Save draft",
  savingLabel: "Saving…",
  statusIdle: "No changes yet",
  statusDirty: "Unsaved changes",
  statusSaving: "Saving…",
  statusSaved: (time: string) => `Saved at ${time}`,
  statusFailed: "Not saved",
  statusIssued: "Prescription issued",
  statusRegionLabel: "Save status",

  reviewHeading: "Review and issue",
  reviewDescription:
    "This is exactly what will be issued. Check every medicine, dose, frequency and duration before you confirm.",
  reviewUnsavedTitle: "Save your draft first",
  reviewUnsavedBody:
    "The review below shows what is currently saved. Save your changes so that what you issue is what you have written.",
  reviewEmptyTitle: "Nothing to issue yet",
  reviewEmptyBody:
    "A prescription needs at least one medicine or remedy before it can be issued.",

  issueLabel: "Issue prescription",
  issuingLabel: "Issuing…",
  issueDialogTitle: "Issue this prescription?",
  issueDialogBody:
    "Please verify the medicines, dosage, frequency and duration. Once issued, this prescription becomes visible to the patient and can no longer be edited.",
  issueDialogConfirm: "Issue prescription",
  issueDialogDismiss: "Keep editing",

  cancelLabel: "Withdraw prescription",
  cancellingLabel: "Withdrawing…",
  cancelDialogTitle: "Withdraw this prescription?",
  cancelDialogBody:
    "The prescription is kept for the record and marked as withdrawn, and the patient is shown that it is no longer to be followed. You can then write a corrected prescription for this consultation.",
  cancelReasonLabel: "Why it is being withdrawn",
  cancelReasonDescription:
    "Optional, and the patient will see it. A short sentence helps them understand what changed.",
  cancelDialogConfirm: "Withdraw prescription",
  cancelDialogDismiss: "Keep it",

  issuedNotice: {
    title: "This prescription has been issued",
    body: "It is now visible to the patient and cannot be edited. If something needs correcting, withdraw it and write a new one — the original is kept either way.",
  },
  cancelledNotice: {
    title: "This prescription has been withdrawn",
    body: "It is kept for the record and the patient is shown that it is no longer to be followed. You can write a new prescription for this consultation.",
  },
  draftNotice: {
    title: "This prescription is a draft",
    body: "The patient cannot see it. It becomes visible to them only when you issue it.",
  },

  leaveDialogTitle: "You have unsaved changes",
  leaveDialogBody:
    "This prescription has not been saved. If you leave now your changes will be lost.",
  leaveStay: "Stay on this page",
  leaveSaveAndGo: "Save draft and leave",
  leaveDiscard: "Leave without saving",
  beforeUnload: "Your prescription has not been saved.",

  startTitle: "No prescription for this consultation yet",
  startDescription:
    "Start one when you know what you are prescribing. You can save it as a draft and issue it when you are ready.",
  startLabel: "Start a prescription",
  startingLabel: "Starting…",

  notFoundTitle: "We couldn't find that prescription",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your appointments to find it.",
  notFoundAction: "Back to your appointments",
  loadErrorTitle: "We couldn't load this prescription",
  loadErrorDescription:
    "Something went wrong at our end. Nothing has been changed. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

/** One prescription, read back from the practitioner's own history (section 40). */
export const PRESCRIPTION_DETAIL_COPY = {
  heading: "Prescription",
  backLabel: "Back to the patient",
  issuedOnLabel: "Issued on",
  withdrawnOnLabel: "Withdrawn on",
  startedOnLabel: "Started on",
  lastUpdatedLabel: "Last updated",
  withdrawnReasonLabel: "Why it was withdrawn",
  metaHeading: "This prescription",
  openConsultationLabel: "Open the consultation",
  continueDraftLabel: "Continue this prescription",
  medicinesHeading: "Medicines and remedies",
  notFoundTitle: "We couldn't find that prescription",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to the patient to find it.",
  notFoundAction: "Back to your patients",
  loadErrorTitle: "We couldn't load that prescription",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

/** The doctor's prescription list on a patient page (section 38). */
export const PRESCRIPTION_HISTORY_COPY = {
  heading: "Prescriptions",
  description: "Prescriptions you have written for this patient.",
  caption: "Prescriptions you have written, most recent first",
  dateHeading: "Date",
  itemsHeading: "Items",
  statusHeading: "Status",
  actionsHeading: "Actions",
  viewLabel: "Open",
  itemCount: (count: number) => (count === 1 ? "1 item" : `${count} items`),
  emptyTitle: "No prescriptions yet",
  emptyDescription:
    "You have not written a prescription for this patient. They appear here once you save or issue one.",
  errorTitle: "We couldn't load the prescriptions",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  boundedNotice: "The most recent prescriptions are listed.",
  scopeNotice: {
    title: "You see the prescriptions you wrote",
    body: "Prescriptions are readable by the practitioner who wrote them. Anything a colleague prescribed is not shown here.",
  },
} as const;

/**
 * The patient's own view (sections 35, 39 and 75).
 *
 * Nothing in it exposes a doctor's note, an assessment, a diagnosis, an
 * internal identifier or the consultation the prescription came out of. It
 * carries what the patient needs in order to follow the instruction, and the
 * safety sentences a healthcare product owes somebody reading it alone at
 * home.
 */
export const PATIENT_PRESCRIPTION_COPY = {
  heading: "Your prescriptions",
  description:
    "What your practitioner has asked you to take. Only prescriptions your practitioner has issued appear here.",

  listCaption: "Your prescriptions, most recent first",
  dateHeading: "Issued",
  practitionerHeading: "Practitioner",
  itemsHeading: "Items",
  statusHeading: "Status",
  viewLabel: "Open",
  itemCount: (count: number) => (count === 1 ? "1 item" : `${count} items`),

  emptyTitle: "No prescriptions yet",
  emptyDescription:
    "When your practitioner issues a prescription for you it will appear here. Prescriptions written on paper during a visit are not shown.",
  errorTitle: "We couldn't load your prescriptions",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  errorRetryLabel: "Try again",

  detailHeading: "Prescription",
  backLabel: "Back to your prescriptions",
  issuedOnLabel: "Issued on",
  issuedByLabel: "Issued by",
  instructionsHeading: "Instructions",
  medicinesHeading: "What to take",

  notFoundTitle: "We couldn't find that prescription",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your prescriptions to find it.",
  notFoundAction: "Back to your prescriptions",

  withdrawnNotice: {
    title: "This prescription has been withdrawn",
    body: "Your practitioner has withdrawn it, so it should no longer be followed. It is shown here so you have a record of it. If you are unsure what to do, please contact the clinic.",
  },
  withdrawnReasonLabel: "Why it was withdrawn",

  /**
   * Section 75: a prescription is not general health information, and the
   * page says which one it is. No claim is made about what the medicines
   * will do — the platform records what the practitioner instructed, and
   * nothing more.
   */
  safetyNotice: {
    title: "This is a prescription, not general advice",
    body: "It was written for you by your practitioner at a particular consultation, and it is not health information for anyone else. If anything is unclear, or if you feel unwell while following it, contact the clinic. Do not stop or change medicine prescribed to you by another doctor without speaking to them.",
  },
} as const;

/** Labels for each status, used by the badge and by screen readers. */
export const PRESCRIPTION_STATUS_LABELS = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Withdrawn",
  amended: "Amended",
} as const;

export const PRESCRIPTION_ERRORS = {
  forbidden: "You don't have permission to do that.",
  generic:
    "We couldn't save the prescription. Your changes have not been saved — please try again.",
  sessionEnded:
    "Your session has ended. Your changes have not been saved. Sign in again in another tab, then save.",
} as const;
