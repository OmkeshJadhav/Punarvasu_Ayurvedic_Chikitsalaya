import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { MediaFrame } from "@/components/marketing/media-frame";
import { AUTH_IMAGES } from "@/config/images";
import { cn } from "@/lib/utils/cn";
import {
  AUTH_FOOTNOTE,
  AUTH_SHOWCASE,
  BACK_TO_SITE_LABEL,
} from "@/features/auth/content";

/**
 * The authentication shell.
 *
 * ## Why these pages have their own chrome
 *
 * Not the marketing header and footer, and not a dashboard shell. Someone on
 * one of these pages has a single job, and a full navigation offering five
 * other destinations makes them work to find it. What stays is the brand mark
 * - so a patient arriving from an emailed link can see whose sign-in page this
 * is, which is exactly the check a phishing page hopes they skip - a way back
 * to the public site, and the clinic's standing medical note.
 *
 * ## Why it is a route group of one layout, not five copies
 *
 * `phase_06.md` section 66: the logo, the card, the background and the legal
 * line are declared once. A page supplies its heading and its form.
 *
 * ## Indexing
 *
 * `robots: { index: false, follow: false }` is set here and inherited by every
 * page beneath it, so a new auth page is excluded by default rather than by
 * somebody remembering (`phase_06.md` section 95). `/auth/` is also disallowed
 * in `robots.txt`. Neither is an access control - that is what the
 * authentication itself is for (section 96) - they exist so a sign-in form
 * does not become a search result, and so a reset link a user pastes somewhere
 * public is not crawled.
 *
 * ## Composition
 *
 * From `lg`, a split that fits the viewport exactly: a photograph with the
 * brand's promise laid over it (45%), and the form on warm ivory (55%). Nothing
 * scrolls at a normal laptop height. To make that possible the brand mark, the
 * way back to the site and the medical note sit on the photograph, so the form
 * column holds the card and nothing else.
 *
 * Content can still outgrow a viewport - a short window, 200% zoom, a long
 * error. The form column then scrolls on its own (`overflow-y-auto`), and
 * `justify-center-safe` keeps its top reachable instead of centring it off the
 * screen. A form that clips its own submit button is not an option on a
 * healthcare site, however tidy the page looks without a scrollbar.
 *
 * The photograph comes *after* the form in the DOM and is placed into the
 * first column by the grid, so the first Tab still lands in the form rather
 * than on the links laid over the photograph.
 *
 * Below `lg` the photograph does not simply stack on top: a patient on a phone
 * came to sign in, so the brand mark and form come first, then the way back
 * and the medical note, and the photograph closes the page as a short band.
 *
 * The overlay copy is `<p>`, not a heading, so each page's `AuthPageHeading`
 * stays the one `<h1>` and the outline starts at the form.
 *
 * ## Legibility over the photograph
 *
 * `MediaFrame`'s `soft` wash plus a gradient that is darkest at the top, where
 * the headline and body copy sit, and deepens again at the bottom behind the
 * medical note. Over a pure white frame the composite behind the body copy
 * stays around #6f6f6f (≥5:1 for white text); the italic aside is large text
 * and needs only 3:1.
 *
 * A server component. The only JavaScript on these pages is the form itself.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="bg-background min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[45fr_55fr] lg:overflow-hidden">
      <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip lg:col-start-2 lg:row-start-1 lg:h-dvh lg:min-h-0 lg:overflow-y-auto">
        {/*
          Editorial botanicals, top-right and bottom-right. Clipped by their
          own box: they hang past the column's edges, and inside a scrolling
          column that overhang would otherwise become scrollable area - a
          scrollbar on a page whose content fits.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <LeafSprig
            sizes="(min-width: 640px) 18rem, 11rem"
            className="absolute -top-6 -right-12 w-44 -rotate-12 opacity-45 sm:w-72"
          />
          <LeafSprig
            sizes="16rem"
            className="absolute -right-10 -bottom-10 hidden w-64 rotate-160 opacity-35 lg:block"
          />
        </div>

        {/*
          The skip link in `SiteHeader` is not on these pages, because these
          pages have no navigation to skip past: `<main>` comes first on
          desktop and straight after the brand mark on a phone, so the first
          Tab already lands in the form.
        */}
        <div className="gutter-x mx-auto flex w-full max-w-[36rem] flex-1 flex-col justify-center-safe py-10 sm:py-14 lg:max-w-[40rem] lg:py-4">
          {/*
            Real landmarks, not decorative wrappers. Every piece of an auth
            page has to sit inside one, or a screen-reader user navigating by
            landmark simply never reaches it - which is what axe's `region`
            rule was reporting against the first version of this layout, where
            the brand mark and the footnote were bare `<div>`s.
          */}
          <header className="mb-8 flex justify-center sm:mb-10 lg:hidden">
            <Logo />
          </header>

          <main
            id="main-content"
            className="border-border bg-card/75 motion-safe:animate-rise-in rounded-lg border p-6 shadow-sm backdrop-blur-sm sm:p-8 lg:py-7"
          >
            {children}
          </main>

          <footer className="mt-8 flex flex-col items-center gap-4 text-center lg:hidden">
            <BackToSiteLink />
            <p className="text-caption text-muted-foreground measure">
              {AUTH_FOOTNOTE}
            </p>
          </footer>
        </div>

        {/* The photograph, as a closing band, where the split has no room. */}
        <MediaFrame
          image={AUTH_IMAGES.panel}
          aspect="wide"
          radius="none"
          sizes="100vw"
          className="aspect-[5/2] sm:aspect-[3/1] lg:hidden"
        />
      </div>

      <AuthShowcase />
    </div>
  );
}

