"use client";

import { Slot } from "radix-ui";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Content entrance: a section fades and rises once, as it comes into view.
 *
 * The entire motion is CSS (`--animate-rise-in`). This component's only job is
 * deciding *when* to start it, which needs an IntersectionObserver and is why
 * it is a client component. It is around forty lines rather than an animation
 * library, because the foundation needs one entrance effect, not a timeline
 * engine (`docs/DESIGN_SYSTEM.md` section 41).
 *
 * Rules it enforces so motion stays a language rather than decoration:
 *   - Every element rises from the same direction. Cards arriving from four
 *     different edges is the house style of a template, not a clinic.
 *   - It fires once. Re-animating on scroll-back makes a page feel restless
 *     and makes long content slow to re-read.
 *   - The observer disconnects after firing.
 *   - `delay` is capped, so a long list cannot stagger into a visible wait.
 *
 * Reduced motion: the animation is `motion-safe:` only, and the element is
 * fully visible from the first paint regardless - `opacity` is never set to 0
 * in a way that could strand content if JavaScript fails to run.
 */
export interface RevealProps extends ComponentProps<"div"> {
  /** Milliseconds to stagger by, for a list. Clamped to 0-300. */
  readonly delay?: number;
  /**
   * Render the child element instead of a `<div>`.
   *
   * Required inside a list: an extra `<div>` between `<ol>` and `<li>` is
   * invalid HTML and strips the list role, so a staggered list of steps would
   * stop being a list to a screen reader purely to gain an animation.
   */
  readonly asChild?: boolean;
  /**
   * `rise` (the default) fades and lifts. `unveil` uncovers a photograph from
   * its lower edge - for large images only, where a fade reads as a slow load.
   */
  readonly effect?: "rise" | "unveil";
}

export function Reveal({
  delay = 0,
  asChild = false,
  effect = "rise",
  className,
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // The animation is progressive enhancement, not a visibility gate: the
    // element is fully rendered whether or not this ever runs. A browser
    // without IntersectionObserver simply gets no entrance animation.
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      // A small negative margin so the animation starts just before the
      // element reaches the fold, rather than after the user is looking at it.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Component = asChild ? Slot.Root : "div";

  return (
    <Component
      ref={ref}
      data-revealed={revealed ? "" : undefined}
      className={cn(
        // The animation only applies once revealed; content is visible either
        // way, so a failed observer degrades to "no animation", not "no page".
        revealed &&
          (effect === "unveil"
            ? "motion-safe:animate-unveil"
            : "motion-safe:animate-rise-in"),
        className,
      )}
      style={{
        animationDelay: delay > 0 ? `${Math.min(delay, 300)}ms` : undefined,
        animationFillMode: "backwards",
        ...style,
      }}
      {...props}
    />
  );
}
