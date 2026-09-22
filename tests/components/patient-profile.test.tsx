import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileCompletenessPanel } from "@/components/patient/profile-completeness";
import { ProfileForm } from "@/components/patient/profile-form";
import { ProfileSummary } from "@/components/patient/profile-summary";
import { PatientNav } from "@/components/patient/patient-nav";
import { evaluateCompleteness } from "@/features/patients/completeness";
import {
  EMERGENCY_CONTACT_DISCLAIMER,
  PROFILE_COPY,
} from "@/features/patients/content";
import type { PatientProfile } from "@/features/patients/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * Patient profile UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * every control has a real label — a form a patient cannot navigate with a
 *     screen reader is a form they cannot correct their own records with;
 *   * errors are associated with their field and announced;
 *   * a name containing markup is displayed, not executed;
 *   * no internal identifier is rendered anywhere;
 *   * the emergency-contact disclaimer is present, because a patient who
 *     believes it is monitored may rely on it when it matters.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient/profile",
}));

const PROFILE: PatientProfile = {
  fullName: "Test Patient",
  preferredName: "Testy",
  phone: "9999999999",
  dateOfBirth: "1990-04-07",
  gender: "female",
  addressLine1: "1 Example Road",
  addressLine2: null,
  city: "Pune",
  state: "Maharashtra",
  postalCode: "411001",
  emergencyContactName: "Test Contact",
  emergencyContactRelationship: "Spouse",
  emergencyContactPhone: "9999999998",
  preferredLanguage: "Marathi",
  createdAt: "2026-09-18T10:00:00.000Z",
};

const EMPTY_PROFILE: PatientProfile = {
  ...PROFILE,
  fullName: "Test Patient",
  preferredName: null,
  phone: null,
  dateOfBirth: null,
  gender: null,
  addressLine1: null,
  city: null,
  state: null,
  postalCode: null,
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactPhone: null,
  preferredLanguage: null,
};

const noopAction = () => {};

/**
 * Renders the form on its own — never inside another `<form>`.
 *
 * That is not a testing convenience, it is the regression: an earlier revision
 * had the caller wrap this component in a form, and the resulting nested form
 * submitted by GET with every profile field in the query string. The wrapper
 * is gone here so a test cannot accidentally recreate the shape that broke.
 */
function renderForm(
  props: Partial<React.ComponentProps<typeof ProfileForm>> = {},
) {
  return render(
    <ProfileForm
      formAction={noopAction}
      profile={PROFILE}
      email="patient@example.test"
      fieldErrors={undefined}
      submittedValues={undefined}
      pending={false}
      submitLabel={PROFILE_COPY.saveLabel}
      submittingLabel={PROFILE_COPY.savingLabel}
      {...props}
    />,
  );
}

