/**
 * Every word the clinic registers say.
 *
 * The privacy line is rendered on the page, not only written here: an
 * administrator should know, while looking at the names, that looking was
 * recorded — that is part of what makes the list acceptable to show.
 */
export const REGISTER_COPY = {
  auditNote:
    "Patient names are shown to administrators only. Each patient listed is recorded in the security audit trail when this page loads.",
  appointments: {
    heading: "Appointment register",
    description:
      "Every appointment in the period, newest first. Contact details, notes and clinical information are never shown here.",
    caption: "Appointments in the period, newest first",
    dateHeader: "Date and time",
    patientHeader: "Patient",
    practitionerHeader: "Practitioner",
    typeHeader: "Appointment type",
    statusHeader: "Status",
    emptyTitle: "No appointments in this period",
    emptyDescription: "Nothing was scheduled in the period you chose.",
  },
  patients: {
    heading: "Patient register",
    description:
      "Patients seen, booked or registered in the period, most recent activity first.",
    caption: "Patients active or registered in the period",
    patientHeader: "Patient",
    visitsHeader: "Visits in period",
    lastVisitHeader: "Last visit",
    registeredHeader: "Registered",
    newBadge: "New",
    noVisit: "No visit yet",
    emptyTitle: "No patients in this period",
    emptyDescription:
      "No patient had an appointment or was registered during the period you chose.",
  },
  activity: {
    heading: "Recent activity",
    description:
      "The latest bookings, changes and registrations in the period.",
    emptyTitle: "No recent activity",
    emptyDescription:
      "Nothing was booked, changed or registered in this period.",
    booked: "Appointment booked",
    rescheduled: "Appointment rescheduled",
    statusChanged: "Appointment updated",
    registered: "New patient registered",
    withPractitioner: "with",
  },
  pagination: {
    label: "Pages",
    previous: "Previous page",
    next: "Next page",
    /** "Showing 9–16 of 43". */
    showing: (from: number, to: number, total: number) =>
      `Showing ${from}–${to} of ${total}`,
    pageOfLabel: (page: number) => `Page ${page}`,
    beyondEnd: "There are no rows on this page.",
    firstPage: "Go to the first page",
  },
} as const;
