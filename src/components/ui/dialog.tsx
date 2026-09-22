"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A modal dialog.
 *
 * Radix supplies focus trapping, focus restoration to the trigger on close,
 * Escape, the `aria-modal` semantics and inert background content. None of
 * that is reimplemented here; only the Punarvasu surface is.
 *
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button variant="outline">Cancel appointment</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Cancel this appointment?</DialogTitle>
 *       <DialogDescription>
 *         The slot is released immediately and cannot be reclaimed.
 *       </DialogDescription>
 *     </DialogHeader>
 *     <DialogFooter>
 *       <DialogClose asChild>
 *         <Button variant="outline">Keep appointment</Button>
 *       </DialogClose>
 *       <Button variant="destructive">Cancel appointment</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * `DialogTitle` is mandatory - Radix warns without one and a dialog with no
 * accessible name is unusable with a screen reader. Where the title must be
 * visually absent, wrap it in `VisuallyHidden` rather than omitting it.
 *
 * On mobile the panel sits at the bottom of the viewport with room to breathe
 * and scrolls internally, so a tall dialog never pushes its actions off screen.
 * For a genuinely mobile-first flow, prefer `Sheet` with `side="bottom"`.
 *
 * Use modals for confirmation, destructive actions and short focused forms.
 * Not for navigation, and not for long forms - those deserve a page.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-(--z-overlay) bg-[rgba(25,40,32,0.45)]",
        "motion-safe:data-[state=open]:animate-overlay-in",
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentProps<
  typeof DialogPrimitive.Content
> {
  /** Hides the built-in close button when the footer already provides one. */
  readonly hideCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  hideCloseButton = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "bg-card text-card-foreground border-border shadow-lg",
          "fixed z-(--z-modal) flex w-full flex-col gap-5 border p-6",
          // Mobile: docked to the bottom, thumb-reachable, scrolls internally.
          "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl",
          // Tablet and up: a centred panel.
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-lg",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          "motion-safe:data-[state=open]:animate-sheet-in-bottom",
          "sm:motion-safe:data-[state=open]:animate-dialog-in",
          className,
        )}
        {...props}
      >
        {children}
        {hideCloseButton ? null : (
          <DialogPrimitive.Close
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-md",
              MOTION_MICRO,
              "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 pr-12 text-left", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-h4 text-heading font-medium", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Action row. Stacks on mobile with the primary action on top, where the thumb
 * is; returns to a right-aligned row from `sm` up.
 */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
