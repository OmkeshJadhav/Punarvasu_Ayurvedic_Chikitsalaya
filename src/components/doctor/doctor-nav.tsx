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
 *
 * ## It wraps rather than scrolls
 *
 * **Found by measurement, not review.** With `overflow-x-auto` the four items
 * needed 376px and got 288 at a 320px viewport, so "My practice" — the entry
 * Phase 16 added, which made a three-item bar a four-item one — sat entirely
 * outside the viewport. The page reported *no* horizontal overflow, because
 * the nav was absorbing it by hiding its own content: the same failure mode
 * the Phase 18 browser pass found in the header nav, in a nav nobody
 * re-measured afterwards.
 *
 * Worse than invisible: focusing it did not scroll it into view, so a keyboard
 * user tabbing through the workspace landed on a link they could not see —
 * WCAG 2.4.7 in practice, whatever the focus ring says.
 *
 * `AppNav` solves the same problem by scrolling and taking its own row,
 * because it shares a row with the brand and sign-out and a second line there
 * would shift the page beneath it. This nav has a row to itself, so it can
 * simply wrap, and wrapping keeps every link visible and reachable at every
 * width. Measured at 320, 375, 390, 430, 768, 1024, 1280 and 1440.
 */
export function DoctorNav({ label }: { readonly label: string }) {
  return (
    <nav aria-label={label} className="-mx-1">
      <ul className="flex flex-wrap items-center gap-1">
        {DOCTOR_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} className="px-3 whitespace-nowrap" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
