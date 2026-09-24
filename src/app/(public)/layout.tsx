import { AccountNav } from "@/components/auth/account-nav";
import {
  SiteFooter,
  type ContactDetail,
} from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteUtilityBar } from "@/components/layout/site-utility-bar";
import {
  CLINIC_CONTACT,
  CLINIC_IDENTITY,
  CLINIC_SOCIAL_LINKS,
  formatAddress,
  formatPhone,
} from "@/config/clinic";
import {
  FOOTER_NAV_GROUPS,
  LEGAL_NAV_ITEMS,
  PRIMARY_CTA,
  PUBLIC_NAV_ITEMS,
} from "@/config/navigation";

/**
 * The public website shell.
 *
 * A route group rather than the root layout, so that the marketing header and
 * footer wrap the public pages only. The patient portal and the staff
 * workspaces get their own groups and their own chrome; the root layout stays
 * responsible for nothing but `<html>`, `<body>`, fonts and tokens.
 *
 * A server component. The header is one too — only the current-page detection
 * and the mobile menu are client components, and both are pushed down to leaf
 * level (`NavLink`, `MobileNav`), so the shell costs a few hundred bytes of
 * JavaScript rather than the whole page.
 *
 * `accountSlot` carries the sign-in / my-account control added in Phase 06.
 * It is a client component that asks `/api/auth/session-status` after
 * hydration rather than a server read of the session, specifically so that
 * this layout stays static: reading the session here would make all thirty
 * public pages render per request. Nothing is authorized on the result — see
 * `components/auth/account-nav.tsx`.
 *
 * `<main id="main-content">` lives here rather than in each page, because the
 * skip link in `SiteHeader` targets it and a page that forgot it would break
 * keyboard bypass silently. `flex-1` makes the footer sit at the bottom of a
 * short page instead of halfway up it.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader
        navItems={PUBLIC_NAV_ITEMS}
        primaryAction={PRIMARY_CTA}
        accountSlot={<AccountNav />}
        utilityBar={<SiteUtilityBar />}
      />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <SiteFooter
        groups={FOOTER_NAV_GROUPS}
        legalItems={LEGAL_NAV_ITEMS}
        contact={buildFooterContact()}
        social={CLINIC_SOCIAL_LINKS.map((link) => ({
          ...link,
          external: true,
        }))}
        tagline={CLINIC_IDENTITY.tagline}
        // disclaimer="Information on this website is general in nature. It is not medical advice, and it is not a substitute for professional diagnosis, treatment or emergency care. Please consult a qualified practitioner about your own health."
      />
    </>
  );
}

/**
 * The footer's contact block, built from whatever the clinic configuration
 * actually holds.
 *
 * Returns `undefined` when nothing is known, which is the state this phase
 * ships in: `SiteFooter` then renders no contact column at all rather than a
 * heading over an empty list. No value here is ever defaulted or guessed — see
 * `config/clinic.ts`.
 */
/**
 * Footer contact links.
 *
 * `min-h-11` because a phone number in a footer is a real tap target on a
 * phone, and small text on its own is about 17px tall. The focus ring colour
 * comes from the footer's `data-surface="inverted"`.
 */
const CONTACT_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

function buildFooterContact(): readonly ContactDetail[] | undefined {
  const details: ContactDetail[] = [];
  const address = formatAddress(CLINIC_CONTACT.address);

  if (address) {
    details.push({ label: "Address", value: address });
  }
  if (CLINIC_CONTACT.openingHours) {
    details.push({ label: "Hours", value: CLINIC_CONTACT.openingHours });
  }
  if (CLINIC_CONTACT.phone) {
    details.push({
      label: "Phone",
      // Grouped for reading, but the `tel:` target is always the stored
      // E.164 value so a dialler never has to parse the spacing.
      value: (
        <a href={`tel:${CLINIC_CONTACT.phone}`} className={CONTACT_LINK_CLASS}>
          {formatPhone(CLINIC_CONTACT.phone)}
        </a>
      ),
    });
  }
  if (CLINIC_CONTACT.email) {
    details.push({
      label: "Email",
      value: (
        <a
          href={`mailto:${CLINIC_CONTACT.email}`}
          className={CONTACT_LINK_CLASS}
        >
          {CLINIC_CONTACT.email}
        </a>
      ),
    });
  }

  return details.length > 0 ? details : undefined;
}
