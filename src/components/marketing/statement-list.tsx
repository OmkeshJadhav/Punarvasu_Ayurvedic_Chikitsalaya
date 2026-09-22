import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils/cn";

/**
 * A list of short titled statements.
 *
 * The site makes this shape four times - the home page's differentiators, the
 * About page's principles and its commitments, and the philosophy band's
 * ideas - so it is one component rather than four near-identical blocks that
 * drift apart (`AGENTS.md` section 32).
 *
 * ## Why a rule and not an icon
 *
 * Each statement is separated by a short brand rule rather than introduced by
 * a glyph. Four generic leaf or lotus icons above four abstract nouns is
 * precisely the decorative template texture `docs/implementation-plan/phase_05.md`
 * section 12 warns against, and the icons would carry no information a screen
 * reader could use. The rule is `aria-hidden` and purely rhythmic.
 *
 * ## Layouts
 *
 *   grid      Two columns from `sm`. For four statements beside a heading
 *             block. Four narrow columns would give every statement an
 *             eight-word measure, which reads as a feature list.
 *   stack     One column, divided by hairlines. For a numbered or ordered
 *             set read top to bottom in a narrow editorial column.
 *
 * `headingLevel` is chosen from the document outline, never from the size
 * wanted. A real `<ul>` is used, so a screen reader announces the count.
 *
 * A server component apart from the shared reveal.
 */
export interface Statement {
  readonly title: string;
  readonly description: string;
}

export interface StatementListProps {
  readonly statements: readonly Statement[];
  readonly layout?: "grid" | "stack";
  readonly headingLevel?: "h3" | "h4";
  readonly className?: string;
}

export function StatementList({
  statements,
  layout = "grid",
  headingLevel: Heading = "h3",
  className,
}: StatementListProps) {
  if (statements.length === 0) {
    return null;
  }

  return (
    <ul
      className={cn(
        "grid",
        layout === "grid"
          ? "gap-x-10 gap-y-8 sm:grid-cols-2"
          : "border-border gap-0 border-t",
        className,
      )}
    >
      {statements.map((statement, index) => (
        <Reveal key={statement.title} asChild delay={index * 70}>
          <li
            className={cn(
              "flex flex-col",
              layout === "stack" && "border-border border-b py-6",
            )}
          >
            <Heading className="text-h5 text-heading font-serif font-medium">
              {statement.title}
            </Heading>

            {layout === "grid" ? (
              <span
                aria-hidden="true"
                className="bg-primary/35 mt-3 h-px w-10"
              />
            ) : null}

            <p
              className={cn(
                "text-body text-prose measure",
                layout === "grid" ? "mt-3" : "mt-2",
              )}
            >
              {statement.description}
            </p>
          </li>
        </Reveal>
      ))}
    </ul>
  );
}
