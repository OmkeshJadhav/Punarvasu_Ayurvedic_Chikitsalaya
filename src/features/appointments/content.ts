/**
 * Appointment copy.
 *
 * All of it in one file, for the same reason the marketing, authentication and
 * patient copy is: so the words a patient reads can be reviewed without
 * reading React, and so two screens cannot describe the same thing
 * differently.
 *
 * The voice is the rest of Punarvasu's — calm, plain, never breezy. Someone
 * booking a consultation is often unwell, and a booking flow that sounds like
 * a hotel reservation is the wrong register.
 *
 * ## Two rules this file follows
 *
 * **Nothing here claims a clinical outcome.** An appointment type is a length
 * of time in a diary, not a treatment, and no sentence below suggests what
 * care will involve or achieve (`docs/HEALTHCARE_AND_AI_SAFETY.md`).
 *
 * **Nothing here claims the clinic has agreed to anything it has not.** An
 * appointment is created `requested`, so the confirmation says "requested" —
 * `phase_09.md` sections 21 and 48 forbid showing "confirmed" while the status
 * is still pending, and it would be a false reassurance to someone arranging
 * their week around it.
 */

/**
 * Shown at the top of the booking flow.
 *
 * The clinic has confirmed neither the appointment types nor their durations,
 * nor the minimum notice and booking horizon. Every previous phase of this
 * project has said so to the visitor rather than only in a source comment, and
 * this is the same decision (`phase_04` treatment review notice,
 * `phase_05` practitioner notice).
 */
export const BOOKING_REVIEW_NOTICE = {
  title: "Booking is new, and these details are still being confirmed",
  body: "The consultation types, their lengths and the notice period below are working defaults while Punarvasu confirms how it wants online booking to run. Your request reaches the clinic either way, and the clinic will contact you to confirm the time.",
} as const;

export const APPOINTMENTS_AREA = {
  navLabel: "Appointments",
  list: {
    title: "Your appointments",
    heading: "Your appointments",
    description:
      "Consultations you have requested, and the ones you have already had.",
    /**
     * Shown only when the patient has more history than this page reads.
     *
     * It names the bound rather than hiding it, and says which end was cut:
     * every upcoming appointment is here, and it is the oldest visits that
     * are not. A patient who needs one of those can ask the clinic, which is
     * the honest instruction while there is no archive view.
     */
    truncatedNotice:
      "Showing your 100 most recent appointments. Every upcoming appointment is listed; older visits are not. Contact the clinic if you need a record of an earlier visit.",
  },
  book: {
    title: "Request an appointment",
    heading: "Request an appointment",
    description:
      "Choose the kind of consultation, who you would like to see, and a time that suits you. The clinic confirms every request.",
  },
  detail: {
    title: "Appointment details",
  },
  reschedule: {
    title: "Change your appointment time",
    heading: "Change your appointment time",
    description:
      "Choose a new time. Your appointment keeps its place until the new time is saved, and the clinic will confirm it again.",
  },
} as const;

/** The steps, named once, so the progress indicator and the headings agree. */
export const BOOKING_STEPS = [
  { id: "type", label: "Consultation" },
  { id: "practitioner", label: "Practitioner" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "review", label: "Review" },
] as const;

export type BookingStepId = (typeof BOOKING_STEPS)[number]["id"];

export const BOOKING_COPY = {
  typeHeading: "What kind of consultation?",
  typeDescription:
    "This sets how long the clinic sets aside for you. If you are not sure, choose an initial consultation and the clinic will adjust it.",

  practitionerHeading: "Who would you like to see?",
  practitionerDescription:
    "Whoever you see takes the same kind of history and assesses the same way. If you have no preference, choose whoever has a time that suits you.",

  dateHeading: "Which day?",
  dateDescription: "Days the practitioner is not working are not shown.",

  timeHeading: "Which time?",
  timeDescription: "Times are shown in clinic time.",

  reviewHeading: "Check your request",
  reviewDescription:
    "Nothing is sent until you choose to request it. The clinic will confirm the time with you.",

  noteLabel: "Anything the clinic should know when scheduling?",
  noteDescription:
    "Optional. This is for practical things — needing a ground-floor room, coming with someone, a language preference. Please don't describe symptoms, medicines or conditions here; those belong in your consultation, not in a booking form.",
  notePlaceholder: "",

  submitLabel: "Request this appointment",
  submittingLabel: "Sending your request…",
  backLabel: "Back",
  changeLabel: "Change",

  slotsLoadingLabel: "Loading available times",
  slotsEmptyTitle: "No times available on this day",
  slotsEmptyDescription:
    "The practitioner has no free time on this date. Please choose another day, or contact the clinic if nothing suits.",
  slotsErrorTitle: "We couldn't load available times",
  slotsErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  slotsRetryLabel: "Try again",

  noPractitionersTitle: "Online booking is not open yet",
  noPractitionersDescription:
    "No practitioner has been set up for online booking, so there is nothing to show you here. Please contact the clinic to arrange a consultation, and we will open booking as soon as it is ready.",

  noticeSummary: (hours: number, days: number) =>
    `Appointments can be requested from ${hours} hours ahead and up to ${days} days in advance.`,

  profileRequiredTitle: "Complete your profile first",
  profileRequiredDescription:
    "The clinic needs to know who the appointment is for before you can request one. It takes a moment — only your name is required.",
  profileRequiredAction: "Complete your profile",
} as const;

