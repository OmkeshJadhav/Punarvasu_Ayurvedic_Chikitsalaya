import { cn } from "@/lib/utils/cn";

/**
 * A figure's shape over the period, in a line the size of a word.
 *
 * Decoration in the strict sense: `aria-hidden`, no axis, no values, nothing
 * that is not also in the appointments chart and its table further down the
 * page. It answers "was this steady or lumpy?" at a glance, which is all a
 * headline card should ask of a reader.
 *
 * `vector-effect: non-scaling-stroke` keeps the line a true 1.5px while the
 * SVG stretches to its box, so the same component is crisp in a narrow card
 * and a wide one without measuring either.
 */
const WIDTH = 100;
const HEIGHT = 32;
const INSET = 2;

export function Sparkline({
  values,
  className,
}: {
  readonly values: readonly number[];
  readonly className?: string;
}) {
  // One point is not a shape, and a flat run of nothing is not worth a line.
  if (values.length < 2 || values.every((value) => value === 0)) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min || 1;
  const step = WIDTH / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = INSET + (1 - (value - min) / spread) * (HEIGHT - INSET * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M${points.join(" L")}`;
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("text-chart-1 h-11 w-28 overflow-visible", className)}
    >
      <path d={area} fill="currentColor" opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
