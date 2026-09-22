/**
 * Receptionist workspace copy.
 *
 * All of it in one file, for the same reason the marketing, authentication,
 * patient and appointment copy is: so the words can be reviewed without
 * reading React, and so two screens cannot describe the same thing
 * differently.
 *
 * ## The register is different here, deliberately
 *
 * Everywhere else in Punarvasu the voice is calm and unhurried, because the
 * reader is often unwell. This workspace is read by a member of staff with
 * somebody standing in front of them, so the words are short, concrete and
 * about the next action. `docs/PRODUCT_SPEC.md` section 5.3 says so plainly:
 * this is the one surface where efficiency outranks whitespace.
 *
 * It is still the same product. No jargon, no abbreviation a new receptionist
 * would have to learn, and no cheerfulness — "Marked as no-show", not
 * "Got it!".
 *
 * ## Two rules this file follows
 *
 * **Nothing here describes a patient's health.** Not in a label, not in a
 * placeholder, not in a help string. A note field is for scheduling and says
 * so; a cancellation reason is for scheduling and says so.
 *
 * **Nothing here claims an outcome or a clinical meaning.** An appointment
 * type is a length of time in a diary.
 */

export const RECEPTION_AREA = {
  title: "Front desk",
  navLabel: "Front desk",
  home: {
    title: "Today",
    heading: "Today at the clinic",
    description:
      "What is booked, what needs confirming, and who is due in next.",
  },
  schedule: {
    title: "Schedule",
    heading: "Schedule",
    description: "The clinic diary, one day at a time.",
  },
  patients: {
    title: "Patients",
    heading: "Find a patient",
    description:
      "Search by name or phone number. Results are limited, so narrow the search if the person you want is not shown.",
  },
  newPatient: {
    title: "Register a patient",
    heading: "Register a patient",
    description:
      "For someone the clinic has not seen before. Only a name is required — the rest can be added later.",
  },
  newAppointment: {
    title: "Book an appointment",
    heading: "Book an appointment",
    description:
      "Find the patient, choose the consultation and practitioner, then pick a time.",
  },
  appointment: {
    title: "Appointment",
  },
  patient: {
    title: "Patient",
  },
} as const;

/** The workspace's own navigation. Three places, because there are three. */
export const RECEPTION_NAV_ITEMS = [
  { label: "Today", href: "/receptionist", match: "exact" },
  { label: "Schedule", href: "/receptionist/schedule" },
  { label: "Patients", href: "/receptionist/patients" },
  // Phase 16. Operational scheduling analytics — the front desk's own
  // numbers. Guarded by `analytics.read.operational`, which the receptionist
  // holds, so the link is never offered to somebody the page would refuse.
  { label: "Analytics", href: "/receptionist/analytics" },
] as const;

export const TODAY_COPY = {
  /**
   * The counts.
   *
   * Operational only (`phase_10.md` section 42). Every one is a count of rows
   * the day's own query returned, so none of them can drift from the list
   * underneath it, and none of them is invented.
   */
  totalLabel: "Booked today",
  awaitingLabel: "Awaiting confirmation",
  checkedInLabel: "Checked in",
  cancelledLabel: "Cancelled today",

  nowHeading: "Happening now",
  nextHeading: "Next in",
  nowEmpty: "Nothing is in progress at the moment.",

  scheduleHeading: "Today's schedule",
  awaitingHeading: "Waiting to be confirmed",
  /**
   * The table's `<caption>`, distinct from the heading above it.
   *
   * `TableScroller` is a labelled `region` landmark, and so is the
   * `<section>` whose heading sits above it. Two landmarks of the same role
   * with the same accessible name is an axe `landmark-unique` violation.
   *
   * This was shipped in Phase 10 and found by Phase 11's browser pass — the
   * measured check Phase 10 recorded as its first known issue for not having
   * run. jsdom has no layout engine, so the component suite's axe sweeps
   * could not see it.
   */
  awaitingCaption: "Requests waiting to be confirmed, earliest first",
  awaitingDescription:
    "Requests patients have made online. Confirming one tells the patient the time is agreed.",
  awaitingEmpty: "Nothing is waiting to be confirmed.",

  emptyTitle: "Nothing booked today",
  emptyDescription:
    "The clinic has no appointments on this date. You can book one, or look at another day.",

  quickBookLabel: "Book an appointment",
  quickFindLabel: "Find a patient",
  quickScheduleLabel: "Open the schedule",
} as const;

