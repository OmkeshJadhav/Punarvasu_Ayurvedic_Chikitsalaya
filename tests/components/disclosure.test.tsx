import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { expectNoAxeViolations } from "../support/axe";

function PatientTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Patient record sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="appointments">Appointments panel</TabsContent>
      <TabsContent value="documents">Documents panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes tablist, tabs and the selected panel", () => {
    render(<PatientTabs />);

    expect(
      screen.getByRole("tablist", { name: "Patient record sections" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview panel");
  });

  it("switches panels on click", async () => {
    const user = userEvent.setup();
    render(<PatientTabs />);

    await user.click(screen.getByRole("tab", { name: "Documents" }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Documents panel");
  });

  it("moves between tabs with the arrow keys, not Tab", async () => {
    const user = userEvent.setup();
    render(<PatientTabs />);

    // One Tab stop for the whole tablist: roving focus is what makes a long
    // tab row navigable without a dozen stops.
    await user.tab();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Appointments" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Appointments panel",
    );

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("has no axe violations", async () => {
    const { container } = render(<PatientTabs />);
    await expectNoAxeViolations(container);
  });
});

function Faq() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="duration">
        <AccordionTrigger>How long is a first consultation?</AccordionTrigger>
        <AccordionContent>
          An initial consultation allows time for a full assessment.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="prepare">
        <AccordionTrigger>Should I prepare anything?</AccordionTrigger>
        <AccordionContent>Bring any recent reports.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe("Accordion", () => {
  it("starts collapsed and reports it", () => {
    render(<Faq />);

    const trigger = screen.getByRole("button", {
      name: "How long is a first consultation?",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("puts each trigger inside a heading so the page outline is navigable", () => {
    render(<Faq />);

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "How long is a first consultation?",
      }),
    ).toBeInTheDocument();
  });

  it("respects an explicit heading level", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="one">
          <AccordionTrigger headingLevel="h2">Section</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Section" }),
    ).toBeInTheDocument();
  });

  it("expands and collapses from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Faq />);

    await user.tab();
    const trigger = screen.getByRole("button", {
      name: "How long is a first consultation?",
    });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );
    expect(
      screen.getByText(
        "An initial consultation allows time for a full assessment.",
      ),
    ).toBeVisible();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("has no axe violations open or closed", async () => {
    const user = userEvent.setup();
    const { container } = render(<Faq />);

    await expectNoAxeViolations(container);

    await user.click(
      screen.getByRole("button", { name: "How long is a first consultation?" }),
    );
    await expectNoAxeViolations(container);
  });
});

describe("Tooltip", () => {
  function Example() {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="About Panchakarma">
              <svg />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Usually scheduled over seven days.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  it("opens on keyboard focus, not only on hover", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.tab();
    expect(
      screen.getByRole("button", { name: "About Panchakarma" }),
    ).toHaveFocus();

    // A tooltip that only opens on hover is unreachable by keyboard.
    expect(
      await screen.findByText("Usually scheduled over seven days."),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.tab();
    await screen.findByText("Usually scheduled over seven days.");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByText("Usually scheduled over seven days."),
      ).not.toBeInTheDocument();
    });
  });
});
