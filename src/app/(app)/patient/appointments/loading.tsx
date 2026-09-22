import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { APPOINTMENT_COPY } from "@/features/appointments/content";

/**
 * The appointment list's loading state.
 *
 * A structured skeleton in roughly the shape of the page — heading, a primary
 * action, then a group of cards — rather than the word "Loading" across the
 * screen (`phase_09.md` section 45). Matching the layout means the content
 * does not jump when it arrives.
 *
 * The skeletons are `aria-hidden` inside `SectionLoading`, which announces the
 * label once, politely. A screen-reader user hears a sentence, not a list of
 * empty boxes.
 */
export default function PatientAppointmentsLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={APPOINTMENT_COPY.loadingLabel}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={2} />
          </div>

          <div aria-hidden="true" className="mt-10 flex flex-col gap-4">
            <Skeleton className="h-7 w-32" />
            {[0, 1].map((index) => (
              <div
                key={index}
                className="border-border flex flex-col gap-3 rounded-lg border p-5 sm:p-6"
              >
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
