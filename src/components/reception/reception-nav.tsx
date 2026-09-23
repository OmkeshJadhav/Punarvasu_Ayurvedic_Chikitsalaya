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
export function ReceptionNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1">
      <ul className="flex flex-wrap items-center gap-1">
        {RECEPTION_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
