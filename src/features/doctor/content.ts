/**
 * Doctor workspace copy.
 *
 * All of it in one file, for the same reason the marketing, authentication,
 * patient, appointment and reception copy is: so the words can be reviewed
 * without reading React, and so two screens cannot describe the same thing
 * differently.
 *
 * ## The register
 *
 * Short, concrete and about the next action, like the front desk's — the
 * reader is a professional mid-clinic, not a patient. But quieter: a
 * practitioner is about to give somebody their attention, and the interface
 * should not be competing for it (`phase_11.md` section 3).
 *
 * ## Three rules this file follows
 *
 * **Nothing here describes a patient's health.** Not in a label, not in a
 * placeholder, not in a help string. There is no word for a symptom, a
 * diagnosis, a medicine or a plan anywhere in this workspace, because there
 * is nothing behind one.
 *
 * **Nothing here claims a clinical outcome, a statistic or a credential.**
 * `phase_11.md` section 7 and example 6: no patient counts, no success rates,
 * no revenue. Every figure the workspace shows is a count of rows on the page
 * beneath it.
 *
 * **Where a capability does not exist, the words say so.** A practitioner who
 * opens a consultation and finds nowhere to write should be told that
 * clinical records are still being built, not left assuming the page failed
 * to load.
 */

export const DOCTOR_AREA = {
  title: "Clinical workspace",
  navLabel: "Clinical workspace",
  home: {
    title: "Today",
    heading: "Your day",
    description: "Who you are seeing, and who is next.",
  },
  appointments: {
    title: "Appointments",
    heading: "Your appointments",
    description: "Everything booked with you, and everything already seen.",
  },
  patients: {
    title: "Patients",
    heading: "Your patients",
    description:
      "Search the people you are booked to see. Results are limited, so narrow the search if the person you want is not shown.",
  },
  appointment: {
    title: "Appointment",
  },
  patient: {
    title: "Patient",
  },
  consultation: {
    title: "Consultation",
  },
} as const;

/** The workspace's own navigation. Three places, because there are three. */
export const DOCTOR_NAV_ITEMS = [
  { label: "Today", href: "/doctor", match: "exact" },
  { label: "Appointments", href: "/doctor/appointments" },
  { label: "Patients", href: "/doctor/patients" },
  // Phase 16. The practitioner's own practice, and only their own: the
  // figures behind this link are scoped by `assert_care_practitioner()` in
  // the database and carry no colleague's numbers and no clinic total.
  { label: "My practice", href: "/doctor/analytics" },
] as const;

export const DOCTOR_TODAY_COPY = {
  /**
   * The four counts.
   *
   * `phase_11.md` section 7's list — today's appointments, completed,
   * pending, next — expressed as three counts plus the next-patient panel
   * beneath them. Each is a count of rows the day's own query returned.
   */
  totalLabel: "Booked today",
  remainingLabel: "Still to see",
  completedLabel: "Completed",
  awaitingLabel: "Awaiting confirmation",

  nowHeading: "With you now",
  nextHeading: "Next patient",
  nowEmpty: "Nobody is in consultation at the moment.",
  nextEmpty: "Nothing else is booked today.",

  scheduleHeading: "Today's schedule",

  emptyTitle: "Nothing booked today",
  emptyDescription:
    "You have no appointments on this date. You can look at another day, or at everything booked with you.",

  viewAllLabel: "All appointments",
  findPatientLabel: "Find a patient",
  previousDayLabel: "Previous day",
  nextDayLabel: "Next day",
  todayLabel: "Today",
} as const;

