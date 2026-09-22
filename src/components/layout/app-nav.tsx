import { NavLink } from "@/components/layout/nav-link";
import type { NavItem } from "@/config/navigation";
import { areasForRole } from "@/lib/authorization/routes";
import { cn } from "@/lib/utils/cn";
import type { AppRole } from "@/types/database";

/**
 * Navigation inside the authenticated shell, built from the signed-in user's
 * role.
 *
 * ## What it is
 *
 * A usability affordance, and only that. It lists the areas the role can
 * actually enter, so nobody is offered a link that will turn them away. Every
 * one of those areas is guarded independently on the server by
 * `requireAreaAccess`, and every table beneath them by row-level security -
 * hiding a link stops nobody who types the URL, and is not meant to
 * (`phase_08.md` section 10, layer 1, and example 5).
 *
 * ## Why it takes the role as a prop
 *
 * So it stays a server component and resolves nothing itself. The layout above
 * has already called `requireUser()`, which resolved the role from the
 * database; passing it down means one lookup per request rather than one per
 * component, and it keeps this file free of any way to obtain a role other
 * than from a verified session.
 *
 * ## Only areas that exist
 *
 * `areasForRole` reads the same table the guards read, so a link can never
 * describe an area that has no rule - and, far more importantly, an area
 * cannot acquire a link while nobody remembers to guard it. A receptionist or
 * a doctor gets nothing here today, because their workspaces have not been
 * built and `phase_08.md` section 23 forbids inventing links to them. The
 * account page tells them so in words.
 */
export function AppNav({
  role,
  label,
  className,
}: {
  readonly role: AppRole | null;
  readonly label: string;
  /** Layout only. The header decides where this sits; the nav does not. */
  readonly className?: string;
}) {
  const areas = areasForRole(role);
  if (areas.length === 0) return null;

  const items: readonly NavItem[] = areas.map((area) => ({
    label: area.label,
    href: area.path,
  }));

  return (
    /*
     * Scrolls rather than wraps, so a third area added later cannot push the
     * bar into a second row that shifts the page beneath it.
     *
     * **Phase 18 fix.** This previously sat on one row beside the brand, the
     * notification bell and sign-out, and below about 430px there was not
     * room: the flex row squeezed it, `overflow-x-auto` clipped it, and the
     * label was cut mid-word — "Patient ar" with the bell against it.
     * Measured at 320px, the nav was 90px wider than the box it was given.
     *
     * Nothing here changed to fix that. The header gives it its own row on a
     * narrow screen instead, which is why this takes a `className`: where a
     * navigation sits is the layout's decision, and solving it here with a
     * `hidden sm:block` would have removed a signed-in person's only link to
     * their own workspace from every phone.
     */
    <nav
      aria-label={label}
      className={cn("-mx-1 min-w-0 overflow-x-auto", className)}
    >
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
