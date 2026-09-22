import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ContentReviewNotice } from "@/components/marketing/content-review-notice";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { ProcessSteps } from "@/components/marketing/process-steps";
import {
  EMERGENCY_NOTE,
  GENERAL_PRECAUTION_NOTE,
  MEDICAL_DISCLAIMER,
} from "@/features/services/content";
import type { Treatment } from "@/features/services/types";
import { cn } from "@/lib/utils/cn";

/**
 * The body of a treatment page.
 *
 * ## Composition
 *
 * An editorial article with a contents rail beside it from `lg`. The rail is
 * a sticky list of plain anchor links — no scroll listener, no active-section
 * highlighting, no client JavaScript at all. It exists because a treatment
 * page is long, and a reader who wants the precautions should not have to
 * scroll past the traditional context to find them.
 *
 * ## Sections appear only when they have content
 *
 * Every section except the overview and the precautions is optional, and an
 * absent one renders nothing — no heading over a blank space, and no entry in
 * the contents rail either (`docs/implementation-plan/phase_04.md` section
 * 60). The sections are assembled into an array first precisely so the rail
 * and the article are generated from the same list and cannot disagree.
 *
 * ## Precautions always render
 *
 * This is the one section that is never omitted. Where the clinic has
 * supplied verified precautions they are listed; where it has not, the
 * general "discuss your history with your practitioner" guidance appears
 * instead. What never happens is a fabricated contraindication list
 * (`phase_04.md` section 29, `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * A server component apart from the FAQ disclosure.
 */
export interface TreatmentArticleProps {
  readonly treatment: Treatment;
}

interface ArticleSection {
  readonly id: string;
  readonly title: string;
  readonly body: ReactNode;
}

export function TreatmentArticle({ treatment }: TreatmentArticleProps) {
  const { content } = treatment;
  const sections: ArticleSection[] = [];

  sections.push({
    id: "overview",
    title: "Overview",
    body: <Prose paragraphs={content.overview} />,
  });

  if (content.traditionalContext && content.traditionalContext.length > 0) {
    sections.push({
      id: "traditional-context",
      title: "Traditional Ayurvedic context",
      body: (
        <>
          <Prose paragraphs={content.traditionalContext} />
          {/*
            Stated in the page, not only in a code comment: a classical
            description is a description of a tradition, and a reader must not
            take it for a summary of clinical evidence (`phase_04.md` §26).
          */}
          <p className="text-body-sm text-muted-foreground border-border mt-6 border-l-2 pl-4">
            This section describes how the therapy is understood within
            classical Ayurveda. It is not a summary of modern clinical research,
            and no study is cited or implied.
          </p>
        </>
      ),
    });
  }

  if (content.whatToExpect && content.whatToExpect.length > 0) {
    sections.push({
      id: "what-to-expect",
      title: "What to expect",
      body: (
        <ProcessSteps
          steps={content.whatToExpect}
          layout="timeline"
          headingLevel="h3"
          className="mt-2"
        />
      ),
    });
  }

  if (content.preparation && content.preparation.length > 0) {
    sections.push({
      id: "preparation",
      title: "Preparing for your visit",
      body: <GuidanceList items={content.preparation} />,
    });
  }

  if (content.aftercare && content.aftercare.length > 0) {
    sections.push({
      id: "aftercare",
      title: "Afterwards",
      body: <GuidanceList items={content.aftercare} />,
    });
  }

  sections.push({
    id: "precautions",
    title: "Before you consider this",
    body: <Precautions treatment={treatment} />,
  });

  if (content.faqs && content.faqs.length > 0) {
    sections.push({
      id: "treatment-questions",
      title: "Questions about this treatment",
      body: (
        <FaqAccordion items={content.faqs} headingLevel="h3" className="mt-2" />
      ),
    });
  }

  return (
    <Section aria-label={`About ${treatment.name}`} className="bg-background">
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <ContentsRail sections={sections} />

          <div className="lg:col-span-8 xl:col-span-7">
            {treatment.reviewStatus !== "verified" ? (
              <ContentReviewNotice context="detail" className="mb-10" />
            ) : null}

            <div className="flex flex-col gap-12 lg:gap-16">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className="anchor-offset"
                >
                  <h2
                    id={`${section.id}-title`}
                    className="text-h3 text-heading border-border border-t pt-6 font-normal"
                  >
                    {section.title}
                  </h2>
                  <div className="mt-6">{section.body}</div>
                </section>
              ))}
            </div>

            <p className="text-body-sm text-muted-foreground border-border mt-14 border-t pt-6">
              {MEDICAL_DISCLAIMER}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/**
 * The contents rail.
 *
 * `position: sticky` and nothing else. Highlighting the section currently in
 * view would need a scroll observer, and the cost of that — a client
 * component wrapping the whole article — buys a nicety, not a capability.
 *
 * Hidden below `lg`, where the article is a single column and a contents list
 * would simply be more to scroll past before reaching the content it lists.
 * That is a duplicate navigation aid, not the only one: every heading is
 * still reachable, and a screen-reader user navigates by heading regardless.
 */
function ContentsRail({
  sections,
}: {
  readonly sections: readonly ArticleSection[];
}) {
  if (sections.length < 3) {
    return null;
  }

  return (
    <nav
      aria-label="On this page"
      className="hidden lg:col-span-4 lg:block xl:col-span-3"
    >
      <div className="sticky top-28">
        <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.14em] uppercase">
          On this page
        </p>
        <ul className="border-border mt-4 flex flex-col border-l">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cn(
                  "text-body-sm text-prose ease-natural -ml-px block border-l py-2 pl-4 transition-colors duration-(--duration-fast)",
                  "hover:border-primary hover:text-primary border-transparent",
                  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
                )}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Prose({ paragraphs }: { readonly paragraphs: readonly string[] }) {
  return (
    <div className="measure flex flex-col gap-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-body-lg text-prose">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function GuidanceList({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="measure marker:text-border-strong flex list-disc flex-col gap-3 pl-5">
      {items.map((item) => (
        <li key={item} className="text-body text-prose pl-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The safety section.
 *
 * Given its own surface and an icon so it reads as guidance to act on rather
 * than as another paragraph. The emergency line is repeated here, in the
 * open, on every treatment page — `docs/HEALTHCARE_AND_AI_SAFETY.md` section
 * 3.3 requires it wherever a visitor might be reasoning about an acute
 * problem, and someone reading about a therapy for a worsening symptom is
 * exactly that reader.
 */
function Precautions({ treatment }: { readonly treatment: Treatment }) {
  const precautions = treatment.content.precautions ?? [];

  return (
    <div className="border-border bg-muted flex flex-col gap-4 rounded-lg border p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="text-warning bg-warning-surface border-warning-border flex size-10 items-center justify-center rounded-full border [&_svg]:size-5"
      >
        <ShieldAlert />
      </span>

      {precautions.length > 0 ? (
        <ul className="measure marker:text-border-strong flex list-disc flex-col gap-3 pl-5">
          {precautions.map((item) => (
            <li key={item} className="text-body text-prose pl-1">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-prose measure">
          {GENERAL_PRECAUTION_NOTE}
        </p>
      )}

      <p className="text-body-sm text-muted-foreground measure border-border border-t pt-4">
        {EMERGENCY_NOTE}
      </p>
    </div>
  );
}
