import { Clock, MapPin, Phone, Quote } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Emphasis } from "@/components/marketing/emphasis";
import { PractitionerPortrait } from "@/components/marketing/practitioner-portrait";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { CLINIC_CONTACT, formatPhone } from "@/config/clinic";
import { CONTACT_PATH } from "@/config/navigation";
import {
  ABOUT_PAGE,
  ABOUT_SECTIONS,
  type Testimonial,
} from "@/features/about/content";
import type { Practitioner } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * The About page's second half: its numbers, its people and place, its
 * limits, and - once there are any - its patients' words.
 */

/**
 * Editorial figures.
 *
 * Numerals set at display size in the serif, divided by hairlines, with a
 * label and one line beneath - the way a printed annual report sets a figure,
 * rather than as three stat cards.
 *
 * Every figure is a count of something this page commits to, so each is true
 * by construction; `ABOUT_PAGE.figures` explains why there is no patient
 * count or years-in-practice figure, and where one goes when the clinic
 * confirms it.
 */
export function FiguresSection() {
  const { figures } = ABOUT_PAGE;

  return (
    <Section aria-labelledby="about-figures-title" className="bg-muted">
      <Container width="wide">
        <Reveal>
          <SectionHeader
            titleId="about-figures-title"
            eyebrow={figures.eyebrow}
            title={figures.title}
          />
        </Reveal>

        <ul className="mt-14 grid sm:grid-cols-3 lg:mt-16">
          {figures.items.map((figure, index) => (
            <Reveal key={figure.label} asChild delay={index * 90}>
              <li
                className={cn(
                  "border-border-strong flex flex-col border-t py-8 sm:border-t-0 sm:py-2",
                  index > 0 && "sm:border-l sm:pl-10",
                  index < figures.items.length - 1 && "sm:pr-10",
                )}
              >
                <span className="text-heading font-serif text-[clamp(4.5rem,3rem+6vw,8rem)] leading-none font-normal tracking-[-0.03em] lining-nums">
                  {figure.value}
                </span>
                <span className="text-label text-heading mt-6 font-semibold">
                  {figure.label}
                </span>
                <span className="text-body-sm text-muted-foreground mt-1">
                  {figure.detail}
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/**
 * "Where Punarvasu is" and "Who you will meet", side by side.
 *
 * Place and people answer one question - who and where you would be walking
 * in to see - so they share a band: a quiet card for the clinic on the left,
 * two arched portraits on the right. Each keeps its own heading and anchor
 * (`#the-clinic`, `#practitioners`).
 *
 * The clinic card shows no photograph, and says why: the clinic's own rooms
 * have not been photographed, and stock imagery is not allowed to stand in
 * for them (`phase_05.md` sections 23-24). Its location sentence is the
 * copy's own, not a second rendering of the address.
 */
export function PlaceAndPeopleSection({
  practitioners,
}: {
  readonly practitioners: readonly Practitioner[];
}) {
  const { clinic, practitioners: people } = ABOUT_PAGE;
  const [location, photographsNote] = clinic.paragraphs;
  const phone = formatPhone(CLINIC_CONTACT.phone);

  return (
    <Section
      id={ABOUT_SECTIONS.practitioners}
      aria-labelledby="about-practitioners-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-4">
            <section
              id={ABOUT_SECTIONS.clinic}
              aria-labelledby="about-clinic-title"
              className="anchor-offset border-border bg-card rounded-xl border p-7 sm:p-9"
            >
              <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                05 · {clinic.eyebrow}
              </p>
              <h2
                id="about-clinic-title"
                className="text-h3 text-heading mt-5 font-normal"
              >
                {clinic.title}
              </h2>

              {location ? (
                <p className="text-body text-prose mt-6 flex gap-3">
                  <MapPin
                    aria-hidden="true"
                    className="text-gold mt-1 size-4 shrink-0"
                  />
                  <span>{location}</span>
                </p>
              ) : null}

              {phone && CLINIC_CONTACT.phone ? (
                <p className="text-body text-prose mt-4 flex items-center gap-3">
                  <Phone
                    aria-hidden="true"
                    className="text-gold size-4 shrink-0"
                  />
                  <a
                    href={`tel:${CLINIC_CONTACT.phone}`}
                    className="link-underline hover:link-underline-active rounded-sm"
                  >
                    {phone}
                  </a>
                </p>
              ) : null}

              {CLINIC_CONTACT.openingHours ? (
                <p className="text-body text-prose mt-4 flex gap-3">
                  <Clock
                    aria-hidden="true"
                    className="text-gold mt-1 size-4 shrink-0"
                  />
                  <span>{CLINIC_CONTACT.openingHours}</span>
                </p>
              ) : null}

              {photographsNote ? (
                <p className="text-body-sm text-muted-foreground border-border mt-7 border-t pt-6">
                  {photographsNote}
                </p>
              ) : null}

              <TextLink href={CONTACT_PATH} className="mt-4">
                {clinic.linkLabel}
              </TextLink>
            </section>
          </Reveal>

          <div className="lg:col-span-7 lg:col-start-6">
            <Reveal>
              <SectionHeader
                titleId="about-practitioners-title"
                eyebrow={`06 · ${people.eyebrow}`}
                title={people.title}
                description={people.description}
              />
            </Reveal>

            <ul className="mt-12 grid gap-12 sm:grid-cols-2 sm:gap-8">
              {practitioners.map((practitioner, index) => (
                <Reveal key={practitioner.slug} asChild delay={index * 100}>
                  <li className={cn(index % 2 === 1 && "sm:mt-16")}>
                    <PractitionerPortrait
                      practitioner={practitioner}
                      shape="arch"
                      summary
                      sizes="(min-width: 1280px) 21rem, (min-width: 640px) 45vw, 100vw"
                    />
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/**
 * "Four things we will not do" - the difference, stated as limits.
 *
 * The heading holds its place on the left (sticky from `lg`) while the four
 * refusals scroll past it on the right, each led by a large serif numeral.
 * The numeral warms to the primary green on hover: a small sign the list is
 * being read, with no card or shadow to carry it.
 */
export function CommitmentsSection() {
  const { commitments } = ABOUT_PAGE;

  return (
    <Section
      id={ABOUT_SECTIONS.commitments}
      aria-labelledby="about-commitments-title"
      className="anchor-offset bg-muted"
    >
      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Reveal className="lg:sticky lg:top-32">
              <SectionHeader
                titleId="about-commitments-title"
                eyebrow={`07 · ${commitments.eyebrow}`}
                title={
                  <Emphasis
                    text={commitments.title}
                    phrase={commitments.titleEmphasis}
                    className="text-primary"
                  />
                }
                description={commitments.description}
              />
            </Reveal>
          </div>

          <ol className="border-border-strong border-t lg:col-span-7 lg:col-start-6">
            {commitments.items.map((item, index) => (
              <Reveal key={item.title} asChild delay={index * 70}>
                <li className="group border-border-strong grid grid-cols-[3rem_1fr] gap-x-6 border-b py-9 sm:grid-cols-[5rem_1fr]">
                  <span
                    aria-hidden="true"
                    className="text-h2 text-gold ease-natural group-hover:text-primary font-serif leading-none italic transition-colors duration-(--duration-normal)"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-h4 text-heading font-normal">
                      {item.title}
                    </h3>
                    <p className="text-body text-prose measure mt-3">
                      {item.description}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}

/**
 * Patients' own words.
 *
 * Renders nothing today, and that is the correct state: no testimonial has
 * been supplied with the patient's consent, and an invented one on a clinic's
 * website is a fabricated medical endorsement. The layout is here so the
 * clinic's first real, consented quote needs only a data entry in
 * `ABOUT_TESTIMONIALS` - whose type will not accept one without a consent
 * record.
 *
 * Quotes are set in the serif italic, attributed exactly as the patient
 * agreed, with no stars and no rating: a score invites a comparison the
 * clinic cannot stand behind.
 */
export function TestimonialsSection({
  testimonials,
}: {
  readonly testimonials: readonly Testimonial[];
}) {
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <Section
      aria-labelledby="about-testimonials-title"
      className="bg-background"
    >
      <Container width="wide">
        <Reveal>
          <SectionHeader
            titleId="about-testimonials-title"
            align="center"
            eyebrow="In their words"
            title="What patients have told us"
          />
        </Reveal>

        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.id} asChild delay={index * 80}>
              <li>
                <figure className="border-border bg-card flex h-full flex-col rounded-xl border p-8">
                  <Quote
                    aria-hidden="true"
                    className="text-gold size-6"
                    strokeWidth={1.25}
                  />
                  <blockquote className="text-h5 text-heading mt-5 flex-1 font-serif font-normal italic">
                    <p>{testimonial.quote}</p>
                  </blockquote>
                  <figcaption className="text-label text-muted-foreground border-border mt-7 border-t pt-5">
                    {testimonial.attribution}
                  </figcaption>
                </figure>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
