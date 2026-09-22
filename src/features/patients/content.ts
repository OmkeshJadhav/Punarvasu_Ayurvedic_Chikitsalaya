/**
 * Patient area copy.
 *
 * All of it in one file, for the same reason the marketing and authentication
 * copy is: so the words a patient reads can be reviewed without reading React,
 * and so two screens cannot describe the same thing differently.
 *
 * The voice is the rest of Punarvasu's — calm, plain, never breezy. These
 * pages are read by somebody managing their own healthcare details, sometimes
 * while unwell.
 *
 * Every "why we ask" sentence here must be **true of what the product actually
 * does** (`phase_07.md` section 75). Where the clinic does not yet use a
 * detail, the sentence says what it is kept for, not what it will one day
 * enable.
 */

export const PATIENT_AREA = {
  navLabel: "Patient area",
  overview: {
    title: "Your Punarvasu account",
    heading: "Your Punarvasu account",
    description:
      "Your appointments, prescriptions, treatment plans, documents and personal details, kept in one place.",
  },
  profile: {
    title: "Your profile",
    heading: "Your profile",
    description:
      "Keep your personal details up to date so the clinic can identify you and reach you about your care.",
  },
} as const;

/**
 * The patient dashboard (Phase 18).
 *
 * ## The greeting
 *
 * A name and nothing else. No email, no identifier, no role, no clinical word
 * — `phase_18.md` section 99 and `DESIGN_SYSTEM.md` section 48: this page is
 * read on a phone in a waiting room, and over shoulders.
 *
 * There is deliberately **no time-of-day greeting**. "Good morning" is
 * computed from a clock, and a server clock and a patient's clock are not the
 * same clock — a patient in another timezone being told "good morning" at
 * nine at night is a small thing that makes a healthcare product feel
 * careless. A plain welcome is true at every hour.
 *
 * ## The section headings are questions, not nouns
 *
 * "What needs your attention?" rather than "Tasks"; "Your care" rather than
 * "Records". Section 63 asks for the first shape over a wall of figures, and
 * a heading phrased as the patient's own question is what makes a dashboard
 * feel like it was written for them.
 */
export const PATIENT_DASHBOARD = {
  title: "Your Punarvasu account",

  /** Used when the patient has told us a name. */
  greeting: (name: string) => `Welcome back, ${name}`,
  /** Used when they have not. Never "Welcome back, undefined". */
  greetingAnonymous: "Welcome to Punarvasu",

  description:
    "Everything the clinic has shared with you, and everything you can do here.",

  nextVisit: {
    heading: "Your next visit",
    viewLabel: "View appointment",
    /** Shown when the appointment is within the next couple of days. */
    imminentNote: "This is coming up soon.",
    emptyTitle: "No upcoming appointments",
    emptyBody:
      "When you're ready, you can request your next consultation with the clinic.",
    errorTitle: "We couldn't load your next appointment",
    errorBody:
      "Everything else on this page is still up to date. Please try again in a moment.",
  },

  attention: {
    heading: "What needs your attention?",
    /**
     * The empty state, and the reason this panel exists.
     *
     * Section 62: no fake urgency. When there is nothing to do the page says
     * so rather than inventing a task to fill the space.
     */
    emptyTitle: "Nothing needs your attention",
    emptyBody:
      "You're up to date. Anything the clinic needs from you will appear here.",
  },

  care: {
    heading: "Your care",
    description:
      "What your practitioner has shared with you. Your consultation notes stay with the clinic — these are the parts written for you to keep.",
    prescriptionsLabel: "Prescriptions",
    prescriptionsEmpty: "Nothing issued yet",
    treatmentPlansLabel: "Treatment plans",
    treatmentPlansEmpty: "No plan yet",
    documentsLabel: "Documents",
    documentsDescription: "Reports and letters, yours and the clinic's.",
    viewAllLabel: "View all",
    /** Section 24: the stored status, never an inferred medical meaning. */
    issuedOn: (when: string) => `Issued ${when}`,
    startedOn: (when: string) => `Started ${when}`,
    errorBody: "We couldn't load this just now. Please try again in a moment.",
  },

  updates: {
    heading: "Recent updates",
    viewAllLabel: "All notifications",
    emptyTitle: "You're all caught up",
    emptyBody:
      "Updates about your appointments and your care will appear here.",
    errorBody:
      "We couldn't load your updates just now. Please try again in a moment.",
  },

  quickActions: {
    heading: "Quick actions",
  },

  /**
   * The line that keeps a care portal from being mistaken for a clinic.
   *
   * Sections 59 and 60. One sentence, in the open, near the bottom — not a
   * banner at the top, which section 59 warns against, and not an AI triage
   * widget, which section 60 forbids outright.
   */
  emergencyNote:
    "Punarvasu is not an emergency service and messages here are not monitored. If you need urgent medical help, call your local emergency number or go to your nearest hospital.",

  /** Section 102: the existing clinic contact path, never a new one. */
  helpNote: "Need something this page can't do? Contact the clinic.",
  helpLinkLabel: "Contact Punarvasu",
} as const;

