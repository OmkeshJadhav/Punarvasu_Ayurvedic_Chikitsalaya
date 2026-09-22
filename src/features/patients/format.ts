/**
 * Display formatting for patient profile values.
 *
 * Pure functions with no imports, so the same formatting runs on the server
 * and in the browser and the two cannot produce different text for the same
 * record — which in React would be a hydration mismatch, and to a patient
 * would be their date of birth flickering.
 */

import type { PatientGender } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * An ISO calendar date as "7 April 1990".
 *
 * Formatted from the string's own parts rather than through a `Date`.
 * `new Date("1990-04-07")` is midnight **UTC**, and rendering that in a
 * timezone behind UTC prints 6 April — the timezone error `phase_07.md`
 * section 27 warns about, and one that would be invisible to anyone
 * developing in India.
 *
 * `Intl.DateTimeFormat` is avoided for the same reason: it takes an instant,
 * so using it safely means constructing a UTC date and then forcing the
 * formatter back to UTC. Reading three numbers out of a string is simpler and
 * has no way to be wrong. Localisation, when it arrives, replaces this
 * function rather than working around it.
 */
export function formatDateOfBirth(isoDate: string | null): string | null {
  if (!isoDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !year || !day) return null;

  return `${Number(day)} ${monthName} ${year}`;
}

/**
 * Age in whole years, from a date of birth.
 *
 * Derived on demand and never stored, because a stored age is wrong within a
 * year (`phase_07.md` section 28).
 *
 * Computed by comparing calendar parts rather than subtracting milliseconds:
 * a millisecond difference divided by an average year length is off by a day
 * around leap years, and someone whose birthday is today would be told they
 * are still a year younger.
 *
 * Exported for the phase that needs it — Ayurvedic assessment takes age into
 * account — and used here only where a date of birth is already displayed.
 */
export function calculateAge(
  isoDate: string,
  today: Date = new Date(),
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const birthYear = Number(yearText);
  const birthMonth = Number(monthText);
  const birthDay = Number(dayText);

  let age = today.getFullYear() - birthYear;

  const beforeBirthdayThisYear =
    today.getMonth() + 1 < birthMonth ||
    (today.getMonth() + 1 === birthMonth && today.getDate() < birthDay);

  if (beforeBirthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}

/**
 * A ten-digit Indian mobile number, grouped for reading.
 *
 * The stored value is always ten digits (`phoneSchema` normalises it), so this
 * only has to group. Anything else is returned untouched rather than mangled —
 * a number that does not match the expected shape is still a number somebody
 * needs to read.
 */
export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;

  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

const GENDER_LABELS: Record<PatientGender, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  undisclosed: "Prefer not to say",
};

export function formatGender(gender: PatientGender | null): string | null {
  return gender ? GENDER_LABELS[gender] : null;
}

/**
 * The address as the lines it would be written on.
 *
 * Empty parts are dropped rather than producing a blank line or a stray comma,
 * so a patient who gave a street and a city sees exactly that.
 */
export function formatAddressLines(profile: {
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
}): readonly string[] {
  const cityLine = [profile.city, profile.state]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");

  return [
    profile.addressLine1,
    profile.addressLine2,
    cityLine,
    profile.postalCode,
  ]
    .map((line) => line?.trim() ?? "")
    .filter((line) => line.length > 0);
}

/**
 * "Member since April 2026", from an ISO timestamp.
 *
 * Month and year only. The exact moment an account was created is operational
 * metadata; a patient gains nothing from the seconds
 * (`phase_07.md` sections 41-42).
 */
export function formatMemberSince(isoTimestamp: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoTimestamp);
  if (!match) return null;

  const [, year, month] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !year) return null;

  return `${monthName} ${year}`;
}
