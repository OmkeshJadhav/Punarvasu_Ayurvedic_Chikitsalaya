import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLink,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
  TableSortButton,
} from "@/components/ui/table";

import { expectNoAxeViolations } from "../support/axe";

describe("Card", () => {
  it("renders a heading at the requested level", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle as="h2">Panchakarma</CardTitle>
          <CardDescription>
            Traditional Ayurvedic detoxification.
          </CardDescription>
        </CardHeader>
      </Card>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Panchakarma" }),
    ).toBeInTheDocument();
  });

  it("defaults the heading to level 3", () => {
    render(
      <Card>
        <CardTitle>Panchakarma</CardTitle>
      </Card>,
    );

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("gives an interactive card exactly one focusable link", async () => {
    const user = userEvent.setup();
    render(
      <Card variant="interactive">
        <CardHeader>
          <CardTitle>
            <CardLink href="/treatments/panchakarma">Panchakarma</CardLink>
          </CardTitle>
          <CardDescription>
            Traditional Ayurvedic detoxification.
          </CardDescription>
        </CardHeader>
        <CardContent>Not focusable on its own.</CardContent>
      </Card>,
    );

    // One tab stop, a real link, and a name that is the treatment - not
    // "read more" and not a div with a click handler.
    await user.tab();
    const link = screen.getByRole("link", { name: "Panchakarma" });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute("href", "/treatments/panchakarma");

    await user.tab();
    expect(link).not.toHaveFocus();
  });

  it("can render as a different element", () => {
    render(
      <Card asChild>
        <article aria-label="Treatment">
          <CardTitle>Panchakarma</CardTitle>
        </article>
      </Card>,
    );

    expect(
      screen.getByRole("article", { name: "Treatment" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <>
        <Card>
          <CardTitle>Default</CardTitle>
        </Card>
        <Card variant="interactive">
          <CardTitle>
            <CardLink href="/x">Interactive</CardLink>
          </CardTitle>
        </Card>
        <Card variant="highlighted">
          <CardTitle>Highlighted</CardTitle>
        </Card>
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("Select", () => {
  function TreatmentSelect() {
    return (
      <Field name="treatment" label="Treatment">
        {(control) => (
          <Select name={control.name}>
            <SelectTrigger
              id={control.id}
              aria-describedby={control["aria-describedby"]}
            >
              <SelectValue placeholder="Choose a treatment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultation">Initial consultation</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
              <SelectItem value="panchakarma">Panchakarma</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
    );
  }

  it("is labelled by its Field", () => {
    render(<TreatmentSelect />);

    expect(
      screen.getByRole("combobox", { name: "Treatment" }),
    ).toBeInTheDocument();
  });

  it("shows a placeholder until a choice is made", () => {
    render(<TreatmentSelect />);
    expect(screen.getByText("Choose a treatment")).toBeInTheDocument();
  });

  it("opens and selects with the keyboard", async () => {
    const user = userEvent.setup();
    render(<TreatmentSelect />);

    await user.tab();
    const trigger = screen.getByRole("combobox", { name: "Treatment" });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveTextContent(/Initial consultation|Follow-up/);
  });

  it("closes on Escape without selecting", async () => {
    const user = userEvent.setup();
    render(<TreatmentSelect />);

    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Choose a treatment")).toBeInTheDocument();
  });

  it("has no axe violations while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<TreatmentSelect />);
    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");

    await expectNoAxeViolations(baseElement);
  });
});

describe("Table", () => {
  function AppointmentTable() {
    return (
      <TableScroller label="Recent appointments">
        <Table>
          <TableCaption>Recent appointments</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead aria-sort="ascending">
                <TableSortButton direction="ascending">Date</TableSortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>PNV-10241</TableCell>
              <TableCell>24 September</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableScroller>
    );
  }

  it("is a real table with a caption and column headers", () => {
    render(<AppointmentTable />);

    expect(
      screen.getByRole("table", { name: "Recent appointments" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("scopes its headers to their columns", () => {
    render(<AppointmentTable />);

    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("is a containing block, so absolute content cannot escape its clipping", () => {
    // An absolutely positioned descendant is clipped by an ancestor's
    // `overflow` only when that ancestor is its containing block — which means
    // the ancestor must be positioned. Without this, anything absolute inside a
    // wide table resolves against the initial containing block, escapes the
    // scroller and widens the whole document.
    //
    // Measured in Phase 08: `/admin/users` at 320px had 35px of horizontal page
    // overflow, caused by one `sr-only` label on a role control sitting 354px
    // into a table this scroller was otherwise containing perfectly. jsdom has
    // no layout engine, so the class is what is asserted here; the pixel result
    // was verified in a real browser.
    const { container } = render(<AppointmentTable />);
    const scroller = container.querySelector('[role="region"]');

    expect(scroller?.className).toContain("relative");
    expect(scroller?.className).toContain("overflow-x-auto");
  });

  it("makes an overflowing table reachable by keyboard", async () => {
    const user = userEvent.setup();
    render(<AppointmentTable />);

    // Without a focusable region, a horizontally scrolling table cannot be
    // scrolled by a keyboard user at all.
    await user.tab();
    expect(
      screen.getByRole("region", { name: "Recent appointments" }),
    ).toHaveFocus();
  });

  it("announces the sort state as text, not only as an arrow direction", () => {
    render(<AppointmentTable />);

    expect(
      screen.getByRole("button", { name: /Date.*sorted ascending/ }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<AppointmentTable />);
    await expectNoAxeViolations(container);
  });
});
