/**
 * Clinical workspace copy.
 *
 * All of it in one file, like every other feature's, so the words can be
 * reviewed without reading React and so two screens cannot describe the same
 * thing differently.
 *
 * ## The register
 *
 * Quiet and precise. The reader is a practitioner with a patient in front of
 * them (`phase_11.md` section 3), and section 66 asks that the consultation
 * screen not feel like a generic enterprise form. So: no exclamation marks,
 * no encouragement, no progress gamification, and field labels that are the
 * words a practitioner already uses rather than database column names.
 *
 * ## Four rules this file follows
 *
 * **No clinical content is written here.** Not an example symptom, not a
 * placeholder diagnosis, not a sample assessment. Section 97 forbids real
 * clinical notes in source, and a *plausible* invented one is worse in a
 * different way: a placeholder reading "Headache, 3 days" is a template
 * nobody chose, and practitioners write to the template they are shown.
 * Descriptions say what a field is *for*; they never demonstrate it.
 *
 * **The save state says what is true.** Section 33: never display "Saved" if
 * the server operation failed, and never leave the practitioner guessing
 * whether their notes are safe. Every failure message says explicitly that
 * the changes were not saved.
 *
 * **No medical authority is claimed.** Section 10 and section 11: this is a
 * documentation structure, not a clinical template that asserts how a
 * consultation should be conducted. Nothing here tells a practitioner what to
 * examine or what to conclude.
 *
 * **Where a capability does not exist, the words say so.** Prescriptions and
 * documents arrive in Phases 13 and 14, and a practitioner who looks for them
 * on this page is told they are not built rather than left assuming the page
 * failed.
 */

import type { ClinicalContent, ClinicalRecordStatus } from "./types";

export const CLINICAL_AREA = {
  record: { title: "Clinical record" },
  history: { title: "Clinical history" },
} as const;

/**
 * The eight sections of the consultation, and what each is for.
 *
 * Grouped into three parts rather than presented as one list of eight
 * (sections 27 and 66): what the patient reports, what the practitioner
 * finds, and what happens next. That is the order a consultation actually
 * runs in, so a practitioner moving down the page is following their own
 * workflow rather than a form's.
 *
 * `description` explains the field's purpose. It never contains an example of
 * clinical content — see the header.
 */
export interface ClinicalFieldCopy {
  readonly name: keyof ClinicalContent;
  readonly label: string;
  readonly description: string;
  /** Roughly how tall the control starts. Narrative fields get more room. */
  readonly rows: number;
}

export interface ClinicalSectionCopy {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fields: readonly ClinicalFieldCopy[];
}

export const CLINICAL_SECTIONS: readonly ClinicalSectionCopy[] = [
  {
    id: "presentation",
    title: "What the patient reports",
    description: "In the patient's own terms, as far as possible.",
    fields: [
      {
        name: "chiefComplaint",
        label: "Chief complaint",
        description: "The main reason for the visit, in a line or two.",
        rows: 2,
      },
      {
        name: "historyOfPresentingConcern",
        label: "History of the presenting concern",
        description:
          "How it began, how it has changed, and anything already tried.",
        rows: 5,
      },
      {
        name: "symptoms",
        label: "Symptoms",
        description: "What the patient describes experiencing.",
        rows: 4,
      },
    ],
  },
  {
    id: "findings",
    title: "What you find",
    description: "Your own observations and your reading of them.",
    fields: [
      {
        name: "clinicalObservations",
        label: "Clinical observations",
        description: "What you observe during the consultation.",
        rows: 5,
      },
      {
        name: "assessment",
        label: "Assessment",
        description: "Your clinical reasoning and how you are interpreting it.",
        rows: 5,
      },
      {
        name: "diagnosisOrClinicalImpression",
        label: "Diagnosis or clinical impression",
        description:
          "Where you have reached one. Leave it empty if the picture is still forming.",
        rows: 3,
      },
    ],
  },
  {
    id: "plan",
    title: "Notes and follow-up",
    description: "Anything else worth recording, and what comes next.",
    fields: [
      {
        name: "doctorNotes",
        label: "Notes",
        description:
          "Anything the sections above do not cover. Visible to you, not to the patient.",
        rows: 6,
      },
      {
        name: "followUpNotes",
        label: "Follow-up",
        description:
          "What you have asked the patient to do, and when you expect to see them.",
        rows: 4,
      },
    ],
  },
];

