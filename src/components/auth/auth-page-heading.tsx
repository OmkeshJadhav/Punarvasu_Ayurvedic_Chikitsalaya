import type { ReactNode } from "react";

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
 */
export function AuthPageHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-h3">{title}</h1>
      {description ? (
        <p className="text-body-sm text-muted-foreground mt-2">{description}</p>
      ) : null}
    </div>
  );
}
