import { cn } from "@/lib/utils/cn";

/**
 * Botanical line art - the site's one decorative motif.
 *
 * A single drawn sprig in two forms: `sprig` is a tall stem with paired
 * leaves, used large and faint behind a composition; `ornament` is a small
 * three-leaf mark that sits above a centred heading.
 *
 * ## Restraint
 *
 * It is line art in `currentColor` at a hairline stroke, so the caller sets
 * its colour and opacity from tokens and it never becomes a new colour on the
 * page. Where it appears is decided per section, and it appears in few of
 * them - a motif on every band stops being a motif.
 *
 * Always decorative: `aria-hidden`, no title, not focusable. It carries
 * nothing a screen reader user would miss.
 */
export interface BotanicalMotifProps {
  readonly variant?: "sprig" | "ornament";
  readonly className?: string;
}

export function BotanicalMotif({
  variant = "sprig",
  className,
}: BotanicalMotifProps) {
  if (variant === "ornament") {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 48 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("h-5 w-12", className)}
      >
        <path d="M24 19V7" />
        <path d="M24 7c-2.2-2.4-2.2-4.6 0-6 2.2 1.4 2.2 3.6 0 6Z" />
        <path d="M24 14c-3.6.4-7.4-.8-9.8-4 3.8-.9 7.6.2 9.8 4Z" />
        <path d="M24 14c3.6.4 7.4-.8 9.8-4-3.8-.9-7.6.2-9.8 4Z" />
        <path d="M4 16h8M36 16h8" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 320"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-80 w-30", className)}
    >
      {/* The stem: a single long curve, slightly off vertical. */}
      <path d="M62 318C58 250 56 190 60 130C63 88 66 50 64 6" />
      {/* Paired leaves, shrinking towards the tip. */}
      <path d="M59 270c-18-2-36-14-44-34 20-1 37 11 44 34Z" />
      <path d="M59 270c-12-12-24-20-40-32" />
      <path d="M59 238c17-4 33-18 38-38-19 1-34 15-38 38Z" />
      <path d="M59 238c10-13 21-24 36-36" />
      <path d="M59 196c-16-3-31-14-37-31 17 0 31 11 37 31Z" />
      <path d="M59 196c-10-10-21-18-35-28" />
      <path d="M61 158c15-4 28-16 32-33-16 1-29 13-32 33Z" />
      <path d="M61 158c9-11 18-21 30-31" />
      <path d="M62 120c-13-3-25-12-30-26 14 0 25 9 30 26Z" />
      <path d="M63 86c11-4 21-13 24-26-12 1-22 10-24 26Z" />
      <path d="M64 52c-9-3-17-10-20-20 10 0 17 7 20 20Z" />
      <path d="M64 6c-4 6-4 12 0 18 4-6 4-12 0-18Z" />
    </svg>
  );
}
