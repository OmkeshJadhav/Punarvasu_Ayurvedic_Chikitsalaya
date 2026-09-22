import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { PATIENT_PRESCRIPTION_COPY } from "@/features/prescriptions/content";

/** A skeleton in the shape of the page, not the word "Loading". */
export default function PatientPrescriptionsLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={PATIENT_PRESCRIPTION_COPY.heading}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={2} />
          </div>
          <div aria-hidden="true" className="mt-10 flex flex-col gap-4">
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
