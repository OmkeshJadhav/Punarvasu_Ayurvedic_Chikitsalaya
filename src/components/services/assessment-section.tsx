import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  HeartHandshake,
  Leaf,
  Sprout,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { Emphasis } from "@/components/marketing/emphasis";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA } from "@/config/navigation";
import { SERVICES_PAGE, SERVICES_SECTIONS } from "@/features/services/content";

/**
 * How a treatment is chosen: a large editorial statement on the left and the
 * four steps as a numbered 01-04 sequence on the right.
 *
 * The steps are separated by hairlines rather than boxed: they are four parts
 * of one commitment, and four cards would read as four products. They are an
 * `<ol>` because the order is the point.
 *
 * Two painted branches frame the section from its outer edges; they sit
 * behind the content and are hidden below `md`, where there is no margin for
 * them.
 *
 * A server component.
 */
const STEP_ICONS = [Sprout, ClipboardList, Leaf, HeartHandshake] as const;

export function AssessmentSection() {
  const { selection } = SERVICES_PAGE;

  return (
    <Section
      id={SERVICES_SECTIONS.selection}
      aria-labelledby="selection-title"
      className="anchor-offset bg-background relative isolate overflow-hidden"
    >
      {/* A branch at each edge, cropped by the viewport, framing the
          statement on one side and the steps on the other. */}
      <LeafSprig
        sizes="24rem"
        className="absolute top-4 -left-40 -z-10 hidden w-96 scale-x-[-1] rotate-[-30deg] opacity-25 saturate-50 md:block"
      />
      <LeafSprig
        sizes="24rem"
        className="absolute -right-40 -bottom-8 -z-10 hidden w-96 rotate-[20deg] opacity-25 saturate-50 md:block"
      />

      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {selection.eyebrow}
            </p>
            <h2
              id="selection-title"
              className="text-display-xl text-heading mt-6 max-w-[11ch] font-normal"
            >
              <Emphasis
                text={selection.title}
                phrase={selection.titleEmphasis}
                className="text-primary"
              />
            </h2>
            <p className="text-body-lg text-prose mt-7 max-w-md">
              {selection.description}
            </p>
            <Button asChild size="lg" className="group mt-10">
              <Link href={PRIMARY_CTA.href}>
                {PRIMARY_CTA.label}
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
          </Reveal>

          <ol className="grid self-center sm:grid-cols-2 lg:col-span-7">
            {selection.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Leaf;
              return (
                <Reveal key={step.title} asChild delay={index * 80}>
                  <li
                    className={
                      // Hairlines between the cells only: a rule under the
                      // first row and one between the columns, never a box.
                      "border-border flex gap-5 border-t py-8 first:border-t-0 sm:px-8 sm:odd:pl-0 sm:even:border-l sm:even:pr-0 sm:nth-[-n+2]:border-t-0 sm:nth-[n+3]:border-t"
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      className="text-gold mt-1 size-7 shrink-0"
                      strokeWidth={1}
                    />
                    <div>
                      <p
                        aria-hidden="true"
                        className="text-eyebrow text-body-lg font-serif"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="text-h5 text-heading mt-1 font-serif font-normal">
                        {step.title}
                      </h3>
                      <p className="text-body-sm text-prose mt-2">
                        {step.description}
                      </p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
