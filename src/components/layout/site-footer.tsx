import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import type { NavGroup, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

import { Container } from "./container";

/**
 * The site footer foundation.
 *
 * Content-driven: link groups, legal links, contact details and social
 * profiles all arrive as props. Nothing about the real clinic is written into
 * this component, and every optional block is genuinely optional, so the
 * footer renders correctly today with only the placeholder navigation from
 * `config/navigation.ts` and correctly later with real contact details.
 *
 * A server component. No JavaScript.
 *
 * The medical disclaimer is a prop rather than fixed copy, but its *place* in
 * the layout is fixed: above the legal row, present on every page. A platform
 * that publishes Ayurvedic health information needs it visible without it
 * dominating the page (`docs/DESIGN_SYSTEM.md` section 47).
 *
 * ## Surface
 *
 * The footer is the brand band's deepest step (`--brand-surface-deep`), not a
 * tinted grey. A long warm page needs a definite end, and a pale footer under
 * a pale page simply trails off - the reader cannot tell whether the content
 * has finished. One step darker than the band itself so that a page ending
 * on a green closing section, or using the band mid-page, still has a floor.
 * Every foreground used here is a `--brand-surface-*` token, each asserted
 * against AA on that background in `lib/design/contrast.test.ts`.
 */
export interface ContactDetail {
  /**
   * What the detail is. Shown as a small title, or - when `icon` is given -
   * kept for screen readers only, with the icon standing in for it visually.
   */
  readonly label: string;
  /** Plain text, or a `tel:`/`mailto:`/maps link when it is actionable. */
  readonly value: ReactNode;
  /** A decorative icon that replaces the visible label. */
  readonly icon?: ReactNode;
}

export interface SiteFooterProps {
  readonly groups?: readonly NavGroup[];
  readonly legalItems?: readonly NavItem[];
  /** Address, phone, hours. Rendered only when supplied. */
  readonly contact?: readonly ContactDetail[];
  readonly social?: readonly NavItem[];
  /** One or two sentences. Responsible wording, never a guarantee. */
  readonly disclaimer?: ReactNode;
  /** A short line under the wordmark. */
  readonly tagline?: ReactNode;
  readonly className?: string;
}

export function SiteFooter({
  groups = [],
  legalItems = [],
  contact,
  social,
  disclaimer,
  tagline,
  className,
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      data-print="hide"
      // See `[data-surface="inverted"]` in `globals.css`: it re-points the
      // focus ring, which is the primary green and invisible here.
      data-surface="inverted"
      className={cn(
        "bg-brand-surface-deep text-brand-surface-foreground mt-auto",
        // A hairline where the footer meets a green closing band above it;
        // on a light page it is simply the edge of the footer.
        "border-brand-surface-border/50 border-t",
        className,
      )}
    >
      {/* `wide`, so the footer's columns share their edges with the header and
          every marketing section above them. */}
      <Container width="wide" className="section-y flex flex-col gap-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3 lg:col-span-1">
            {/* The footer's brand column is one of four, and narrower than the
                lockup's subline. The tagline below says the same thing with
                room to breathe. */}
            <Logo
              showSubline={false}
              className="text-brand-surface-foreground"
            />
            {tagline ? (
              <p className="text-body text-brand-surface-muted mt-2 max-w-xs font-serif italic">
                {tagline}
              </p>
            ) : null}
          </div>

          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.12em] uppercase">
                {group.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <FooterLink item={item} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {contact && contact.length > 0 ? (
            <section aria-labelledby="footer-contact">
              <h2
                id="footer-contact"
                className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.12em] uppercase"
              >
                Contact
              </h2>
              <dl className="mt-3 flex flex-col gap-3">
                {contact.map((detail) =>
                  detail.icon ? (
                    <div
                      key={detail.label}
                      className={cn(
                        "flex gap-3",
                        // A link carries a 44px touch target with its text
                        // centred in it, so its icon centres too; plain text
                        // (an address over three lines) hangs from the top.
                        typeof detail.value === "string"
                          ? "items-start"
                          : "items-center",
                      )}
                    >
                      <dt className="text-brand-surface-accent flex min-h-6 shrink-0 items-center [&_svg]:size-4">
                        <span aria-hidden="true">{detail.icon}</span>
                        <span className="sr-only">{detail.label}</span>
                      </dt>
                      <dd className="text-body-sm text-brand-surface-foreground">
                        {detail.value}
                      </dd>
                    </div>
                  ) : (
                    <div key={detail.label} className="flex flex-col">
                      <dt className="text-caption text-brand-surface-muted">
                        {detail.label}
                      </dt>
                      <dd className="text-body-sm text-brand-surface-foreground">
                        {detail.value}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>
          ) : null}
        </div>

        {disclaimer ? (
          <p className="text-caption text-brand-surface-muted border-brand-surface-border measure border-t pt-6">
            {disclaimer}
          </p>
        ) : null}

        <div
          className={cn(
            "border-brand-surface-border flex flex-col gap-4 border-t pt-6",
            "sm:flex-row sm:items-center sm:justify-between",
            !disclaimer && "border-t",
          )}
        >
          <p className="text-caption text-brand-surface-muted">
            &copy; {year} Punarvasu. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalItems.map((item) => (
              <FooterLink
                key={item.href}
                item={item}
                className="text-caption"
              />
            ))}
            {social?.map((item) => (
              <FooterLink
                key={item.href}
                item={item}
                className="text-caption"
              />
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}

/**
 * A footer link.
 *
 * `min-h-11` keeps the touch target adequate even though the text is small -
 * footer links are a common place for targets to fall below 44px.
 */
function FooterLink({
  item,
  className,
}: {
  readonly item: NavItem;
  readonly className?: string;
}) {
  return (
    <Link
      href={item.href}
      {...(item.external
        ? { target: "_blank", rel: "noreferrer noopener" }
        : {})}
      className={cn(
        "text-body-sm text-brand-surface-muted inline-flex min-h-11 items-center rounded-sm",
        "ease-natural hover:text-brand-surface-foreground transition-colors duration-(--duration-fast)",
        // The ring colour comes from the footer's `data-surface="inverted"`.
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      {item.label}
      {item.external ? (
        <span className="sr-only"> (opens in a new tab)</span>
      ) : null}
    </Link>
  );
}