describe("ProfileSummary", () => {
  it("shows the patient's details in readable groups", () => {
    render(<ProfileSummary profile={PROFILE} email="patient@example.test" />);

    expect(
      screen.getByRole("heading", { name: "Personal information" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Contact information" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Address" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Emergency contact" }),
    ).toBeInTheDocument();
  });

  it("formats the date of birth without shifting it", () => {
    render(<ProfileSummary profile={PROFILE} email="patient@example.test" />);

    expect(screen.getByText("7 April 1990")).toBeInTheDocument();
  });

  it("says 'Not provided' rather than leaving a value blank", () => {
    render(
      <ProfileSummary profile={EMPTY_PROFILE} email="patient@example.test" />,
    );

    // A blank cell is indistinguishable from a rendering failure.
    expect(
      screen.getAllByText(PROFILE_COPY.notProvided).length,
    ).toBeGreaterThan(0);
  });

  it("renders a name containing markup as text", async () => {
    const { container } = render(
      <ProfileSummary
        profile={{ ...PROFILE, fullName: "<script>alert('x')</script>" }}
        email="patient@example.test"
      />,
    );

    expect(screen.getByText("<script>alert('x')</script>")).toBeInTheDocument();
    // The characters are on the page; no element was created from them.
    expect(container.querySelector("script")).toBeNull();
  });

  it("carries the emergency contact disclaimer", () => {
    render(<ProfileSummary profile={PROFILE} email="patient@example.test" />);

    expect(screen.getByText(EMERGENCY_CONTACT_DISCLAIMER)).toBeInTheDocument();
  });

  it("renders no internal identifier", () => {
    const { container } = render(
      <ProfileSummary profile={PROFILE} email="patient@example.test" />,
    );

    const text = container.textContent ?? "";
    expect(text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(text).not.toContain("profile_id");
    expect(text).not.toContain("updated_at");
  });

  it("lets a long unbreakable value shrink instead of widening the page", () => {
    /*
      jsdom has no layout engine, so this asserts the mechanism rather than the
      pixels — the pixels are measured in a real browser. The defect it guards
      against was measured: a long email address set the min-content width of a
      flex item, which has `min-width: auto`, and the profile page overflowed
      horizontally at 320px. `min-width: 0` lets the item shrink, and
      `overflow-wrap: anywhere` (not `break-word`, which does not affect
      min-content) lets the address itself break.
    */
    const { container } = render(
      <ProfileSummary
        profile={PROFILE}
        email="a.very.long.address.that.cannot.break@example.test"
      />,
    );

    const section = container.querySelector("section");
    expect(section?.className).toContain("min-w-0");

    const value = screen.getByText(
      "a.very.long.address.that.cannot.break@example.test",
    );
    expect(value.className).toContain("min-w-0");
    expect(value.className).toContain("[overflow-wrap:anywhere]");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProfileSummary profile={PROFILE} email="patient@example.test" />,
    );

    await expectNoAxeViolations(container);
  });
});

describe("ProfileForm", () => {
  it("renders exactly one form, and it carries an action", () => {
    /*
      The regression test for the defect that made this phase's worst bug.
      Two nested forms are invalid HTML; after hydration the inner one owns the
      inputs, and an inner form with no action submits by GET — which put the
      patient's name, date of birth, phone number and address into the URL
      (`phase_07.md` section 83). One form, with an action, is the invariant.
    */
    const { container } = renderForm();

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]).toContainElement(screen.getByLabelText(/^Full name/));
    // React sets a function `action` as a property, not an attribute, so the
    // assertion is that the browser default (GET to the current URL) has been
    // replaced rather than left in place.
    expect(forms[0]).not.toHaveAttribute("method", "get");
  });

  it("gives every control a visible label", () => {
    renderForm();

    for (const label of [
      "Full name",
      "Preferred name",
      "Date of birth",
      "Gender",
      "Preferred language",
      "Mobile number",
      "Address line 1",
      "Address line 2",
      "City",
      "State",
      "Postal code",
      "Contact's full name",
      "Relationship to you",
      "Contact's mobile number",
    ]) {
      // `getByLabelText` fails unless a real label is bound to a real control.
      expect(
        screen.getByLabelText(new RegExp(`^${label}`)),
      ).toBeInTheDocument();
    }
  });

  it("marks only the name as required", () => {
    renderForm();

    expect(screen.getByLabelText(/^Full name/)).toBeRequired();
    expect(screen.getByLabelText(/^Mobile number/)).not.toBeRequired();
    expect(screen.getByLabelText(/^Date of birth/)).not.toBeRequired();
  });

  it("fills controls from the stored record", () => {
    renderForm();

    expect(screen.getByLabelText(/^Full name/)).toHaveValue("Test Patient");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Pune");
    expect(screen.getByLabelText(/^Date of birth/)).toHaveValue("1990-04-07");
    expect(screen.getByLabelText(/^Gender/)).toHaveValue("female");
  });

  it("prefers a returned submission over the stored record", () => {
    // A failed save must not silently revert what the patient typed.
    renderForm({
      submittedValues: { fullName: "Corrected Name", city: "Mumbai" },
    });

    expect(screen.getByLabelText(/^Full name/)).toHaveValue("Corrected Name");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Mumbai");
  });

  it("keeps a field the patient deliberately cleared cleared", () => {
    renderForm({ submittedValues: { city: "" } });

    expect(screen.getByLabelText(/^City/)).toHaveValue("");
  });

  it("associates a field error with its control and announces it", () => {
    renderForm({
      fieldErrors: { phone: "Enter a valid 10-digit mobile number." },
    });

    const phone = screen.getByLabelText(/^Mobile number/);
    expect(phone).toHaveAttribute("aria-invalid", "true");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid 10-digit mobile number.");
    // The message is reachable from the control, not merely near it.
    expect(phone.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("offers an explicit way back to 'not specified' for gender", async () => {
    // Nothing about gender may be a one-way door.
    renderForm();

    const gender = screen.getByLabelText(/^Gender/);
    await userEvent.selectOptions(gender, "");
    expect(gender).toHaveValue("");
  });

  it("bounds the date input at both ends", () => {
    renderForm();

    const dob = screen.getByLabelText(/^Date of birth/);
    expect(dob).toHaveAttribute("type", "date");
    expect(dob).toHaveAttribute("min", "1900-01-01");
    expect(dob).toHaveAttribute("max");
  });

  it("shows the email address without offering to edit it", () => {
    renderForm();

    expect(screen.getByText("patient@example.test")).toBeInTheDocument();
    // No control is bound to an email label — it is the account identity.
    expect(screen.queryByLabelText(/^Email address/)).toBeNull();
  });

  it("has no field for clinical information", () => {
    renderForm();

    for (const label of [
      /symptom/i,
      /diagnos/i,
      /medication/i,
      /allerg/i,
      /medical history/i,
      /prescription/i,
      /blood group/i,
    ]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  });

  it("tells the patient not to record health information here", () => {
    renderForm();

    expect(
      screen.getByText(/don't record anything about your health here/i),
    ).toBeInTheDocument();
  });

  it("disables submission while a save is in flight", () => {
    renderForm({ pending: true });

    const submit = screen.getByRole("button", {
      name: PROFILE_COPY.savingLabel,
    });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
  });

  it("offers Cancel only where there is something to cancel back to", () => {
    renderForm({ onCancel: () => {} });
    expect(
      screen.getByRole("button", { name: PROFILE_COPY.cancelLabel }),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: PROFILE_COPY.cancelLabel });
  });

  it("omits Cancel during onboarding", () => {
    renderForm({ profile: null });

    expect(
      screen.queryByRole("button", { name: PROFILE_COPY.cancelLabel }),
    ).toBeNull();
  });

  it("reports whether anything changed when Cancel is pressed", async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });

    await userEvent.click(
      screen.getByRole("button", { name: PROFILE_COPY.cancelLabel }),
    );
    expect(onCancel).toHaveBeenLastCalledWith(false);

    await userEvent.type(screen.getByLabelText(/^City/), "x");
    await userEvent.click(
      screen.getByRole("button", { name: PROFILE_COPY.cancelLabel }),
    );
    // Dirty, so the caller can ask before discarding.
    expect(onCancel).toHaveBeenLastCalledWith(true);
  });

  it("is operable from the keyboard alone", async () => {
    renderForm();

    const name = screen.getByLabelText(/^Full name/);
    name.focus();
    expect(name).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByLabelText(/^Preferred name/)).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderForm();

    await expectNoAxeViolations(container);
  });

  it("has no accessibility violations while showing errors", async () => {
    const { container } = renderForm({
      fieldErrors: {
        fullName: "Your full name is required.",
        phone: "Enter a valid 10-digit mobile number.",
      },
    });

    await expectNoAxeViolations(container);
  });
});

