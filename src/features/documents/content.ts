/**
 * Patient document copy.
 *
 * All of it in one file, for the same reason every other feature's copy is:
 * so the words a patient reads can be reviewed without reading React, and so
 * two screens cannot describe the same thing differently.
 *
 * The voice is the rest of Punarvasu's — calm, plain, never breezy. These
 * pages are read by somebody managing their own healthcare, sometimes while
 * unwell, and by a practitioner with a patient in the room.
 *
 * Two rules this file holds to:
 *
 *   * **nothing here makes a claim about a document's contents.** The
 *     application stores files; it does not read them, summarise them or say
 *     what they mean (`phase_14.md` sections 90-92);
 *   * **nothing here promises a security property the product does not
 *     have.** In particular no sentence says a file is scanned for malware,
 *     because no scanner exists (section 40).
 */

import {
  MAX_DOCUMENT_SIZE_LABEL,
  SIGNED_URL_TTL_SECONDS,
} from "@/config/documents";
import type { DocumentStatus, DocumentType, DocumentUploader } from "./types";

export const DOCUMENT_AREA = {
  patientList: {
    title: "Your documents",
    heading: "Your documents",
    description:
      "Reports and other documents kept with your clinic record. Only you and the practitioners treating you can see them.",
  },
  patientDetail: { title: "Document" },
  doctorList: { title: "Documents" },
  doctorDetail: { title: "Document" },
} as const;

/**
 * Section 80. What a patient would call these, not what the database does.
 *
 * `previous_prescription` is "Prescription from another clinic" rather than
 * "Prescription", so nobody confuses a scan they brought in with the
 * prescription their Punarvasu practitioner issued — which lives somewhere
 * else entirely and is not a file.
 */
export const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  lab_report: "Lab report",
  diagnostic_report: "Diagnostic report",
  medical_image: "Scan or medical image",
  previous_prescription: "Prescription from another clinic",
  referral: "Referral letter",
  previous_record: "Earlier medical record",
  other: "Other document",
};

export const DOCUMENT_STATUS_LABELS: Readonly<Record<DocumentStatus, string>> =
  {
    active: "Available",
    archived: "Archived",
  };

export const DOCUMENT_UPLOADER_LABELS: Readonly<
  Record<DocumentUploader, string>
> = {
  patient: "Uploaded by the patient",
  practitioner: "Uploaded by the clinic",
};

/** The same two facts, from the patient's side of the consultation. */
export const DOCUMENT_UPLOADER_LABELS_FOR_PATIENT: Readonly<
  Record<DocumentUploader, string>
> = {
  patient: "You uploaded this",
  practitioner: "The clinic uploaded this",
};

export const PATIENT_DOCUMENT_COPY = {
  heading: DOCUMENT_AREA.patientList.heading,
  description: DOCUMENT_AREA.patientList.description,

  // Section 73, and the voice the empty states elsewhere in the patient area
  // already use: say what this is for, not "no data".
  emptyTitle: "You don't have any documents yet",
  emptyDescription:
    "Upload a report or another document relevant to your care, and it will be here whenever you or your practitioner need it.",

  errorTitle: "We couldn't load your documents",
  errorDescription:
    "Please check your connection and try again. Nothing has been lost.",
  errorRetryLabel: "Try again",

  listCaption: "Your documents, most recently added first",
  titleHeading: "Document",
  typeHeading: "Type",
  dateHeading: "Added",
  sizeHeading: "Size",
  statusHeading: "Status",
  viewLabel: "Open",
  boundedNotice:
    "Showing your most recent documents. Contact the clinic if you need something older.",

  /**
   * Sections 66-68 and `docs/SECURITY.md` section 14, said to the patient
   * rather than only implemented. People share phones and laptops, and
   * somebody deciding whether to open a report on a shared machine deserves
   * to know how this works.
   */
  privacyNotice: {
    title: "Who can see these",
    body: "Your documents are stored privately. Only you and the practitioners treating you at Punarvasu can open them — reception and administration cannot. Links to a document expire after a few minutes, so nothing stays accessible in your browser history.",
  },
} as const;

