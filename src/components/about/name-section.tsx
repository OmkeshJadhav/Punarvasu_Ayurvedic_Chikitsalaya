import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { Reveal } from "@/components/shared/reveal";
import { CLINIC_IDENTITY } from "@/config/clinic";
import { ABOUT_PAGE, ABOUT_SECTIONS } from "@/features/about/content";

/**
 * "What Punarvasu means" - the name, as the page's first chapter.
 *
 * The word itself is the image: पुनर्वसु set large in a deep green arch - the
 * same arched niche as the home page's hero photograph, so the two pages
 * share an architecture - with hairline rings behind it for the night sky a
 * nakshatra belongs to. Beside it, the word is glossed half by half, then the
 * explanation follows: the first paragraph set in the serif as the answer,
 * the second smaller, because it is the qualification.
 *
 * The second paragraph must stay: it is where the page says it does not know
 * why the clinic chose the name, and a test holds it to that.
 */
export function NameSection() {
  const { name } = ABOUT_PAGE;
  const [answer, qualification] = name.paragraphs;

  return (
    <Section
      id={ABOUT_SECTIONS.name}
      aria-labelledby="about-name-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <div className="bg-brand-surface text-brand-surface-foreground relative mx-auto flex aspect-4/5 max-w-md flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-lg px-8 pb-12">
              {/* Concentric hairlines: the sky the nakshatra sits in. */}
              <div
                aria-hidden="true"
                className="border-brand-surface-border/50 absolute top-[16%] left-1/2 aspect-square w-[78%] -translate-x-1/2 rounded-full border"
              />
              <div
                aria-hidden="true"
                className="border-brand-surface-border/35 absolute top-[26%] left-1/2 aspect-square w-[54%] -translate-x-1/2 rounded-full border"
              />
              <BotanicalMotif
                variant="ornament"
                className="text-brand-surface-accent/70 absolute top-[12%] left-1/2 -translate-x-1/2"
              />

              <p
                lang="sa"
                className="text-display-xl relative font-serif leading-none"
              >
                {CLINIC_IDENTITY.devanagariName}
              </p>
              <p className="text-caption text-brand-surface-accent relative mt-5 font-sans font-medium tracking-[0.2em] uppercase">
                {name.archCaption}
              </p>
            </div>
          </Reveal>

          <Reveal delay={100} className="lg:col-span-6 lg:col-start-7">
            <SectionHeader
              titleId="about-name-title"
              eyebrow={`01 · ${name.eyebrow}`}
              title={
                <Emphasis
                  text={name.title}
                  phrase={name.titleEmphasis}
                  className="text-primary"
                />
              }
            />

            <dl className="border-border-strong mt-10 grid grid-cols-2 border-t">
              {name.glossary.map((entry, index) => (
                <div
                  key={entry.term}
                  className={
                    index > 0
                      ? "border-border-strong border-l pt-6 pl-6"
                      : "pt-6 pr-6"
                  }
                >
                  <dt>
                    <span
                      lang="sa"
                      className="text-h3 text-eyebrow block font-serif"
                    >
                      {entry.devanagari}
                    </span>
                    <span className="text-body text-heading mt-1 block font-serif italic">
                      {entry.term}
                    </span>
                  </dt>
                  <dd className="text-body-sm text-muted-foreground mt-1">
                    {entry.meaning}
                  </dd>
                </div>
              ))}
            </dl>

            {answer ? (
              <p className="text-h5 text-heading mt-10 font-serif leading-relaxed font-normal">
                {answer}
              </p>
            ) : null}
            {qualification ? (
              <p className="text-body text-prose measure mt-6">
                {qualification}
              </p>
            ) : null}
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
