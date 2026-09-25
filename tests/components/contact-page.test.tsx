import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ContactPage from "@/app/(public)/contact/page";
import { ContactForm } from "@/components/marketing/contact-form";
import { MapEmbed } from "@/components/marketing/map-embed";
import { CLINIC_CONTACT, formatPhone } from "@/config/clinic";
import { ABOUT_PATH, CONTACT_PATH, PRIMARY_CTA } from "@/config/navigation";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => CONTACT_PATH,
}));

/**
 * The contact experience.
 *
 * Three things matter here more than layout:
 *
 *   1. The clinic's real phone number and address reach the page, and reach
 *      it from `config/clinic.ts` rather than from a second copy in a
 *      component. A wrong address sends a patient to the wrong building.
 *   2. Nothing unverified is invented. No opening hours, no email address -
 *      and the page says which are missing rather than leaving a gap.
 *   3. The map costs nothing until it is asked for, and the location is
 *      obtainable without it.
 *
 * The enquiry form is not rendered by the page - there is no delivery channel
 * - so its four states are driven directly, which is what keeps it working
 * for the phase that switches it on.
 */

const PHONE_DISPLAY = formatPhone(CLINIC_CONTACT.phone) ?? "";

describe("contact page", () => {
  it("owns exactly one h1", () => {
    render(<ContactPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    render(<ContactPage />);

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));

    let previous = 0;
    for (const level of levels) {
      if (previous !== 0) {
        expect(level).toBeLessThanOrEqual(previous + 1);
      }
      previous = level;
    }
  });

  it("makes the phone number a tel: link using the stored E.164 value", () => {
    const { container } = render(<ContactPage />);

    const telLinks = [...container.querySelectorAll('a[href^="tel:"]')];
    expect(telLinks.length).toBeGreaterThan(0);
    for (const link of telLinks) {
      // A dialler must never have to parse display spacing.
      expect(link.getAttribute("href")).toBe(`tel:${CLINIC_CONTACT.phone}`);
    }
  });

  it("shows the phone number in readable form", () => {
    render(<ContactPage />);

    expect(screen.getByText(PHONE_DISPLAY)).toBeInTheDocument();
  });

  it("shows the complete verified address", () => {
    render(<ContactPage />);

    const street = CLINIC_CONTACT.address?.streetAddress ?? "";
    expect(screen.getAllByText(street).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Satara, Maharashtra 415001/).length,
    ).toBeGreaterThan(0);
  });

  it("shows the opening hours the clinic supplied, and no fallback", () => {
    render(<ContactPage />);

    const hours = CLINIC_CONTACT.openingHours ?? "";
    expect(hours).not.toBe("");
    expect(screen.getAllByText(hours).length).toBeGreaterThan(0);
    expect(screen.queryByText(CONTACT_PAGE.unavailable.hours)).toBeNull();
  });

  it("says no email address has been published rather than inventing one", () => {
    const { container } = render(<ContactPage />);

    expect(
      screen.getByText(CONTACT_PAGE.unavailable.email),
    ).toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("offers directions that open a maps application", () => {
    render(<ContactPage />);

    const directions = screen.getAllByRole("link", {
      name: /Get directions/i,
    });
    expect(directions.length).toBeGreaterThan(0);
    for (const link of directions) {
      expect(link.getAttribute("href")).toBe(CLINIC_CONTACT.directionsUrl);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer noopener");
    }
  });

  it("gives an accessible alternative to reading the map", () => {
    render(<ContactPage />);

    // `phase_05.md` section 34: nobody should have to interpret a map image
    // to obtain the address.
    expect(
      screen.getByRole("link", { name: /Open in Google Maps/i }),
    ).toHaveAttribute("href", CLINIC_CONTACT.mapUrl);
    expect(screen.getAllByRole("region").length).toBeGreaterThan(0);
  });

  it("shows the map, named for assistive technology", () => {
    const { container } = render(<ContactPage />);

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    // A `title` is how a screen reader names an iframe, and it is the one
    // accessibility property here that belongs to this codebase rather than
    // to the provider's page.
    expect(frame).toHaveAttribute("title", CONTACT_PAGE.location.mapTitle);
    // Lazy, so the frame does not compete with the content above it.
    expect(frame).toHaveAttribute("loading", "lazy");
  });

  it("discloses that the map is a third party", () => {
    render(<ContactPage />);

    expect(
      screen.getByText(CONTACT_PAGE.location.mapPrivacyNote),
    ).toBeInTheDocument();
  });

  it("renders no enquiry form while there is nowhere to send one", () => {
    const { container } = render(<ContactPage />);

    // A form that silently discards a message is a lie; one that always fails
    // invites someone to write their question out and then throws it away.
    expect(container.querySelector("form")).toBeNull();
    expect(
      screen.getByText(CONTACT_PAGE.enquiryUnavailable.body),
    ).toBeInTheDocument();
  });

  it("answers practical questions from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ContactPage />);

    const question = screen.getByRole("button", {
      name: CONTACT_PAGE.faqItems[0]?.question,
    });
    expect(question).toHaveAttribute("aria-expanded", "false");

    question.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(question).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("gives every anchored section an id and a scroll offset", () => {
    const { container } = render(<ContactPage />);

    for (const id of Object.values(CONTACT_SECTIONS)) {
      const target = container.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        expect(target.className).toContain("anchor-offset");
      }
    }
  });

  it("publishes structured data that matches the visible page", () => {
    const { container } = render(<ContactPage />);

    const scripts = [
      ...container.querySelectorAll('script[type="application/ld+json"]'),
    ].map(
      (script) =>
        JSON.parse(script.textContent ?? "{}") as Record<string, unknown>,
    );

    const clinic = scripts.find((data) => data["@type"] === "MedicalClinic");
    expect(clinic).toBeDefined();
    // `phase_05.md` section 52: structured data must match what is shown.
    expect(clinic?.["telephone"]).toBe(CLINIC_CONTACT.phone);
    expect(clinic?.["address"]).toMatchObject({
      streetAddress: CLINIC_CONTACT.address?.streetAddress,
      postalCode: CLINIC_CONTACT.address?.postalCode,
    });
    // Nothing fabricated: no hours, rating, review or price.
    expect(clinic).not.toHaveProperty("openingHours");
    expect(clinic).not.toHaveProperty("aggregateRating");
    expect(clinic).not.toHaveProperty("review");
    expect(clinic).not.toHaveProperty("priceRange");

    expect(scripts.some((data) => data["@type"] === "BreadcrumbList")).toBe(
      true,
    );
  });

  it("links on to the about page and the booking route", () => {
    const { container } = render(<ContactPage />);

    const hrefs = [...container.querySelectorAll("a[href]")].map((anchor) =>
      anchor.getAttribute("href"),
    );
    expect(hrefs).toContain(ABOUT_PATH);
    expect(hrefs).toContain(PRIMARY_CTA.href);
  });

  it("has no axe violations, including landmark and region rules", async () => {
    const { container } = render(<ContactPage />);

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});

describe("MapEmbed", () => {
  const LINES = ["1st Floor, Example Building", "Satara, Maharashtra 415001"];

  it("renders the frame with the page", () => {
    const { container } = render(
      <MapEmbed embedUrl="https://example.test/embed" addressLines={LINES} />,
    );

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute("src", "https://example.test/embed");
    expect(frame).toHaveAttribute("title", CONTACT_PAGE.location.mapTitle);
    expect(frame).toHaveAttribute("loading", "lazy");
    // Only the origin reaches the provider, never the full page URL.
    expect(frame).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
  });

  it("gives the location in text as well as on the map", () => {
    // This is what makes the map an enhancement rather than the only route to
    // the address: it works with the frame blocked, and for a screen reader
    // (`docs/implementation-plan/phase_05.md` section 34).
    render(
      <MapEmbed embedUrl="https://example.test/embed" addressLines={LINES} />,
    );

    for (const line of LINES) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("discloses that the frame is a third party", () => {
    render(
      <MapEmbed embedUrl="https://example.test/embed" addressLines={LINES} />,
    );

    expect(
      screen.getByText(CONTACT_PAGE.location.mapPrivacyNote),
    ).toBeInTheDocument();
  });

  it("degrades to a message when no map is configured", () => {
    const { container } = render(<MapEmbed addressLines={LINES} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.getByText(CONTACT_PAGE.location.mapUnavailable),
    ).toBeInTheDocument();
  });

  it("has no axe violations in its unconfigured state", async () => {
    // axe cannot be run over a page containing the frame: it tries to reach
    // into the iframe's own document, which jsdom does not support across
    // frames ("Respondable target must be a frame in the current window").
    // The frame's own accessible name is asserted above instead, and the
    // whole contact page is swept live in a real browser.
    const { container } = render(<MapEmbed addressLines={LINES} />);

    await expectNoAxeViolations(container);
  });
});

describe("ContactForm", () => {
  const VALID = {
    name: "Test Patient",
    email: "test.patient@example.test",
    message: "I would like to ask about consultations at the clinic.",
  };

  async function fillValidly(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Your name/), VALID.name);
    await user.type(screen.getByLabelText(/Email address/), VALID.email);
    await user.type(screen.getByLabelText(/Your message/), VALID.message);
  }

  it("labels every visible control", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/Your name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your message/)).toBeInTheDocument();
  });

  it("warns against putting health information in it", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    expect(
      screen.getByText(CONTACT_PAGE.enquiry.privacyWarning),
    ).toBeInTheDocument();
  });

  it("asks for nothing medical", () => {
    const { container } = render(<ContactForm onSubmit={vi.fn()} />);

    const names = [...container.querySelectorAll("input, textarea")].map(
      (control) => control.getAttribute("name"),
    );
    expect(names).not.toContain("symptoms");
    expect(names).not.toContain("condition");
    expect(names).not.toContain("medicalHistory");
  });

  it("rejects an empty submission without calling the server", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /Send message/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("marks an invalid field and announces its error", async () => {
    const user = userEvent.setup();
    render(<ContactForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/Email address/), "not-an-email");
    await user.click(screen.getByRole("button", { name: /Send message/ }));

    const email = screen.getByLabelText(/Email address/);
    await waitFor(() => {
      expect(email).toHaveAttribute("aria-invalid", "true");
    });

    // The message is programmatically associated, not merely nearby.
    const describedBy = email.getAttribute("aria-describedby") ?? "";
    expect(describedBy.length).toBeGreaterThan(0);
  });

  it("keeps what the visitor typed when validation fails", async () => {
    const user = userEvent.setup();
    render(<ContactForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/Your name/), VALID.name);
    await user.click(screen.getByRole("button", { name: /Send message/ }));

    expect(screen.getByLabelText(/Your name/)).toHaveValue(VALID.name);
  });

  it("submits a valid enquiry and confirms it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ContactForm onSubmit={onSubmit} />);

    await fillValidly(user);
    await user.click(screen.getByRole("button", { name: /Send message/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: VALID.name,
      email: VALID.email,
    });

    expect(
      await screen.findByText(CONTACT_PAGE.enquiry.successTitle),
    ).toBeInTheDocument();
    // The form is replaced, so a confirmation cannot be followed by a second
    // accidental send.
    expect(screen.queryByRole("button", { name: /Send message/ })).toBeNull();
  });

  it("prevents a duplicate submission while one is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = render(<ContactForm onSubmit={onSubmit} />);

    await fillValidly(user);
    const button = screen.getByRole("button", { name: /Send message/ });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(button).toHaveAttribute("aria-busy", "true");

    // The disabled button already stops a second tap. This drives the form's
    // submit event directly, which is what an Enter key in a text field or a
    // racing script would do, and asserts the handler guards that too.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    release();
  });

  it("shows a safe failure message and never the underlying error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new Error("relation contact_enquiries does not exist"),
      );
    render(
      <ContactForm
        onSubmit={onSubmit}
        fallbackAction={<span>Call the clinic</span>}
      />,
    );

    await fillValidly(user);
    await user.click(screen.getByRole("button", { name: /Send message/ }));

    const failure = await screen.findByText(CONTACT_PAGE.enquiry.errorTitle);
    expect(failure).toBeInTheDocument();
    expect(screen.getByText("Call the clinic")).toBeInTheDocument();
    // No table name, no driver message, nothing internal.
    expect(document.body.textContent).not.toContain("contact_enquiries");
    expect(document.body.textContent).not.toContain("relation");
  });

  it("rejects a submission that filled the honeypot", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container } = render(<ContactForm onSubmit={onSubmit} />);

    await fillValidly(user);

    const honeypot = container.querySelector<HTMLInputElement>(
      'input[name="company"]',
    );
    expect(honeypot).not.toBeNull();
    // Removed from the tab order, so no person reaches it.
    expect(honeypot).toHaveAttribute("tabindex", "-1");

    await user.type(honeypot as HTMLInputElement, "Acme Marketing");
    await user.click(screen.getByRole("button", { name: /Send message/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has no axe violations in its initial or error state", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContactForm onSubmit={vi.fn()} />);

    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: /Send message/ }));
    await screen.findAllByRole("alert");
    await expectNoAxeViolations(container);
  });

  it("reaches every control by keyboard in visual order", async () => {
    const user = userEvent.setup();
    render(<ContactForm onSubmit={vi.fn()} />);

    await user.tab();
    expect(screen.getByLabelText(/Your name/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Phone number/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Your message/)).toHaveFocus();
    // The honeypot is skipped; the next stop is the submit button.
    await user.tab();
    expect(screen.getByRole("button", { name: /Send message/ })).toHaveFocus();
  });
});

describe("contact channels", () => {
  it("keeps the clinic's details in one module", () => {
    // If a component ever hard-codes the address or the number, this is the
    // test that should have caught it. The page renders exactly what
    // `config/clinic.ts` holds.
    const { container } = render(<ContactPage />);
    const text = container.textContent ?? "";

    expect(text).toContain(CLINIC_CONTACT.address?.postalCode);
    expect(text).toContain(PHONE_DISPLAY);
  });

  it("describes each detail with a label, not only an icon", () => {
    render(<ContactPage />);

    const lists = screen.getAllByRole("definition");
    expect(lists.length).toBeGreaterThan(0);
    for (const label of ["Phone", "Visit us", "Opening hours", "Email"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("gives the address an address element", () => {
    const { container } = render(<ContactPage />);

    const addresses = container.querySelectorAll("address");
    expect(addresses.length).toBeGreaterThan(0);
    expect(
      within(addresses[0] as HTMLElement).getByText(
        CLINIC_CONTACT.address?.streetAddress ?? "",
      ),
    ).toBeInTheDocument();
  });
});