export const SCHEDULE_COPY = {
  filtersLabel: "Filter the schedule",
  dateLabel: "Date",
  practitionerLabel: "Practitioner",
  practitionerAll: "All practitioners",
  statusLabel: "Status",
  statusAll: "All statuses",
  applyLabel: "Apply",
  resetLabel: "Clear filters",

  previousDayLabel: "Previous day",
  nextDayLabel: "Next day",
  todayLabel: "Today",

  tableCaption: "Appointments on the selected day, earliest first",
  timeHeading: "Time",
  patientHeading: "Patient",
  typeHeading: "Consultation",
  practitionerHeading: "Practitioner",
  statusHeading: "Status",
  actionsHeading: "Actions",

  emptyTitle: "No appointments match",
  emptyDescription:
    "Nothing on this day matches the filters you have chosen. Clear them, or try another date.",
  emptyDayTitle: "Nothing booked on this day",
  emptyDayDescription:
    "The clinic has no appointments on this date. You can book one, or look at another day.",

  loadErrorTitle: "We couldn't load the schedule",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
  loadingLabel: "Loading the schedule",

  viewLabel: "Open",
} as const;

export const PATIENT_SEARCH_COPY = {
  label: "Search patients",
  description: "Type at least two characters of a name, or part of a number.",
  placeholder: "Name or phone number",
  submitLabel: "Search",
  searchingLabel: "Searching…",

  resultsHeading: "Matching patients",
  resultsCaption: "Patients matching your search",
  nameHeading: "Name",
  phoneHeading: "Phone",
  dateOfBirthHeading: "Date of birth",
  cityHeading: "Town",
  accountHeading: "Account",

  hasAccountLabel: "Can sign in",
  noAccountLabel: "No account",

  idleTitle: "Search for a patient",
  idleDescription:
    "Type a name or a phone number above. Nothing is listed until you search.",

  tooShortTitle: "Keep typing",
  tooShortDescription:
    "Enter at least two characters so the search has something to match.",

  emptyTitle: "No patients found",
  emptyDescription:
    "Nothing matches that search. Check the spelling, try part of a phone number, or register the patient if they are new.",
  emptyAction: "Register a patient",

  errorTitle: "We couldn't run that search",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",

  boundedNotice:
    "Only the first matches are listed. Narrow the search if the person you want is not here.",

  selectLabel: "Choose",
  viewLabel: "Open",
} as const;

