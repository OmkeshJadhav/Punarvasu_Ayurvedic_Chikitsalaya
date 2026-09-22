import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ComponentProps } from "react";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A table foundation.
 *
 * Deliberately a set of styled semantic elements, not a data-grid. Sorting,
 * pagination and selection arrive with the first workflow that genuinely needs
 * them; building them now would be guessing.
 *
 * Responsive strategy - pick one per table, do not squeeze:
 *   - Few columns: let `TableScroller` scroll horizontally. It is focusable and
 *     labelled, so a keyboard user can scroll it and a screen reader announces
 *     what it contains.
 *   - Many columns, or content a patient reads on a phone: render cards below
 *     `md` and the table from `md` up. `docs/DESIGN_SYSTEM.md` section 32.
 *
 * Always give a table a `<caption>`. It is the accessible name, and it can be
 * visually hidden with `className="sr-only"` when a heading above already says
 * the same thing.
 */

/**
 * The horizontally scrollable wrapper.
 *
 * `tabIndex={0}` with a role and a label is what makes an overflowing region
 * operable by keyboard - without it the content is simply unreachable.
 *
 * ## Why it is `relative`
 *
 * An absolutely positioned descendant is clipped by an ancestor's `overflow`
 * only when that ancestor is its *containing block*, which means the ancestor
 * has to be positioned. Without `relative` here, anything absolute inside a
 * wide table - a visually hidden label, a badge, a decorative marker - resolves
 * against the initial containing block, escapes this scroller entirely, and
 * extends the width of the whole document.
 *
 * That is not theoretical: it was measured in Phase 08. `/admin/users` at 320px
 * had 35px of horizontal page overflow, and the offending element was a single
 * `sr-only` label on a role control, sitting 354px into a table the scroller
 * was otherwise containing perfectly. One class here fixes it for every table.
 *
 * It does not affect an overlay that needs to escape: `Dialog`, `Select`,
 * `Tooltip` and `Popover` all portal to the document body, so they were never
 * positioned against this element.
 */
export function TableScroller({
  className,
  label,
  ...props
}: ComponentProps<"div"> & { readonly label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "border-border relative w-full overflow-x-auto rounded-lg border",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("text-body-sm w-full border-collapse text-left", className)}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: ComponentProps<"caption">) {
  return (
    <caption
      className={cn(
        "text-body-sm text-muted-foreground px-4 py-3 text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-muted", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&>tr:not(:last-child)]:border-b", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-border ease-natural hover:bg-accent/50 transition-colors duration-(--duration-fast)",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "text-caption text-muted-foreground px-4 py-3 font-medium tracking-wide uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export type SortDirection = "ascending" | "descending" | "none";

export interface TableSortButtonProps extends ComponentProps<"button"> {
  readonly direction: SortDirection;
}

/**
 * The header control for a sortable column.
 *
 * Renders inside a `<th>` whose `aria-sort` must be set to the same direction -
 * that attribute, not the arrow glyph, is what a screen reader reports. The
 * arrow changes shape as well as position, so the sort state is not conveyed by
 * orientation alone.
 */
export function TableSortButton({
  className,
  direction,
  children,
  ...props
}: TableSortButtonProps) {
  const Icon =
    direction === "ascending"
      ? ArrowUp
      : direction === "descending"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <button
      type="button"
      className={cn(
        "text-caption text-muted-foreground -mx-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-2 font-medium tracking-wide uppercase",
        MOTION_MICRO,
        "hover:text-foreground",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      {children}
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">
        {direction === "ascending"
          ? "sorted ascending"
          : direction === "descending"
            ? "sorted descending"
            : "not sorted"}
      </span>
    </button>
  );
}
