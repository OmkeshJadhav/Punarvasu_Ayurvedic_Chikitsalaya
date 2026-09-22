/**
 * What genuinely needs the patient's attention.
 *
 * ## Why this is a pure function
 *
 * It takes already-fetched values and a clock, and returns a list. No
 * database, no session, no `Date.now()` of its own — so every rule below can
 * be tested one at a time, and a rule that fires at the wrong moment fails a
 * test rather than being noticed by a patient (the shape Phase 09's
 * availability engine established and Phase 16's metric layer reused).
 *
 * ## The rule that matters most: nothing is invented
 *
 * `phase_18.md` section 7 forbids fabricated personalization and section 62
 * forbids fake urgency. Every item here is derived from a value the database
 * actually returned:
 *
 *   * profile completeness comes from the patient's own record;
 *   * the unread count is an authorized `head` count;
 *   * "awaiting confirmation" is the appointment's own stored status.
 *
 * There is no "your treatment is progressing well", no streak, no score and no
 * health outcome, because the product knows none of those things. Section 56
 * permits patient-specific *operational* statistics and then says explicitly:
 * do not invent health outcomes or clinical scores.
 *
 * ## What is deliberately not in this list
 *
 * **The next appointment itself.** It has its own card above, with the date,
 * the practitioner and a way in. Repeating it here would make the list longer
 * without making it more useful, which is how a "what needs your attention"
 * panel turns into the KPI wall section 63 is guarding against.
 *
 * What *is* here is the one thing the card cannot say on its own: whether the
 * patient is expected to do something about it. "Awaiting confirmation" is a
 * status badge; "the clinic will contact you, there is nothing for you to do"
 * is the answer to the question the patient actually has.
 *
 * ## An empty list is a real state
 *
 * When nothing needs attention the panel says so, calmly, instead of
 * manufacturing a task. That is the point of the feature.
 */

import type { PatientAppointment } from "@/features/appointments/types";

import type { ProfileCompleteness } from "./completeness";

/**
 * One thing worth the patient's attention.
 *
 * `tone` drives presentation only. It is never the sole carrier of meaning —
 * every item has a title and a description that read correctly in black and
 * white, which is `DESIGN_SYSTEM.md` section 43 and WCAG 1.4.1.
 */
export interface AttentionItem {
  readonly id: string;
  /** What it is, as a short phrase. */
  readonly title: string;
  /** Why it is here, and what happens next. One sentence. */
  readonly description: string;
  /** Where the patient goes. Always a real route this patient may enter. */
  readonly href: string;
  readonly actionLabel: string;
  /**
   * `action` — the patient can do something about it.
   * `info` — the patient does not need to do anything, and should be told so.
   */
  readonly tone: "action" | "info";
}

/** How the dashboard describes the patient's own record. */
export interface AttentionInput {
  /**
   * `null` when no patient record exists at all — a different state from an
   * incomplete one, and it gets a different sentence.
   */
  readonly completeness: ProfileCompleteness | null;
  /** The soonest appointment still to come, or `null`. */
  readonly nextAppointment: PatientAppointment | null;
  /** Unread notifications, already capped by the query. */
  readonly unreadNotifications: number;
}

/**
 * Derives the attention list.
 *
 * Ordered by how time-sensitive each item is, not by how easy it is to
 * satisfy. An appointment the clinic has not confirmed yet is the thing a
 * patient most wants an answer about; a missing postal code is not, and
 * putting it first would train people to ignore the panel.
 */
export function deriveAttentionItems(
  input: AttentionInput,
): readonly AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1. An appointment the clinic has not yet agreed to.
  //
  // Phrased as information, not as a task. In Punarvasu's model the *clinic*
  // confirms a request (Phase 09) — a patient cannot confirm their own
  // appointment, and an item telling them to would be an instruction to press
  // a button that does not exist.
  if (input.nextAppointment?.status === "requested") {
    items.push({
      id: "appointment-awaiting-confirmation",
      title: "Your appointment request is with the clinic",
      description:
        "Punarvasu will contact you to confirm the time. There is nothing you need to do right now.",
      href: `/patient/appointments/${input.nextAppointment.id}`,
      actionLabel: "View the request",
      tone: "info",
    });
  }

  // 2. Unread updates. A count, never a preview: what the notification says is
  //    on the notification, and this panel is read over shoulders.
  if (input.unreadNotifications > 0) {
    items.push({
      id: "unread-notifications",
      title:
        input.unreadNotifications === 1
          ? "You have an unread update"
          : `You have ${input.unreadNotifications} unread updates`,
      description:
        "Updates about your appointments and your care are waiting in your notifications.",
      href: "/notifications",
      actionLabel: "Read your updates",
      tone: "action",
    });
  }

  // 3. The patient record itself.
  //
  // Last, deliberately. It is the least time-sensitive item on the list and
  // the one most likely to be permanently true — a patient who never adds an
  // address should still find this panel useful for the two above.
  if (input.completeness === null) {
    items.push({
      id: "profile-missing",
      title: "Complete your Punarvasu profile",
      description:
        "Add a few details so the clinic can identify you and reach you about your care. Only your name is required.",
      href: "/patient/profile",
      actionLabel: "Complete your profile",
      tone: "action",
    });
  } else if (!input.completeness.complete) {
    const missing = input.completeness.missing;
    const first = missing[0];

    items.push({
      id: "profile-incomplete",
      title: "A few profile details are missing",
      description:
        missing.length === 1 && first
          ? // One missing item names itself, because "add your mobile number"
            // is more useful than "one detail is missing".
            `${first.label}. ${first.reason}`
          : `${missing.length} details would help the clinic look after you — including your ${lowerFirst(first?.shortLabel ?? "contact details")}.`,
      href: "/patient/profile",
      actionLabel: "Update your profile",
      tone: "action",
    });
  }

  return items;
}

/**
 * Whether an appointment is close enough to be worth emphasising.
 *
 * Used by the next-visit card for a quiet "this is coming up" line, not for an
 * alarm. Exported and pure so the boundary is tested rather than eyeballed.
 *
 * Returns `false` for an appointment already under way: "starts in 0 hours" is
 * not a helpful thing to tell somebody sitting in the consulting room.
 */
export function isImminent(
  startsAt: Date,
  now: Date,
  withinHours = 48,
): boolean {
  const ms = startsAt.getTime() - now.getTime();
  return ms > 0 && ms <= withinHours * 60 * 60 * 1000;
}

function lowerFirst(value: string): string {
  return value.length > 0
    ? `${value.charAt(0).toLowerCase()}${value.slice(1)}`
    : value;
}
