import { NavLink } from "@/components/layout/nav-link";
import { RECEPTION_NAV_ITEMS } from "@/features/reception/content";

/**
 * Navigation within the front desk workspace.
 *
 * A server component. The only part that needs the browser is knowing which
 * link is current, and `NavLink` — the same one the public header, the patient
 * area and administration use — already handles that, setting
 * `aria-current="page"` and an underline so the current page is not signalled
 * by colour alone.
 *
 * Reusing `NavLink` rather than writing a fourth nav link is the point: the
 * current-page treatment, the focus ring and the 44px target are defined once
 * (`AGENTS.md` section 32).
 *
 * "Today" uses `match: "exact"`, because this nav also lists children of
 * `/receptionist`. Without it both entries would report `aria-current="page"`
 * on `/receptionist/schedule`, telling a screen-reader user they are in two
 * places at once — the defect Phase 07 found and fixed in the patient nav.
 */
export function ReceptionNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex items-center gap-1">
        {RECEPTION_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