export const DOCUMENT_UPLOAD_COPY = {
  heading: "Upload a document",
  description:
    "Add a report or another document relevant to your care so your practitioner can see it at your next consultation.",

  // Section 79. Guidance, not a form field asking for more than is needed.
  guidance:
    "Upload only documents relevant to your care. There is no need to upload anything else, and you do not need to describe your symptoms here — your practitioner will ask at your consultation.",

  fileLabel: "File",
  fileDescription: `PDF or a photograph — JPEG, PNG, WebP or HEIC. Up to ${MAX_DOCUMENT_SIZE_LABEL}.`,
  chooseFileLabel: "Choose a file",
  changeFileLabel: "Choose a different file",
  noFileSelected: "No file chosen yet",

  typeLabel: "What kind of document is this?",
  typeDescription: "This helps your practitioner find it later.",
  typePlaceholder: "Choose a type",

  titleLabel: "Title",
  titleDescription:
    "A short name you will recognise, such as “Blood test — September 2026”.",

  descriptionLabel: "Note (optional)",
  descriptionDescription:
    "Anything practical the clinic should know about this file, such as which hospital it came from. Please don't describe symptoms here.",

  submitLabel: "Upload document",
  submittingLabel: "Uploading…",

  progressLabel: "Upload progress",
  progressText: (percent: number) => `Uploading… ${percent}%`,
  finalisingText: "Almost done — saving the document…",

  successTitle: "Document uploaded",
  successBody:
    "It is now on your record and your practitioner can see it at your next consultation.",
  uploadAnotherLabel: "Upload another",

  // Section 50 and example 9: safe, actionable, and it says what happened to
  // the file.
  failureTitle: "We couldn't upload this document",
  failureBody:
    "The file was not saved. Please check your connection and try again.",

  networkFailure:
    "We couldn't reach the clinic to upload this document. The file was not saved — please check your connection and try again.",

  /**
   * Section 40, stated plainly rather than implied away. Claiming files are
   * safe when nothing checks them would be the worse of the two failures.
   */
  scanningNotice:
    "Files are checked for type and size, and are never opened or run by Punarvasu. They are not scanned for viruses, so please only upload documents from a source you trust.",
} as const;

export const DOCTOR_DOCUMENT_COPY = {
  heading: "Documents",
  description:
    "Reports and other documents on this patient's record — whether the patient uploaded them or the clinic did.",

  consultationHeading: "Documents for this consultation",
  consultationDescription:
    "Everything on this patient's record, and anything you add here is attached to this appointment.",

  uploadHeading: "Add a document",
  uploadDescription:
    "The patient, the appointment and the consultation are taken from where you are — there is nothing to select.",
  uploadGuidance:
    "Upload the document itself. Your findings belong in the consultation notes, not in the description here.",

  emptyTitle: "No documents for this patient",
  emptyDescription:
    "Nothing has been uploaded for this patient yet, by them or by the clinic.",

  errorTitle: "We couldn't load this patient's documents",
  errorDescription: "Please try again.",

  listCaption: "Documents on this patient's record, most recently added first",
  boundedNotice: "Showing the most recent documents on this record.",

  /**
   * The same shape of notice the clinical history carries: an empty list has
   * two explanations and the practitioner needs to know which.
   */
  scopeNotice: {
    title: "What you can see here",
    body: "Documents are shown for the patients you are booked to see, whoever uploaded them. Punarvasu does not read, interpret or summarise a document's contents — what a report says is for you to read.",
  },

  openLabel: "Open",
  patientLinkLabel: "All documents for this patient",
  backToConsultationLabel: "Back to the consultation",
  backToPatientLabel: "Back to the patient",

  /**
   * Sections 80-81. Who this is for and which visit it belongs to, shown
   * above the upload form so that attaching a report to the wrong patient
   * takes effort. A uuid in a hidden field is not something a practitioner
   * can check against the person in front of them; a name and a date of
   * birth is.
   */
  patientHeading: "Patient",
  appointmentHeading: "This consultation",
  identityHint:
    "Check this is the right person before uploading. Anything you add here is attached to this patient and this appointment.",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  /** Declared for completeness; no phone number is passed, so it never renders. */
  phoneLabel: "Phone",
  whenLabel: "Date and time",
  typeLabel: "Consultation",

  notFoundTitle: "Appointment unavailable",
  notFoundDescription:
    "This appointment isn't in your schedule, or the link may be wrong.",
  notFoundAction: "Back to your appointments",
} as const;

