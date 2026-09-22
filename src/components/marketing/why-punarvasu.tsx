import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { StatementList } from "@/components/marketing/statement-list";
import { HOME_SECTIONS, WHY_CONTENT } from "@/config/marketing-content";

/**
 * "Why Punarvasu" — the differentiation section.
 *
 * Distinct from the trust strip in the hero, which is three short labels a
 * visitor reads in two seconds. This is four fuller statements, read by
 * someone who has scrolled and is now deciding. Repetition between them would
 * make the page feel padded, so the trust strip states *what* and this states
 * *what that means in practice*.
 *
 * Composed from `StatementList`, which is the one implementation of this
 * shape on the site - a two-by-two grid rather than a four-across row,
 * because four narrow columns give every statement an eight-word line and
 * that reads as a feature list.
 *
 * Every claim here is about the clinic's process, not about outcomes. There is
 * nothing to quantify and nothing that would become a medical claim if quoted
 * alone (`AGENTS.md` section 15).
 */
export function WhyPunarvasuSection() {
  return (
    <Section
      id={HOME_SECTIONS.why}
      aria-labelledby="why-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="why-title"
              eyebrow={WHY_CONTENT.eyebrow}
              title={WHY_CONTENT.title}
              description={WHY_CONTENT.description}
            />
          </div>

          <StatementList
            statements={WHY_CONTENT.points}
            className="lg:col-span-7"
          />
        </div>
      </Container>
    </Section>
  );
}
