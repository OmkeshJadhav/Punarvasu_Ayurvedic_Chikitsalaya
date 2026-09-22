import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { MIN_TOUCH_TARGET_PX } from "@/config/design-tokens";

import { expectNoAxeViolations } from "../support/axe";

describe("Button", () => {
  it("renders a real button element with its label as the accessible name", () => {
    render(<Button>Book a Consultation</Button>);

    const button = screen.getByRole("button", { name: "Book a Consultation" });
    expect(button.tagName).toBe("BUTTON");
  });

  it("defaults to type=button so it cannot submit a form by accident", () => {
    render(<Button>Save Changes</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("respects an explicit type", () => {
    render(<Button type="submit">Confirm Appointment</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("activates on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>View Treatment</Button>);

    const button = screen.getByRole("button");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Native button semantics: both keys activate. This is the whole reason a
    // clickable <div> is forbidden.
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    render(<Button>Book a Consultation</Button>);

    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  describe("disabled", () => {
    it("does not fire its handler", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick}>
          Save Changes
        </Button>,
      );

      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("is exposed as disabled to assistive technology", () => {
      render(<Button disabled>Save Changes</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("loading", () => {
    it("blocks a second submission", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Confirm Appointment
        </Button>,
      );

      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("announces itself as busy", () => {
      render(<Button loading>Confirm Appointment</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
    });

    it("swaps the label so the accessible name describes the current state", () => {
      render(
        <Button loading loadingLabel="Confirming...">
          Confirm Appointment
        </Button>,
      );

      expect(
        screen.getByRole("button", { name: "Confirming..." }),
      ).toBeInTheDocument();
    });

    it("keeps the original label when no loading label is given", () => {
      render(<Button loading>Confirm Appointment</Button>);

      expect(
        screen.getByRole("button", { name: "Confirm Appointment" }),
      ).toBeInTheDocument();
    });
  });

  describe("asChild", () => {
    it("projects its styling onto a link and keeps the link role", () => {
      render(
        <Button asChild>
          <a href="/treatments">View Treatments</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "View Treatments" });
      expect(link).toHaveAttribute("href", "/treatments");
      // `disabled` is meaningless on an anchor and must not be emitted.
      expect(link).not.toHaveAttribute("disabled");
      expect(link).not.toHaveAttribute("type");
    });

    it("marks a projected element inoperable with ARIA rather than `disabled`", () => {
      render(
        <Button asChild loading>
          <a href="/treatments">View Treatments</a>
        </Button>,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).toHaveAttribute("aria-busy", "true");
    });
  });

  it("requires an accessible name for an icon-only button", () => {
    render(
      <Button size="icon" aria-label="Call the clinic">
        <svg />
      </Button>,
    );

    expect(
      screen.getByRole("button", { name: "Call the clinic" }),
    ).toBeInTheDocument();
  });

  it("every size requests at least the minimum touch target", () => {
    // jsdom has no layout, so the class - which is what produces the size - is
    // the only observable fact. The token keeps the two in step.
    expect(MIN_TOUCH_TARGET_PX).toBe(44);

    const { container } = render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Icon">
          <svg />
        </Button>
      </>,
    );

    const classes = [...container.querySelectorAll("button")].map(
      (button) => button.className,
    );
    // min-h-11 and size-11 are both 44px on the 4px spacing scale; min-h-13 is 52px.
    expect(classes[0]).toMatch(/min-h-11/);
    expect(classes[1]).toMatch(/min-h-11/);
    expect(classes[2]).toMatch(/min-h-13/);
    expect(classes[3]).toMatch(/size-11/);
  });

  it("lets a caller override a default without a specificity fight", () => {
    render(<Button className="px-10">Book a Consultation</Button>);

    const className = screen.getByRole("button").className;
    expect(className).toContain("px-10");
    expect(className).not.toContain("px-5");
  });

  it("has no axe violations across its variants", async () => {
    const { container } = render(
      <>
        <Button>Book a Consultation</Button>
        <Button variant="secondary">View Treatments</Button>
        <Button variant="outline">Save Changes</Button>
        <Button variant="ghost">View Appointment</Button>
        <Button variant="link">View all</Button>
        <Button variant="destructive">Cancel Appointment</Button>
        <Button disabled>Disabled</Button>
        <Button loading loadingLabel="Booking...">
          Book
        </Button>
        <Button size="icon" aria-label="Call the clinic">
          <svg />
        </Button>
      </>,
    );

    await expectNoAxeViolations(container);
  });
});
