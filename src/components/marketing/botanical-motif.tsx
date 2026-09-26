import { cn } from "@/lib/utils/cn";

/**
 * Botanical line art - the site's one decorative motif.
 *
 * A single drawn sprig in three forms: `sprig` is a tall stem with paired
 * leaves, used large and faint behind a composition; `ornament` is a small
 * three-leaf mark that sits above a centred heading; `frond` is a branch of
 * broad, softly filled leaves, used at the edges of a light section where a
 * hairline sprig would be too slight to register.
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
  readonly variant?: "sprig" | "ornament" | "frond";
  readonly className?: string;
}

export function BotanicalMotif({
  variant = "sprig",
  className,
}: BotanicalMotifProps) {
  if (variant === "frond") {
    return <Frond className={className} />;
  }

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

/**
 * Where each leaf of the frond sits: a point on the stem, an angle away from
 * vertical, and a scale. Paired leaves shrink towards the tip, like the sprig.
 */
const FROND_LEAVES: readonly (readonly [number, number, number, number])[] = [
  [97, 300, -58, 1.1],
  [97, 296, 52, 1],
  [95, 238, -62, 1.02],
  [96, 232, 56, 0.94],
  [98, 178, -52, 0.88],
  [99, 172, 58, 0.86],
  [102, 120, -46, 0.72],
  [104, 115, 50, 0.72],
  [107, 66, -36, 0.54],
  [107, 62, 40, 0.52],
  [108, 14, 0, 0.4],
];

/**
 * A broad leaf drawn pointing up from its base at the origin, 90 units long:
 * the blade, the midrib, and two pairs of veins.
 */
const LEAF_BLADE = "M0 0C-24-20-26-62 0-90C26-62 24-20 0 0Z";
const LEAF_VEINS = "M0-2V-86M0-24l-12-13M0-44l-14-14M0-24l12-13M0-44l14-14";

function Frond({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 360"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-90 w-50", className)}
    >
      <path d="M100 356C96 290 92 230 98 170C104 110 112 60 108 10" />
      {FROND_LEAVES.map(([x, y, angle, scale]) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}
        >
          {/* A soft wash inside a crisp outline: the leaf reads as a shape at
              a distance and as line art up close. */}
          <path d={LEAF_BLADE} fill="currentColor" fillOpacity="0.35" />
          <path d={LEAF_VEINS} strokeOpacity="0.7" />
        </g>
      ))}
    </svg>
  );
}
