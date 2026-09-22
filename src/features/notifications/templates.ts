/**
 * Notification templates.
 *
 * ## One place, typed inputs
 *
 * `phase_15.md` sections 40-41. Every word a patient reads in a notification
 * is written here, and every template takes a declared shape rather than an
 * arbitrary object — so "what can a confirmation say about somebody?" is
 * answered by reading one interface.
 *
 * Nothing constructs a message anywhere else. A component that wanted to write
 * its own would have to write it into a column no request can reach.
 *
 * ## What a template may know
 *
 * Exactly what `notification_appointment_context()`,
 * `notification_prescription_context()` and
 * `notification_treatment_plan_context()` return, which is a practitioner's
 * roster name, a consultation type, a time and a status. There is no way to
 * reach a diagnosis, a symptom, an assessment, a medicine, a dose, a
 * prescription item, a plan title, a plan item, a document, a doctor's note, a
 * cancellation reason or a patient note from inside this module, because
 * nothing hands one to it (sections 36, 81, 82, 83, 128).
 *
 * That is the point. Minimising clinical content in a notification is not a
 * rule somebody has to remember when adding a template; it is the only thing
 * the inputs allow.
 *
 * ## Email privacy: the subject line is separate from the body
 *
 * Sections 37 and 82, and example 4. A subject line and its preview are read
 * on a lock screen, over a shoulder, in a notification shade — they are the
 * least private part of an email, so they carry the least.
 *
 *   * **Appointment** categories put the operational fact in the subject.
 *     "Appointment confirmed" tells a patient what to open and reveals
 *     nothing about their health.
 *   * **Clinical** categories do not. The subject is the neutral
 *     "New update from Punarvasu", because the *existence* of a prescription
 *     is itself information about somebody's health.
 *
 * The body, which is inside the message, may say that a prescription is
 * waiting — that is section 33's own good example — and never what is in it.
 *
 * ## Versioning
 *
 * Section 99. A notification stores the text it was rendered with, plus
 * `NOTIFICATION_TEMPLATE_VERSION`. Correcting the wording below must not
 * rewrite what somebody was told last year, and it does not: the stored row is
 * what the notification centre renders. **Raise the version whenever the
 * wording changes**, so the two can be told apart afterwards.
 *
 * ## Localization
 *
 * Section 100. The strings are here rather than scattered through business
 * logic, which is the structural half of being able to localize later. The
 * dates already go through the Phase 09 clinic formatters rather than being
 * assembled by hand, so section 31's "no ad-hoc timezone conversion in each
 * template" holds too.
 */

import { formatClinicDateTime } from "@/features/appointments/time";

import type { NotificationCategory, NotificationEventType } from "./types";

/**
 * The wording revision.
 *
 * Raise it in the same change as any edit to the strings below.
 */
export const NOTIFICATION_TEMPLATE_VERSION = 1;

/** The subject every clinical email carries. Deliberately says nothing. */
export const NEUTRAL_EMAIL_SUBJECT = "New update from Punarvasu";

/** The label on an email's action button. */
export const EMAIL_ACTION_LABEL = "Open Punarvasu";

/** What an appointment template is allowed to know. */
export interface AppointmentTemplateData {
  /** The practitioner's roster name, exactly as the clinic recorded it. */
  readonly practitionerName: string;
  /** The consultation type — an operational category, never a treatment. */
  readonly appointmentTypeName: string;
  readonly startsAt: Date;
}

/** What a prescription template is allowed to know. Note what is absent. */
export interface PrescriptionTemplateData {
  readonly practitionerName: string;
}

/** What a treatment-plan template is allowed to know. */
export interface TreatmentPlanTemplateData {
  readonly practitionerName: string;
}

export type NotificationTemplateData =
  | {
      readonly event: "appointment_confirmed";
      readonly data: AppointmentTemplateData;
    }
  | {
      readonly event: "appointment_rescheduled";
      readonly data: AppointmentTemplateData;
    }
  | {
      readonly event: "appointment_cancelled";
      readonly data: AppointmentTemplateData;
    }
  | {
      readonly event: "appointment_reminder";
      readonly data: AppointmentTemplateData;
    }
  | {
      readonly event: "prescription_issued";
      readonly data: PrescriptionTemplateData;
    }
  | {
      readonly event: "treatment_plan_activated";
      readonly data: TreatmentPlanTemplateData;
    };