export const CONSULTATION_WORKSPACE_COPY = {
  heading: "Consultation",
  backLabel: "Back to the appointment",

  patientHeading: "Patient",
  appointmentHeading: "This appointment",
  recordHeading: "Consultation notes",

  /** Section 29: the practitioner must be able to confirm the right person. */
  identityHint: "Check this is the patient in front of you before you write.",

  nameLabel: "Name",
  preferredNameLabel: "Known as",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  genderLabel: "Gender",
  phoneLabel: "Phone",

  whenLabel: "Date and time",
  typeLabel: "Consultation",
  statusLabel: "Appointment status",

  startTitle: "Start the consultation",
  startDescription:
    "This opens the clinical record for this appointment and marks the appointment as in consultation.",
  startLabel: "Start consultation",
  startingLabel: "Starting…",

  notStartedTitle: "This consultation has not been started",
  notStartedDescription:
    "Open the appointment and start the consultation when the patient is with you.",
  notStartedAction: "Open the appointment",

  notFoundTitle: "We couldn't find that consultation",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your appointments to find it.",
  notFoundAction: "Back to your appointments",

  loadErrorTitle: "We couldn't load this consultation",
  loadErrorDescription:
    "Something went wrong at our end. Nothing has been changed. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",

  loadingLabel: "Loading the consultation",

  /**
   * The Phase 13 and 14 boundary, said where a practitioner will look for the
   * missing thing.
   *
   * The same convention every phase of this project has followed: name what
   * is not built, in the product, rather than only in a source comment.
   */
  /**
   * The two things a practitioner does next (Phase 13).
   *
   * Links rather than forms, because a prescription and a treatment plan are
   * their own documents with their own lifecycles — but reached from here,
   * because this is where the practitioner already is when they decide
   * (`phase_13.md` section 64: do not open unrelated pages during a
   * consultation).
   */
  nextStepsHeading: "Prescription and treatment plan",
  nextStepsDescription:
    "What you are asking this patient to take, and how you are asking them to eat, live and be treated. Each is kept separately from these notes, and neither is visible to the patient until you issue it.",
  prescriptionLinkLabel: "Open the prescription",
  treatmentPlanLinkLabel: "Open the treatment plan",
  /**
   * Phase 14. Reached from here for the same reason the other two are: this
   * is where the practitioner already is when a patient hands them a report,
   * and the patient, the appointment and the consultation come with them
   * rather than being typed (section 47).
   */
  documentsLinkLabel: "Documents for this patient",

  /**
   * Phase 17. Deliberately phrased as an aid rather than as a step.
   *
   * The other three links open documents this consultation produces. This one
   * opens a tool that produces nothing, and the label says so — "help me read
   * this record", not "generate the notes". `phase_17.md` section 135: the
   * primary workflow stays patient -> clinical record -> doctor decision, and
   * AI is secondary.
   */
  aiSupportLinkLabel: "AI clinical support",

  scopeNotice: {
    title: "The patient is not told automatically",
    body: "These notes, the prescription, the treatment plan and any document you attach are all recorded and kept. Punarvasu does not yet send the patient a reminder or a notification about any of them, so anything they need to be told still needs telling.",
  },
} as const;

