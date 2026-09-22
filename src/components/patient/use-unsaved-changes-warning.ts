"use client";

import { useEffect } from "react";

/**
 * Warns before a reload or a closed tab discards unsaved form changes.
 *
 * ## What it covers, and what it deliberately does not
 *
 * `beforeunload` is the browser's own mechanism, and it covers the cases that
 * lose the most work: closing the tab, reloading, and following a link out of
 * the application. It does **not** cover Next.js client-side navigation —
 * clicking "Overview" in the patient nav — because the App Router has no
 * supported way to intercept a navigation, and the ways to fake one all
 * involve patching history or the router.
 *
 * `phase_07.md` section 34 asks for a warning *and* warns against an intrusive
 * confirmation on every navigation, and points at "the browser/framework
 * capabilities". This is that capability, used as it is meant to be. The gap
 * is covered from the other side: Cancel asks before discarding, and the
 * patient area's navigation is two links, so the accidental-navigation case is
 * small. The limitation is recorded in the phase notes rather than papered
 * over.
 *
 * ## Why the listener is added and removed rather than left in place
 *
 * A registered `beforeunload` handler disqualifies a page from the
 * back-forward cache in every major browser. Leaving one attached when the
 * form is clean would slow down an ordinary back-button press for no benefit,
 * so it exists only while there is something to lose.
 */
export function useUnsavedChangesWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      // `preventDefault()` is the modern, specified way to request the prompt.
      // Browsers show their own wording; a custom message has been ignored for
      // a decade, and inventing one here would be writing copy nobody reads.
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
