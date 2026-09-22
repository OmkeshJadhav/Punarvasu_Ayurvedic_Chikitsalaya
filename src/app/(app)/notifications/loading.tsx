import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { NOTIFICATION_CENTRE_COPY } from "@/features/notifications/content";

/** A skeleton in the shape of the page, not the word "Loading". */
export default function NotificationsLoading() {
  return (
    <Section>
      <Container width="content">
        <SectionLoading label={NOTIFICATION_CENTRE_COPY.title}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={2} />
          </div>
          <div aria-hidden="true" className="mt-10 flex flex-col gap-3">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:p-5"
              >
                <Skeleton className="h-5 w-48" />
                <SkeletonText lines={1} />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