describe("ProfileCompletenessPanel", () => {
  it("reports the value as text as well as a bar", () => {
    render(
      <ProfileCompletenessPanel completeness={evaluateCompleteness(PROFILE)} />,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    // Never carried by the coloured strip alone.
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("lists what is missing, with a reason for each", () => {
    render(
      <ProfileCompletenessPanel
        completeness={evaluateCompleteness(EMPTY_PROFILE)}
      />,
    );

    const list = screen.getByRole("list");
    expect(
      within(list).getByText("Add your mobile number"),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(/reach you about an appointment/i),
    ).toBeInTheDocument();
  });

  it("confirms a complete profile rather than inventing something to ask for", () => {
    render(
      <ProfileCompletenessPanel completeness={evaluateCompleteness(PROFILE)} />,
    );

    expect(
      screen.getByText(PROFILE_COPY.completenessComplete),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProfileCompletenessPanel
        completeness={evaluateCompleteness(EMPTY_PROFILE)}
      />,
    );

    await expectNoAxeViolations(container);
  });
});

describe("PatientNav", () => {
  it("marks the current page for assistive technology", () => {
    render(<PatientNav label="Patient area" />);

    const current = screen.getByRole("link", { name: "Profile" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not advertise sections that do not exist", () => {
    render(<PatientNav label="Patient area" />);

    // Six, as of Phase 14: Overview, Appointments, Prescriptions, Treatment
    // plans, Documents, Profile. Each moved from the "does not exist" list to
    // the "does" list in the same change that built the screens behind it,
    // which is the point of this assertion — a link is offered exactly when
    // there is something to link to (`phase_07.md` section 62).
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Appointments" })).toHaveAttribute(
      "href",
      "/patient/appointments",
    );
    expect(screen.getByRole("link", { name: "Prescriptions" })).toHaveAttribute(
      "href",
      "/patient/prescriptions",
    );
    expect(
      screen.getByRole("link", { name: "Treatment plans" }),
    ).toHaveAttribute("href", "/patient/treatment-plans");

    // Phase 14. Moved from the "still absent" list to this one in the same
    // change that built `/patient/documents`.
    expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute(
      "href",
      "/patient/documents",
    );

    // Still absent, because they still do not exist. Notifications are
    // Phase 15's and there is no billing surface at all.
    expect(screen.queryByRole("link", { name: /notification/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /billing|invoice/i })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PatientNav label="Patient area" />);

    await expectNoAxeViolations(container);
  });
});
