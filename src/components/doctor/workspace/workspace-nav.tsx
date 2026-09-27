import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from "@/features/doctor/workspace";

/**
 * Jump links to each section of the appointment workspace.
 *
 * Sticky beneath the site header (64px, 80px from `lg`), so a practitioner
 * halfway down the treatment plan is one tap from the notes. Plain fragment
 * links: no script, keyboard- and screen-reader-operable as they are, and
 * ignored by the unsaved-changes guards, which only intercept navigation to
 * another page.
 *
 * On a phone the row scrolls sideways inside itself rather than wrapping into
 * a bar that would take a third of the screen.
 */
export function WorkspaceNav({
  sections,
}: {
  readonly sections: readonly WorkspaceSection[];
}) {
  return (
    <nav
      aria-label={DOCTOR_WORKSPACE_COPY.jumpNavLabel}
      className="bg-background/95 border-border sticky top-16 z-(--z-sticky) border-b backdrop-blur lg:top-20"
    >
      <ul className="flex gap-1 overflow-x-auto py-2">
        {sections.map((section) => (
          <li key={section} className="shrink-0">
            <a
              href={`#${WORKSPACE_SECTIONS[section]}`}
              className="text-body-sm text-foreground hover:bg-muted focus-visible:outline-ring inline-flex min-h-11 items-center rounded-md px-3 font-sans whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {DOCTOR_WORKSPACE_COPY.sections[section]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
