/**
 * Turning a stored prescription item into something a person reads.
 *
 * Pure functions with no locale or timezone assumptions, so they behave the
 * same in a test, on the server and in the browser — and so the doctor's
 * review and the patient's copy render from one implementation and cannot
 * disagree about what was prescribed.
 *
 * Every one of them **omits what is absent** rather than printing a
 * placeholder. A prescription line reading "Dose: —" invites somebody to
 * wonder whether the dose was forgotten; a line with no dose at all reads as
 * a remedy that does not need one, which is what it is.
 */

import type { PrescriptionItemContent } from "./types";

/** "1-2 teaspoon", "1 tablet", "2", "teaspoon", or `null` when neither is set. */
export function formatDose(
  item: Pick<PrescriptionItemContent, "doseAmount" | "doseUnit">,
): string | null {
  return joinParts(item.doseAmount, item.doseUnit);
}

/** "10 tablets", "100 ml", "1 bottle", or `null`. */
export function formatQuantity(
  item: Pick<PrescriptionItemContent, "quantity" | "quantityUnit">,
): string | null {
  return joinParts(item.quantity, item.quantityUnit);
}

/**
 * The line a list or a heading shows: the name, and the form when there is
 * one. "Ashwagandha churna (Churna)" would read oddly, so it is
 * "Ashwagandha churna — Churna".
 */
export function formatMedicineHeading(
  item: Pick<PrescriptionItemContent, "medicineName" | "form" | "strength">,
): string {
  const name = item.medicineName.trim();
  const detail = joinParts(item.form, item.strength, " ");
  return detail ? `${name} — ${detail}` : name;
}

function joinParts(
  first: string,
  second: string,
  separator = " ",
): string | null {
  const a = first.trim();
  const b = second.trim();
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return `${a}${separator}${b}`;
}

/**
 * The facts worth showing beneath a medicine's name, in a fixed order, with
 * the absent ones dropped.
 *
 * Returned as pairs rather than rendered here so the doctor's review, the
 * doctor's read-only detail page and the patient's copy can present them
 * differently while showing exactly the same facts in exactly the same order.
 */
export function prescriptionItemFacts(
  item: PrescriptionItemContent,
): readonly { readonly label: string; readonly value: string }[] {
  const facts: { label: string; value: string }[] = [];

  const dose = formatDose(item);
  if (dose) facts.push({ label: "Dose", value: dose });
  if (item.frequency.trim())
    facts.push({ label: "Frequency", value: item.frequency.trim() });
  if (item.timing.trim())
    facts.push({ label: "Timing", value: item.timing.trim() });
  if (item.duration.trim())
    facts.push({ label: "Duration", value: item.duration.trim() });

  const quantity = formatQuantity(item);
  if (quantity) facts.push({ label: "Quantity", value: quantity });

  return facts;
}
