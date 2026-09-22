"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the services segment.
 *
 * ## Why a segment boundary and not just the app-level one
 *
 * `app/error.tsx` sits above the `(public)` route group, so a failure caught
 * there replaces the header, the navigation and the footer with a bare
 * status page — a visitor loses every way out except the back button. This
 * boundary is inside the public shell, so a failure in `/services` degrades
 * to one region while the rest of the site keeps working
 * (`docs/implementation-plan/phase_04.md` section 59,
 * `docs/implementation-plan/phase_03.md` section 47).
 *
 * The catalogue is static configuration today and has nothing to fail at, so
 * this is insurance against the phase that makes it database-backed rather
 * than a path exercised now.
 *
 * `ErrorState` rather than `StatusMessage`: the layout already owns `<main>`
 * and the page heading, and a second `<main>` would break the skip link.
 *
 * Only `digest` reaches the browser console. The real failure is in the
 * server log, and the message may carry internal detail
 * (`docs/SECURITY.md` section 16).
 */
export default function ServicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error(`Unhandled error in /services (digest ${error.digest})`);
    }
  }, [error.digest]);

  return (
    <Section aria-labelledby="services-error-title" className="bg-background">
      <Container width="prose">
        <h1
          id="services-error-title"
          className="text-h2 text-heading font-normal"
        >
          Services
        </h1>

        <ErrorState
          className="mt-8"
          description="We couldn't load our treatment information just now. Please try again — if it keeps happening, the clinic can help you directly."
          reference={error.digest}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
              <Button asChild>
                <Link href="/">Go to the home page</Link>
              </Button>
            </div>
          }
        />
      </Container>
    </Section>
  );
}
