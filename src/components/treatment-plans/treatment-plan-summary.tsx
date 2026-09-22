import {
  TREATMENT_PLAN_CATEGORY_COPY,
  TREATMENT_PLAN_CATEGORY_LABELS,
} from "@/features/treatment-plans/content";
import type {
  TreatmentPlanCategory,
  TreatmentPlanItemContent,
} from "@/features/treatment-plans/types";

/**
 * A treatment plan, rendered to be read.
 *
 * ## Grouped by section, not listed flat
 *
 * `phase_13.md` example 8 and section 68: a plan is Diet, Lifestyle, Therapy,
 * Follow-up and Other instructions — not one undifferentiated list and
 * certainly not one blob of text. A patient reading it at home wants to find
 * "what do I eat" without reading the therapy instructions first.
 *
 * Sections with nothing in them are **omitted**, not rendered empty: a
 * heading with no content under it reads as something the practitioner forgot.
 *
 * ## One implementation, three readers
 *
 * The practitioner's review before giving the plan, the practitioner's
 * read-only detail page and the patient's own copy all render through this,
 * so the review shows exactly what the patient will see.
 *
 * No `"use client"` and no state, so it renders on the server for the
 * read-only pages and inside the builder's client island for the review.
 */
export function TreatmentPlanSections({
  items,
  emptyMessage,
}: {
  readonly items: readonly TreatmentPlanItemContent[];
  readonly emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground measure font-sans">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {TREATMENT_PLAN_CATEGORY_COPY.map((category) => {
        const inSection = items.filter(
          (item) => item.category === category.value,
        );
        if (inSection.length === 0) return null;

        return (
          <section key={category.value} className="min-w-0">
            <h3 className="text-h5 text-heading font-sans font-medium">
              {category.label}
            </h3>
            <ul className="mt-3 flex flex-col gap-4">
              {inSection.map((item, index) => (
                <li
                  key={`${category.value}-${index}`}
                  className="border-border bg-card min-w-0 rounded-lg border p-4"
                >
                  <p className="text-body text-foreground font-sans font-medium [overflow-wrap:anywhere]">
                    {item.title.trim()}
                  </p>

                  {item.instructions.trim() ? (
                    <p className="text-body-sm text-foreground measure mt-2 font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {item.instructions.trim()}
                    </p>
                  ) : null}

                  {item.frequency.trim() || item.duration.trim() ? (
                    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                      {item.frequency.trim() ? (
                        <div className="min-w-0">
                          <dt className="text-caption text-muted-foreground font-sans">
                            How often
                          </dt>
                          <dd className="text-body-sm text-foreground font-sans font-medium [overflow-wrap:anywhere]">
                            {item.frequency.trim()}
                          </dd>
                        </div>
                      ) : null}
                      {item.duration.trim() ? (
                        <div className="min-w-0">
                          <dt className="text-caption text-muted-foreground font-sans">
                            For how long
                          </dt>
                          <dd className="text-body-sm text-foreground font-sans font-medium [overflow-wrap:anywhere]">
                            {item.duration.trim()}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function treatmentPlanCategoryLabel(
  category: TreatmentPlanCategory,
): string {
  return TREATMENT_PLAN_CATEGORY_LABELS[category];
}