/** Announced once, politely, while the dashboard's skeleton is on screen. */
export const PATIENT_DASHBOARD_LOADING_LABEL = "Loading your account";

/**
 * The patient area's error boundary copy.
 *
 * `phase_18.md` section 70 and its "bad → good" example in section 148. What a
 * patient reads is a sentence and a way forward; what a developer needs is in
 * the server log, correlated by request id. A Supabase message, a relation
 * name or a stack trace reaching this screen would be both useless to the
 * patient and useful to somebody probing the application.
 *
 * The boundary receives an `Error` whose message Next.js has already replaced
 * with a generic one in production — but this copy does not depend on that,
 * and never renders `error.message` at all.
 */
export const PATIENT_ERROR_COPY = {
  title: "Something went wrong",
  description:
    "We couldn't load this part of your account. Your information is safe — please try again.",
  retryLabel: "Try again",
  homeLabel: "Back to your account",
} as const;

export const PROFILE_SECTIONS = {
  personal: {
    title: "Personal information",
    description: "How the clinic knows you.",
  },
  contact: {
    title: "Contact information",
    description: "How the clinic reaches you.",
  },
  address: {
    title: "Address",
    description: "Kept with your patient record for clinic correspondence.",
  },
  emergency: {
    title: "Emergency contact",
    description:
      "Someone the clinic can call about you if you are unwell during a visit.",
  },
  account: {
    title: "Account",
    description: "Your sign-in details.",
  },
} as const;

/**
 * Field labels, descriptions and autocomplete tokens.
 *
 * `autoComplete` is here rather than in the component because it is part of
 * the field's definition: it is what lets a browser or password manager fill
 * the form, which matters most to the people who find forms hardest.
 */
export const PROFILE_FIELDS = {
  fullName: {
    label: "Full name",
    description: "As you would like it to appear on your clinic records.",
    autoComplete: "name",
  },
  preferredName: {
    label: "Preferred name",
    description: "What you would like the clinic to call you, if it differs.",
    autoComplete: "nickname",
  },
  dateOfBirth: {
    label: "Date of birth",
    description:
      "Ayurvedic assessment takes age into account, and it helps the clinic tell apart patients with similar names.",
    autoComplete: "bday",
  },
  gender: {
    label: "Gender",
    description:
      "Optional, and only used where it is relevant to your care. You can choose not to say.",
  },
  preferredLanguage: {
    label: "Preferred language",
    description: "The language you would rather speak during a consultation.",
    autoComplete: "language",
  },
  email: {
    label: "Email address",
    /**
     * The email is the account identity and is not edited here
     * (`phase_07.md` sections 22-23). Changing it means proving control of the
     * new address, which is Supabase Auth's email-change flow; offering an
     * ordinary text field would either silently fail or quietly detach the
     * account from its login.
     */
    description:
      "This is the address you sign in with. To change it, please contact the clinic — we will add a secure way to do it yourself.",
  },
  phone: {
    label: "Mobile number",
    description:
      "The clinic uses this to reach you about an appointment. A 10-digit Indian mobile number.",
    autoComplete: "tel-national",
  },
  addressLine1: {
    label: "Address line 1",
    autoComplete: "address-line1",
  },
  addressLine2: {
    label: "Address line 2",
    autoComplete: "address-line2",
  },
  city: { label: "City", autoComplete: "address-level2" },
  state: { label: "State", autoComplete: "address-level1" },
  postalCode: {
    label: "Postal code",
    description: "A six-digit PIN code in India.",
    autoComplete: "postal-code",
  },
  emergencyContactName: {
    label: "Contact's full name",
  },
  emergencyContactRelationship: {
    label: "Relationship to you",
    description: "For example, spouse, parent, friend.",
  },
  emergencyContactPhone: {
    label: "Contact's mobile number",
  },
} as const;

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

/**
 * The sentence that keeps an emergency contact from being mistaken for a
 * service.
 *
 * `phase_07.md` section 31 asks for it explicitly, and it matters: a patient
 * who believes the clinic is monitoring this number may rely on it in exactly
 * the situation where relying on it would be dangerous.
 */