export const DOCTOR_SCHEDULE_COPY = {
  /**
   * A table's `<caption>`, and the label on its scroll region.
   *
   * Every caption in this workspace names the **ordering** as well as the
   * contents, and that is not decoration. `TableScroller` is a labelled
   * `region` landmark, and so is the `<section>` whose heading sits above it;
   * two landmarks of the same role with the same accessible name is an axe
   * `landmark-unique` violation, which is exactly what the Phase 11 browser
   * pass found on three pages. Saying "…, most recent first" makes the two
   * names distinct *and* tells a screen-reader user something the sighted
   * reader gets from the column order for free.
   */
  tableCaption: "Your appointments, earliest first",
  timeHeading: "Time",
  patientHeading: "Patient",
  typeHeading: "Consultation",
  statusHeading: "Status",
  actionsHeading: "Actions",

  dateHeading: "Date",
  ageLabel: "Age",

  filtersLabel: "Filter your appointments",
  rangeLabel: "When",
  rangeToday: "Today",
  rangeUpcoming: "Upcoming",
  rangePast: "Past",
  statusLabel: "Status",
  statusAll: "All statuses",
  typeLabel: "Consultation",
  typeAll: "All consultations",
  applyLabel: "Apply",
  resetLabel: "Clear filters",

  emptyTitle: "No appointments match",
  emptyDescription:
    "Nothing matches the filters you have chosen. Clear them, or look at another range.",
  emptyRangeTitle: "Nothing here",
  emptyRangeDescription:
    "You have no appointments in this range. Try another one.",

  loadErrorTitle: "We couldn't load your appointments",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
  loadingLabel: "Loading your appointments",

  viewLabel: "Open",
  boundedNotice: "The most recent are listed first.",
} as const;

export const DOCTOR_PATIENT_SEARCH_COPY = {
  label: "Search your patients",
  description:
    "Type at least two characters of a name, or part of a number. Only people you are booked to see are searched.",
  placeholder: "Name or phone number",
  submitLabel: "Search",
  searchingLabel: "Searching…",

  resultsCaption: "Patients you are booked to see, matching your search",
  nameHeading: "Name",
  phoneHeading: "Phone",
  dateOfBirthHeading: "Date of birth",
  lastSeenHeading: "Last appointment with you",

  idleTitle: "Search your patients",
  idleDescription:
    "Type a name or a phone number above. Nothing is listed until you search.",

  tooShortTitle: "Keep typing",
  tooShortDescription:
    "Enter at least two characters so the search has something to match.",

  emptyTitle: "No patients found",
  emptyDescription:
    "Nothing matches that search among the people you are booked to see. If they are new to you, they will appear here once an appointment is booked with you.",

  errorTitle: "We couldn't run that search",
  errorDescription:
    "Something went wrong at our end. Please try again in a moment.",

  boundedNotice:
    "Only the first matches are listed. Narrow the search if the person you want is not here.",

  viewLabel: "Open",

  /**
   * Why the list is shorter than the clinic's.
   *
   * `phase_11.md` section 16 requires the access model to be documented. It
   * should also be *visible*: a practitioner who cannot find a patient needs
   * to know whether the search failed or the person is simply not theirs.
   */
  scopeNotice: {
    title: "You see the patients you are booked to see",
    body: "This searches people who have an appointment with you, now or in the past. Anybody else is not shown, and the front desk can book them in if you need to see them.",
  },
} as const;

