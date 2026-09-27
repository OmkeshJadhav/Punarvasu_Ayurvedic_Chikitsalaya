"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ADMIN_AREA, ADMIN_SHELL } from "@/features/admin/content";

/**
 * The administration navigation below `lg`, in a sheet.
 *
 * A `Sheet` for the same reasons as the public `MobileNav`: focus trapping,
 * Escape and focus restoration come from Radix. It closes on a route change
 * and — because a dashboard section link changes only the fragment, which
 * never changes the pathname — on any link being followed as well.
 */
export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [pathnameWhenOpened, setPathnameWhenOpened] = useState(pathname);

  // Adjusted during render rather than in an effect, so the sheet is never
  // painted open over the page it navigated to.
  if (pathnameWhenOpened !== pathname) {
    setPathnameWhenOpened(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ADMIN_SHELL.openMenu}
          className="lg:hidden"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" aria-label={ADMIN_SHELL.menuTitle}>
        <SheetHeader>
          <SheetTitle className="sr-only">{ADMIN_SHELL.menuTitle}</SheetTitle>
          <Logo />
        </SheetHeader>
        <div className="mt-6 overflow-y-auto">
          <AdminNav
            label={ADMIN_AREA.navLabel}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
