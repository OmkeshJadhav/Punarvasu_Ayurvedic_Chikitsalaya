import { NavLink } from "@/components/layout/nav-link";
import { DOCTOR_NAV_ITEMS } from "@/features/doctor/content";

/**
 * Navigation within the clinical workspace.
 *
 * A server component. The only part that needs the browser is knowing which
 * link is current, and `NavLink` — the same one the public header, the
 * patient area, the front desk and administration use — already handles that,
 * setting `aria-current="page"` and an underline so the current page is not
 * signalled by colour alone.
 *
 * Reusing `NavLink` rather than writing a fifth nav link is the point: the
 * current-page treatment, the focus ring and the 44px target are defined once
 * (`AGENTS.md` section 32).
 *
 * "Today" uses `match: "exact"`, because this nav also lists children of
 * `/doctor`. Without it both entries would report `aria-current="page"` on
 * `/doctor/appointments`, telling a screen-reader user they are in two places
 * at once — the defect Phase 07 found in the patient nav and Phase 10 avoided
 * in the reception one.
 */
export function DoctorNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex items-center gap-1">
        {DOCTOR_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
