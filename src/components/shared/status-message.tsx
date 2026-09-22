import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A full-page status screen: not found, an unrecoverable route error, a
 * completed one-off action.
 *
 * Owns the `<main>` landmark and the page's `<h1>`, which is why it is a page
 * component rather than a section one. For a region of a page that failed,
 * use `ErrorState`; for a region with nothing in it, use `EmptyState`.
 *
 * `reference` is the opaque correlation id from the server log. It carries no
 * patient data and is the only technical detail a user should ever see
 * (`AGENTS.md` section 18).
 *
 * Kept free of server-only imports so client boundaries such as `error.tsx`
 * can render it.
 */
export interface StatusMessageProps {
  readonly title: string;
  readonly description: string;
  /** Actions such as a retry button or a link home. */
  readonly children?: ReactNode;
  /** Shown in small print so a user can quote it to the clinic. */
  readonly reference?: string;
  /** A decorative Lucide icon. */
  readonly icon?: ReactNode;
  readonly className?: string;
}

export function StatusMessage({
  title,
  description,
  children,
  reference,
  icon,
  className,
}: StatusMessageProps) {
  return (
    <main
      id="main-content"
      className={cn(
        "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="text-primary bg-accent flex size-12 items-center justify-center rounded-full [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}

      <h1 className="text-h3 text-heading font-normal">{title}</h1>

      <p className="text-body text-muted-foreground">{description}</p>

      {children ? (
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          {children}
        </div>
      ) : null}

      {reference ? (
        <p className="text-caption text-muted-foreground mt-4">
          Reference: <span className="font-mono">{reference}</span>
        </p>
      ) : null}
    </main>
  );
}
