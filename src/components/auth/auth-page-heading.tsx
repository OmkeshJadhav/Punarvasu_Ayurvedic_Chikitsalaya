import type { ReactNode } from "react";

import { Emphasis } from "@/components/marketing/emphasis";

/**
 * The heading block that opens an authentication page.
 *
 * Every auth page carries exactly one `<h1>`, and it is this one - so the
 * document outline is correct without each page remembering, and a screen
 * reader user landing from an emailed link is told immediately which page they
 * are on (`phase_06.md` section 61).
 *
 * The serif comes from the base layer, which gives every `h1`-`h5` the brand
 * voice and the `--heading` colour. The supporting line uses the functional
 * muted tone rather than the editorial `--prose` green: this is a form, not a
 * marketing section (`docs/DESIGN_SYSTEM.md` section 4.5).
 *
 * `emphasis` sets one word of the title in terracotta italic - the editorial
 * device the marketing pages use, and just as rare here.
 */
export function AuthPageHeading({
  title,
  emphasis,
  description,
}: {
  readonly title: string;
  readonly emphasis?: string;
  readonly description?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-7">
      <h1 className="text-h1 font-normal">
        <Emphasis text={title} phrase={emphasis} className="text-eyebrow" />
      </h1>
      {description ? (
        <p className="text-body text-muted-foreground mt-3">{description}</p>
      ) : null}
    </div>
  );
}