export const EMERGENCY_CONTACT_DISCLAIMER =
  "Punarvasu keeps this contact for administrative purposes only. It is not an emergency response service and it is not monitored. In an emergency, call your local emergency number.";

/**
 * The line that keeps clinical information out of a demographic form.
 *
 * The form has no field for it, but somebody will reach for the address box to
 * mention a condition unless the page says not to.
 */
export const NO_CLINICAL_DATA_NOTICE =
  "Please don't record anything about your health here — symptoms, conditions, medicines or allergies. This page holds contact details only; your health is discussed with your practitioner and kept in your clinical record.";

export const PROFILE_COPY = {
  completenessLabel: "Profile completeness",
  completenessComplete:
    "Your profile has everything the clinic needs. Thank you.",
  completenessPartial: "A few details would help the clinic look after you:",

  editLabel: "Edit profile",
  saveLabel: "Save changes",
  savingLabel: "Saving…",
  cancelLabel: "Cancel",

  createHeading: "Complete your Punarvasu profile",
  createDescription:
    "Add a few details so the clinic can identify you and reach you about your care. Only your name is required — the rest can wait.",
  createSubmitLabel: "Save profile",
  createSubmittingLabel: "Saving your profile…",

  /**
   * The confirmation title, true of both a first save and a later edit.
   *
   * The body says which one it was, and it comes from the server action —
   * the only party that knows whether a record was created or updated.
   */
  saveSuccessTitle: "Profile saved",
  saveSuccessBody: "Your profile has been updated.",
  createSuccessBody:
    "Your profile has been saved. You can change any of it whenever you like.",

  /**
   * Save failure. Generic on purpose — the underlying cause is in the server
   * log, correlated by request, and a database message shown to a patient is
   * both useless to them and useful to an attacker (`phase_07.md` sections
   * 67, 80).
   */
  saveErrorTitle: "We couldn't save your changes",
  saveErrorBody: "Please try again. Your details have been kept on the form.",
  validationErrorBody: "Please check the details below and try again.",

  loadErrorTitle: "We couldn't load your profile",
  loadErrorBody:
    "Something went wrong at our end. Please try again in a moment.",
  loadErrorRetryLabel: "Try again",
  loadingLabel: "Loading your profile",

  unsavedChangesTitle: "Discard your changes?",
  unsavedChangesBody:
    "You have changes that haven't been saved. Discarding them cannot be undone.",
  unsavedChangesConfirmLabel: "Discard changes",
  unsavedChangesCancelLabel: "Keep editing",

  notProvided: "Not provided",
} as const;

/**
 * The patient area's navigation.
 *
 * "Overview" matches exactly. It is the index of a section that also lists its
 * own child, and the default section matching would mark both links current
 * while viewing the profile.
 */
export const PATIENT_NAV_ITEMS = [
  { label: "Overview", href: "/patient", match: "exact" },
  { label: "Appointments", href: "/patient/appointments" },
  // Phase 13. Two links, not one, because a prescription and a treatment plan
  // are different things (`phase_13.md` section 28) and a patient looking for
  // "what do I take" should not have to read a diet plan first.
  { label: "Prescriptions", href: "/patient/prescriptions" },
  { label: "Treatment plans", href: "/patient/treatment-plans" },
  // Phase 14. Its own link rather than a section of the overview: a patient
  // uploading a report from a phone in a waiting room should reach it in one
  // tap, not by scrolling past three other things first.
  { label: "Documents", href: "/patient/documents" },
  { label: "Profile", href: "/patient/profile" },
] as const;

/**
 * Why "Notifications" is **not** in the bar above (Phase 18).
 *
 * `phase_18.md` section 9 lists it as a potential patient destination, and it
 * was considered. The notification centre lives at `/notifications` — a shared
 * Phase 15 route, outside `/patient`, because every role has notifications and
 * a patient-specific copy would be a second surface to secure for no
 * capability (section 101).
 *
 * Putting it in this bar would therefore mean a tab that, when pressed, takes
 * the patient to a page where the bar no longer exists. A navigation whose
 * tabs disappear reads as a bug, and it is the one thing a section nav must
 * not do.
 *
 * So notifications reach the patient three other ways, all of them already
 * present on every page or on the page they most need it:
 *
 *   * the **bell** in the authenticated header, with an unread count, on every
 *     authenticated page including this area;
 *   * the **Recent updates** panel on the dashboard, which is where section 5
 *     asks for them;
 *   * an **attention item** when anything is unread, linking straight in.
 *
 * Section 9's own qualifier — "only show sections supported by actual
 * permissions/data" — and section 10's warning against overcrowding both point
 * the same way. If `/notifications` ever moves inside the patient area, this
 * comment is the thing to delete.
 */