export const DOCTOR_PATIENT_COPY = {
  contextHeading: "Patient",
  detailsHeading: "Patient details",
  contactHeading: "Contact",
  emergencyHeading: "Emergency contact",

  nameLabel: "Name",
  preferredNameLabel: "Preferred name",
  dateOfBirthLabel: "Date of birth",
  ageLabel: "Age",
  genderLabel: "Gender",
  languageLabel: "Preferred language",
  phoneLabel: "Phone",
  locationLabel: "Town",
  emergencyNameLabel: "Name",
  emergencyRelationshipLabel: "Relationship",
  emergencyPhoneLabel: "Phone",
  registeredLabel: "Registered with the clinic",

  upcomingHeading: "Upcoming with you",
  /** See `DOCTOR_SCHEDULE_COPY.tableCaption` for why this differs. */
  upcomingCaption: "Upcoming appointments with you, earliest first",
  upcomingEmpty: "Nothing booked with you at the moment.",
  historyHeading: "Previous appointments with you",
  historyCaption: "Previous appointments with you, most recent first",
  historyEmpty: "You have not seen this patient before.",
  historyBoundedNotice: "The most recent appointments are listed.",

  /**
   * What this summary is, and what is beside it.
   *
   * Phase 11 used this slot to say that clinical records did not exist yet.
   * They do now, so the notice says where they are instead of apologising for
   * their absence — and it still names the two capabilities that genuinely do
   * not exist, which is the convention every phase of this project has
   * followed (`phase_11.md` section 18, `phase_12.md` sections 48-49).
   */
  clinicalNotice: {
    title: "This is the patient's record, not their notes",
    body: "Who the patient is and how to reach them. The consultations, prescriptions and treatment plans you have written, and the documents on their record, are listed separately on this page.",
  },

  notFoundTitle: "We couldn't find that patient",
  notFoundDescription:
    "You may not be booked to see them, or the link may be wrong. Search again from your patients page.",
  notFoundAction: "Search your patients",

  loadErrorTitle: "We couldn't load that patient",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

export const DOCTOR_APPOINTMENT_COPY = {
  heading: "Appointment",
  backLabel: "Back to your appointments",

  // Not "Appointment": the page's own `<h1>` is already that, and both this
  // group and the page frame are named `region` landmarks. Two landmarks of
  // the same role sharing an accessible name is an axe `landmark-unique`
  // violation — found by the Phase 11 browser pass, invisible to jsdom.
  detailsHeading: "Appointment details",
  whenLabel: "Date and time",
  durationLabel: "Length",
  typeLabel: "Consultation",
  statusLabel: "Status",
  referenceLabel: "Reference",
  bookedOnLabel: "Booked on",
  noteLabel: "Scheduling note",
  noteDescription:
    "Written by whoever booked the appointment. Practical scheduling information only.",
  cancelledOnLabel: "Cancelled on",

  patientHeading: "Patient",
  openPatientLabel: "Open patient",

  notFoundTitle: "We couldn't find that appointment",
  notFoundDescription:
    "It may not be one of yours, or the link may be wrong. Go back to your appointments to find it.",
  notFoundAction: "Back to your appointments",

  loadErrorTitle: "We couldn't load that appointment",
  loadErrorDescription:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
} as const;

export const DOCTOR_ACTIONS_COPY = {
  heading: "What would you like to do?",
  noneAvailable:
    "This appointment has finished, been missed or been cancelled, so there is nothing left to change here.",
  deskOnly:
    "Cancelling and moving an appointment are done at the front desk, so the patient can be told.",

  confirmDialogTitle: (action: string) => `${action}?`,
  dismissLabel: "Go back",
  workingLabel: "Working…",

  statusSuccess: {
    confirmed: "Appointment confirmed.",
    in_consultation: "Consultation started.",
    completed: "Consultation completed.",
    no_show: "Recorded as not attended.",
  },
} as const;

export const CONSULTATION_COPY = {
  heading: "Consultation",
  backLabel: "Back to the appointment",

  inProgressLabel: "In progress",
  startedHeading: "Consultation in progress",
  startedDescription:
    "The appointment is marked as in consultation. Complete it when you are finished.",

  contextHeading: "Who you are seeing",
  appointmentHeading: "This appointment",
  historyHeading: "Previous appointments with you",
  historyCaption: "Previous appointments with you, most recent first",

  completeLabel: "Complete consultation",
  completingLabel: "Completing…",

  notStartedTitle: "This consultation has not been started",
  notStartedDescription:
    "Open the consultation workspace to start it when the patient is with you.",
  notStartedAction: "Open the appointment",

  /** The way into the workspace, from the appointment. */
  openWorkspaceLabel: "Open the consultation",
} as const;

/**
 * Shown when a doctor account is not on the clinic's scheduling roster.
 *
 * Holding the doctor role and having a practitioner record are two different
 * things, and the second is what a diary hangs off. An account with no
 * practitioner record has no appointments and no patients — which would
 * otherwise render as a quiet, wrong "nothing booked today".
 */
export const NO_PRACTITIONER_RECORD = {
  title: "Your account isn't on the scheduling roster yet",
  body: "Your access is set up, but nobody has added you to the clinic's list of practitioners, so there is no diary to show. An administrator needs to do that before appointments can be booked with you.",
} as const;

/**
 * Shown at the top of the workspace.
 *
 * Every phase of this project has told the reader when what they are looking
 * at is not finished, rather than saying it only in a source comment. A
 * practitioner opening this workspace expecting a clinical record system
 * should find out immediately, and from the product.
 */
export const DOCTOR_SCOPE_NOTICE = {
  title: "Reminders and notifications are still being built",
  body: "Today's appointments, your patients, the consultations you document, the prescriptions and treatment plans you write, and the documents on a patient's record are all here. Punarvasu does not yet send a patient any reminder or notification, so anything that needs telling still needs telling.",
} as const;

/** Copy shared by every failure path that is not a specific one. */
export const DOCTOR_ERRORS = {
  forbidden: "You don't have permission to do that.",
  generic: "Something went wrong. Please try again.",
  sessionEnded: "Your session has ended. Please sign in again to continue.",
} as const;