export const DOCUMENT_DETAIL_COPY = {
  backToListLabel: "Back to documents",

  detailsHeading: "Document details",
  typeLabel: "Type",
  addedLabel: "Added",
  uploadedByLabel: "Uploaded by",
  fileLabel: "File",
  sizeLabel: "Size",
  statusLabel: "Status",
  noteLabel: "Note",
  consultationLabel: "Consultation",
  consultationValue: "Attached to a consultation",

  previewHeading: "Preview",
  previewLoadingLabel: "Opening the document…",
  previewFrameTitle: "Document preview",
  previewOpenLabel: "Open preview",
  previewCloseLabel: "Close preview",
  previewUnavailableTitle: "This file can't be previewed here",
  previewUnavailableBody:
    "Your browser can't display this format. Download it to open it on your device.",
  previewArchivedBody:
    "This document has been archived, so it is not shown here. You can still download it.",

  downloadLabel: "Download",
  downloadPreparingLabel: "Preparing…",
  // Section 32, said to the reader so a stale tab is not a surprise.
  expiryNotice: `For your privacy, the link to this file expires after ${Math.round(
    SIGNED_URL_TTL_SECONDS / 60,
  )} minutes. Open it again if it stops working.`,

  accessErrorTitle: "We couldn't open this document",
  accessErrorBody: "Please try again.",

  notFoundTitle: "Document unavailable",
  // Sections 76 and example 6. It does not say whether the document exists.
  notFoundDescription:
    "This document isn't available. It may have been removed, or the link may be wrong.",
  notFoundAction: "Back to documents",

  loadErrorTitle: "We couldn't load this document",
  loadErrorDescription: "Please try again.",
  loadErrorRetryLabel: "Try again",
} as const;

export const DOCUMENT_ARCHIVE_COPY = {
  triggerLabel: "Archive document",
  dialogTitle: "Archive this document?",
  dialogDescription:
    "It will be marked as archived and taken out of the working record. Nothing is deleted — the document and this reason are kept, and it stays downloadable.",
  reasonLabel: "Reason (optional)",
  reasonDescription:
    "Why this document is being withdrawn, so anybody reading the record later understands.",
  cancelLabel: "Keep it",
  confirmLabel: "Archive document",
  confirmingLabel: "Archiving…",
  archivedNoticeTitle: "This document has been archived",
  archivedNoticeBody:
    "It has been withdrawn from the working record. It cannot be edited or restored, and it is still available to download.",
  reasonGivenLabel: "Reason",
} as const;

export const DOCUMENT_ERRORS = {
  sessionEnded: "Your session has ended. Please sign in again.",
  forbidden: "You don't have permission to do that.",
  /**
   * Phase 19. Says what happened and what to do, and never why in terms of a
   * limit somebody could tune their script against. "Your file was not saved"
   * is the sentence that matters: a patient who is not told that will assume
   * it was.
   */
  tooManyUploads:
    "You've uploaded a lot of files in a short time. Your file was not saved — please wait a few minutes and try again.",
  generic:
    "We couldn't complete that. Nothing has been changed — please try again.",
} as const;
