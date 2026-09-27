import { Container } from "@/components/layout/container";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * The clinic dashboard's shape, while it is being read.
 *
 * Mirrors the real grid — header, filter, four headline cards, then the
 * panels at their real spans — so nothing jumps when the figures arrive
 * (`phase_16.md` section 63). Everything is `aria-hidden` inside
 * `SectionLoading`, which announces the label once.
 */
const PANEL_SPANS = [
  "lg:col-span-8 h-96",
  "lg:col-span-4 h-96",
  "lg:col-span-12 h-72",
  "lg:col-span-7 h-96",
  "lg:col-span-5 h-96",
] as const;

export function DashboardLoading({ label }: { readonly label: string }) {
  return (
    <div className="py-8 lg:py-10">
      <Container width="wide">
        <SectionLoading label={label}>
          <div aria-hidden="true" className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-72 max-w-full" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>

            <Skeleton className="h-44 w-full rounded-lg xl:h-36" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {PANEL_SPANS.map((span) => (
                <Skeleton key={span} className={cn("rounded-lg", span)} />
              ))}
            </div>
          </div>
        </SectionLoading>
      </Container>
    </div>
  );
}
