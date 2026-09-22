import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { AUTH_FOOTNOTE, BACK_TO_SITE_LABEL } from "@/features/auth/content";

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
 * A server component. The only JavaScript on these pages is the form itself.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="bg-muted flex min-h-dvh flex-col">
      {/*
        The skip link in `SiteHeader` is not on these pages, because these
        pages have no navigation to skip past: `<main>` is the first thing
        after the brand mark, so the first Tab already lands in the form.
      */}
      <div className="gutter-x mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10 sm:py-16">
        {/*
          Real landmarks, not decorative wrappers. Every piece of an auth page
          has to sit inside one, or a screen-reader user navigating by landmark
          simply never reaches it - which is what axe's `region` rule was
          reporting against the first version of this layout, where the brand
          mark and the footnote were bare `<div>`s.
        */}
        <header className="mb-8 flex justify-center">
          <Logo showSubline={false} />
        </header>

        <main
          id="main-content"
          className="border-border bg-card rounded-lg border p-6 shadow-sm sm:p-8"
        >
          {children}
        </main>

        <footer className="mt-8 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {BACK_TO_SITE_LABEL}
          </Link>

          <p className="text-caption text-muted-foreground measure">
            {AUTH_FOOTNOTE}
          </p>
        </footer>
      </div>
    </div>
  );
}
