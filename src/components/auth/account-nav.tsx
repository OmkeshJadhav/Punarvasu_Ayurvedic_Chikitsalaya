"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AUTHENTICATED_LANDING_PATH, LOGIN_PATH } from "@/lib/auth/paths";

/**
 * The account control in the public header.
 *
 * ## What it shows
 *
 * Signed out: "Sign in". Signed in: "My account".
 *
 * That is all it shows, deliberately. No name, no email, no patient id, no
 * clinical anything (`phase_06.md` section 39). The public header is rendered
 * on pages that are read over someone's shoulder in a waiting room, and there
 * is no version of "Welcome back, Priya" that is worth that.
 *
 * ## Why it asks the server instead of rendering the answer
 *
 * The thirty public pages are statically prerendered. Reading the session in
 * the public layout would make every one of them render per request - a real
 * cost, paid on every visit by every visitor, for a label. So the pages stay
 * static and this component asks `/api/auth/session-status` once after
 * hydration, which answers with a single boolean and nothing else.
 *
 * ## This is not an authorization boundary, and cannot become one
 *
 * `docs/SECURITY.md` section 2.3 and `phase_06.md` section 26 are unambiguous:
 * client auth state is a UI convenience. Nothing here gates access. Someone
 * who flips this value in a debugger gets a link labelled "My account" that
 * leads to a route which redirects them to sign in, because the protected
 * layout asks the server and the database enforces row-level security. The
 * worst outcome available is a misleading link on their own screen.
 *
 * ## Why it renders the signed-out state first
 *
 * It is the correct state for most visitors and the honest state before the
 * answer arrives - a "My account" link that turns into "Sign in" would be
 * worse than the reverse. Both states occupy the same space, so the header
 * does not shift when the answer lands.
 */
export function AccountNav() {
  const [authenticated, setAuthenticated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();

    async function readSessionStatus(): Promise<void> {
      try {
        const response = await fetch("/api/auth/session-status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;

        const body: unknown = await response.json();
        setAuthenticated(isAuthenticatedResponse(body));
      } catch {
        // Offline, aborted, or the endpoint is unavailable. The signed-out
        // label is a safe thing to be wrong about, and an error here must
        // never break a public page.
      }
    }

    void readSessionStatus();
    return () => controller.abort();
    // Re-checked on navigation so the label corrects itself after signing in
    // or out without a full reload.
  }, [pathname]);

  return authenticated ? (
    <Button asChild variant="ghost" size="sm">
      <Link href={AUTHENTICATED_LANDING_PATH}>My account</Link>
    </Button>
  ) : (
    <Button asChild variant="ghost" size="sm">
      <Link href={LOGIN_PATH}>Sign in</Link>
    </Button>
  );
}

/** Narrows the response envelope without trusting its shape. */
function isAuthenticatedResponse(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;

  const envelope = body as { ok?: unknown; data?: unknown };
  if (envelope.ok !== true) return false;

  const data = envelope.data;
  if (typeof data !== "object" || data === null) return false;

  return (data as { authenticated?: unknown }).authenticated === true;
}
