import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { expectNoAxeViolations } from "../support/axe";

describe("Field", () => {
  it("binds a visible label to the control", () => {
    render(
      <Field name="email" label="Email address">
        {(control) => <Input type="email" {...control} />}
      </Field>,
    );

    // getByLabelText only resolves through a real label association.
    const input = screen.getByLabelText("Email address");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("Email address")).toBeVisible();
  });

  it("does not rely on a placeholder for the label", () => {
    render(
      <Field name="email" label="Email address">
        {(control) => (
          <Input type="email" placeholder="you@example.com" {...control} />
        )}
      </Field>,
    );

    const input = screen.getByLabelText("Email address");
    // The placeholder is a hint in addition to the label, never instead of it.
    expect(input).toHaveAttribute("placeholder", "you@example.com");
  });

  it("associates a description through aria-describedby", () => {
    render(
      <Field
        name="email"
        label="Email address"
        description="We'll use this email for appointment communication."
      >
        {(control) => <Input {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
      "We'll use this email for appointment communication.",
    );
  });

  it("does not reference a description element that is not rendered", () => {
    render(
      <Field name="email" label="Email address">
        {(control) => <Input {...control} />}
      </Field>,
    );

    // A dangling aria-describedby is an axe violation and confuses a screen
    // reader, so the attribute must be absent rather than pointing at nothing.
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  describe("error state", () => {
    it("associates the message with the control", () => {
      render(
        <Field
          name="phone"
          label="Mobile number"
          error="Please enter a valid mobile number."
        >
          {(control) => <Input {...control} />}
        </Field>,
      );

      expect(
        screen.getByLabelText("Mobile number"),
      ).toHaveAccessibleDescription("Please enter a valid mobile number.");
    });

    it("marks the control invalid rather than relying on colour", () => {
      render(
        <Field
          name="phone"
          label="Mobile number"
          error="Please enter a valid mobile number."
        >
          {(control) => <Input {...control} />}
        </Field>,
      );

      expect(screen.getByLabelText("Mobile number")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    it("announces the message as an alert", () => {
      render(
        <Field
          name="phone"
          label="Mobile number"
          error="Please enter a valid mobile number."
        >
          {(control) => <Input {...control} />}
        </Field>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter a valid mobile number.",
      );
    });

    it("keeps both the description and the error in the accessible description", () => {
      render(
        <Field
          name="phone"
          label="Mobile number"
          description="We'll send appointment reminders here."
          error="Please enter a valid mobile number."
        >
          {(control) => <Input {...control} />}
        </Field>,
      );

      const input = screen.getByLabelText("Mobile number");
      expect(input).toHaveAccessibleDescription(
        "We'll send appointment reminders here. Please enter a valid mobile number.",
      );
    });

    it("has no error state when no message is given", () => {
      render(
        <Field name="phone" label="Mobile number">
          {(control) => <Input {...control} />}
        </Field>,
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Mobile number")).not.toHaveAttribute(
        "aria-invalid",
      );
    });
  });

  describe("required", () => {
    it("marks the control required and gives the asterisk a text alternative", () => {
      render(
        <Field name="fullName" label="Full name" required>
          {(control) => <Input {...control} />}
        </Field>,
      );

      const input = screen.getByLabelText(/Full name/);
      expect(input).toBeRequired();
      expect(screen.getByText("(required)")).toBeInTheDocument();
    });
  });

  it("disables the control when the field is disabled", () => {
    render(
      <Field name="notes" label="Notes" disabled>
        {(control) => <Input {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText("Notes")).toBeDisabled();
  });

  it("generates unique ids so two fields with the same name do not collide", () => {
    render(
      <>
        <Field name="email" label="Patient email">
          {(control) => <Input {...control} />}
        </Field>
        <Field name="email" label="Guardian email">
          {(control) => <Input {...control} />}
        </Field>
      </>,
    );

    const first = screen.getByLabelText("Patient email");
    const second = screen.getByLabelText("Guardian email");
    expect(first.id).not.toBe(second.id);
    // The submitted name is shared on purpose; only the DOM id differs.
    expect(first).toHaveAttribute("name", "email");
    expect(second).toHaveAttribute("name", "email");
  });

  it("supports typing and keyboard navigation between fields", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Field name="fullName" label="Full name">
          {(control) => <Input {...control} />}
        </Field>
        <Field name="notes" label="Notes">
          {(control) => <Textarea {...control} />}
        </Field>
      </form>,
    );

    await user.tab();
    const name = screen.getByLabelText("Full name");
    expect(name).toHaveFocus();
    await user.keyboard("Asha");
    expect(name).toHaveValue("Asha");

    await user.tab();
    expect(screen.getByLabelText("Notes")).toHaveFocus();
  });

  it("has no axe violations, including in its error state", async () => {
    const { container } = render(
      <form>
        <Field
          name="email"
          label="Email address"
          description="We'll use this email for appointment communication."
          required
        >
          {(control) => (
            <Input type="email" autoComplete="email" {...control} />
          )}
        </Field>
        <Field
          name="phone"
          label="Mobile number"
          error="Please enter a valid mobile number."
          required
        >
          {(control) => <Input type="tel" {...control} />}
        </Field>
        <Field name="notes" label="Notes" disabled>
          {(control) => <Textarea {...control} />}
        </Field>
      </form>,
    );

    await expectNoAxeViolations(container);
  });
});

/**
 * Every `Field` is rendered from a client component.
 *
 * `Field` is a client component whose `children` is a render prop, and a
 * function cannot cross the server/client boundary. Rendering one from a
 * server component therefore type-checks, lints, builds and passes every unit
 * test - and then throws "Functions are not valid as a child of Client
 * Components" the first time a browser asks for the page. Nothing else in the
 * suite can see that, because a component test renders the component directly
 * and never crosses the boundary that breaks.
 *
 * This is the cheap structural check that does see it: if a module imports
 * `Field`, that module must declare `"use client"`. It caught the front-desk
 * schedule filters, which had been written as a server component precisely
 * because they need no JavaScript.
 */
describe("Field callers", () => {
  // `process.cwd()` rather than `import.meta.url`: this project runs under
  // jsdom, where `import.meta.url` is not a `file:` URL.
  const SRC = resolve(process.cwd(), "src");

  function modulesImportingField(): string[] {
    return readdirSync(SRC, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
      .filter((entry) =>
        readFileSync(`${SRC}/${entry}`, "utf8").includes(
          "@/components/ui/field",
        ),
      )
      .map((entry) => entry.replaceAll("\\", "/"));
  }

  it("finds the callers at all, so a passing list is not an empty one", () => {
    expect(modulesImportingField().length).toBeGreaterThan(5);
  });

  it.each(modulesImportingField())('%s declares "use client"', (module) => {
    const source = readFileSync(`${SRC}/${module}`, "utf8");

    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });
});