export const APPOINTMENT_COPY = {
  upcomingHeading: "Upcoming",
  pastHeading: "Past",
  cancelledHeading: "Cancelled",

  emptyUpcomingTitle: "No upcoming appointments",
  emptyUpcomingDescription:
    "You don't have a consultation booked. You can request one whenever you are ready.",
  emptyPastDescription: "Appointments you have had will appear here.",
  emptyCancelledDescription: "Appointments you cancel will appear here.",

  bookLabel: "Request an appointment",
  viewLabel: "View details",
  /** The detail page's own heading. */
  detailsLabel: "Appointment details",
  /** The heading of the block *inside* it, so no page has two of the same. */
  summaryHeading: "Your appointment",

  practitionerLabel: "Practitioner",
  typeLabel: "Consultation",
  whenLabel: "Date and time",
  durationLabel: "Length",
  statusLabel: "Status",
  whereLabel: "Where",
  noteLabel: "Your note",
  referenceLabel: "Reference",
  requestedOnLabel: "Requested on",
  cancelledOnLabel: "Cancelled on",
  cancellationReasonLabel: "Reason given",

  historyHeading: "What has happened to this appointment",
  historyCreated: "Requested",
  historyRescheduled: "Moved to a new time",
  historyCancelled: "Cancelled",
  historyStatusChanged: "Status changed",

  loadErrorTitle: "We couldn't load your appointments",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
  loadingLabel: "Loading your appointments",

  notFoundTitle: "We couldn't find that appointment",
  notFoundDescription:
    "It may have been removed, or the link may be wrong. Your appointments are listed below.",
  notFoundAction: "See your appointments",

  /**
   * What "requested" means, in words.
   *
   * Shown wherever the status is. A patient who reads "Requested" and assumes
   * it is booked has been misled by the product, not by themselves.
   */
  requestedExplainer:
    "The clinic has your request and will contact you to confirm the time. It is not confirmed yet.",
  confirmedExplainer: "The clinic has confirmed this time with you.",
} as const;

export const CANCEL_COPY = {
  triggerLabel: "Cancel appointment",
  title: "Cancel this appointment?",
  body: "The clinic will be told the time is free again. You can request another appointment whenever you like.",
  reasonLabel: "Would you like to tell the clinic why?",
  reasonDescription:
    "Optional, and never required. Please keep it to scheduling — you don't need to explain anything about your health here.",
  confirmLabel: "Cancel appointment",
  confirmingLabel: "Cancelling…",
  dismissLabel: "Keep appointment",
  successTitle: "Appointment cancelled",
  successBody: "The clinic has been told. Nothing else is needed from you.",
} as const;

export const RESCHEDULE_COPY = {
  triggerLabel: "Change time",
  submitLabel: "Move to this time",
  submittingLabel: "Moving your appointment…",
  successTitle: "Appointment moved",
  successBody:
    "Your appointment has been moved and sent back to the clinic to confirm.",
  currentTimeLabel: "Currently booked for",
} as const;

export const CONFIRMATION_COPY = {
  /**
   * The heading after a successful booking.
   *
   * "Requested", not "Confirmed". The appointment's status is `requested`, and
   * `phase_09.md` sections 21 and 48 forbid claiming otherwise
   * (`docs/DESIGN_SYSTEM.md` section 29 asks for a strong confirmation state,
   * which this is — of the right thing).
   */
  title: "Appointment requested",
  body: "The clinic has your request. Someone will contact you to confirm the time.",
  nextStepsHeading: "What happens next",
  nextSteps: [
    "The clinic reviews your request and confirms the time with you.",
    "If the time no longer suits you, you can change or cancel it from this page.",
  ],
  viewLabel: "See your appointments",
} as const;
