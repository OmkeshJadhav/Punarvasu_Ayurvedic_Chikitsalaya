import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { expectNoAxeViolations } from "../support/axe";

function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Cancel appointment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            The slot is released immediately and cannot be reclaimed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep Appointment</Button>
          </DialogClose>
          <Button variant="destructive">Cancel Appointment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is closed until the trigger is activated", () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens from the trigger", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Cancel appointment" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("takes its accessible name and description from the title and description", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Cancel this appointment?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "The slot is released immediately and cannot be reclaimed.",
    );
  });

  it("hides background content from assistive technology while open", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>Background content</p>
        <ConfirmDialog />
      </div>,
    );

    const background = screen.getByText("Background content");
    expect(background).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    // Radix marks every sibling of the dialog inert rather than setting
    // `aria-modal`, which is the stronger behaviour: the background is removed
    // from the accessibility tree *and* from the tab order.
    await waitFor(() => {
      const hiddenAncestor = background.closest(
        "[aria-hidden='true'], [inert]",
      );
      expect(hiddenAncestor).not.toBeNull();
    });
  });

  it("moves focus into the dialog when it opens", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("traps focus: tabbing past the last control returns to the first", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    // Cycle well past the number of focusable controls. If focus escaped, it
    // would land on the body or on the trigger behind the overlay.
    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("restores focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    const trigger = screen.getByRole("button", { name: "Cancel appointment" });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes from the built-in close button", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes from a DialogClose action", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Keep Appointment" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("has no axe violations while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<ConfirmDialog />);
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await expectNoAxeViolations(baseElement);
  });
});

describe("Sheet", () => {
  function MenuSheet() {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <svg />
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <a href="/treatments">Treatments</a>
        </SheetContent>
      </Sheet>
    );
  }

  it("opens, is named, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<MenuSheet />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      await screen.findByRole("dialog", { name: "Menu" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("restores focus to its trigger", async () => {
    const user = userEvent.setup();
    render(<MenuSheet />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("has no axe violations while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<MenuSheet />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog");

    await expectNoAxeViolations(baseElement);
  });
});
