/**
 * Clinic facts.
 *
 * The single place the application learns anything about the real Punarvasu
 * clinic. Nothing here may be invented: an address, a phone number, a set of
 * opening hours or a practitioner's qualification is a claim a patient will
 * act on, and a wrong one sends someone to the wrong building or the wrong
 * clinician.
 *
 * Every field below is therefore optional, and the components that consume
 * them render nothing rather than a placeholder when a fact is absent
 * (`SiteFooter` contact block, `LocationSection`, `ContactChannels`, the
 * JSON-LD builder).
 *
 * ## What is verified, as of Phase 05
 *
 * The clinic supplied its **postal address** and **phone number**, and the
 * Google Maps embed for its own listing. Those three are published. Its
 * **opening hours** followed later and are published too, as display text
 * and as structured periods for `buildClinicJsonLd`.
 *
 * Still unsupplied, and therefore still absent: **email address** and
 * **social profiles**. The UI says so where a visitor would look for them
 * rather than guessing, and `buildClinicJsonLd` emits no property for them
 * at all — a guessed value in structured data is republished by search
 * engines with the clinic's name attached.
 *
 * A later phase replaces this module with database-backed clinic settings.
 */

export interface PostalAddress {
  readonly streetAddress: string;
  readonly locality: string;
  readonly region: string;
  readonly postalCode: string;
  /** ISO 3166-1 alpha-2. */
  readonly country: string;
}

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/** One opening period, in 24-hour local time ("HH:MM"). */
export interface OpeningHoursPeriod {
  readonly days: readonly DayOfWeek[];
  readonly opens: string;
  readonly closes: string;
}

export interface ClinicContact {
  /** E.164 where possible, so `tel:` links work from any country. */
  readonly phone?: string;
  readonly email?: string;
  readonly address?: PostalAddress;
  /** Free text for display, e.g. "Mon-Sat, 9:00-19:00". Never guessed. */
  readonly openingHours?: string;
  /**
   * The same hours as machine-readable periods, for structured data. Kept
   * beside `openingHours` so the two are edited together; a search engine
   * shows these to people deciding when to set out.
   */
  readonly openingHoursSpecification?: readonly OpeningHoursPeriod[];
  /** A maps link for the Directions action. */
  readonly directionsUrl?: string;
  /** A maps link that shows the clinic's listing, for "Open in Google Maps". */
  readonly mapUrl?: string;
  /**
   * The Google Maps embed URL for the clinic's own listing.
   *
   * Rendered with the page and lazily fetched — see `MapEmbed`. The address
   * and the directions link are text beside it, so the location never depends
   * on the frame loading (`docs/implementation-plan/phase_05.md` section 34).
   */
  readonly mapEmbedUrl?: string;
}

/**
 * VERIFIED — supplied by the clinic.
 *
 * `streetAddress` is the address as given, with one formatting change: a
 * space was inserted in "7Apartment", which is a typography correction rather
 * than a change of fact. **Confirm the building name spelling with the clinic
 * before launch.**
 *
 * `phone` is stored in E.164 so `tel:` works from any country; use
 * `formatPhone` for display.
 *
 * `openingHours` was supplied by the clinic as "Monday to Saturday
 * 10:00-2:00, 5:00-8:30", read as a morning session to 2 pm and an evening
 * session from 5 pm. The display string and the structured periods must say
 * the same thing.
 *
 * Do not add an `email` here until the clinic supplies one — a
 * plausible-looking value is indistinguishable from a real one once it is on
 * a healthcare website.
 */
const MONDAY_TO_SATURDAY: readonly DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const CLINIC_CONTACT: ClinicContact = {
  phone: "+917507043414",
  openingHours: "Mon–Sat · 10:00 am–2:00 pm, 5:00–8:30 pm",
  openingHoursSpecification: [
    { days: MONDAY_TO_SATURDAY, opens: "10:00", closes: "14:00" },
    { days: MONDAY_TO_SATURDAY, opens: "17:00", closes: "20:30" },
  ],
  address: {
    streetAddress:
      "1st Floor, Samruddhi 7 Apartment, near Sai Baba Mandir Road, Godoli",
    locality: "Satara",
    region: "Maharashtra",
    postalCode: "415001",
    country: "IN",
  },
  // Built from the verified address rather than from coordinates: a wrong
  // latitude is an invisible error that sends someone to a field.
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=PUNARVASU%20AYURVEDA%20CHIKITSALAYA%2C%20Godoli%2C%20Satara%2C%20Maharashtra%20415001",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=PUNARVASU%20AYURVEDA%20CHIKITSALAYA%2C%20Godoli%2C%20Satara%2C%20Maharashtra%20415001",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3801.32097770992!2d74.01129077475568!3d17.68229088325603!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc239ee5d2d2a0f%3A0xe555bc8b0000000!2sPUNARVASU%20AYURVEDA%20CHIKITSALAYA!5e0!3m2!1sen!2sin!4v1789657921813!5m2!1sen!2sin",
};

/** Verified social profiles only. An invented profile URL is a broken promise. */
export const CLINIC_SOCIAL_LINKS: readonly { label: string; href: string }[] =
  [];

/**
 * Whether enough contact information exists to render a "Visit us" section at
 * all. Callers check this rather than reaching for individual fields, so the
 * rule for showing the section lives in one place.
 */
export function hasPublishableContact(
  contact: ClinicContact = CLINIC_CONTACT,
): boolean {
  return Boolean(
    contact.phone ?? contact.email ?? contact.address ?? contact.openingHours,
  );
}

/** A single line suitable for display, or `undefined` when no address is set. */
export function formatAddress(
  address: PostalAddress | undefined,
): string | undefined {
  if (!address) {
    return undefined;
  }
  return [
    address.streetAddress,
    address.locality,
    `${address.region} ${address.postalCode}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The address broken into display lines.
 *
 * A postal address on a clinic page is read, copied and typed into a maps
 * app, so it is rendered over several lines rather than as one long sentence
 * that wraps arbitrarily.
 */
export function addressLines(
  address: PostalAddress | undefined,
): readonly string[] {
  if (!address) {
    return [];
  }
  return [
    address.streetAddress,
    `${address.locality}, ${address.region} ${address.postalCode}`,
  ];
}

/**
 * A stored E.164 number, grouped for reading.
 *
 * Display only. `tel:` links always use the stored value, because a dialler
 * should never have to parse spacing. Anything that is not a recognised
 * Indian mobile number is returned unchanged rather than mangled into a
 * grouping that does not apply to it.
 */
export function formatPhone(phone: string | undefined): string | undefined {
  if (!phone) {
    return undefined;
  }
  const indianMobile = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return indianMobile ? `+91 ${indianMobile[1]} ${indianMobile[2]}` : phone;
}

/**
 * Brand identity.
 *
 * These are safe: they come from the supplied logo artwork, not from guesses
 * about the business. `legalName` is deliberately the name on the mark.
 */
export const CLINIC_IDENTITY = {
  name: "Punarvasu",
  /** As it appears on the clinic's own logo. */
  legalName: "Punarvasu Ayurvedic Chikitsalaya",
  devanagariName: "पुनर्वसु",
  /** VERIFIED - supplied by the clinic. */
  foundedYear: 2010,
  /**
   * Positioning line. A description of intent, not a claim about outcomes -
   * see `docs/HEALTHCARE_AND_AI_SAFETY.md`.
   */
  tagline: "Ayurvedic consultation and treatment, built around the individual.",
} as const;
