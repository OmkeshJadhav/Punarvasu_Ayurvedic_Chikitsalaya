import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DOCTOR_SCHEDULE_COPY } from "@/features/doctor/content";

/** A skeleton in the shape of the appointments page: heading, filters, rows. */
export default function DoctorAppointmentsLoading() {
  return (
    <Section>
      <Container width="wide">
        <SectionLoading label={DOCTOR_SCHEDULE_COPY.loadingLabel}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={1} />
          </div>

          <div
            aria-hidden="true"
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>

          <div aria-hidden="true" className="mt-8 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
