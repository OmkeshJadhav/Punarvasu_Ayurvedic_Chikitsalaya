"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { PATIENT_ERROR_COPY } from "@/features/patients/content";

/**
 * The patient area's error boundary.
 *
 * ## Why the area has its own, when the application already has one
 *
 * `src/app/error.tsx` sits above the `(app)` route group, so a failure caught
 * there replaces the whole authenticated shell — the header, the notification
 * bell, the patient navigation and sign-out all disappear, and the patient is
 * left on a bare page with no way back into their account except the browser's
 * back button.
 *
 * This boundary is inside the area, so the shell and the navigation survive.
 * A patient whose prescriptions page failed can still reach their
 * appointments, which is `phase_18.md` section 129's point: one section's
 * failure should not destroy the rest of the experience.
 *
 * ## What it never shows
 *
 * `error.message`. Section 70 and section 144: no Supabase text, no relation
 * name, no stack trace, no storage path. Next.js already replaces the message
 * with a generic one in production, and this component does not render it in
 * any environment, so a development build cannot get into the habit of
 * displaying something a production build would hide.
 *
 * `digest` is the one thing that crosses: an opaque correlation id that
 * carries no patient data and is what support needs to find the matching
 * server log.
 *
 * ## Two ways forward
 *
 * `reset()` re-renders the segment, which is the right first try for a
 * transient failure. The link out is the second, for a failure that will
 * happen again — without it, a page that reliably throws is a trap.
 */
export default function PatientAreaError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // The digest only. The message may carry internal detail and must not
    // reach the browser console, where it would be one screenshot away from a
    // support ticket.
    if (error.digest) {
      console.error(`Patient area error (digest ${error.digest})`);
    }
  }, [error.digest]);

  return (
    <Section>
      <Container width="content">
        <ErrorState
          title={PATIENT_ERROR_COPY.title}
          description={PATIENT_ERROR_COPY.description}
          reference={error.digest}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={reset}>
                {PATIENT_ERROR_COPY.retryLabel}
              </Button>
              <Button asChild variant="ghost">
                <Link href="/patient">{PATIENT_ERROR_COPY.homeLabel}</Link>
              </Button>
            </div>
          }
        />
      </Container>
    </Section>
  );
}
