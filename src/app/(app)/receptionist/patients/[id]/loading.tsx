import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { PATIENT_RECORD_COPY } from "@/features/reception/content";

/**
 * A patient record's loading state.
 *
 * The shape of the page: a heading, the scope notice, then the three titled
 * groups the record is made of. A skeleton that matches the layout is what
 * stops the content jumping when it arrives.
 */
export default function ReceptionPatientLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={PATIENT_RECORD_COPY.detailsHeading}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-1/2 max-w-xs" />
            <SkeletonText lines={2} />
          </div>

          <div aria-hidden="true" className="mt-8 flex flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="border-border flex flex-col gap-4 rounded-lg border p-5 sm:p-6"
              >
                <Skeleton className="h-6 w-40" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
