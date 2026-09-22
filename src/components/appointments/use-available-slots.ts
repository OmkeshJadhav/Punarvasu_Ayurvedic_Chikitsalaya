"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads bookable times for a practitioner on a clinic day.
 *
 * ## Why a hook, and why it is shared
 *
 * Booking and rescheduling ask exactly the same question, and the three states
 * it can be in — loading, empty, failed — must look and behave the same in
 * both (`phase_09.md` sections 45-47). One hook is how that stays true.
 *
 * ## What it is not
 *
 * Not a source of truth. `phase_09.md` section 42 is explicit: what this
 * returns is a snapshot, and by the time the patient clicks it may be stale.
 * Nothing here is trusted by the booking path — the server recomputes every
 * rule and the database's exclusion constraint settles the race. The value of
 * this hook is that a patient is usually not shown a time that will fail.
 *
 * ## Why the status is derived rather than stored
 *
 * The naive shape is `setStatus("loading")` at the top of an effect. That is a
 * synchronous state update inside an effect body, which causes a second render
 * pass before anything has happened and which ESLint's
 * `react-hooks/set-state-in-effect` correctly refuses — the same rule Phase 02
 * hit and fixed rather than suppressed.
 *
 * So there is one piece of state, the *result*, and it carries the question it
 * answers. "Loading" is then not a stored fact but an observation: the result
 * in hand does not answer the question being asked. That makes the impossible
 * state — showing one day's times under another day's heading — unrepresentable
 * rather than merely avoided.
 *
 * ## Two races it handles
 *
 * A patient tapping through dates faster than the network answers would
 * otherwise see an earlier day's slots arrive after a later day's. Each
 * request carries a sequence number in a ref, and a late reply for a
 * superseded request is discarded rather than stored; the in-flight request is
 * also aborted, so the browser is not holding connections open for answers
 * nobody wants.
 */

export interface AvailableSlot {
  /** ISO 8601 instant, with offset. Passed back to the server unchanged. */
  readonly startsAt: string;
  readonly endsAt: string;
}

export type SlotsStatus = "idle" | "loading" | "ready" | "error";

export interface UseAvailableSlotsOptions {
  readonly practitionerId: string | null;
  readonly appointmentTypeId: string | null;
  /** Clinic calendar date, `YYYY-MM-DD`. */
  readonly date: string | null;
}

export interface UseAvailableSlotsResult {
  readonly status: SlotsStatus;
  readonly slots: readonly AvailableSlot[];
  /** Re-asks. Used by the retry control, and after a slot conflict. */
  readonly reload: () => void;
}

/** A stable empty list, so a consumer's dependency arrays do not churn. */
const NO_SLOTS: readonly AvailableSlot[] = [];

interface SlotsOutcome {
  /** The question this answers. Compared with the current one. */
  readonly key: string;
  readonly status: "ready" | "error";
  readonly slots: readonly AvailableSlot[];
}

export function useAvailableSlots(
  options: UseAvailableSlotsOptions,
): UseAvailableSlotsResult {
  const { practitionerId, appointmentTypeId, date } = options;

  const [outcome, setOutcome] = useState<SlotsOutcome | null>(null);
  const [nonce, setNonce] = useState(0);

  // Identifies the most recent request. A reply whose sequence is not the
  // current one belongs to a question the patient has already moved on from.
  const sequence = useRef(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // The question, as one value. `null` means there is nothing to ask yet.
  // `nonce` is part of it so that a retry is a different question and the
  // previous answer stops counting.
  const key =
    practitionerId && appointmentTypeId && date
      ? `${practitionerId}|${appointmentTypeId}|${date}|${nonce}`
      : null;

  useEffect(() => {
    if (!key) return;

    const [nextPractitionerId, nextTypeId, nextDate] = key.split("|");
    if (!nextPractitionerId || !nextTypeId || !nextDate) return;

    const requestId = (sequence.current += 1);
    const controller = new AbortController();

    const query = new URLSearchParams({
      practitionerId: nextPractitionerId,
      appointmentTypeId: nextTypeId,
      date: nextDate,
    });

    fetch(`/api/appointments/availability?${query.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (requestId !== sequence.current) return;

        const parsed = readSlots(body);
        if (!response.ok || !parsed) {
          // The response envelope carries a safe message and a correlation id.
          // Neither is rendered: the failure copy lives with the rest of the
          // page's words, and a request id shown to a patient is noise.
          setOutcome({ key, status: "error", slots: NO_SLOTS });
          return;
        }

        setOutcome({ key, status: "ready", slots: parsed });
      })
      .catch(() => {
        // An abort is the expected outcome of changing the date, not a failure
        // to report. Anything else — offline, DNS, a dropped connection — is.
        if (controller.signal.aborted) return;
        if (requestId !== sequence.current) return;
        setOutcome({ key, status: "error", slots: NO_SLOTS });
      });

    return () => controller.abort();
  }, [key]);

  const answered = outcome !== null && outcome.key === key;

  return {
    status: key === null ? "idle" : answered ? outcome.status : "loading",
    slots: answered ? outcome.slots : NO_SLOTS,
    reload,
  };
}

/**
 * Reads the response envelope without trusting its shape.
 *
 * The endpoint is ours, but a response that has been through a proxy, a
 * captive portal or a stale service worker is untrusted data like any other
 * (`docs/SECURITY.md` section 2.3). A malformed body becomes an error state
 * rather than a render crash.
 */
function readSlots(body: unknown): readonly AvailableSlot[] | null {
  if (typeof body !== "object" || body === null) return null;
  if ((body as { ok?: unknown }).ok !== true) return null;

  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;

  const raw = (data as { slots?: unknown }).slots;
  if (!Array.isArray(raw)) return null;

  const slots: AvailableSlot[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;

    const startsAt = (entry as { startsAt?: unknown }).startsAt;
    const endsAt = (entry as { endsAt?: unknown }).endsAt;

    if (typeof startsAt !== "string" || typeof endsAt !== "string") return null;
    if (!Number.isFinite(Date.parse(startsAt))) return null;

    slots.push({ startsAt, endsAt });
  }

  return slots;
}
