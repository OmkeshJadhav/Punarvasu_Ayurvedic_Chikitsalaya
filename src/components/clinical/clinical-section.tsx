import {
  CLINICAL_RECORD_VIEW_COPY,
  CLINICAL_SECTIONS,
} from "@/features/clinical/content";
import type { ClinicalContent } from "@/features/clinical/types";

/**
 * A clinical record, read rather than written.
 *
 * ## Why a completed record is not the form with the inputs disabled
 *
 * Two reasons, and the second is the one that matters.
 *
 * A row of disabled textareas is a poor reading experience: the text is
 * boxed, greyed, and scrollable inside its own window, which is the opposite
 * of what somebody reviewing a consultation before the next one needs.
 *
 * And it would say the wrong thing. A disabled control implies "not right
 * now" — that some state change would re-enable it. A completed clinical
 * record is not temporarily uneditable; it is *finished*, permanently, by
 * design (section 16 and example 5). Rendering it as prose says that, and the
 * notice above it says why.
 *
 * ## Empty sections are shown, not hidden
 *
 * A section the practitioner did not write reads "Not recorded" rather than
 * disappearing. On a clinical record the difference between "there were no
 * symptoms to note" and "this section is missing from the page" matters, and
 * a silently absent heading makes the two indistinguishable.
 *
 * ## Rendered as text
 *
 * `whitespace-pre-wrap` preserves the paragraphs and line breaks the
 * practitioner typed, and React escapes the content. Nothing in this feature
 * uses `dangerouslySetInnerHTML` — asserted by test — so a note containing
 * angle brackets, which clinical text legitimately does, renders as the
 * characters that were typed.
 */
export function ClinicalRecordView({
  content,
}: {
  readonly content: ClinicalContent;
}) {
  return (
    <div className="flex flex-col gap-10">
      {CLINICAL_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`clinical-view-${section.id}`}
          className="min-w-0"
        >
          <h3
            id={`clinical-view-${section.id}`}
            className="text-h4 text-heading font-sans font-medium"
          >
            {section.title}
          </h3>

          <dl className="mt-5 flex flex-col gap-6">
            {section.fields.map((field) => {
              const value = content[field.name].trim();

              return (
                <div key={field.name} className="min-w-0">
                  <dt className="text-body-sm text-muted-foreground font-sans font-medium">
                    {field.label}
                  </dt>
                  <dd
                    className={
                      value
                        ? "text-body text-foreground measure mt-1 font-sans [overflow-wrap:anywhere] whitespace-pre-wrap"
                        : "text-body-sm text-muted-foreground mt-1 font-sans italic"
                    }
                  >
                    {value || CLINICAL_RECORD_VIEW_COPY.emptyFieldValue}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
