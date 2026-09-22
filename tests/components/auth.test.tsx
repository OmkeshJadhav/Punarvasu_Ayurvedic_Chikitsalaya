import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { PasswordField } from "@/components/auth/password-field";
import { PASSWORD_VISIBILITY } from "@/features/auth/content";
import {
  authFormError,
  authFormSuccess,
  firstFieldMessages,
  IDLE_AUTH_FORM_STATE,
} from "@/features/auth/types";
import { expectNoAxeViolations } from "../support/axe";

/**
 * Component tests for the authentication UI.
 *
 * The forms themselves are exercised through the pieces that carry the
 * accessibility contract - the password field, the form-level message and the
 * page heading - rather than by mounting a form bound to a server action,
 * which jsdom cannot dispatch. The action layer is covered by the integration
 * tests; what is asserted here is what a keyboard and a screen reader meet.
 */

describe("PasswordField", () => {
  it("has a visible label bound to the input", async () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    expect(input).toBeInTheDocument();
    // Not a placeholder-only label.
    expect(screen.getByText("Password")).toBeVisible();
  });

  it("starts hidden", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
  });

  it("reveals and re-hides the password from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    const toggle = screen.getByRole("button", {
      name: PASSWORD_VISIBILITY.show,
    });

    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");

    // The accessible name changes with the state, so re-reading the control
    // tells a screen-reader user where they are.
    const hideToggle = screen.getByRole("button", {
      name: PASSWORD_VISIBILITY.hide,
    });
    expect(hideToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(hideToggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("is operable with Enter and Space", async () => {
    const user = userEvent.setup();
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });

    await user.tab(); // into the input
    await user.tab(); // onto the toggle
    expect(screen.getByRole("button", { name: /password/i })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "text");

    await user.keyboard(" ");
    expect(input).toHaveAttribute("type", "password");
  });

  it("does not submit the form it is inside", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();

    render(
      <form onSubmit={onSubmit}>
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: /show password/i }));

    // Without `type="button"` this would default to submit, and revealing a
    // password would attempt to sign the user in.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("associates an error with the input and announces it", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        error="Please use at least 10 characters."
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    const alert = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(alert).toHaveTextContent("Please use at least 10 characters.");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("associates the requirement text with the input", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        description="At least 10 characters."
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    const description = screen.getByText("At least 10 characters.");

    // The requirement has to be readable by a screen reader at the field, not
    // only visible beside it.
    expect(input.getAttribute("aria-describedby")).toContain(description.id);
  });

  it("carries the autocomplete token a password manager needs", () => {
    const { rerender } = render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
      />,
    );
    expect(
      screen.getByLabelText(/password/i, { selector: "input" }),
    ).toHaveAttribute("autocomplete", "current-password");

    rerender(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );
    expect(
      screen.getByLabelText(/password/i, { selector: "input" }),
    ).toHaveAttribute("autocomplete", "new-password");
  });

  it("never blocks paste", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
      />,
    );

    const input = screen.getByLabelText(/password/i, { selector: "input" });
    // `docs/SECURITY.md` section 5: password managers must work.
    expect(input).not.toHaveAttribute("onpaste");
    expect(input).not.toHaveAttribute("oncopy");
  });

  it("disables both the input and the toggle while submitting", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        disabled
      />,
    );

    expect(
      screen.getByLabelText(/password/i, { selector: "input" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /show password/i }),
    ).toBeDisabled();
  });

  it("has no axe violations, in either state", async () => {
    const { container } = render(
      <PasswordField
        name="password"
        label="Password"
        description="At least 10 characters."
        autoComplete="new-password"
        error="Please use at least 10 characters."
      />,
    );

    await expectNoAxeViolations(container);
  });
});

describe("AuthFormMessage", () => {
  it("renders nothing while idle", () => {
    const { container } = render(
      <AuthFormMessage state={IDLE_AUTH_FORM_STATE} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a failure immediately", () => {
    render(
      <AuthFormMessage
        state={authFormError("The email or password is incorrect.")}
      />,
    );

    // `role="alert"` interrupts, which is right for a failure the user has to
    // act on.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The email or password is incorrect.");
  });

  it("announces a success politely", () => {
    render(
      <AuthFormMessage
        state={authFormSuccess(
          "If an account exists, we've sent instructions.",
        )}
      />,
    );

    // `role="status"` waits for a pause rather than interrupting.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("If an account exists");
  });

  it("never renders provider text, because it renders only what it is given", () => {
    render(
      <AuthFormMessage
        state={authFormError("We couldn't sign you in. Please try again.")}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toMatch(/AuthApiError|supabase|postgres/i);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <AuthFormMessage state={authFormError("Something went wrong.")} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("AuthPageHeading", () => {
  it("renders exactly one h1", () => {
    render(
      <AuthPageHeading
        title="Welcome back"
        description="Sign in to continue to Punarvasu."
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Welcome back");
  });

  it("renders without a description", () => {
    render(<AuthPageHeading title="Check your email" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Check your email" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <AuthPageHeading title="Welcome back" description="Sign in." />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("form state helpers", () => {
  it("never carries a password in the values it returns", () => {
    const state = authFormError("Please check the details below.", {
      values: { email: "patient@example.test" },
    });

    // Echoing a password would put it into the flight payload and the DOM.
    expect(JSON.stringify(state)).not.toContain("password");
  });

  it("reduces each field to a single message", () => {
    expect(
      firstFieldMessages({
        email: ["Enter a valid email address.", "That address is too long."],
        password: ["Please use at least 10 characters."],
      }),
    ).toEqual({
      email: "Enter a valid email address.",
      password: "Please use at least 10 characters.",
    });
  });

  it("returns undefined when there is nothing to show", () => {
    expect(firstFieldMessages(undefined)).toBe(undefined);
    expect(firstFieldMessages({})).toBe(undefined);
  });
});

describe("an assembled authentication card", () => {
  it("has no axe violations and a sane heading order", async () => {
    const { container } = render(
      <main>
        <AuthPageHeading
          title="Create your account"
          description="An account keeps your appointments in one place."
        />
        <AuthFormMessage
          state={authFormError("Please check the details below and try again.")}
        />
        <form>
          <PasswordField
            name="password"
            label="Password"
            description="At least 10 characters."
            autoComplete="new-password"
          />
          <PasswordField
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            error="The two passwords don't match."
          />
        </form>
      </main>,
    );

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });

    // Two password fields on one page: their ids and their describedby targets
    // must not collide, or one field's error is announced for the other.
    const main = within(container);
    const inputs = main
      .getAllByLabelText(/password/i, { selector: "input" })
      .map((input) => input.id);
    expect(new Set(inputs).size).toBe(inputs.length);
  });
});
