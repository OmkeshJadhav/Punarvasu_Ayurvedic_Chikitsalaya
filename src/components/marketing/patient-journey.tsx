import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ProcessSteps } from "@/components/marketing/process-steps";
import { HOME_SECTIONS, JOURNEY_CONTENT } from "@/config/marketing-content";

/**
 * The patient journey.
 *
 * Its job is to remove the uncertainty behind "Book a Consultation": a visitor
 * who cannot picture what happens next does not press the button.
 *
 * The sequence itself is rendered by `ProcessSteps` with the `row` layout —
 * a vertical timeline on a phone, a horizontal progression from `lg`. That
 * component was extracted in Phase 04, when the services and treatment pages
 * each needed a numbered sequence of their own and three hand-rolled
 * timelines would have drifted apart. The composition here is unchanged.
 */
export function PatientJourneySection() {
  return (
    <Section
      id={HOME_SECTIONS.journey}
      aria-labelledby="journey-title"
      className="anchor-offset bg-muted"
    >
      <Container width="wide">
        <SectionHeader
          titleId="journey-title"
          eyebrow={JOURNEY_CONTENT.eyebrow}
          title={JOURNEY_CONTENT.title}
          description={JOURNEY_CONTENT.description}
        />

        <ProcessSteps
          steps={JOURNEY_CONTENT.steps}
          layout="row"
          className="mt-12 lg:mt-16"
        />
      </Container>
    </Section>
  );
}
