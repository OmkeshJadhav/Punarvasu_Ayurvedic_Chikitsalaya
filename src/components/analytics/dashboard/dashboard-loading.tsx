import { Container } from "@/components/layout/container";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * The clinic dashboard's shape, while it is being read.
 *
 * Mirrors the real grid — header and photograph, filter, four headline
 * cards, then the panels at their real spans — so nothing jumps when the figures arrive
 * (`phase_16.md` section 63). Everything is `aria-hidden` inside
 * `SectionLoading`, which announces the label once.
 */
const PANEL_SPANS = [
  "lg:col-span-12 xl:col-span-8 h-[28rem]",
  "lg:col-span-12 xl:col-span-4 h-[28rem]",
  "lg:col-span-12 h-[30rem]",
  "lg:col-span-12 h-64",
  "lg:col-span-6 2xl:col-span-4 h-96",
  "lg:col-span-6 2xl:col-span-4 h-96",
  "lg:col-span-6 2xl:col-span-4 h-96",
] as const;

export function DashboardLoading({ label }: { readonly label: string }) {
  return (
    <div className="py-8 lg:py-10">
      <Container width="wide">
        <SectionLoading label={label}>
          <div aria-hidden="true" className="flex flex-col gap-8">
            <div className="grid items-center gap-6 lg:grid-cols-12">
              <div className="flex flex-col gap-3 lg:col-span-7">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-72 max-w-full" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-4 w-2/3 max-w-md" />
              </div>
              <Skeleton className="hidden h-48 rounded-lg md:block lg:col-span-5 lg:h-52" />
            </div>

            <Skeleton className="h-64 w-full rounded-lg sm:h-52 xl:h-44" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="border-border/60 bg-card flex flex-col gap-5 rounded-lg border p-5 sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-11 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {PANEL_SPANS.map((span, index) => (
                // Spans repeat, so the position is the key; the list is fixed.
                <Skeleton key={index} className={cn("rounded-lg", span)} />
              ))}
            </div>
          </div>
        </SectionLoading>
      </Container>
    </div>
  );
}
