"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { DisplayTestimonial } from "@/features/testimonials/content";
import { cn } from "@/lib/utils/cn";

/**
 * One quote at a time, moved by the reader and never by a timer.
 *
 * `docs/implementation-plan/phase_03.md` section 26 rules out an
 * auto-advancing carousel where it harms readability, and a quote that slides
 * away mid-sentence always does. So there is no autoplay, and therefore no
 * pause control to forget.
 *
 * ## Semantics
 *
 * The WAI-ARIA carousel pattern: a named region with
 * `aria-roledescription="carousel"`, each slide a `group` with
 * `aria-roledescription="slide"` and an "n of m" label, and a polite live
 * region so a screen reader hears the new quote after pressing Next.
 *
 * Every slide is in the server-rendered HTML; inactive ones carry `hidden`,
 * so all quotes are indexable and the page works before hydration (it simply
 * shows the first).
 *
 * With a single testimonial there is nothing to move between, and the
 * controls are not rendered at all.
 */
export interface TestimonialCarouselProps {
  readonly testimonials: readonly DisplayTestimonial[];
  readonly label: string;
}

export function TestimonialCarousel({
  testimonials,
  label,
}: TestimonialCarouselProps) {
  const [active, setActive] = useState(0);
  const count = testimonials.length;
  const hasControls = count > 1;

  const go = (index: number) => setActive((index + count) % count);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="flex flex-col"
    >
      <div aria-live="polite" aria-atomic="true">
        {testimonials.map((testimonial, index) => (
          // A `div` group wrapping a `figure`: `figure` may not take the
          // `group` role, and the slide semantics belong on the wrapper.
          <div
            key={testimonial.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            hidden={index !== active}
            className="motion-safe:animate-fade-in"
          >
            <figure>
              {testimonial.placeholder ? (
                <p className="text-caption border-warning-border bg-warning-surface text-warning mb-5 inline-flex rounded-sm border px-2 py-0.5 font-sans font-medium tracking-[0.14em] uppercase">
                  Placeholder
                </p>
              ) : null}
              <blockquote
                className={cn(
                  "text-h2 text-heading font-serif font-normal italic",
                  testimonial.placeholder && "text-muted-foreground",
                )}
              >
                <p>
                  <span aria-hidden="true">&ldquo;</span>
                  {testimonial.quote}
                  <span aria-hidden="true">&rdquo;</span>
                </p>
              </blockquote>
              <figcaption className="text-label text-muted-foreground mt-7 inline-flex items-center gap-3">
                <span aria-hidden="true" className="bg-gold h-px w-6" />
                {testimonial.attribution}
              </figcaption>
            </figure>
          </div>
        ))}
      </div>

      {hasControls ? (
        <div className="mt-10 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous testimonial"
            onClick={() => go(active - 1)}
            className="rounded-full"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <ul className="flex items-center" aria-label="Choose a testimonial">
            {testimonials.map((testimonial, index) => (
              <li key={testimonial.id}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  aria-label={`Show testimonial ${index + 1} of ${count}`}
                  aria-current={index === active ? "true" : undefined}
                  className="group/dot flex size-11 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "ease-natural block h-1.5 rounded-full transition-all duration-(--duration-normal)",
                      index === active
                        ? "bg-primary w-6"
                        : "bg-border-strong group-hover/dot:bg-input w-1.5",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next testimonial"
            onClick={() => go(active + 1)}
            className="rounded-full"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
