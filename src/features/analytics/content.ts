/**
 * Every word the analytics surfaces say.
 *
 * Kept out of the components for the reason every feature in this product
 * keeps its copy out of its components: so that somebody can read what the
 * clinic is being told without reading React, and so that a phrase used in
 * two places is one string.
 *
 * ## Two things this copy is careful about
 *
 * **A number is explained where it could be misread.** Section 92's "this
 * prevents ambiguous reporting" only holds if the definition reaches the
 * person reading the figure, so the dashboard carries a definitions panel and
 * several figures carry a one-line note. "Acceptance rate" in particular says
 * what it is not.
 *
 * **Nothing here makes a clinical claim.** A count of treatment plans is a
 * count of plans, and the copy says so — section 38 warns specifically
 * against a plan count being read as efficacy, and
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` makes an unsupported clinical claim a
 * content-safety failure rather than a wording preference.
 */

import type { AnalyticsRangePreset } from "@/config/analytics";

export const ANALYTICS_AREA = {
  clinic: {
    title: "Clinic analytics",
    heading: "Clinic analytics",
    description:
      "How the clinic is operating. Every figure is an operational count taken from the clinic's own records.",
  },
  reception: {
    title: "Schedule analytics",
    heading: "Schedule analytics",
    description:
      "Appointment volume, outcomes and patient growth for the period you choose.",
  },
  practice: {
    title: "My practice",
    heading: "My practice",
    description:
      "Your own appointments and working time. These figures cover your practice only.",
  },
} as const;

/** The date filter. */
export const RANGE_FILTER_COPY = {
  legend: "Reporting period",
  presetLabel: "Period",
  fromLabel: "From",
  toLabel: "To",
  applyLabel: "Apply",
  resetLabel: "Reset",
  customHint: "Choose any period up to one year.",
  timezoneNote:
    "Dates follow the clinic's own day, in the clinic's timezone. A period includes both the start and the end date.",
  fellBackNotice:
    "We couldn't use that period, so this shows the current month instead.",
  problems: {
    malformed: "Enter both dates as a real calendar date.",
    reversed: "The end date is before the start date.",
    too_long: "Choose a period of up to one year.",
    before_records: "The clinic has no records that far back.",
  },
} as const;

export const RANGE_PRESET_LABELS: Readonly<
  Record<AnalyticsRangePreset, string>
> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  last_12_months: "Last 12 months",
  custom: "Custom period",
};

/** Shared states, so a failed panel reads the same everywhere. */
export const ANALYTICS_STATE_COPY = {
  errorTitle: "We couldn't load this report",
  errorDescription:
    "Something went wrong reading these figures. Nothing is wrong with your data — please try again.",
  retryLabel: "Try again",
  // Section 64 and example 7. "No records exist for this period" rather than a
  // zero, so nobody reads an empty period as a bad one.
  emptyTitle: "No activity in this period",
  emptyDescription:
    "There are no records for the period you chose. Try a longer period.",
  forbiddenDescription: "You don't have access to this report.",
  unavailableInline: "Data unavailable",
  /** Shown where a rate has no denominator. Never rendered as 0%. */
  noRateBasis: "No concluded appointments",
} as const;

export const FRESHNESS_COPY = {
  /** Section 75-76: state when, and do not imply live. */
  prefix: "Figures read",
  refreshLabel: "Refresh",
  note: "Read from the clinic's records each time this page loads. Nothing here is cached.",
} as const;

export const APPOINTMENT_PANEL_COPY = {
  heading: "Appointments",
  totalLabel: "Appointments",
  completedLabel: "Completed",
  cancelledLabel: "Cancelled",
  noShowLabel: "No-shows",
  upcomingLabel: "Still upcoming",
  concludedLabel: "Concluded",
  completionRateLabel: "Completion rate",
  cancellationRateLabel: "Cancellation rate",
  noShowRateLabel: "No-show rate",
  denominatorNote:
    "Rates are shares of concluded appointments — completed, cancelled and no-shows. Appointments still ahead of the clinic are not counted in them.",
  trendHeading: "Appointment trend",
  trendDescription:
    "Appointments per period, by the clinic day each one is scheduled for.",
} as const;

