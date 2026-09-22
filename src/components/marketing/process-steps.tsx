import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils/cn";

/**
 * A numbered sequence of steps.
 *
 * The site explains three different sequences — what happens after you book,
 * how a treatment is chosen, and what happens during a therapy — and they
 * were on their way to becoming three hand-rolled timelines. This is the one
 * component, with three compositions:
 *
 *   timeline  Always vertical: a rule down the left, a dot per step. For a
 *             sequence inside a narrow editorial column.
 *   row       Vertical on mobile, horizontal from `lg`, with the rule running
 *             across the top of the columns. For a full-width band.
 *   grid      No rule. Large numerals in a two-column grid, for a short
 *             sequence that is a set of commitments rather than a walk-through.
 *
 * The rule and the dots are `aria-hidden`. Order is carried by the `<ol>` and
 * by the numerals, which are real text, so a screen-reader user gets "list, 5
 * items" and the steps in sequence — which is the whole meaning.
 *
 * `headingLevel` exists because the same sequence appears under an `<h2>` on
 * one page and under an `<h3>` inside an article on another. Choose it from
 * the document outline, never from the size you want.
 *
 * Steps stagger in as the section arrives; the delay is capped by `Reveal` so
 * a long sequence never becomes a visible wait. A server component apart from
 * that shared reveal.
 */
export interface ProcessStep {
  readonly title: string;
  readonly description: string;
}

export interface ProcessStepsProps {
  readonly steps: readonly ProcessStep[];
  readonly layout?: "timeline" | "row" | "grid";
  readonly headingLevel?: "h3" | "h4";
  readonly className?: string;
}

export function ProcessSteps({
  steps,
  layout = "timeline",
  headingLevel: Heading = "h3",
  className,
}: ProcessStepsProps) {
  if (steps.length === 0) {
    return null;
  }

  const showRule = layout !== "grid";

  return (
    <ol
      className={cn(
        "relative grid",
        layout === "grid"
          ? "gap-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-10"
          : "gap-8",
        // `grid-flow-col` with equal auto columns, so a row lays out any
        // number of steps evenly without the caller declaring a column count.
        layout === "row" && "lg:auto-cols-fr lg:grid-flow-col lg:gap-6",
        className,
      )}
    >
      {showRule ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-border-strong absolute top-2 bottom-2 left-1.75 w-px",
            layout === "row" &&
              "lg:top-1.75 lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto",
          )}
        />
      ) : null}

      {steps.map((step, index) => (
        <Reveal key={step.title} asChild delay={index * 70}>
          <li
            className={cn(
              "relative",
              showRule && "pl-8",
              layout === "row" && "lg:pt-8 lg:pl-0",
            )}
          >
            {showRule ? (
              <span
                aria-hidden="true"
                className={cn(
                  "border-primary bg-background absolute top-1.5 left-0 size-3.5 rounded-full border-2",
                  layout === "row" && "lg:top-0 lg:left-0",
                )}
              />
            ) : null}

            <p
              className={cn(
                "text-eyebrow font-sans font-medium tabular-nums",
                layout === "grid"
                  ? "text-h4 font-serif"
                  : "text-caption tracking-[0.18em]",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </p>

            <Heading className="text-h5 text-heading mt-1.5 font-serif font-medium">
              {step.title}
            </Heading>

            <p className="text-body-sm text-prose measure mt-2">
              {step.description}
            </p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}
