import type { ReactNode } from "react";

import { PROFILE_COPY } from "@/features/patients/content";
import { cn } from "@/lib/utils/cn";

/**
 * One titled group of profile information.
 *
 * `phase_07.md` sections 17 and 40 ask for readable sections rather than a
 * dump of database fields, and for the same grouping in the view and the form
 * — so both use this component and neither can drift into its own layout.
 *
 * The heading level is a prop rather than fixed, so the outline stays correct
 * wherever the section is placed. It defaults to `h2` because that is where it
 * sits on the profile page.
 */
export function ProfileSection({
  title,
  description,
  headingLevel: Heading = "h2",
  id,
  children,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly headingLevel?: "h2" | "h3";
  readonly id?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        // `min-w-0` because these sections are laid out in a flex column, and
        // a flex item's `min-width` defaults to `auto` — it will not shrink
        // below its content's min-content width. One long unbreakable value,
        // such as an email address, would otherwise widen the whole section
        // and give the page horizontal overflow on a 320px screen. Measured:
        // it did, before this line.
        "border-border bg-card min-w-0 rounded-lg border p-5 sm:p-6",
        className,
      )}
    >
      <Heading
        id={headingId}
        className="text-h5 text-heading font-sans font-medium"
      >
        {title}
      </Heading>
      {description ? (
        <p className="text-body-sm text-muted-foreground measure mt-1">
          {description}
        </p>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * A list of label/value pairs.
 *
 * A real `<dl>`, so a screen reader announces each value as the definition of
 * its term rather than as two unrelated runs of text.
 */
export function ProfileFieldList({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-[11rem_1fr]">
      {children}
    </dl>
  );
}

/**
 * One label and its value.
 *
 * A value is always rendered as **text**. React escapes it, so a name
 * containing `<script>` is displayed rather than executed — and nothing in the
 * patient area uses `dangerouslySetInnerHTML` (`phase_07.md` section 39).
 *
 * An absent value shows "Not provided" rather than an empty cell, so a blank
 * row cannot be mistaken for a rendering failure.
 */
export function ProfileField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null | undefined;
}) {
  const provided = typeof value === "string" && value.trim().length > 0;

  return (
    <>
      <dt className="text-label text-muted-foreground font-medium">{label}</dt>
      <dd
        className={cn(
          // `overflow-wrap: anywhere` rather than `break-words`: only the
          // former reduces the element's *min-content* width, which is what a
          // grid track and a flex item are sized from. `break-words` breaks
          // the text visually but still reports the whole email address as its
          // minimum, so the layout widens anyway.
          "text-body min-w-0 [overflow-wrap:anywhere]",
          provided ? "text-foreground" : "text-muted-foreground italic",
        )}
      >
        {provided ? value : PROFILE_COPY.notProvided}
      </dd>
    </>
  );
}
