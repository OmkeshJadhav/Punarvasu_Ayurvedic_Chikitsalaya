import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { MOTION_MICRO, MOTION_PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

import { Spinner } from "./spinner";

/**
 * The Punarvasu button.
 *
 * A server component. It ships no JavaScript of its own; hover, focus, press
 * and disabled are all CSS. Attach behaviour by rendering it inside a client
 * component, or use `asChild` to project the styling onto a `next/link`.
 *
 * Variants
 *   primary      The single most important action on the screen.
 *   secondary    A supporting action of comparable weight.
 *   outline      A quiet action that still needs a container.
 *   ghost        Toolbar and icon actions; no container until hovered.
 *   inverse      The primary action on a dark band.
 *   outline-inverse  The quiet action on a dark band or scrimmed photograph.
 *   link         An action that reads as inline text.
 *   destructive  Irreversible actions only. Always pair with a confirmation.
 *
 * Sizes
 *   `sm`, `md` and `lg` for text buttons, `icon` for a square icon-only
 *   control. Every size is at least 44px tall, so the WCAG 2.2 target size is
 *   met without a separate mobile variant.
 *
 * Accessibility
 *   - Renders a real `<button>`, or with `asChild` whatever element you supply
 *     (which must itself be interactive).
 *   - `size="icon"` has no visible text, so `aria-label` is required by the
 *     type signature rather than merely recommended.
 *   - `loading` sets `aria-busy`, disables the control so a form cannot be
 *     submitted twice, and keeps a label beside the spinner so the button does
 *     not collapse to an unreadable square mid-submission.
 *
 * Labels should say what will happen - "Book a Consultation", not "Submit".
 *
 * `size` is declared before `variant` so that variant-level overrides (the
 * `link` variant dropping its padding) come later in the generated class
 * string and win the `tailwind-merge` pass.
 */
const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap",
    "cursor-pointer select-none",
    MOTION_MICRO,
    MOTION_PRESS,
    // Disabled must read as unavailable without relying on colour alone, so
    // the cursor and pointer-events change as well as the opacity.
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
    "aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
    "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      size: {
        sm: "min-h-11 px-3.5 py-2 text-body-sm",
        md: "min-h-11 px-5 py-2.5 text-label",
        lg: "min-h-13 px-7 py-3 text-body",
        icon: "size-11 p-0",
      },
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-border-strong bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        /**
         * The primary action on a dark band. A green fill on the deep green
         * brand surface all but disappears, so the one filled button there is
         * light linen with the heading green on it - the same pair, inverted.
         */
        inverse:
          "bg-brand-surface-accent text-heading shadow-sm hover:bg-card active:bg-brand-surface-accent",
        /**
         * The quiet action on a dark band or a scrimmed photograph: a hairline
         * and white type, so it sits beside an `inverse` or `primary` button
         * without competing with it. Only valid inside
         * `data-surface="inverted"`, where white is the verified foreground.
         */
        "outline-inverse":
          "border border-brand-surface-foreground/55 bg-transparent text-brand-surface-foreground hover:border-brand-surface-foreground hover:bg-brand-surface-foreground/10",
        link: "min-h-0 bg-transparent p-0 text-primary underline-offset-4 hover:text-primary-hover hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-95 active:brightness-90",
      },
      /**
       * Full width. Use on mobile for a primary action, or inside a narrow
       * form column - not as a default.
       *
       * Wrapping is re-enabled here: a full-width button is the one place a
       * long label meets a 320px viewport, and `whitespace-nowrap` would push
       * it off the screen rather than let it use a second line.
       */
      block: {
        true: "w-full whitespace-normal",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "primary",
      block: false,
    },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;
type ButtonSize = NonNullable<ButtonVariants["size"]>;

interface ButtonOwnProps extends Omit<ButtonVariants, "size"> {
  /**
   * Render the child element instead of a `<button>`, keeping the styling.
   * Use for navigation: `<Button asChild><Link href="/x">Go</Link></Button>`.
   */
  readonly asChild?: boolean;
  /**
   * Shows a spinner, disables the control and sets `aria-busy`. Keep it true
   * for the whole submission so a second click cannot land.
   */
  readonly loading?: boolean;
  /**
   * Replaces the label while loading, for example "Booking...". Ignored
   * with `asChild`, whose child owns its own content.
   */
  readonly loadingLabel?: string;
}

type ButtonBaseProps = ComponentProps<"button"> & ButtonOwnProps;

/**
 * An icon-only button has no text node, so the accessible name has to come
 * from `aria-label`. The union makes omitting it a type error.
 */
export type ButtonProps = ButtonBaseProps &
  (
    | { readonly size: "icon"; readonly "aria-label": string }
    | { readonly size?: Exclude<ButtonSize, "icon"> }
  );

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  const isInoperable = disabled === true || loading;

  return (
    <Component
      // Inside a form an unspecified type defaults to "submit", which is a
      // recurring source of accidental submissions.
      type={asChild ? undefined : (type ?? "button")}
      // `disabled` is not a valid attribute on an anchor, so a projected
      // element gets the ARIA equivalent instead.
      disabled={asChild ? undefined : isInoperable}
      aria-disabled={asChild && isInoperable ? true : undefined}
      aria-busy={loading || undefined}
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ size, variant, block }), className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {/*
        `Slottable` marks which child is the element to merge onto, so the
        spinner is rendered *inside* the projected element rather than
        confusing Slot with two roots. Outside a Slot it is a transparent
        fragment, so the plain `<button>` path is unaffected.

        A projected element keeps its own content while loading: substituting
        `loadingLabel` would mean rewriting a child we do not own.
      */}
      <Slot.Slottable>
        {!asChild && loading && loadingLabel ? loadingLabel : children}
      </Slot.Slottable>
    </Component>
  );
}

export { buttonVariants };
