import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils/cn";

/**
 * An editorial section: a heading block beside a column of prose.
 *
 * The About page is mostly writing, and writing on this site has one shape -
 * eyebrow, heading, standfirst on the left, paragraphs on the right, with
 * anything extra (a list of principles, a link onward) beneath the prose.
 * Repeating that grid four times in four files is how four sections end up
 * with four different gaps.
 *
 * The two-column arrangement is not decoration: it keeps the paragraphs at a
 * real measure on a wide screen instead of running them to 1280px, which is
 * the single fastest way to make long-form copy unreadable
 * (`docs/DESIGN_SYSTEM.md` section 8).
 *
 * `surface` selects one of the three page surfaces the design system defines.
 * A section may not invent a colour; it changes band
 * (`docs/DESIGN_SYSTEM.md` section 4.2).
 *
 * Every section is a labelled landmark: `id` is the anchor target and carries
 * `anchor-offset` so a jump link never lands behind the sticky header.
 *
 * A server component apart from the shared reveal.
 */
export interface ProseSectionProps {
  readonly id: string;
  readonly titleId: string;
  readonly eyebrow: string;
  readonly title: ReactNode;
  /** Optional standfirst under the heading, in the left column. */
  readonly description?: string;
  readonly paragraphs: readonly string[];
  readonly surface?: "background" | "muted";
  /** An onward link beneath the prose. */
  readonly link?: { readonly href: string; readonly label: string };
  /** Anything that belongs under the prose: a statement list, an aside. */
  readonly children?: ReactNode;
  readonly className?: string;
}

const SURFACE_CLASSES = {
  background: "bg-background",
  muted: "bg-muted border-border border-y",
} as const;

export function ProseSection({
  id,
  titleId,
  eyebrow,
  title,
  description,
  paragraphs,
  surface = "background",
  link,
  children,
  className,
}: ProseSectionProps) {
  return (
    <Section
      id={id}
      aria-labelledby={titleId}
      className={cn("anchor-offset", SURFACE_CLASSES[surface], className)}
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId={titleId}
              eyebrow={eyebrow}
              title={title}
              description={description}
            />
          </div>

          <div className="lg:col-span-7">
            <Reveal>
              <div className="measure flex flex-col gap-5">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-body-lg text-prose">
                    {paragraph}
                  </p>
                ))}
              </div>

              {link ? (
                <Link
                  href={link.href}
                  className="text-label text-primary ease-natural hover:text-primary-hover focus-visible:outline-ring mt-7 inline-flex min-h-11 items-center gap-2 rounded-sm font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {link.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </Reveal>

            {children ? <div className="mt-10 lg:mt-12">{children}</div> : null}
          </div>
        </div>
      </Container>
    </Section>
  );
}
