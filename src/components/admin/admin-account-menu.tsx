"use client";

import Link from "next/link";
import { ChevronDown, Settings } from "lucide-react";
import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ADMIN_SHELL } from "@/features/admin/content";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * The top bar's account control: the role, and where the account lives.
 *
 * ## The role, never the person
 *
 * The chrome names no one (`phase_06.md` section 39): the trigger reads
 * "Administrator", and the circle carries the role's first two letters, not
 * somebody's initials. A screen over a shoulder shows what kind of account is
 * signed in, not whose.
 *
 * ## Sign-out arrives as a slot
 *
 * `SignOutButton` is a server component posting to a server action. It is
 * rendered by the layout and passed in, so this client component opens and
 * closes a panel and does nothing else.
 */
export function AdminAccountMenu({
  roleLabel,
  signOut,
}: {
  readonly roleLabel: string;
  readonly signOut: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "text-label text-foreground inline-flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-1 pl-3 font-sans font-medium",
          MOTION_MICRO,
          "hover:bg-accent/70 data-[state=open]:bg-accent/70",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      >
        <span className="hidden sm:inline">{roleLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground hidden size-4 sm:block"
        />
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-full text-[0.8125rem] font-semibold tracking-wide"
        >
          {roleLabel.slice(0, 2).toUpperCase()}
        </span>
        <span className="sr-only sm:hidden">{roleLabel}</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-caption text-muted-foreground px-3 pt-2 pb-1 font-sans tracking-wide uppercase">
          {ADMIN_SHELL.accountMenu}
        </p>
        <p className="text-body-sm text-foreground px-3 pb-2 font-sans font-medium">
          {roleLabel}
        </p>
        <div className="border-border my-1 border-t" />
        <Link
          href="/account"
          className={cn(
            "text-body-sm text-foreground flex min-h-11 items-center gap-3 rounded-md px-3 font-sans",
            MOTION_MICRO,
            "hover:bg-accent hover:text-primary",
            "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
          )}
        >
          <Settings aria-hidden="true" className="size-4" />
          {ADMIN_SHELL.settings}
        </Link>
        <div className="px-1 pt-2 pb-1">{signOut}</div>
      </PopoverContent>
    </Popover>
  );
}
