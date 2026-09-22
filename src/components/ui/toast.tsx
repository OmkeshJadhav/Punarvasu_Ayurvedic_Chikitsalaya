"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import { Check, Info, TriangleAlert, X, CircleAlert } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { TOAST_DURATION_MS } from "@/config/design-tokens";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * Toasts.
 *
 * Built on Radix Toast, which gives the hotkey (F8) that moves focus into the
 * toast region, correct `status`/`alert` live-region roles, pause-on-hover and
 * pause-on-focus, and swipe-to-dismiss.
 *
 * Mount `<Toaster />` once, near the root of the interactive tree, then call
 * `useToast()` from any client component:
 *
 * ```tsx
 * const { toast } = useToast();
 * toast({ tone: "success", title: "Appointment confirmed" });
 * ```
 *
 * Rules that matter more than the API:
 *   - A toast is a confirmation, never the only place important information
 *     appears. A booking reference belongs on the confirmation screen.
 *   - Error toasts do not auto-dismiss. Something went wrong; the user decides
 *     when they have finished reading it.
 *   - Toasts carry an icon as well as a tone colour.
 *   - Errors use `role="alert"` (interrupts); everything else uses
 *     `role="status"` (waits for a pause), so a success message does not talk
 *     over what a screen-reader user is already hearing.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  readonly title: string;
  /** One extra sentence at most. Anything longer belongs on the page. */
  readonly description?: string;
  readonly tone?: ToastTone;
  /** A single recovery or follow-up action. */
  readonly action?: {
    readonly label: string;
    readonly onSelect: () => void;
  };
}

interface ToastRecord extends ToastOptions {
  readonly id: number;
}

interface ToastContextValue {
  readonly toast: (options: ToastOptions) => void;
  readonly dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() requires <Toaster /> to be mounted above it");
  }
  return context;
}

const TONE_STYLES: Record<
  ToastTone,
  {
    readonly surface: string;
    readonly icon: typeof Check;
    readonly iconClass: string;
  }
> = {
  success: {
    surface: "border-success-border bg-success-surface",
    icon: Check,
    iconClass: "text-success",
  },
  error: {
    surface: "border-destructive-border bg-destructive-surface",
    icon: CircleAlert,
    iconClass: "text-destructive",
  },
  warning: {
    surface: "border-warning-border bg-warning-surface",
    icon: TriangleAlert,
    iconClass: "text-warning",
  },
  info: {
    surface: "border-info-border bg-info-surface",
    icon: Info,
    iconClass: "text-info",
  },
};

/**
 * The toast region and provider. Mount once.
 *
 * The viewport sits bottom-centre on mobile, where a thumb can reach the
 * dismiss control, and bottom-right from `sm` up.
 */
export function Toaster({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    // A monotonic counter, not an index: two toasts dismissed out of order
    // must not be able to collide on a key.
    setToasts((current) => [
      ...current,
      { ...options, id: (current.at(-1)?.id ?? 0) + 1 },
    ]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((item) => (
          <ToastItem key={item.id} record={item} onDismiss={dismiss} />
        ))}
        <ToastPrimitive.Viewport
          className={cn(
            "fixed bottom-0 z-(--z-toast) flex max-h-dvh w-full flex-col-reverse gap-2 p-4",
            "inset-x-0 sm:inset-x-auto sm:right-0 sm:max-w-sm",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

function ToastItem({
  record,
  onDismiss,
}: {
  readonly record: ToastRecord;
  readonly onDismiss: (id: number) => void;
}) {
  const tone = record.tone ?? "info";
  const { surface, icon: Icon, iconClass } = TONE_STYLES[tone];
  const isError = tone === "error";

  return (
    <ToastPrimitive.Root
      // An error waits to be acknowledged; everything else clears itself.
      duration={isError ? Number.POSITIVE_INFINITY : TOAST_DURATION_MS}
      type={isError ? "foreground" : "background"}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss(record.id);
        }
      }}
      className={cn(
        "border shadow-md",
        surface,
        "flex w-full items-start gap-3 rounded-md border p-4",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
        "motion-safe:data-[state=open]:animate-rise-in",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", iconClass)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <ToastPrimitive.Title className="text-label text-foreground font-medium">
          {record.title}
        </ToastPrimitive.Title>
        {record.description ? (
          <ToastPrimitive.Description className="text-body-sm text-muted-foreground">
            {record.description}
          </ToastPrimitive.Description>
        ) : null}
        {record.action ? (
          <ToastPrimitive.Action
            altText={record.action.label}
            onClick={record.action.onSelect}
            className={cn(
              "text-label text-primary mt-1 w-fit cursor-pointer font-medium underline-offset-4 hover:underline",
              "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
          >
            {record.action.label}
          </ToastPrimitive.Action>
        ) : null}
      </div>

      <ToastPrimitive.Close
        aria-label="Dismiss notification"
        className={cn(
          "text-muted-foreground hover:text-foreground -my-1 -mr-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md",
          MOTION_MICRO,
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export type ToasterProps = ComponentProps<typeof Toaster>;
