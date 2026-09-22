/**
 * Copy for the administration area.
 *
 * Separated from the components for the same reason every other feature's copy
 * is: so that the words can be reviewed without reading React, and so a change
 * of wording is not a change to a component.
 *
 * ## Two rules this copy follows
 *
 * A refusal never says what would have been required. "You don't have
 * permission to access this page" and a way back - never the role held, the
 * role needed, the permission or the policy (`phase_08.md` section 12 and
 * example 6).
 *
 * A failure never says what went wrong technically. No policy name, no
 * function name, no SQLSTATE, no table (`phase_08.md` section 26).
 */

export const FORBIDDEN_PAGE = {
  title: "You don't have permission to view this page",
  description:
    "This part of Punarvasu is not available to your account. If you think it should be, please contact the clinic.",
  accountAction: "Go to your account",
  homeAction: "Return to the website",
} as const;

export const ADMIN_AREA = {
  navLabel: "Administration",
  title: "Administration",
  heading: "Clinic administration",
  description:
    "Manage who can sign in to Punarvasu and what each person is allowed to do.",
  /**
   * Said out loud rather than implied by an empty page. Services,
   * availability, content and settings are later phases; a dashboard full of
   * disabled tiles would suggest they exist.
   */
  scopeNoticeTitle: "What you can do here today",
  scopeNoticeBody:
    "Access management is the only administrative area that has been built. Services, availability, clinic settings and reporting are still to come.",
} as const;

export const ADMIN_USERS_PAGE = {
  title: "Access management",
  heading: "People and access",
  description:
    "Every account that can sign in to Punarvasu, and the role it holds. Changing a role takes effect the next time that person loads a page.",

  tableCaption: "Accounts and the role each one holds",
  columnPerson: "Person",
  columnRole: "Current role",
  columnStatus: "Email",
  columnAction: "Change role",

  noRoleLabel: "No role",
  unverifiedLabel: "Not verified",
  verifiedLabel: "Verified",
  unnamedLabel: "No name given",
  youLabel: "You",

  emptyTitle: "No accounts yet",
  emptyBody:
    "Accounts appear here once people register. Nobody has registered yet.",

  errorTitle: "We couldn't load the list of accounts",
  errorBody:
    "Please try again in a moment. If this keeps happening, contact whoever supports your Punarvasu installation.",
  errorAction: "Try again",

  formLegend: "Assign a role",
  roleFieldLabel: "Role",
  submitLabel: "Save role",
  savingLabel: "Saving",

  /**
   * Shown against the administrator's own row instead of a role control. It
   * explains a rule rather than presenting a disabled control with no reason -
   * and the rule is enforced in the action and again in the database, so this
   * sentence is an explanation, not the mechanism.
   */
  selfNotice:
    "You cannot change your own role. Ask another administrator to do it.",

  successMessage: "The role has been updated.",
  validationErrorMessage:
    "That role change could not be applied. Please check the selection and try again.",
  permissionErrorMessage:
    "You don't have permission to change roles for this account.",
  unknownUserMessage:
    "That account no longer exists. Refresh the page and try again.",
  saveErrorMessage:
    "We couldn't update that role. Please try again in a moment.",
} as const;

/**
 * What the account page offers a staff member whose workspace does not exist
 * yet.
 *
 * Honest rather than encouraging: a receptionist or a doctor signing in today
 * finds their role confirmed and nothing to do, and being told that plainly is
 * better than a menu of links that lead to a forbidden page.
 */
export const ROLE_NEXT_STEPS = {
  patient: {
    title: "Your patient area",
    body: "Keep your name, contact details and emergency contact up to date so the clinic can identify you and reach you about your care.",
    action: "Go to your patient area",
  },
  receptionist: {
    title: "Your front-desk workspace",
    body: "Today's schedule, patient lookup and appointment management. Operational access only — consultation notes, assessments and prescriptions are not available to this account.",
    action: "Go to the front desk",
  },
  doctor: {
    title: "Your clinical workspace",
    // Phase 11 said clinical records were still being built. Phase 12 built
    // them, so this names what is there and what still is not — a stale
    // placeholder outliving the thing it stood in for would send a
    // practitioner to write their notes somewhere else.
    body: "Today's schedule, the patients you are booked to see, the consultations you document, the prescriptions and treatment plans you write, and the documents on a patient's record.",
    action: "Go to your workspace",
  },
  admin: {
    title: "Clinic administration",
    body: "Manage who can sign in to Punarvasu and what each person is allowed to do.",
    action: "Go to administration",
  },
} as const;

/**
 * Shown when a signed-in account has no role at all.
 *
 * It should not happen - registration assigns one in the same transaction that
 * creates the account - but "should not happen" is not a reason to render a
 * blank page. It names no cause the user cannot act on.
 */
export const NO_ROLE_NOTICE = {
  /** The short form, for the role row on the account page. */
  label: "Not set",
  title: "Your account is still being set up",
  body: "Your access hasn't finished being configured. Please try again shortly, or contact the clinic if this continues.",
} as const;
