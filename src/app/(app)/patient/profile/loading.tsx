import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { PROFILE_COPY } from "@/features/patients/content";

/**
 * The profile page's loading state.
 *
 * A structured skeleton in roughly the shape of the page — heading,
 * completeness panel, four sections — rather than the word "Loading" across
 * the whole screen (`phase_07.md` section 64). Matching the layout means the
 * content does not jump when it arrives, and it tells the patient what is
 * coming.
 *
 * The skeletons are `aria-hidden` inside `SectionLoading`, which announces
 * "Loading your profile" once, politely. A screen-reader user hears a
 * sentence, not a list of empty boxes.
 */
export default function PatientProfileLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={PROFILE_COPY.loadingLabel}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={2} />
          </div>

          <div aria-hidden="true" className="mt-8 flex flex-col gap-6">
            <div className="border-border flex flex-col gap-3 rounded-lg border p-5 sm:p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
              <SkeletonText lines={2} />
            </div>

            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="border-border flex flex-col gap-4 rounded-lg border p-5 sm:p-6"
              >
                <Skeleton className="h-6 w-48" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
