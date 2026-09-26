import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { CONTACT_PAGE_IMAGES } from "@/config/images";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

/**
 * Practical questions about visiting.
 *
 * The heading and a still life of stacked stones on the left, the questions on
 * open hairlines on the right: atmosphere on one side, content on the other.
 * The photograph is shot against a pale wall and dissolved into the page with
 * `mix-blend-multiply` and a soft mask, as in `ServicesFaq`. It is decorative
 * (`CONTACT_PAGE_IMAGES`).
 *
 * The questions are the ones the rest of the page cannot answer in a line,
 * and where the only honest answer is "the clinic has not confirmed that,
 * please call", that is the answer given (`phase_05.md` section 46). The
 * urgent-care answer is one of them, so it is visible as a question even
 * collapsed.
 *
 * A server component around the accordion's client island.
 */
export function ContactFaq() {
  const { faq, faqItems } = CONTACT_PAGE;

  return (
    <Section
      id={CONTACT_SECTIONS.faq}
      aria-labelledby="contact-faq-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                {faq.eyebrow}
              </p>
              <h2
                id="contact-faq-title"
                className="text-display text-heading mt-5 font-normal"
              >
                {faq.title}
              </h2>
              <p className="text-body-lg text-prose mt-6 max-w-md">
                {faq.description}
              </p>
            </Reveal>

            {/* Bleeds off the left edge on wide screens so the stones sit in
                the corner of the page rather than in a box. */}
            <Reveal
              effect="unveil"
              className="mt-8 hidden mask-[radial-gradient(ellipse_at_35%_60%,black_40%,transparent_72%)] mix-blend-multiply sm:block lg:-ml-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]"
            >
              <MediaFrame
                image={CONTACT_PAGE_IMAGES.stones}
                aspect="landscape"
                radius="none"
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="bg-transparent"
                imageClassName="brightness-[1.04]"
              />
            </Reveal>
          </div>

          <Reveal delay={120} className="lg:col-span-7 lg:pt-2">
            <FaqAccordion
              items={faqItems}
              headingLevel="h3"
              appearance="rules"
            />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
