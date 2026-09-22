"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A sheet: a panel that slides in from an edge. Also the drawer / bottom-sheet
 * pattern, which is the same component with `side="bottom"`.
 *
 * Built on Radix Dialog rather than a separate drawer library. A sheet *is* a
 * modal surface, and Dialog already provides focus trapping, Escape, focus
 * restoration and inert background content. Adding a second dependency for the
 * same semantics would only give us drag-to-dismiss, which is not a
 * requirement and is difficult to make accessible.
 *
 * Intended uses: mobile navigation, filter panels, quick detail views, and
 * appointment actions on a phone.
 *
 * ```tsx
 * <Sheet>
 *   <SheetTrigger asChild>
 *     <Button variant="ghost" size="icon" aria-label="Open menu"><Menu /></Button>
 *   </SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Menu</SheetTitle>
 *     </SheetHeader>
 *     ...
 *   </SheetContent>
 * </Sheet>
 * ```
 *
 * `SheetTitle` is mandatory, exactly as for `Dialog`. Use `VisuallyHidden`
 * rather than omitting it.
 *
 * Do not use a sheet where a page is better. A booking flow is a page.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  cn(
    "bg-card text-card-foreground border-border shadow-lg",
    "fixed z-(--z-modal) flex flex-col gap-5 border p-6",
  ),
  {
    variants: {
      side: {
        /** The drawer / bottom-sheet. Capped so the page behind stays visible. */
        bottom: cn(
          "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-b-0",
          "motion-safe:data-[state=open]:animate-sheet-in-bottom",
        ),
        /** A side panel. Full width on a phone, a column from `sm` up. */
        right: cn(
          "inset-y-0 right-0 h-dvh w-full max-w-sm overflow-y-auto border-r-0",
          "motion-safe:data-[state=open]:animate-sheet-in-right",
        ),
      },
    },
    defaultVariants: {
      side: "bottom",
    },
  },
);

export interface SheetContentProps
  extends
    ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  readonly hideCloseButton?: boolean;
}

export function SheetContent({
  className,
  children,
  side,
  hideCloseButton = false,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-(--z-overlay) bg-[rgba(25,40,32,0.45)]",
          "motion-safe:data-[state=open]:animate-overlay-in",
        )}
      />
      <DialogPrimitive.Content
        className={cn(sheetVariants({ side }), className)}
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
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 pr-12 text-left", className)}
      {...props}
    />
  );
}

export function SheetTitle({
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

export function SheetDescription({
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

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
