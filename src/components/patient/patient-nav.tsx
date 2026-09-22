import { NavLink } from "@/components/layout/nav-link";
import { PATIENT_NAV_ITEMS } from "@/features/patients/content";

/**
 * Navigation within the patient area.
 *
 * A server component. The only part that needs the browser is knowing which
 * link is current, and `NavLink` — the same one the public header uses —
 * already handles that, setting `aria-current="page"` and an underline so the
 * current page is not signalled by colour alone.
 *
 * Reusing `NavLink` rather than writing a second nav link is the point: the
 * current-page treatment, the focus ring and the 44px target are defined once
 * (`AGENTS.md` section 32).
 *
 * It scrolls horizontally rather than wrapping, so adding a third item later
 * cannot push the bar into a second row that shifts the page beneath it. With
 * two short items it never scrolls in practice.
 */
export function PatientNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex items-center gap-1">
        {PATIENT_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
