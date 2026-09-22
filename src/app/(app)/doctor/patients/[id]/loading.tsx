import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** A skeleton in the shape of the patient page: heading, details, history. */
export default function DoctorPatientLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label="Loading the patient">
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-1/2 max-w-xs" />
            <SkeletonText lines={1} />
          </div>

          <div aria-hidden="true" className="mt-8 flex flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex flex-col gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
