import { APPOINTMENT_COPY } from "@/features/appointments/content";
import { formatClinicDateTime } from "@/features/appointments/time";
import type { AppointmentEvent } from "@/features/appointments/types";

/**
 * What has happened to an appointment, in order.
 *
 * ## Why a patient sees this at all
 *
 * `phase_09.md` section 31 asks that history be preserved and that it remain
 * possible to understand what happened and when. Preserving it in a table that
 * nobody can read would satisfy the letter of that and not the point: a
 * patient who moved an appointment and then cannot remember what it used to
 * be has a question the product can answer.
 *
 * ## What it carries
 *
 * Only what changed: created, moved, cancelled, and the times involved. No
 * actor name, no reason text, no clinical content — the underlying table has
 * no column for any of them (`docs/DATABASE.md` section 10: an audit record
 * holds references, never contents).
 *
 * It renders nothing at all when there is one event, because "Requested on
 * Tuesday" directly beneath "Requested on Tuesday" in the details above is
 * noise rather than history.
 */
export function AppointmentHistory({
  events,
}: {
  readonly events: readonly AppointmentEvent[];
}) {
  if (events.length < 2) return null;

  return (
    <section
      aria-labelledby="appointment-history-heading"
      className="border-border bg-card rounded-lg border p-5 sm:p-6"
    >
      <h2
        id="appointment-history-heading"
        className="text-h5 text-heading font-sans font-medium"
      >
        {APPOINTMENT_COPY.historyHeading}
      </h2>

      <ol className="mt-4 flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="text-body-sm flex flex-col">
            <span className="text-foreground font-medium">
              {describeEvent(event)}
            </span>
            <time
              dateTime={event.createdAt.toISOString()}
              className="text-caption text-muted-foreground"
            >
              {formatClinicDateTime(event.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * One event, in words.
 *
 * A rescheduled event names both times, because "moved" without saying from
 * where answers half the question a patient came with.
 */
function describeEvent(event: AppointmentEvent): string {
  if (event.eventType === "created") {
    return APPOINTMENT_COPY.historyCreated;
  }

  if (event.eventType === "rescheduled") {
    if (event.previousStartsAt && event.newStartsAt) {
      return `${APPOINTMENT_COPY.historyRescheduled}: ${formatClinicDateTime(
        event.previousStartsAt,
      )} → ${formatClinicDateTime(event.newStartsAt)}`;
    }
    return APPOINTMENT_COPY.historyRescheduled;
  }

  if (event.newStatus === "cancelled") {
    return APPOINTMENT_COPY.historyCancelled;
  }

  return APPOINTMENT_COPY.historyStatusChanged;
}
