import {
  prescriptionItemFacts,
  formatMedicineHeading,
} from "@/features/prescriptions/format";
import type { PrescriptionItemContent } from "@/features/prescriptions/types";

/**
 * A prescription, rendered to be read.
 *
 * ## One implementation, three readers
 *
 * The doctor's review before issuing, the doctor's read-only detail page and
 * the patient's own copy all render through this. That is deliberate: the
 * review must show *exactly* what will be issued (`phase_13.md` sections 15
 * and 16), and the surest way to guarantee that is for the review and the
 * issued article to be the same component over the same data.
 *
 * ## Why it is not a table
 *
 * Section 76: clean and highly readable, not a dense spreadsheet. A
 * prescription is read one medicine at a time, often on a phone, sometimes by
 * somebody unwell. So it is a numbered list of headings with the facts
 * beneath each, which wraps down to 320px without a horizontal scroller and
 * reads in the order a person needs them.
 *
 * ## No identifiers
 *
 * No row id, no prescription id, no consultation id, no practitioner id
 * (section 35 and section 77). The reader gets what was prescribed.
 *
 * It carries no `"use client"` and no state, so it renders on the server for
 * the two read-only pages and inside the builder's client island for the
 * review — one component, not three.
 */
export function PrescriptionItems({
  items,
  emptyMessage,
}: {
  readonly items: readonly PrescriptionItemContent[];
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
    <ol className="flex flex-col gap-5">
      {items.map((item, index) => {
        const facts = prescriptionItemFacts(item);
        const instructions = item.instructions.trim();

        return (
          <li
            key={`${item.medicineName}-${index}`}
            className="border-border bg-card min-w-0 rounded-lg border p-4 sm:p-5"
          >
            <p className="text-h5 text-heading font-sans font-medium [overflow-wrap:anywhere]">
              <span className="text-muted-foreground tabular-nums">
                {index + 1}.
              </span>{" "}
              {formatMedicineHeading(item)}
            </p>

            {facts.length > 0 ? (
              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                {facts.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-caption text-muted-foreground font-sans">
                      {fact.label}
                    </dt>
                    <dd className="text-body-sm text-foreground font-sans font-medium [overflow-wrap:anywhere]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {instructions ? (
              <p className="text-body-sm text-foreground measure mt-3 font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
                {instructions}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The instructions that apply to the whole prescription (section 24). */
export function PrescriptionInstructions({
  heading,
  instructions,
}: {
  readonly heading: string;
  readonly instructions: string;
}) {
  const text = instructions.trim();
  if (!text) return null;

  return (
    <section className="min-w-0">
      <h3 className="text-h5 text-heading font-sans font-medium">{heading}</h3>
      <p className="text-body text-foreground measure mt-2 font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
        {text}
      </p>
    </section>
  );
}
