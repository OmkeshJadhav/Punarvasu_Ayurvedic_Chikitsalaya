"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Stops a half-written clinical document being lost on the way out.
 *
 * Extracted from `components/clinical/` in Phase 13, when the prescription
 * and treatment plan builders needed exactly the same behaviour. The
 * mechanism is unchanged; only the words are now a prop, because "your
 * consultation notes have not been saved" is the wrong sentence on a
 * prescription.
 *
 * ## What it covers, and what it does not
 *
 * * **Refresh, tab close and leaving the application** — `beforeunload`,
 *   registered only while there is something to lose so the page is not
 *   needlessly disqualified from the back-forward cache.
 * * **Every in-app link** — a capture-phase click listener, which offers
 *   *Stay*, *Save and leave* or *Leave without saving*.
 * * **The browser's back button within the application** — not covered.
 *   Blocking it needs a decoy history entry, which breaks the back button in
 *   its own right. The mitigation is that the save control and the save state
 *   are always visible, so there is never any doubt about whether there is
 *   something to lose.
 *
 * The safe answer is first and is the primary action. A dialog whose most
 * prominent button loses work is a dialog that loses work.
 */
export interface UnsavedChangesCopy {
  readonly title: string;
  readonly body: string;
  readonly stay: string;
  readonly saveAndGo: string;
  readonly discard: string;
  readonly beforeUnload: string;
}

export function UnsavedChangesGuard({
  active,
  saving,
  onSave,
  copy,
}: {
  readonly active: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly copy: UnsavedChangesCopy;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const leave = useRef<{
    phase: "idle" | "armed" | "saving";
    destination: string | null;
  }>({ phase: "idle", destination: null });

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = copy.beforeUnload;
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [copy.beforeUnload]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!activeRef.current) return;

      // Leave alone anything that is not a plain left-click navigation: a
      // modified click opens a new tab, which loses nothing.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      setPending(destination.pathname + destination.search);
    }

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // "Save and leave" waits for the save to finish *and succeed* before it
  // navigates. It leaves only once the form reports itself clean, so a
  // refused save keeps the practitioner on the page with their work.
  useEffect(() => {
    const state = leave.current;
    if (state.phase === "idle") return;

    if (state.phase === "armed") {
      if (saving) state.phase = "saving";
      return;
    }

    if (saving) return;

    state.phase = "idle";
    if (active) return;

    const destination = state.destination;
    state.destination = null;
    if (destination) {
      activeRef.current = false;
      window.location.assign(destination);
    }
  }, [saving, active]);

  function discard() {
    const destination = pending;
    setPending(null);
    if (!destination) return;
    activeRef.current = false;
    window.location.assign(destination);
  }

  function saveAndLeave() {
    leave.current = { phase: "armed", destination: pending };
    setPending(null);
    onSave();
  }

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <DialogContent>
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setPending(null)}>
              {copy.stay}
            </Button>
            <Button type="button" variant="secondary" onClick={saveAndLeave}>
              {copy.saveAndGo}
            </Button>
            <Button type="button" variant="ghost" onClick={discard}>
              {copy.discard}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
