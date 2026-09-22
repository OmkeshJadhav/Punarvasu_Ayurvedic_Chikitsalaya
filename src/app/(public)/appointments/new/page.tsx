import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { CLINIC_CONTACT, formatPhone } from "@/config/clinic";
import { LOGIN_PATH } from "@/lib/auth/paths";

/**
 * The public entry point to booking.
 *
 * ## What changed in Phase 09
 *
 * Until now this page said, truthfully, that online booking did not exist. It
 * does now, for signed-in patients, so the page's job has changed from
 * explaining an absence to routing someone into the flow.
 *
 * The URL is deliberately the same one Phase 03 chose: "Book a Consultation"
 * appears five times on the home page and in the header, and every one of
 * those links keeps working.
 *
 * ## Why booking is not anonymous
 *
 * `phase_09.md` section 50 is explicit — the preferred model is public site,
 * then authentication, then patient profile, then booking — and section 23
 * requires the patient to be *derived* from the authenticated user rather than
 * claimed in a request. An anonymous booking has no owner, so it cannot be
 * viewed, cancelled or rescheduled by the person who made it, and it cannot be
 * protected by row-level security from the person who did not.
 *
 * So this page explains that in one sentence and offers the two things a
 * visitor can actually do: sign in, or telephone the clinic.
 *
 * ## Why it stays static and `noindex`
 *
 * It reads no session — checking one here would make it render per request and
 * it is the only booking-adjacent page that is still part of the public,
 * statically prerendered site. `/patient/appointments/book` is the real
 * destination and the sign-in redirect carries the visitor there. `noindex`
 * because a page whose purpose is to move you along has no business being a
 * search result.
 */
export const metadata: Metadata = {
  title: "Book a Consultation",
  description:
    "How to request a consultation at Punarvasu. Booking is done from your patient account, so your appointments stay private to you.",
  robots: { index: false, follow: true },
};

const BOOKING_DESTINATION = "/patient/appointments/book";

export default function NewAppointmentPage() {
  const phone = formatPhone(CLINIC_CONTACT.phone);

  return (
    <Section aria-labelledby="booking-title" className="bg-background">
      <Container width="prose">
        <span
          aria-hidden="true"
          className="text-primary bg-accent flex size-12 items-center justify-center rounded-full [&_svg]:size-5"
        >
          <CalendarClock />
        </span>

        <h1
          id="booking-title"
          className="text-h1 text-heading mt-6 font-normal"
        >
          Request a consultation
        </h1>

        <p className="text-body-lg text-prose mt-5">
          You can request an appointment from your Punarvasu account. Signing in
          first is what lets the clinic know who the appointment is for, and
          what keeps your appointments visible to you and to nobody else.
        </p>

        <p className="text-body-lg text-prose mt-4">
          Every request is confirmed by the clinic before it is settled, so you
          will hear from us about the time you choose.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            {/*
              Carries the booking page as the destination, so signing in lands
              on it rather than on the account page. `safeRedirectPath`
              validates it server-side before it is used — this value is a
              literal, but the parameter is treated as untrusted regardless
              (`lib/auth/redirect.ts`).
            */}
            <Link
              href={`${LOGIN_PATH}?next=${encodeURIComponent(BOOKING_DESTINATION)}`}
            >
              Sign in to request an appointment
            </Link>
          </Button>
          {phone ? (
            <Button asChild variant="outline" size="lg">
              <a href={`tel:${CLINIC_CONTACT.phone}`}>Call the clinic</a>
            </Button>
          ) : null}
        </div>

        <p className="text-body-sm text-muted-foreground mt-8">
          Do not have an account yet?{" "}
          <Link
            href="/auth/register"
            className="text-primary underline underline-offset-4"
          >
            Create one
          </Link>
          {phone ? (
            <>
              , or telephone the clinic on{" "}
              <a
                href={`tel:${CLINIC_CONTACT.phone}`}
                className="text-primary underline underline-offset-4"
              >
                {phone}
              </a>
              .
            </>
          ) : (
            "."
          )}
        </p>
      </Container>
    </Section>
  );
}
