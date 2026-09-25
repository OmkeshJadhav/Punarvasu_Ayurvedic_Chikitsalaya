"use client";

import Link from "next/link";
import { ArrowRight, Info, Phone, X } from "lucide-react";
import type { ReactNode } from "react";

import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CLINIC_CONTACT, formatPhone } from "@/config/clinic";
import { PRIMARY_CTA } from "@/config/navigation";
import {
  PROFILE_CONSULTATION_NOTE,
  PROFILE_SECTION_TITLES,
} from "@/features/practitioners/content";
import type { PublishedPractitioner } from "@/features/practitioners/types";

/**
 * A practitioner's full profile, as a modal.
 *
 * Replaces the retired `/practitioners/[slug]` pages: the home and About pages
 * introduce each doctor in a few lines, and this is where the rest lives.
 *
 * ## Composition
 *
 * A two-leaf spread from `md`, like an open prospectus. The left leaf is the
 * portrait, full-height, with the designation and experience set over a scrim
 * at its foot. The right leaf is the reading side: the name at display size,
 * credentials as a quiet ledger of label/value rows, areas of focus as
 * hairline pills, the biography, and the clinic's consultation note in a sage
 * inset. The actions sit in a footer that stays put while the right leaf
 * scrolls, so "Book a consultation" is never scrolled out of reach.
 *
 * On a phone the dialog is the design system's bottom sheet, and the portrait
 * becomes a banner across its top.
 *
 * ## Behaviour
 *
 * Radix supplies the focus trap, Escape, focus return to the trigger and the
 * inert page behind. `DialogTitle` is the practitioner's name, so the dialog
 * is announced as "Dr. ..., dialog". The built-in close button is replaced
 * with a round glass one that reads on both the photograph and the paper.
 *
 * Every section renders only when the roster holds its data, so no empty
 * heading is ever left behind.
 */
export interface PractitionerProfileDialogProps {
  readonly practitioner: PublishedPractitioner;
  /** The element that opens the dialog; rendered through `DialogTrigger`. */
  readonly children: ReactNode;
}

export function PractitionerProfileDialog({
  practitioner,
  children,
}: PractitionerProfileDialogProps) {
  const {
    name,
    designation,
    qualifications = [],
    registrationNumber,
    experience,
    specialties = [],
    languages = [],
    biography = [],
    approach = [],
    shortBio,
    image,
  } = practitioner;
  const phone = formatPhone(CLINIC_CONTACT.phone);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        hideCloseButton
        className="bg-background gap-0 overflow-hidden p-0 sm:max-w-5xl sm:rounded-2xl md:grid md:h-[min(88dvh,46rem)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-[minmax(0,1fr)]"
      >
        {/* Left leaf: the portrait. */}
        <div className="bg-brand-surface relative h-80 shrink-0 overflow-hidden md:h-auto">
          {image ? (
            <MediaFrame
              image={image}
              aspect="fill"
              radius="none"
              sizes="(min-width: 768px) 26rem, 100vw"
              imageClassName="object-[50%_22%] motion-safe:animate-settle md:object-top"
            />
          ) : (
            <BotanicalMotif className="text-brand-surface-border absolute inset-0 m-auto h-3/4 w-1/2" />
          )}

          <div
            aria-hidden="true"
            className="from-scrim/90 via-scrim/70 absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent md:h-3/4"
          />

          <div className="text-scrim-foreground absolute inset-x-0 bottom-0 p-6 sm:p-8">
            {designation ? (
              <p className="text-caption font-medium tracking-[0.2em] uppercase">
                {designation}
              </p>
            ) : null}
            {experience ? (
              <p className="text-h5 mt-2 font-serif font-normal italic">
                {experience}
              </p>
            ) : null}
            {image?.placeholder ? (
              <p className="text-caption text-scrim-foreground/80 mt-3">
                Representative photograph
              </p>
            ) : null}
          </div>
        </div>

        {/* Right leaf: the reading side. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-8 sm:px-10 sm:pt-12">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              Practitioner profile
            </p>

            <DialogTitle className="text-display text-heading mt-5 font-serif font-normal">
              {name}
            </DialogTitle>

            {shortBio ? (
              <DialogDescription className="text-body-lg text-prose mt-4">
                {shortBio}
              </DialogDescription>
            ) : null}

            <dl className="border-border-strong mt-8 border-t">
              {qualifications.length > 0 ? (
                <LedgerRow label={PROFILE_SECTION_TITLES.qualifications}>
                  {qualifications.join(", ")}
                </LedgerRow>
              ) : null}
              {registrationNumber ? (
                <LedgerRow label={PROFILE_SECTION_TITLES.registration}>
                  {registrationNumber}
                </LedgerRow>
              ) : null}
              {experience ? (
                <LedgerRow label={PROFILE_SECTION_TITLES.experience}>
                  {experience}
                </LedgerRow>
              ) : null}
              {languages.length > 0 ? (
                <LedgerRow label={PROFILE_SECTION_TITLES.languages}>
                  {languages.join(", ")}
                </LedgerRow>
              ) : null}
            </dl>

            {specialties.length > 0 ? (
              <ProfileSection title={PROFILE_SECTION_TITLES.specialties}>
                <ul className="flex flex-wrap gap-2">
                  {specialties.map((specialty) => (
                    <li
                      key={specialty}
                      className="border-border-strong text-body-sm text-heading rounded-full border px-4 py-1.5"
                    >
                      {specialty}
                    </li>
                  ))}
                </ul>
              </ProfileSection>
            ) : null}

            {biography.length > 0 ? (
              <ProfileSection title={PROFILE_SECTION_TITLES.biography}>
                <div className="flex flex-col gap-4">
                  {biography.map((paragraph) => (
                    <p key={paragraph} className="text-body text-prose">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {approach.length > 0 ? (
              <ProfileSection title={PROFILE_SECTION_TITLES.approach}>
                <div className="flex flex-col gap-4">
                  {approach.map((paragraph) => (
                    <p key={paragraph} className="text-body text-prose">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            <p className="bg-sage text-body-sm text-prose mt-10 flex gap-3 rounded-lg p-5">
              <Info
                aria-hidden="true"
                className="text-primary mt-0.5 size-4 shrink-0"
              />
              {PROFILE_CONSULTATION_NOTE}
            </p>
          </div>

          <div className="border-border bg-background flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:px-10">
            <Button asChild size="lg" className="group">
              <Link href={PRIMARY_CTA.href}>
                Book a consultation
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            {phone && CLINIC_CONTACT.phone ? (
              <Button asChild size="lg" variant="outline">
                <a href={`tel:${CLINIC_CONTACT.phone}`}>
                  <Phone aria-hidden="true" />
                  {phone}
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <DialogClose className="bg-card/85 text-heading hover:bg-card ease-natural focus-visible:outline-ring absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Close profile</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

/** One credential: a small-caps label and its value, divided by hairlines. */
function LedgerRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="border-border grid gap-1 border-b py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-caption text-muted-foreground pt-0.5 font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="text-body text-heading">{children}</dd>
    </div>
  );
}

/** A titled block inside the reading side. */
function ProfileSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h3 className="text-h5 text-heading mb-4 font-serif font-normal">
        {title}
      </h3>
      {children}
    </section>
  );
}