export const WORKLOAD_PANEL_COPY = {
  heading: "Practitioner workload",
  description:
    "Operational volume and working time per practitioner. These are scheduling figures; nothing here describes clinical care.",
  caption: "Practitioner workload for the period, busiest first",
  practitionerHeader: "Practitioner",
  totalHeader: "Appointments",
  completedHeader: "Completed",
  cancelledHeader: "Cancelled",
  noShowHeader: "No-shows",
  utilizationHeader: "Utilisation",
  emptyTitle: "No practitioners to report on",
  emptyDescription:
    "No practitioner has a schedule or an appointment in this period.",
  utilizationNote:
    "Utilisation is booked time as a share of working time, after leave and closures are taken out. A practitioner with no working hours in the period has no utilisation to report.",
} as const;

export const PATIENT_PANEL_COPY = {
  heading: "Patients",
  newLabel: "New patients",
  returningLabel: "Returning patients",
  activeLabel: "Active patients",
  totalLabel: "Registered patients",
  growthHeading: "New patients over time",
  note: "New patients counts patient records created in the period, by either route — a patient registering themselves or the front desk registering them. It does not count user accounts.",
} as const;

export const NOTIFICATION_PANEL_COPY = {
  heading: "Notifications",
  deliveryHeading: "Sending",
  deliveryCaption: "Notification sends by channel and provider",
  channelHeader: "Channel",
  providerHeader: "Provider",
  pendingHeader: "Queued",
  sentHeader: "Accepted",
  failedHeader: "Failed",
  skippedHeader: "Skipped",
  acceptanceHeader: "Acceptance rate",
  /**
   * Section 41, stated to the reader rather than only in a comment. This is
   * the one figure on the dashboard somebody would otherwise assume means
   * something stronger than it does.
   */
  acceptanceNote:
    "Accepted means the provider took the message for sending. It is not confirmation that it reached the recipient — no provider configured for Punarvasu reports that.",
  volumeHeading: "In-app notifications",
  volumeCaption: "In-app notifications created in the period, by kind",
  categoryHeader: "Kind",
  scheduledHeader: "Scheduled",
  activeHeader: "Shown",
  cancelledHeader: "Withdrawn",
  readHeader: "Opened",
  readRateHeader: "Opened rate",
  volumeNote:
    "An in-app notification is delivered by existing, so these are counts of notifications rather than of send attempts. Scheduled reminders are not visible to the patient until their time comes.",
  emptyTitle: "No notifications in this period",
  emptyDescription:
    "Nothing was sent or scheduled during the period you chose.",
} as const;

export const CLINICAL_ACTIVITY_PANEL_COPY = {
  heading: "Clinical activity",
  /**
   * Section 36 and section 38. The panel says what these counts are and what
   * they are not, in the product rather than in a comment, because a count of
   * prescriptions beside a count of plans invites exactly the reading that
   * section warns about.
   */
  description:
    "How much clinical work was recorded. These are counts of records created — they say nothing about what was in them, and nothing about how treatment turned out.",
  prescriptionsLabel: "Prescriptions issued",
  plansLabel: "Treatment plans started",
  consultationsLabel: "Consultations documented",
  documentsLabel: "Documents uploaded",
  documentsHeading: "Documents by kind",
  documentsCaption: "Uploaded documents in the period, by kind",
  documentTypeHeader: "Kind",
  documentCountHeader: "Uploaded",
  privacyNote:
    "Punarvasu does not report on diagnoses, symptoms, medicines or the contents of any document.",
} as const;

export const EXPORT_COPY = {
  heading: "Export",
  description:
    "Download the appointment operations report for the period above. The file contains counts by day, practitioner, appointment type and status — no patient information of any kind.",
  submitLabel: "Download CSV",
  columnsLabel: "Columns in this file",
  scopeNote:
    "The file covers the period and practitioner selected in the filter above.",
  auditNote: "Exports are recorded against your account.",
} as const;

export const DEFINITIONS_COPY = {
  heading: "How these figures are calculated",
  description:
    "Every number on this page is defined once and used the same way on the dashboard and in the export.",
  metricHeader: "Figure",
  formulaHeader: "How it is calculated",
  datesHeader: "Which records it counts",
} as const;

/** The chart's accessible data alternative (section 66). */
export const CHART_COPY = {
  tableToggleLabel: "Show the figures as a table",
  periodHeader: "Period",
  valueHeader: "Appointments",
  newPatientsHeader: "New patients",
  emptyDescription: "There is nothing to plot for this period.",
} as const;

/** The navigation entries added to the three workspaces. */
export const ANALYTICS_NAV = {
  admin: { href: "/admin/analytics", label: "Analytics" },
  receptionist: { href: "/receptionist/analytics", label: "Analytics" },
  doctor: { href: "/doctor/analytics", label: "My practice" },
} as const;
