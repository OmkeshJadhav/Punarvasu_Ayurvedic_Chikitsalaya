import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * The access-management loading state.
 *
 * A structured skeleton in the shape of the page — heading, then table rows —
 * rather than the word "Loading". The page reads the account list through a
 * database function on every request, so this is a state a real administrator
 * will see, not a formality.
 *
 * `SectionLoading` announces once, politely; the skeletons inside it are
 * `aria-hidden`, so a screen-reader user hears a sentence rather than a list
 * of empty boxes.
 */
export default function AdminUsersLoading() {
  return (
    <Section>
      <Container>
        <SectionLoading label="Loading accounts">
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={2} />
          </div>

          <div
            aria-hidden="true"
            className="border-border mt-8 flex flex-col gap-4 rounded-lg border p-5 sm:p-6"
          >
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6"
              >
                <Skeleton className="h-6 w-full sm:w-1/3" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-11 w-full sm:w-56" />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
