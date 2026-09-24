import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

import { Container } from "./container";
import { MobileNav } from "./mobile-nav";
import { ScrollAwareHeader } from "./scroll-aware-header";
import { NavLink } from "./nav-link";

/**
 * The site header foundation.
 *
 * A server component. Only the mobile menu and the current-page detection are
 * client components, so the header costs almost no JavaScript.
 *
 * It is a *foundation*, not the finished homepage header: content arrives as
 * props. The public site passes `PUBLIC_NAV_ITEMS` and `PRIMARY_CTA`; the
 * patient portal and staff workspaces pass their own items and an account menu
 * through `accountSlot`.
 *
 * Structure
 *   Logo left, navigation right, one primary action furthest right. Below
 *   `lg`, navigation collapses into `MobileNav` and the CTA stays visible from
 *   `sm` up, because booking a consultation is the action the site exists for.
 *
 * Accessibility
 *   - A skip link is the first focusable element on the page. It targets
 *     `#main-content`, which the layout puts on `<main>`.
 *   - `<header>` and `<nav aria-label="Main">` are landmarks, so a screen
 *     reader user can jump straight past them.
 *   - Sticky positioning only; the header does not hide and reappear on scroll,
 *     which is disorienting and steals the top of the viewport on a phone. It
 *     changes surface on scroll - translucent at the top, solid once content
 *     passes beneath it - and never changes height, so nothing below it moves.
 */
export interface SiteHeaderProps {
  readonly navItems: readonly NavItem[];
  /** The one primary action. Omit where a surface has none. */
  readonly primaryAction?: NavItem;
  /**
   * Authenticated state: an account menu, or sign-in links. Rendered before
   * the primary action on desktop and inside the mobile menu.
   */
  readonly accountSlot?: ReactNode;
  /**
   * A slim band above the bar - the public site's location and phone. It sits
   * inside `<header>`, after the skip link, so "Skip to main content" stays
   * the first thing a keyboard reaches. The header's negative sticky offset
   * (the band's own 36px height) lets the band scroll away while the bar
   * beneath it stays pinned. The band is `md`-and-up only, so the offset is
   * too.
   */
  readonly utilityBar?: ReactNode;
  readonly className?: string;
}

export function SiteHeader({
  navItems,
  primaryAction,
  accountSlot,
  utilityBar,
  className,
}: SiteHeaderProps) {
  const cta = primaryAction ? (
    <Button asChild size="sm">
      <Link href={primaryAction.href}>{primaryAction.label}</Link>
    </Button>
  ) : null;

  return (
    <ScrollAwareHeader
      data-print="hide"
      className={cn(
        "sticky top-0 z-(--z-sticky) w-full border-b",
        utilityBar ? "md:-top-9" : null,
        "ease-natural transition-[background-color,border-color,box-shadow] duration-(--duration-normal)",
        // At rest: translucent linen, no rule, so the bar belongs to the
        // opening composition. The blur keeps it legible over the hero's
        // photograph where the two meet on a narrow screen.
        //
        // Scrolled: solid, with a hairline and a soft shadow, because body
        // copy sliding under a see-through bar reads as a rendering fault.
        // `data-scrolled` is set by `ScrollAwareHeader`; everything visual
        // lives here.
        "bg-background/80 border-transparent",
        "supports-[backdrop-filter:blur(0px)]:bg-background/70 supports-[backdrop-filter:blur(0px)]:backdrop-blur-md",
        "data-scrolled:border-border data-scrolled:bg-background/95 data-scrolled:shadow-sm",
        className,
      )}
    >
      <SkipLink />
      {utilityBar}

      {/* `wide`, matching every marketing section beneath it. At `content`
          the logo and the CTA sat 80px inside the page's own edges, which is
          the misalignment a trained eye notices before anything else. */}
      <Container
        width="wide"
        className="flex h-16 items-center justify-between gap-4 lg:h-20"
      >
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/*
            Hidden in the bar on the narrowest screens, exactly as the CTA
            beside it is, because at 320px there is not room for the logo, an
            account control and a menu trigger: measured, the header overflowed
            the viewport by 12px — but only once signed in, because "My
            account" is wider than "Sign in". That is why it survived every
            earlier phase's checks, which browsed signed out.

            Nothing is lost: `MobileNav`'s footer renders the same
            `accountSlot`, so the control is one tap away in the menu a phone
            user opens anyway (`docs/DESIGN_SYSTEM.md` section 49).
          */}
          <span className="hidden sm:inline-flex">{accountSlot}</span>
          <span className="hidden sm:inline-flex">{cta}</span>
          <span className="lg:hidden">
            <MobileNav
              items={navItems}
              footer={
                <>
                  {primaryAction ? (
                    <Button asChild block>
                      <Link href={primaryAction.href}>
                        {primaryAction.label}
                      </Link>
                    </Button>
                  ) : null}
                  {accountSlot}
                </>
              }
            />
          </span>
        </div>
      </Container>
    </ScrollAwareHeader>
  );
}

/**
 * Bypass block: visible only once focused, which is what makes it useful to a
 * keyboard user and invisible to everyone else (WCAG 2.4.1).
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className={cn(
        "bg-primary text-primary-foreground text-label sr-only rounded-md font-medium",
        // The padding is declared under the `focus` variant on purpose:
        // `not-sr-only` resets `padding` to 0 and, at equal specificity, an
        // unprefixed `px-4` loses to it - leaving the revealed link as a green
        // box with the text jammed against its edges.
        "focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-(--z-modal) focus:px-4 focus:py-2",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
      )}
    >
      Skip to main content
    </a>
  );
}
