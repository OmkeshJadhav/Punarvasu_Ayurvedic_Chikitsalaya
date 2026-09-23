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

 * ## It wraps rather than scrolls
 *
 * **Found by measurement.** With `overflow-x-auto` the bar was wider than a
 * phone viewport, and the page reported *no* horizontal overflow because the
 * nav absorbed it by hiding its own content — the failure mode the Phase 18
 * browser pass found in the header nav. Focusing a hidden entry did not scroll
 * it into view either, so a keyboard user landed on a link they could not see.
 *
 * `AppNav` answers the same problem by scrolling and taking its own row, because
 * it shares a row with the brand and sign-out. This nav has a row to itself, so
 * it wraps, and every link stays visible and reachable at every width.
 * */
export function PatientNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1">
      <ul className="flex flex-wrap items-center gap-1">
        {PATIENT_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
