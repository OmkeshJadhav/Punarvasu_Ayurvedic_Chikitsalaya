"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import type { NavItem } from "@/config/navigation";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A navigation link that knows whether it is the current page.
 *
 * `aria-current="page"` is the part that matters: it is how a screen reader
 * user learns where they are. The underline is the visual equivalent, so the
 * current page is not signalled by colour alone.
 *
 * A client component because it reads the pathname. It is small and leaf-level
 * on purpose - the header around it stays a server component.
 *
 * A section is treated as current when the path is nested beneath it, so
 * `/treatments/panchakarma` still highlights "Treatments". `/` matches only
 * itself, or every link would be current on the homepage.
 *
 * An item may opt out with `match: "exact"`, which an index link has to do
 * whenever the same nav also lists its children — see `NavItem.match`.
 */
export function isCurrentPath(
  pathname: string,
  href: string,
  match: "section" | "exact" = "section",
): boolean {
  if (href === "/" || match === "exact") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavLinkProps extends Omit<
  ComponentProps<typeof Link>,
  "href" | "children"
> {
  readonly item: NavItem;
  /** `header` sits on a bar; `stacked` is the mobile menu and footer. */
  readonly appearance?: "header" | "stacked";
}

export function NavLink({
  item,
  appearance = "header",
  className,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const current =
    !item.external && isCurrentPath(pathname, item.href, item.match);

  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      {...(item.external
        ? { target: "_blank", rel: "noreferrer noopener" }
        : {})}
      className={cn(
        "text-label inline-flex items-center rounded-sm font-medium",
        MOTION_MICRO,
        "hover:text-primary",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        appearance === "header"
          ? cn(
              "text-foreground min-h-11 px-3",
              // A hairline that draws in on hover and stays drawn for the
              // current page - so "you are here" is a mark, not a colour
              // alone. `bg-origin-content` sizes it to the label rather than
              // to the padded hit area.
              "link-underline hover:link-underline-active bg-origin-content",
              // Replaces MOTION_MICRO's property list (tailwind-merge keeps
              // the last), which would otherwise drop the underline's own.
              "transition-[color,background-size] duration-(--duration-normal)",
              "aria-[current=page]:text-primary aria-[current=page]:link-underline-active",
            )
          : cn(
              "text-muted-foreground min-h-11 w-full",
              "aria-[current=page]:text-primary aria-[current=page]:font-semibold",
            ),
        className,
      )}
      {...props}
    >
      {item.label}
    </Link>
  );
}
