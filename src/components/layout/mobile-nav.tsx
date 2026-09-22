"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavItem } from "@/config/navigation";

import { NavLink } from "./nav-link";

/**
 * The mobile navigation menu.
 *
 * A `Sheet`, so focus trapping, Escape, focus restoration to the trigger and
 * an inert background all come from Radix rather than being reimplemented.
 *
 * The menu closes when the route changes. Without that, tapping a link
 * navigates underneath a menu that stays open over the new page - a bug users
 * report as "the site froze".
 *
 * Links are wrapped in `SheetClose asChild` as well, which covers a same-route
 * navigation where the pathname never changes.
 */
export interface MobileNavProps {
  readonly items: readonly NavItem[];
  /** Rendered at the foot of the menu: the primary CTA, account actions. */
  readonly footer?: ReactNode;
}

export function MobileNav({ items, footer }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [pathnameWhenOpened, setPathnameWhenOpened] = useState(pathname);

  // Adjusting state during render rather than in an effect: React re-renders
  // immediately with the corrected value, so the menu is never painted open
  // over the new page. An effect would run after that paint.
  if (pathnameWhenOpened !== pathname) {
    setPathnameWhenOpened(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" aria-label="Site menu">
        <SheetHeader>
          {/* Required for an accessible name; the logo is the visible heading. */}
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>

        <Separator />

        <nav aria-label="Main">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <NavLink
                    item={item}
                    appearance="stacked"
                    className="text-body py-1"
                  />
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>

        {footer ? (
          <div className="mt-auto flex flex-col gap-3">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
