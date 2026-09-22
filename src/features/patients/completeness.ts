/**
 * Profile completeness.
 *
 * ## Calculated, never stored
 *
 * There is no `profile_completion` column and there must not be
 * (`phase_07.md` sections 59 and 85, example 4). A stored percentage is wrong
 * the moment the rules change, wrong if a write path forgets to recalculate
 * it, and impossible to explain when it disagrees with the form. Deriving it
 * from the record costs nothing and cannot go stale.
 *
 * ## What counts, and what deliberately does not
 *
 * Only fields the clinic genuinely uses (`phase_07.md` sections 19-20). Each
 * item states *why* it is wanted, and that sentence is shown to the patient —
 * if a reason cannot be written honestly, the field does not belong in the
 * list.
 *
 * Date of birth, gender and preferred language are **not** counted. All three
 * are legitimate to collect and none is something a patient should be nudged
 * towards by a bar that sits at 80% until they give it. `phase_07.md` section
 * 19 is explicit: do not pressure users into providing unnecessary
 * information, and section 20 adds that sensitive optional information must
 * not be marked mandatory just to reach 100%.
 *
 * The consequence is deliberate and worth stating: a patient who fills in the
 * four items below reaches 100% with a half-empty form. That is the correct
 * outcome. The bar measures "can the clinic look after you properly", not "has
 * every box been ticked".
 */

import type { PatientProfile } from "./types";

/** One thing the profile is or is not carrying. */
export interface CompletenessItem {
  readonly id: string;
  /** What is missing, phrased as the action: "Add your phone number". */
  readonly label: string;
  /**
   * The thing itself, as a noun phrase: "mobile number", "address".
   *
   * Added in Phase 18 so a summary can build a sentence around it — "including
   * your mobile number" — without re-deriving it from `label` by stripping the
   * verb, which is the kind of string surgery that breaks the first time a
   * label is reworded.
   */
  readonly shortLabel: string;
  /** Why the clinic wants it. Shown to the patient. Must be true. */
  readonly reason: string;
  readonly complete: boolean;
  /** Required items keep the record usable at all; the rest are recommended. */
  readonly required: boolean;
}

export interface ProfileCompleteness {
  /** 0-100, rounded. */
  readonly percentage: number;
  readonly items: readonly CompletenessItem[];
  readonly missing: readonly CompletenessItem[];
  /** True when every item is present. */
  readonly complete: boolean;
}

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Evaluates a profile against the completeness rules.
 *
 * Address is one item, not four: a patient with a street and no city has not
 * given the clinic an address, and counting the parts separately would show
 * progress for something unusable. The same reasoning makes the emergency
 * contact one item.
 */
export function evaluateCompleteness(
  profile: PatientProfile | null,
): ProfileCompleteness {
  const items: readonly CompletenessItem[] = [
    {
      id: "fullName",
      label: "Add your full name",
      shortLabel: "Full name",
      reason: "The clinic needs a name to identify your records by.",
      complete: filled(profile?.fullName),
      required: true,
    },
    {
      id: "phone",
      label: "Add your mobile number",
      shortLabel: "Mobile number",
      reason:
        "The clinic uses your number to reach you about an appointment — a change of time, or something they need before you arrive.",
      complete: filled(profile?.phone),
      required: false,
    },
    {
      id: "address",
      label: "Add your address",
      shortLabel: "Address",
      reason:
        "An address is kept with your patient record for clinic correspondence.",
      complete:
        filled(profile?.addressLine1) &&
        filled(profile?.city) &&
        filled(profile?.postalCode),
      required: false,
    },
    {
      id: "emergencyContact",
      label: "Add an emergency contact",
      shortLabel: "Emergency contact",
      reason:
        "Someone the clinic can call about you if you are unwell during a visit and cannot speak for yourself.",
      complete:
        filled(profile?.emergencyContactName) &&
        filled(profile?.emergencyContactPhone),
      required: false,
    },
  ];

  const completed = items.filter((item) => item.complete).length;

  return {
    percentage: Math.round((completed / items.length) * 100),
    items,
    missing: items.filter((item) => !item.complete),
    complete: completed === items.length,
  };
}