/** A rendered notification, ready to be stored. */
export interface RenderedNotification {
  readonly title: string;
  readonly body: string;
  readonly category: NotificationCategory;
  readonly templateVersion: number;
}

/** Which preference group an event belongs to. */
export const EVENT_CATEGORY: Readonly<
  Record<NotificationEventType, NotificationCategory>
> = {
  appointment_confirmed: "appointment_updates",
  appointment_rescheduled: "appointment_updates",
  appointment_cancelled: "appointment_updates",
  appointment_reminder: "appointment_reminders",
  prescription_issued: "clinical_updates",
  treatment_plan_activated: "clinical_updates",
};

/**
 * Renders the in-app notification for an event.
 *
 * Every appointment message names the practitioner, the consultation type
 * where it helps, and the authoritative time (section 25: use real data,
 * invent nothing). The cancellation message carries **no reason** — a
 * cancellation note is written by staff for staff (section 27).
 */
export function renderNotification(
  input: NotificationTemplateData,
): RenderedNotification {
  const category = EVENT_CATEGORY[input.event];
  const templateVersion = NOTIFICATION_TEMPLATE_VERSION;

  switch (input.event) {
    case "appointment_confirmed":
      return {
        category,
        templateVersion,
        title: "Appointment confirmed",
        body: `Your ${input.data.appointmentTypeName} with ${input.data.practitionerName} is confirmed for ${formatClinicDateTime(input.data.startsAt)}.`,
      };

    case "appointment_rescheduled":
      return {
        category,
        templateVersion,
        title: "Appointment rescheduled",
        body: `Your ${input.data.appointmentTypeName} with ${input.data.practitionerName} has moved to ${formatClinicDateTime(input.data.startsAt)}.`,
      };

    case "appointment_cancelled":
      return {
        category,
        templateVersion,
        title: "Appointment cancelled",
        // No reason, and no invitation to reply — the clinic's number is on
        // every page of the site, and a notification is not a channel anybody
        // is listening on.
        body: `Your ${input.data.appointmentTypeName} with ${input.data.practitionerName} on ${formatClinicDateTime(input.data.startsAt)} has been cancelled.`,
      };

    case "appointment_reminder":
      return {
        category,
        templateVersion,
        title: "Appointment reminder",
        body: `Your ${input.data.appointmentTypeName} with ${input.data.practitionerName} is on ${formatClinicDateTime(input.data.startsAt)}.`,
      };

    case "prescription_issued":
      // Section 33 and example 3, almost word for word. That a prescription
      // exists; never what is in it.
      return {
        category,
        templateVersion,
        title: "Prescription available",
        body: `${input.data.practitionerName} has issued a prescription from your recent consultation. Sign in to Punarvasu to view it.`,
      };

    case "treatment_plan_activated":
      // Section 34. The plan's own title is written by a clinician about one
      // patient, so it is not among this template's inputs at all.
      return {
        category,
        templateVersion,
        title: "Treatment plan updated",
        body: `${input.data.practitionerName} has shared a treatment plan with you. Sign in to Punarvasu to review it.`,
      };
  }
}

/** The subject and body of the email carrying a rendered notification. */
export interface RenderedEmail {
  readonly subject: string;
  readonly heading: string;
  readonly body: string;
  readonly actionLabel: string;
}

/**
 * Wraps a rendered notification for email.
 *
 * The body is the in-app body unchanged — one message, one wording, so a
 * patient who reads both does not have to reconcile them — and the subject is
 * decided by the category, for the reason in this module's header.
 */
export function renderEmail(
  notification: Pick<RenderedNotification, "title" | "body" | "category">,
): RenderedEmail {
  const operational =
    notification.category === "appointment_updates" ||
    notification.category === "appointment_reminders";

  return {
    subject: operational
      ? `Punarvasu: ${notification.title}`
      : NEUTRAL_EMAIL_SUBJECT,
    heading: notification.title,
    body: notification.body,
    actionLabel: EMAIL_ACTION_LABEL,
  };
}
