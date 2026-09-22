import { describe, expect, it } from "vitest";
import {
  formatDose,
  formatMedicineHeading,
  formatQuantity,
  prescriptionItemFacts,
} from "./format";
import { EMPTY_PRESCRIPTION_ITEM } from "./types";

/**
 * Rendering a prescription item.
 *
 * The property that matters throughout: **what is absent is omitted, never
 * filled in with a placeholder**. A line reading "Dose: —" invites somebody to
 * wonder whether the dose was forgotten; a line with no dose at all reads as a
 * remedy that does not need one, which is what it is.
 */

describe("the dose", () => {
  it("joins an amount and a unit", () => {
    expect(formatDose({ doseAmount: "1", doseUnit: "teaspoon" })).toBe(
      "1 teaspoon",
    );
  });

  it("keeps the shorthand a practitioner writes", () => {
    expect(formatDose({ doseAmount: "1/2", doseUnit: "teaspoon" })).toBe(
      "1/2 teaspoon",
    );
    expect(formatDose({ doseAmount: "1-2", doseUnit: "tablet" })).toBe(
      "1-2 tablet",
    );
  });

  it("renders whichever half exists on its own", () => {
    expect(formatDose({ doseAmount: "", doseUnit: "as directed" })).toBe(
      "as directed",
    );
    expect(formatDose({ doseAmount: "2", doseUnit: "" })).toBe("2");
  });

  it("is absent when neither is recorded", () => {
    expect(formatDose({ doseAmount: "", doseUnit: "" })).toBeNull();
    expect(formatDose({ doseAmount: "  ", doseUnit: "\t" })).toBeNull();
  });
});

describe("the quantity", () => {
  it("joins an amount and a unit", () => {
    expect(formatQuantity({ quantity: "10", quantityUnit: "tablets" })).toBe(
      "10 tablets",
    );
    expect(formatQuantity({ quantity: "1", quantityUnit: "bottle" })).toBe(
      "1 bottle",
    );
  });

  it("is absent for a therapy that has no quantity", () => {
    expect(formatQuantity({ quantity: "", quantityUnit: "" })).toBeNull();
  });
});

describe("the heading", () => {
  it("is the name alone when there is nothing else", () => {
    expect(
      formatMedicineHeading({
        medicineName: "Ashwagandha churna",
        form: "",
        strength: "",
      }),
    ).toBe("Ashwagandha churna");
  });

  it("adds the form and the strength when they are recorded", () => {
    expect(
      formatMedicineHeading({
        medicineName: "Triphala",
        form: "Tablet",
        strength: "500 mg",
      }),
    ).toBe("Triphala — Tablet 500 mg");
  });

  it("adds whichever of the two exists", () => {
    expect(
      formatMedicineHeading({
        medicineName: "Dashamoola",
        form: "Kashaya",
        strength: "",
      }),
    ).toBe("Dashamoola — Kashaya");
  });
});

describe("the facts beneath a medicine", () => {
  it("are in a fixed order, so two prescriptions read the same way", () => {
    const facts = prescriptionItemFacts({
      ...EMPTY_PRESCRIPTION_ITEM,
      medicineName: "Ashwagandha churna",
      doseAmount: "1",
      doseUnit: "teaspoon",
      frequency: "Twice daily",
      timing: "After meals",
      duration: "2 weeks",
      quantity: "100",
      quantityUnit: "g",
    });

    expect(facts.map((fact) => fact.label)).toEqual([
      "Dose",
      "Frequency",
      "Timing",
      "Duration",
      "Quantity",
    ]);
  });

  it("omits every fact that was not recorded", () => {
    const facts = prescriptionItemFacts({
      ...EMPTY_PRESCRIPTION_ITEM,
      medicineName: "Abhyanga",
      frequency: "Weekly",
    });

    expect(facts).toEqual([{ label: "Frequency", value: "Weekly" }]);
  });

  it("returns nothing at all for a remedy with no structured detail", () => {
    // A therapy prescribed with only a free-text instruction is a real case,
    // and it must render as that instruction rather than as five empty rows.
    expect(
      prescriptionItemFacts({
        ...EMPTY_PRESCRIPTION_ITEM,
        medicineName: "Shirodhara",
        instructions: "As arranged with the clinic.",
      }),
    ).toEqual([]);
  });
});
