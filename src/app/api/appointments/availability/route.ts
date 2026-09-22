import { BOOKING_RULES } from "@/config/appointments";
import { apiSuccess } from "@/lib/api/response";
import { createRouteHandler } from "@/lib/api/route-handler";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import {
  forbiddenError,
  internalError,
  unauthorizedError,
} from "@/lib/errors/app-error";
import { getAvailability } from "@/features/appointments/queries";
import { availabilityQuerySchema } from "@/features/appointments/validation";
import { parseInput } from "@/lib/validation/parse";

/**
 * Bookable times for a practitioner on a given clinic day.
 *
 * ## Why a route handler rather than a server action
 *
 * The booking flow asks this every time the patient changes the date, and the
 * answer has three distinct states the UI must render differently: loading,
 * empty, and failed (`phase_09.md` sections 45-47). `fetch` against an
 * endpoint returning the project's standard envelope gives all three
 * naturally; a server action would give the same data through a POST that the
 * framework treats as a mutation.
 *
 * ## What it discloses
 *
 * A list of start and end instants. No appointment id, no patient, no status,
 * and no reason a period is blocked — a blocked period's reason may be
 * personal (`docs/DATABASE.md` section 4.6) and `phase_09.md` section 15
 * forbids surfacing it. That guarantee is not implemented here: it is the
 * shape of `get_practitioner_busy_intervals`, which is the only thing this
 * path can read.
 *
 * A caller learns when a practitioner is free, which is what the slot list
 * they are about to be shown tells them anyway.
 *
 * ## Why it is authenticated
 *
 * Booking is authenticated (`phase_09.md` section 50), so availability has no
 * anonymous audience. Requiring a session and a booking permission keeps the
 * clinic's diary shape from being scrapable by anyone who finds the URL, and
 * it is the least privilege that still serves the screens that need it.
 *
 * ## Why one endpoint serves both the patient and the front desk
 *
 * They ask the same question of the same engine. A second endpoint would be
 * the duplicated scheduling logic `phase_10.md` section 17 forbids, and the
 * two would drift the first time a rule changed.
 *
 * What differs is the minimum notice, and that is resolved **here, from the
 * permission the caller was just found to hold** — not from a query parameter.
 * A patient asking this endpoint for times inside the notice window is refused
 * the same times a patient asking the booking flow would be, because the only
 * thing that decides is their role.
 *
 * ## Caching
 *
 * `private, no-store`. Availability is the most time-sensitive value in the
 * product: a cached slot list is a slot list that is wrong, and
 * `phase_09.md` section 58 rules out caching it publicly at all.
 */
export const GET = createRouteHandler(
  "appointments.availability",
  async (request) => {
    const user = await getCurrentUser();
    if (!user) throw unauthorizedError();

    // The same permissions the two booking paths require. Reading the diary is
    // part of booking; nobody who cannot book has a reason to ask.
    const managesAnyAppointment = can(user.role, "appointments.manage.any");
    const booksOwnAppointments = can(user.role, "appointments.write.self");

    if (!managesAnyAppointment && !booksOwnAppointments) {
      throw forbiddenError({
        cause: new Error("Missing an appointment booking permission"),
      });
    }

    // Resolved from the role, not from the request. The front desk books
    // people in for today; a patient may not.
    const minNoticeMinutes = managesAnyAppointment
      ? 0
      : BOOKING_RULES.minNoticeMinutes;

    const url = new URL(request.url);
    const query = parseInput(availabilityQuerySchema, {
      practitionerId: url.searchParams.get("practitionerId") ?? "",
      appointmentTypeId: url.searchParams.get("appointmentTypeId") ?? "",
      date: url.searchParams.get("date") ?? "",
      days: url.searchParams.get("days") ?? 1,
    });

    const result = await getAvailability(query, { minNoticeMinutes });

    // A failed read must not look like a free-but-empty diary, or the patient is
    // told to choose another date when the truth is "try again". The query layer
    // has already logged the cause; the envelope carries a safe message and the
    // correlation id.
    if (result.status === "unavailable") {
      throw internalError({
        cause: new Error("Availability could not be computed."),
      });
    }

    return apiSuccess(
      {
        slots: result.slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  },
);
