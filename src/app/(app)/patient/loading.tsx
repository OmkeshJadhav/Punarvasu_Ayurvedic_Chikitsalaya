import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { PATIENT_DASHBOARD_LOADING_LABEL } from "@/features/patients/content";

/**
 * The dashboard's loading state.
 *
 * A structured skeleton in the shape the page will take — greeting, a large
 * next-visit card, an attention list, three care tiles, two updates — rather
 * than a blank screen or the word "Loading" (`phase_18.md` sections 68, 69,
 * and the "bad → good" example in section 148). Matching the real layout is
 * what stops the content jumping when it arrives.
 *
 * `SectionLoading` announces one polite sentence and marks the boxes
 * `aria-hidden`, so a screen-reader user hears "Loading your account" rather
 * than a list of empty rectangles.
 *
 * Section 69 warns against animating excessively: these use the design
 * system's single shimmer, which the global reduced-motion rule disables
 * outright.
 */
export default function PatientDashboardLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={PATIENT_DASHBOARD_LOADING_LABEL}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={1} />
          </div>

          <div aria-hidden="true" className="mt-10 flex flex-col gap-12">
            {/* Next visit — the page's one emphasised surface. */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-32" />
              <div className="border-border flex flex-col gap-4 rounded-lg border p-6 sm:p-8">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-5 w-40" />
                <SkeletonText lines={1} />
                <Skeleton className="h-11 w-44" />
              </div>
            </div>

            {/* What needs your attention. */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-48" />
              <div className="flex flex-col gap-3">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="border-border flex flex-col gap-2 rounded-lg border p-4"
                  >
                    <Skeleton className="h-5 w-2/3" />
                    <SkeletonText lines={1} />
                  </div>
                ))}
              </div>
            </div>

            {/* Your care — three tiles. */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-28" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="border-border flex flex-col gap-2 rounded-lg border p-5 sm:p-6"
                  >
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent updates. */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-40" />
              <div className="flex flex-col gap-3">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="border-border flex flex-col gap-2 rounded-lg border p-4"
                  >
                    <Skeleton className="h-5 w-1/2" />
                    <SkeletonText lines={1} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
