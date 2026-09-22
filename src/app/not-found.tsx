import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { SERVICES_PATH } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * The application-wide 404.
 *
 * It also serves a mistyped treatment URL: `/services/[slug]` sets
 * `dynamicParams = false`, so an unknown slug lands here with a real 404
 * status rather than on a soft-404 page of its own - the reasoning is in
 * that route's docblock. The services link is here because of that: after
 * the home page, the catalogue is the most likely thing the visitor was
 * looking for.
 *
 * Known limitation, inherited from Phase 03: this page sits above the
 * `(public)` route group, so it renders without the site header and footer.
 */
export default function NotFound() {
  return (
    <StatusMessage
      icon={<Compass />}
      title="We couldn't find that page"
      description="The page may have moved, or the link may be out of date."
    >
      <Button asChild>
        <Link href="/">Go to the homepage</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={SERVICES_PATH}>View our services</Link>
      </Button>
    </StatusMessage>
  );
}
