/**
 * JSON-LD for the public site.
 *
 * ## The rule
 *
 * Structured data is read by machines and republished by them - a search
 * engine will show an address, a phone number or a rating it finds here
 * directly in a result page, with the clinic's name attached. That makes an
 * invented value in this file worse than an invented value in the visible
 * copy: it travels further and is harder to correct.
 *
 * So this builder emits a property only when a real value exists. There are no
 * defaults, no examples and no placeholders, and the shapes that most invite
 * fabrication - `aggregateRating`, `review`, `priceRange`, `openingHours` with
 * a guess in it - are simply not constructed unless the data is present
 * (`docs/implementation-plan/phase_03.md` section 36).
 *
 * ## Type choice
 *
 * `MedicalClinic` rather than the broader `LocalBusiness`: it is accurate, and
 * accuracy is the whole point here. It is emitted without medical specialty
 * claims, which would need clinical sign-off.
 */

import {
  CLINIC_IDENTITY,
  type ClinicContact,
  type PostalAddress,
} from "@/config/clinic";

/**
 * Only the subset of schema.org we actually emit. Typed rather than
 * `Record<string, unknown>` so a property cannot be added without a decision.
 */
interface JsonLdPostalAddress {
  readonly "@type": "PostalAddress";
  readonly streetAddress: string;
  readonly addressLocality: string;
  readonly addressRegion: string;
  readonly postalCode: string;
  readonly addressCountry: string;
}

export interface ClinicJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "MedicalClinic";
  readonly name: string;
  readonly legalName: string;
  readonly alternateName: string;
  readonly description: string;
  readonly url: string;
  readonly logo: string;
  readonly image: string;
  readonly address?: JsonLdPostalAddress;
  readonly telephone?: string;
  readonly email?: string;
  readonly sameAs?: readonly string[];
}

function toJsonLdAddress(address: PostalAddress): JsonLdPostalAddress {
  return {
    "@type": "PostalAddress",
    streetAddress: address.streetAddress,
    addressLocality: address.locality,
    addressRegion: address.region,
    postalCode: address.postalCode,
    addressCountry: address.country,
  };
}

export interface BuildClinicJsonLdInput {
  readonly siteUrl: string;
  readonly description: string;
  readonly contact: ClinicContact;
  readonly socialLinks: readonly { readonly href: string }[];
}

export function buildClinicJsonLd({
  siteUrl,
  description,
  contact,
  socialLinks,
}: BuildClinicJsonLdInput): ClinicJsonLd {
  const origin = siteUrl.replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: CLINIC_IDENTITY.name,
    legalName: CLINIC_IDENTITY.legalName,
    alternateName: CLINIC_IDENTITY.devanagariName,
    description,
    url: `${origin}/`,
    logo: `${origin}/images/logo.png`,
    image: `${origin}/images/logo.png`,
    // Each of these is present only when the clinic has actually supplied it.
    ...(contact.address ? { address: toJsonLdAddress(contact.address) } : {}),
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(socialLinks.length > 0
      ? { sameAs: socialLinks.map((link) => link.href) }
      : {}),
  };
}

/**
 * Serializes JSON-LD for a `<script type="application/ld+json">`.
 *
 * `<` is escaped so a value containing `</script>` cannot close the tag and
 * inject markup. Everything this builder emits is currently developer-authored
 * constants, but the contact fields become clinic-editable settings in a later
 * phase, and the escape has to already be here when they do
 * (`docs/SECURITY.md`).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/* ------------------------------------------------------------------ */
/* Breadcrumbs                                                         */
/* ------------------------------------------------------------------ */

interface JsonLdListItem {
  readonly "@type": "ListItem";
  readonly position: number;
  readonly name: string;
  readonly item: string;
}

export interface BreadcrumbJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "BreadcrumbList";
  readonly itemListElement: readonly JsonLdListItem[];
}

export interface BreadcrumbTrailItem {
  readonly name: string;
  /** Site-relative path, e.g. `/services/shirodhara`. */
  readonly path: string;
}

/**
 * A `BreadcrumbList` for a nested public page.
 *
 * ## Why this is the only structured data a treatment page emits
 *
 * A breadcrumb trail is a statement about site structure. It is verifiable
 * from the URLs themselves, it republishes no claim about health, and it is
 * the one thing on a treatment page that is unambiguously factual today.
 *
 * `MedicalTherapy` and `MedicalProcedure` are deliberately **not** emitted.
 * Those types exist to carry `indication`, `contraindication`,
 * `expectedPrognosis` and similar - exactly the assertions this project has
 * no verified source for - and a search engine republishes whatever it finds
 * with the clinic's name attached. Emitting the type with those properties
 * empty would still declare the page to be a medical-procedure description
 * authored by the clinic, which it is not until a practitioner has reviewed
 * it (`docs/implementation-plan/phase_04.md` section 46,
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * `FAQPage` is withheld for the same reason: it lifts answers directly into
 * search results, and these answers are still development content.
 *
 * Add either one in the change that marks the content `verified`.
 */
export function buildBreadcrumbJsonLd(
  siteUrl: string,
  items: readonly BreadcrumbTrailItem[],
): BreadcrumbJsonLd {
  const origin = siteUrl.replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}