export const PATIENT_RECORD_COPY = {
  detailsHeading: "Patient details",
  contactHeading: "Contact",
  addressHeading: "Address",
  emergencyHeading: "Emergency contact",

  nameLabel: "Name",
  preferredNameLabel: "Preferred name",
  phoneLabel: "Phone",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  genderLabel: "Gender",
  addressLabel: "Address",
  cityLabel: "Town or city",
  stateLabel: "State",
  postalCodeLabel: "Postal code",
  emergencyNameLabel: "Name",
  emergencyRelationshipLabel: "Relationship",
  emergencyPhoneLabel: "Phone",
  languageLabel: "Preferred language",
  accountLabel: "Account",
  registeredLabel: "Registered",

  hasAccountValue: "This patient can sign in and manage their own bookings.",
  noAccountValue:
    "No account. This record was created at the clinic; the patient cannot sign in yet.",

  upcomingHeading: "Upcoming appointments",
  /** See `TODAY_COPY.awaitingCaption` for why this differs from the heading. */
  upcomingCaption: "Upcoming appointments for this patient, earliest first",
  upcomingEmpty: "Nothing booked. You can book an appointment for them.",
  recentHeading: "Recent appointments",
  recentCaption: "Recent appointments for this patient, most recent first",

  bookLabel: "Book an appointment",

  /**
   * Shown on every patient record.
   *
   * The front desk sees operational information because that is what the front
   * desk needs. Saying so on the page is not decoration: it is how a new
   * receptionist learns where the boundary is, rather than assuming the
   * absence of clinical information is a loading failure.
   */
  scopeNotice: {
    title: "Operational information only",
    body: "This is what the front desk needs to schedule and contact this patient. Consultation notes, assessments and prescriptions are not shown here and are not available to this account.",
  },

  notFoundTitle: "We couldn't find that patient",
  notFoundDescription:
    "The record may have been removed, or the link may be wrong. Search again from the patients page.",
  notFoundAction: "Search patients",

  loadErrorTitle: "We couldn't load that patient",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

export const NEW_PATIENT_COPY = {
  identityHeading: "Who is this?",
  contactHeading: "How can the clinic reach them?",
  addressHeading: "Address",
  emergencyHeading: "Emergency contact",
  emergencyDescription:
    "Someone to contact about this patient. Optional, and both a name and a number are needed if either is given.",

  fullNameLabel: "Full name",
  fullNameDescription: "As the patient gives it.",
  preferredNameLabel: "Preferred name",
  phoneLabel: "Phone number",
  phoneDescription: "A mobile or landline. Used to contact them about visits.",
  dateOfBirthLabel: "Date of birth",
  genderLabel: "Gender",
  genderUnspecified: "Not specified",
  addressLine1Label: "Address line 1",
  addressLine2Label: "Address line 2",
  cityLabel: "Town or city",
  stateLabel: "State",
  postalCodeLabel: "Postal code",
  emergencyNameLabel: "Contact name",
  emergencyRelationshipLabel: "Relationship to the patient",
  emergencyPhoneLabel: "Contact phone number",
  languageLabel: "Preferred language",

  submitLabel: "Register patient",
  submittingLabel: "Registering…",
  cancelLabel: "Cancel",

  successTitle: "Patient registered",
  successBody: "You can book an appointment for them now.",

  /**
   * The duplicate warning.
   *
   * `phase_10.md` section 33: show what already exists and let the receptionist
   * decide. It never merges, never blocks, and never picks for them — the two
   * ways it could be wrong are creating a second record for one person and
   * attaching one person's visit to another's record, and the second is far
   * worse.
   */
  duplicateTitle: "A patient with similar details already exists",
  duplicateBody:
    "Please check before registering another record. If one of these is the same person, open their record instead.",
  duplicateReasonPhone: "Same phone number",
  duplicateReasonNameDob: "Same name and date of birth",
  duplicateContinueLabel: "This is someone else — register anyway",
  duplicateOpenLabel: "Open",

  /**
   * What registering does and does not do.
   *
   * A record created here belongs to the clinic, not to a login. Saying so
   * prevents the reasonable assumption that registering somebody gives them an
   * account — and `phase_10.md` section 35 forbids creating credentials on a
   * patient's behalf, so there is no version of this that does.
   */
  accountNotice: {
    title: "This creates a clinic record, not a login",
    body: "The patient will not be able to sign in from this. If they want online access they register themselves on the website, and the clinic links the two.",
  },

  clinicalNotice:
    "Please don't record symptoms, conditions or medicines here. This form is for identifying and contacting the patient.",

  saveErrorMessage:
    "We couldn't register that patient. Please check the details and try again.",
  validationErrorMessage: "Please check the highlighted fields and try again.",
} as const;

export const STAFF_BOOKING_COPY = {
  patientHeading: "Which patient?",
  patientDescription:
    "Search for them, or register them first if they are new to the clinic.",
  patientChosenLabel: "Booking for",
  changePatientLabel: "Change patient",

  typeHeading: "Which consultation?",
  typeDescription: "This sets how long the diary holds.",

  practitionerHeading: "Which practitioner?",
  practitionerDescription: "Only practitioners currently working are listed.",

  dateHeading: "Which day?",
  timeHeading: "Which time?",
  timeDescription:
    "Times are the practitioner's working hours, with anything already booked removed.",

  reviewHeading: "Check the booking",
  reviewDescription:
    "Booking this confirms it straight away — the patient does not need to confirm anything.",

  noteLabel: "Scheduling note",
  noteDescription:
    "Optional. Practical things only — a ground-floor room, coming with someone, a language preference. Not symptoms or medicines.",

  submitLabel: "Book appointment",
  submittingLabel: "Booking…",
  backLabel: "Back",

  successTitle: "Appointment booked",
  successBody: "It is confirmed. The patient does not need to do anything.",

  noPractitionersTitle: "No practitioner is set up yet",
  noPractitionersDescription:
    "Nobody has been added to the clinic's scheduling roster, so there is nobody to book with. An administrator needs to add a practitioner and their working hours.",
  noTypesTitle: "No consultation types are set up",
  noTypesDescription:
    "There is nothing to book. An administrator needs to add at least one consultation type.",
  noDatesTitle: "No working days in the booking window",
  noDatesDescription:
    "This practitioner has no working hours set, so there are no days to choose from.",

  validationErrorMessage: "Please check the highlighted fields and try again.",
} as const;

export const APPOINTMENT_ACTIONS_COPY = {
  heading: "What would you like to do?",
  noneAvailable:
    "This appointment has finished or been cancelled, so there is nothing left to change.",

  rescheduleLabel: "Change time",
  rescheduleHeading: "Change the time",
  rescheduleDescription:
    "Pick a new day and time. The appointment keeps its place until the new time is saved.",
  rescheduleSubmitLabel: "Move to this time",
  rescheduleSubmittingLabel: "Moving…",
  rescheduleSuccessTitle: "Appointment moved",
  rescheduleSuccessBody: "The new time is saved.",
  currentTimeLabel: "Currently booked for",

  confirmDialogTitle: (action: string) => `${action}?`,
  reasonLabel: "Reason",
  reasonDescription:
    "Optional, and recorded against the appointment. Keep it to scheduling — a phone call, a clash, a cancellation.",
  dismissLabel: "Go back",

  cancelBody:
    "The time goes back into the diary and the patient's appointment is marked cancelled. The record is kept.",
  noShowBody:
    "This records that the patient did not attend. It cannot be undone from here.",

  statusSuccess: {
    confirmed: "Appointment confirmed.",
    checked_in: "Patient checked in.",
    no_show: "Marked as a no-show.",
    cancelled: "Appointment cancelled.",
  },

  workingLabel: "Working…",
} as const;

export const APPOINTMENT_DETAIL_COPY = {
  heading: "Appointment",
  backLabel: "Back to the schedule",

  summaryHeading: "Appointment",
  whenLabel: "Date and time",
  durationLabel: "Length",
  typeLabel: "Consultation",
  practitionerLabel: "Practitioner",
  statusLabel: "Status",
  referenceLabel: "Reference",
  bookedOnLabel: "Booked on",
  noteLabel: "Scheduling note",
  cancelledOnLabel: "Cancelled on",
  cancellationReasonLabel: "Reason given",

  patientHeading: "Patient",
  patientNameLabel: "Name",
  patientPhoneLabel: "Phone",
  openPatientLabel: "Open patient record",

  historyHeading: "History",

  notFoundTitle: "We couldn't find that appointment",
  notFoundDescription:
    "It may have been removed, or the link may be wrong. Go back to the schedule to find it.",
  notFoundAction: "Back to the schedule",

  loadErrorTitle: "We couldn't load that appointment",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

/**
 * Shown at the top of the workspace.
 *
 * Every phase of this project has told the reader when what they are looking
 * at is not yet confirmed, rather than saying it only in a source comment. The
 * consultation types, their lengths and the booking window are still working
 * defaults, and the receptionist is the person most likely to notice they are
 * wrong — so they are the person who should be told.
 */
export const RECEPTION_REVIEW_NOTICE = {
  title: "Scheduling settings are still provisional",
  body: "Consultation lengths and how far ahead the diary is open are working defaults that the clinic has not confirmed. Tell an administrator if they do not match how Punarvasu actually runs.",
} as const;

/** Copy shared by every failure path that is not a specific one. */
export const RECEPTION_ERRORS = {
  forbidden: "You don't have permission to do that.",
  generic: "Something went wrong. Please try again.",
  sessionEnded: "Your session has ended. Please sign in again to continue.",
} as const;
