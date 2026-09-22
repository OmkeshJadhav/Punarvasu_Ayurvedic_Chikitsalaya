import { PageLoading } from "@/components/shared/loading-state";

/**
 * Route-level loading boundary.
 *
 * Announced politely so a screen reader reports the wait instead of leaving
 * the user on a silent, empty page. Routes whose content has a known shape
 * should provide their own `loading.tsx` built from skeletons instead - see
 * `SectionLoading`.
 */
export default function Loading() {
  return <PageLoading label="Loading" />;
}