function BackToSiteLink({ className }: { readonly className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "group text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <ArrowLeft
        aria-hidden="true"
        className="size-4 motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:group-hover:-translate-x-0.5"
      />
      {BACK_TO_SITE_LABEL}
    </Link>
  );
}

/**
 * The photograph and the brand's promise, the first column from `lg`.
 *
 * An `<aside>` so its words and links sit in a landmark (axe's `region` rule)
 * and are announced as supplementary to the form rather than part of it.
 * `data-surface="inverted"` turns the focus ring white over the photograph.
 */
function AuthShowcase() {
  return (
    <aside
      aria-label={AUTH_SHOWCASE.eyebrow}
      data-surface="inverted"
      className="relative isolate hidden h-dvh overflow-hidden lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <MediaFrame
          image={AUTH_IMAGES.panel}
          aspect="fill"
          radius="none"
          scrim="soft"
          priority
          sizes="45vw"
          imageClassName="motion-safe:animate-settle"
        />
        <div className="from-scrim/70 via-scrim/35 absolute inset-0 bg-linear-to-b via-40% to-transparent" />
        <div className="from-scrim/60 absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t to-transparent" />
      </div>

      <div className="text-scrim-foreground flex flex-1 flex-col px-12 py-8 xl:px-16">
        <div className="flex items-center justify-between gap-6">
          <Logo showSubline={false} className="text-scrim-foreground" />
          <BackToSiteLink className="text-scrim-foreground/85 hover:text-scrim-foreground" />
        </div>

        <div className="my-auto max-w-md py-8">
          <p className="text-caption inline-flex items-center gap-3 font-medium tracking-[0.2em] uppercase">
            <span
              aria-hidden="true"
              className="h-px w-8 bg-current opacity-70"
            />
            {AUTH_SHOWCASE.eyebrow}
          </p>

          <p className="text-display mt-6 font-serif">{AUTH_SHOWCASE.title}</p>

          <p className="text-body-lg mt-6 opacity-90">
            {AUTH_SHOWCASE.description}
          </p>
        </div>

        <div className="flex items-end justify-between gap-10">
          <div className="max-w-56 shrink-0">
            <Leaf aria-hidden="true" strokeWidth={1} className="size-8" />
            <span
              aria-hidden="true"
              className="mt-3 block h-px w-8 bg-current opacity-70"
            />
            <p className="text-h4 mt-3 font-serif italic">
              {AUTH_SHOWCASE.aside}
            </p>
          </div>
          <p className="text-caption max-w-64 text-right opacity-80">
            {AUTH_FOOTNOTE}
          </p>
        </div>
      </div>
    </aside>
  );
}
