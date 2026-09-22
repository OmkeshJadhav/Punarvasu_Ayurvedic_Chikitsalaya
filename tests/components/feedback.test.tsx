import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  CardListLoading,
  PageLoading,
  SectionLoading,
} from "@/components/shared/loading-state";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Toaster, useToast } from "@/components/ui/toast";

import { expectNoAxeViolations } from "../support/axe";

describe("StatusBadge", () => {
  it("renders the status as text, not only as a colour", () => {
    render(<StatusBadge status="confirmed" />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("pairs every status with an icon", () => {
    const { container } = render(
      <>
        <StatusBadge status="confirmed" />
        <StatusBadge status="pending" />
        <StatusBadge status="cancelled" />
        <StatusBadge status="draft" />
      </>,
    );

    // Colour plus text plus shape: readable when printed in greyscale.
    expect(container.querySelectorAll("svg")).toHaveLength(4);
  });

  it("allows a custom label while keeping the status tone and icon", () => {
    render(<StatusBadge status="pending" label="Awaiting payment" />);
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
  });

  it("hides a decorative icon from assistive technology", () => {
    const { container } = render(<Badge icon={<svg />}>Seasonal</Badge>);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <>
        <StatusBadge status="confirmed" />
        <StatusBadge status="missed" />
        <Badge tone="primary">Seasonal</Badge>
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("Alert", () => {
  it("announces an urgent tone as an alert", () => {
    render(<Alert tone="danger" title="We couldn't save your changes" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't save your changes",
    );
  });

  it("announces a non-urgent tone as a status, so it waits its turn", () => {
    render(<Alert tone="success" title="Appointment confirmed" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Appointment confirmed",
    );
  });

  it("has no axe violations across tones", async () => {
    const { container } = render(
      <>
        <Alert tone="info" title="Clinic hours">
          Consultations run Monday to Saturday.
        </Alert>
        <Alert tone="warning" title="Payment pending" />
        <Alert tone="danger" title="Something went wrong" />
        <Alert tone="success" title="Saved" />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("Loading states", () => {
  it("announces what is loading rather than showing a silent blank region", () => {
    render(<SectionLoading label="Loading your appointments" />);

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Loading your appointments");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("keeps individual skeletons out of the accessibility tree", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a card skeleton for each expected item", () => {
    render(<CardListLoading label="Loading treatments" count={4} />);

    const region = screen.getByRole("status");
    expect(
      region.querySelectorAll("[aria-hidden='true']").length,
    ).toBeGreaterThan(4);
  });

  it("labels a page-level spinner visibly and programmatically", () => {
    render(<PageLoading label="Loading your appointments" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your appointments",
    );
  });

  it("hides a decorative spinner but announces a labelled one", () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");

    rerender(<Spinner label="Working" />);
    expect(screen.getByRole("status")).toHaveTextContent("Working");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <>
        <CardListLoading label="Loading treatments" count={2} />
        <PageLoading label="Loading appointments" />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("EmptyState", () => {
  it("says what is empty, why, and what to do next", () => {
    render(
      <EmptyState
        title="No upcoming appointments"
        description="You don't have an appointment scheduled yet."
        action={<Button>Book a Consultation</Button>}
      />,
    );

    expect(screen.getByText("No upcoming appointments")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have an appointment scheduled yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Book a Consultation" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <EmptyState
        icon={<svg />}
        title="No upcoming appointments"
        description="You don't have an appointment scheduled yet."
        action={<Button>Book a Consultation</Button>}
        secondaryAction={<Button variant="ghost">Contact the clinic</Button>}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("ErrorState", () => {
  it("explains the failure in plain language and offers a way back", () => {
    render(
      <ErrorState
        description="We couldn't load your appointments."
        action={<Button variant="outline">Try Again</Button>}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("We couldn't load your appointments.");
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("shows only an opaque reference, never technical detail", () => {
    render(
      <ErrorState
        description="We couldn't load your appointments."
        reference="a1b2c3d4"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("a1b2c3d4");
    expect(alert.textContent).not.toMatch(/error|exception|sql|stack/i);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ErrorState
        description="We couldn't load your appointments."
        action={<Button variant="outline">Try Again</Button>}
        reference="a1b2c3d4"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("Toast", () => {
  function Harness() {
    const { toast } = useToast();
    return (
      <>
        <Button
          onClick={() =>
            toast({
              tone: "success",
              title: "Appointment confirmed",
              description: "Tuesday 24 September, 10:30 AM.",
            })
          }
        >
          Confirm
        </Button>
        <Button
          onClick={() =>
            toast({ tone: "error", title: "We couldn't save your changes" })
          }
        >
          Fail
        </Button>
      </>
    );
  }

  it("shows a success toast with its title and description", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <Harness />
      </Toaster>,
    );

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("Appointment confirmed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tuesday 24 September, 10:30 AM."),
    ).toBeInTheDocument();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <Harness />
      </Toaster>,
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Appointment confirmed");

    await user.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Appointment confirmed"),
      ).not.toBeInTheDocument();
    });
  });

  it("does not auto-dismiss an error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    try {
      render(
        <Toaster>
          <Harness />
        </Toaster>,
      );

      await user.click(screen.getByRole("button", { name: "Fail" }));
      await screen.findByText("We couldn't save your changes");

      // Well past the success-toast lifetime. An error the user has not read
      // must not vanish on a timer.
      await vi.advanceTimersByTimeAsync(30_000);

      expect(
        screen.getByText("We couldn't save your changes"),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws a useful error when used without a Toaster", () => {
    // Suppress React's own error logging for this deliberate failure.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    function Orphan() {
      useToast();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(/Toaster/);
    consoleError.mockRestore();
  });

  it("has no axe violations while a toast is showing", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Toaster>
        <Harness />
      </Toaster>,
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Appointment confirmed");

    await expectNoAxeViolations(baseElement);
  });
});