export const CLINICAL_FORM_COPY = {
  requiredHint: "Needed before you can complete the consultation",
  optionalHint: "Optional",

  saveDraftLabel: "Save draft",
  savingLabel: "Saving…",
  completeLabel: "Complete consultation",
  completingLabel: "Completing…",

  /**
   * The save states (sections 33 and 69).
   *
   * Four of them, each unambiguous about whether the notes are in the
   * database. "Unsaved changes" is a warning rather than a neutral note,
   * because it is the state in which closing the laptop loses work.
   */
  statusIdle: "No changes yet",
  statusDirty: "Unsaved changes",
  statusSaving: "Saving…",
  statusSaved: (time: string) => `Saved at ${time}`,
  statusFailed: "Not saved",
  statusCompleted: "Consultation completed",
  statusRegionLabel: "Save status",

  /** The completion confirmation (section 35). */
  completeDialogTitle: "Complete this consultation?",
  completeDialogBody:
    "This saves the notes, closes the consultation and marks the appointment completed. After that the notes can no longer be edited.",
  completeDialogConfirm: "Complete consultation",
  completeDialogDismiss: "Keep editing",

  /** Blocked completion, explained rather than a disabled button. */
  completeBlockedTitle: "Two things are still needed",
  completeBlockedBody:
    "A completed consultation needs a chief complaint and an assessment. You can save a draft now and complete it once both are written.",

  /** The unsaved-changes guard (sections 67-68). */
  leaveDialogTitle: "You have unsaved changes",
  leaveDialogBody:
    "Your notes have not been saved. If you leave now they will be lost.",
  leaveStay: "Stay on this page",
  leaveSaveAndGo: "Save draft and leave",
  leaveDiscard: "Leave without saving",

  /**
   * The browser's own refresh/close warning.
   *
   * Browsers ignore custom text here and show their own wording, which is why
   * the in-page dialog above exists as well — section 67 says not to rely
   * solely on browser unload behaviour.
   */
  beforeUnload: "Your consultation notes have not been saved.",
} as const;

export const CLINICAL_RECORD_VIEW_COPY = {
  heading: "Clinical record",
  backLabel: "Back to the patient",

  completedOnLabel: "Completed on",
  recordedOnLabel: "First recorded",
  lastUpdatedLabel: "Last updated",
  appointmentLabel: "Appointment",
  openAppointmentLabel: "Open the appointment",

  emptyFieldValue: "Not recorded",

  /**
   * Why a completed record has no edit control.
   *
   * Section 16 and example 5. A sentence explaining the rule beats a disabled
   * button, which tells somebody nothing they can act on.
   */
  completedNotice: {
    title: "This consultation is complete",
    body: "Completed notes are kept as they were written and cannot be edited. If something needs correcting, record it in the next consultation — a formal amendment workflow is being built.",
  },

  draftNotice: {
    title: "These notes are still a draft",
    body: "The consultation has not been completed, so these notes can still be changed.",
  },
  continueDraftLabel: "Continue the consultation",

  notFoundTitle: "We couldn't find that record",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to the patient to find it.",
  notFoundAction: "Back to your patients",

  loadErrorTitle: "We couldn't load that record",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

export const CLINICAL_HISTORY_COPY = {
  heading: "Clinical history",
  description: "Consultations you have documented for this patient.",

  /**
   * The table's `<caption>`.
   *
   * Names the ordering as well as the contents, for the reason Phase 11
   * recorded: `TableScroller` is a labelled `region` landmark and so is the
   * `<section>` above it, and two landmarks sharing an accessible name is an
   * axe `landmark-unique` violation.
   */
  caption: "Consultations you have documented, most recent first",

  dateHeading: "Date",
  typeHeading: "Consultation",
  statusHeading: "Notes",
  actionsHeading: "Actions",
  viewLabel: "Open",

  emptyTitle: "No consultations documented yet",
  emptyDescription:
    "You have not written up a consultation for this patient. Notes appear here once you complete or save one.",

  errorTitle: "We couldn't load the clinical history",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",

  boundedNotice: "The most recent consultations are listed.",

  /**
   * Why the list may be shorter than the patient's whole history.
   *
   * Section 20 requires the access policy to be documented; it should also be
   * *visible*. A practitioner who sees an empty history needs to know whether
   * nothing exists or whether they are simply not the author.
   */
  scopeNotice: {
    title: "You see the consultations you documented",
    body: "Clinical records are readable by the practitioner who wrote them. Consultations documented by a colleague are not shown here.",
  },
} as const;

/** The word this product uses for a record's state, for prose and badges. */
export const CLINICAL_STATUS_LABELS: Readonly<
  Record<ClinicalRecordStatus, string>
> = {
  draft: "Draft",
  completed: "Completed",
  amended: "Amended",
};

/** Copy shared by every failure path that is not a specific one. */
export const CLINICAL_ERRORS = {
  forbidden: "You don't have permission to do that.",
  generic:
    "We couldn't save the clinical record. Your changes have not been saved — please try again.",
  sessionEnded:
    "Your session has ended. Your changes have not been saved. Sign in again in another tab, then save.",
} as const;
