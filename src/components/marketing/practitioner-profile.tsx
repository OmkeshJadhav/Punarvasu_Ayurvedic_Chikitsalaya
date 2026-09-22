import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  PRACTITIONERS_PATH,
  PRIMARY_CTA,
  CONTACT_PATH,
} from "@/config/navigation";
import {
  PROFILE_CONSULTATION_NOTE,
  PROFILE_SECTION_TITLES,
} from "@/features/practitioners/content";
import type { PublishedPractitioner } from "@/features/practitioners/types";

/**
 * A practitioner's profile page.
 *
 * ## Only ever rendered for a confirmed profile
 *
 * The type is `PublishedPractitioner`, not `Practitioner`. A page for someone
 * whose details the clinic has not confirmed cannot be constructed here, and
 * the route never tries: `getPractitionerSlugs` returns published slugs only,
 * so an unpublished person has no URL at all
 * (`features/practitioners/directory.ts`).
 *
 * ## Every section is optional
 *
 * Qualifications, specialties, biography, approach, experience and languages
 * are each rendered only when the clinic has supplied them. A heading over an
 * empty block would read as an omission by the practitioner rather than by
 * the website (`docs/implementation-plan/phase_05.md` section 18).
 *
 * ## The consultation note
 *
 * Always rendered, never optional. A profile page is where a visitor is most
 * likely to conclude that picking the right person is what decides the
 * outcome, so the page says plainly that it is not
 * (`phase_05.md` sections 21 and 44).
 *
 * ## Layout
 *
 * Portrait, name, credentials and the action come first on a phone, with the
 * long-form writing beneath. From `lg` the portrait and the identity block
 * sit side by side and the body text runs in a measured column - the vertical
 * hierarchy `phase_05.md` section 57 asks for, without shrinking the
 * biography to fit beside a photograph.
 *
 * A server component. The page's single `<h1>` lives here.
 */
export interface PractitionerProfileProps {
  readonly practitioner: PublishedPractitioner;
  readonly titleId: string;
}

export function PractitionerProfile({
  practitioner,
  titleId,
}: PractitionerProfileProps) {
  const hasQualifications =
    practitioner.qualifications !== undefined &&
    practitioner.qualifications.length > 0;
  const hasSpecialties =
    practitioner.specialties !== undefined &&
    practitioner.specialties.length > 0;
  const hasBiography =
    practitioner.biography !== undefined && practitioner.biography.length > 0;
  const hasApproach =
    practitioner.approach !== undefined && practitioner.approach.length > 0;
  const hasLanguages =
    practitioner.languages !== undefined && practitioner.languages.length > 0;

  return (
    <>
      <section
        aria-labelledby={titleId}
        className="bg-background border-border border-b"
      >
        <Container width="wide" className="pt-6 pb-14 md:pb-20">
          <Breadcrumbs
            className="mb-8 lg:mb-10"
            items={[
              { label: "Home", href: "/" },
              { label: "Practitioners", href: PRACTITIONERS_PATH },
              { label: practitioner.name },
            ]}
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-16">
            {practitioner.image ? (
              <MediaFrame
                image={practitioner.image}
                aspect="portrait"
                radius="xl"
                priority
                // A portrait crop is driven by height, so the declared width
                // is overstated to stop the browser upscaling the source.
                sizes="(min-width: 1024px) 26rem, (min-width: 640px) 60vw, 100vw"
                className="lg:col-span-5"
              />
            ) : null}

            <div className={practitioner.image ? "lg:col-span-7" : "measure"}>
              {practitioner.designation ? (
                <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
                  {practitioner.designation}
                </p>
              ) : null}

              <h1
                id={titleId}
                className="text-h1 text-heading mt-4 font-normal text-balance"
              >
                {practitioner.name}
              </h1>

              {hasQualifications ? (
                <p className="text-body-lg text-prose mt-3">
                  {practitioner.qualifications?.join(", ")}
                </p>
              ) : null}

              {practitioner.experience ? (
                <p className="text-body text-muted-foreground mt-2">
                  {practitioner.experience}
                </p>
              ) : null}

              {practitioner.shortBio ? (
                <p className="text-body-lg text-prose measure mt-6">
                  {practitioner.shortBio}
                </p>
              ) : null}

              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button asChild size="lg" block className="sm:w-auto">
                  <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  block
                  className="sm:w-auto"
                >
                  <Link href={CONTACT_PATH}>Contact the clinic</Link>
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section
        aria-labelledby="practitioner-detail-title"
        className="bg-background"
      >
        <Container width="wide">
          <h2 id="practitioner-detail-title" className="sr-only">
            About {practitioner.name}
          </h2>

          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="flex flex-col gap-10 lg:col-span-7">
              {hasBiography ? (
                <ProfileBlock title={PROFILE_SECTION_TITLES.biography}>
                  {practitioner.biography?.map((paragraph) => (
                    <p key={paragraph} className="text-body-lg text-prose">
                      {paragraph}
                    </p>
                  ))}
                </ProfileBlock>
              ) : null}

              {hasApproach ? (
                <ProfileBlock title={PROFILE_SECTION_TITLES.approach}>
                  {practitioner.approach?.map((paragraph) => (
                    <p key={paragraph} className="text-body-lg text-prose">
                      {paragraph}
                    </p>
                  ))}
                </ProfileBlock>
              ) : null}

              <Alert tone="info" title="How care is decided here">
                {PROFILE_CONSULTATION_NOTE}
              </Alert>
            </div>

            <div className="flex flex-col gap-10 lg:col-span-5">
              {hasSpecialties ? (
                <ProfileBlock title={PROFILE_SECTION_TITLES.specialties}>
                  <DetailList items={practitioner.specialties ?? []} />
                </ProfileBlock>
              ) : null}

              {hasQualifications ? (
                <ProfileBlock title={PROFILE_SECTION_TITLES.qualifications}>
                  <DetailList items={practitioner.qualifications ?? []} />
                </ProfileBlock>
              ) : null}

              {hasLanguages ? (
                <ProfileBlock title={PROFILE_SECTION_TITLES.languages}>
                  <DetailList items={practitioner.languages ?? []} />
                </ProfileBlock>
              ) : null}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

function ProfileBlock({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-h4 text-heading border-border border-b pb-3 font-normal">
        {title}
      </h3>
      <div className="measure mt-5 flex flex-col gap-4">{children}</div>
    </div>
  );
}

/**
 * A short list of confirmed facts.
 *
 * A real `<ul>` rather than comma-separated text, so each entry is announced
 * separately and the count is available.
 */
function DetailList({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="text-body text-prose border-border flex gap-3 border-b pb-2 last:border-b-0"
        >
          <span aria-hidden="true" className="bg-primary/40 mt-2.5 h-px w-4" />
          {item}
        </li>
      ))}
    </ul>
  );
}
