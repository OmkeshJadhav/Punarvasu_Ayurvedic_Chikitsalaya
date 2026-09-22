"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Shows a safe, generic message. The real failure was already logged on the
 * server; `digest` is the only handle the browser gets, and it correlates to
 * that server log without revealing anything about the failure.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only the digest. The message may carry internal detail and must not be
    // written to the browser console.
    if (error.digest) {
      console.error(`Unhandled error (digest ${error.digest})`);
    }
  }, [error.digest]);

  return (
    <StatusMessage
      icon={<TriangleAlert />}
      title="Something went wrong"
      description="We couldn't load this page. Please try again — if it keeps happening, contact the clinic."
      reference={error.digest}
    >
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </StatusMessage>
  );
}
