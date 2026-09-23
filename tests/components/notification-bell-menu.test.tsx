import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NotificationBellMenu } from "@/components/notifications/notification-bell-menu";
import type { Notification } from "@/features/notifications/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The header bell's preview panel.
 *
 * What is asserted:
 *
 *   * the **unread count** is on the bell and in its accessible name, and
 *     absent when nothing is unread;
 *   * **hover opens it** for a mouse, and a click or Enter opens it too, so it
 *     is never hover-only (`AGENTS.md` section 34);
 *   * read and unread rows are told apart by **more than colour** — the word
 *     "Unread" is in the unread row's accessible name;
 *   * each row is a form posting **the id and nothing else** — the
 *     destination is read from the database, not from the page;
 *   * "View all" is a real link to the notification centre;
 *   * empty and failed reads say different things.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient",
}));

vi.mock("@/features/notifications/actions", () => ({
  openNotificationAction: async () => {},
}));

const BASE: Notification = {
  id: "11111111-1111-4111-8111-111111111111",
  eventType: "appointment_confirmed",
  category: "appointment_updates",
  title: "Appointment confirmed",
  body: "Your appointment is confirmed.",
  templateVersion: 1,
  resourceType: "appointment",
  resourceId: "22222222-2222-4222-8222-222222222222",
  linkPath: "/patient/appointments/22222222-2222-4222-8222-222222222222",
  readAt: null,
  createdAt: "2026-09-18T09:00:00.000Z",
};

const UNREAD = BASE;
const READ: Notification = {
  ...BASE,
  id: "33333333-3333-4333-8333-333333333333",
  title: "Appointment moved",
  readAt: "2026-09-18T10:00:00.000Z",
  createdAt: "2026-09-17T09:00:00.000Z",
};

function renderMenu(
  props: Partial<Parameters<typeof NotificationBellMenu>[0]> = {},
) {
  return render(
    <NotificationBellMenu
      unread={1}
      unreadCap={99}
      recent={{ status: "ok", notifications: [UNREAD, READ] }}
      {...props}
    />,
  );
}

describe("NotificationBellMenu", () => {
  it("shows the unread count on the bell and in its name", () => {
    renderMenu({ unread: 3 });

    const bell = screen.getByRole("button", { name: /3 unread/i });
    expect(bell).toHaveTextContent("3");
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("shows no count when nothing is unread", () => {
    renderMenu({ unread: 0 });

    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(bell).toHaveTextContent("");
  });

  it("caps a large count", () => {
    renderMenu({ unread: 150 });

    expect(
      screen.getByRole("button", { name: /more than 99 unread/i }),
    ).toHaveTextContent("99+");
  });

  it("opens on a click, lists read and unread, and links to the centre", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /1 unread/i }));

    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    const rows = within(panel).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    expect(
      within(panel).getByRole("button", {
        name: "Unread: Appointment confirmed",
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("button", { name: "Appointment moved" }),
    ).toBeInTheDocument();

    expect(
      within(panel).getByRole("link", { name: "View all notifications" }),
    ).toHaveAttribute("href", "/notifications");

    await expectNoAxeViolations(document.body);
  });

  it("opens from the keyboard and moves focus into the panel", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.tab();
    await user.keyboard("{Enter}");

    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    expect(panel.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Notifications" }),
    ).not.toBeInTheDocument();
  });

  it("opens on mouse hover without taking focus", async () => {
    vi.useFakeTimers();
    try {
      renderMenu();
      const bell = screen.getByRole("button", { name: /1 unread/i });

      fireEvent.pointerOver(bell, { pointerType: "mouse" });
      await act(() => vi.advanceTimersByTimeAsync(200));

      expect(
        screen.getByRole("dialog", { name: "Notifications" }),
      ).toBeInTheDocument();
      expect(document.activeElement).toBe(document.body);

      fireEvent.pointerOut(bell, { pointerType: "mouse" });
      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(
        screen.queryByRole("dialog", { name: "Notifications" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not open on a touch hover", async () => {
    vi.useFakeTimers();
    try {
      renderMenu();

      fireEvent.pointerOver(screen.getByRole("button", { name: /1 unread/i }), {
        pointerType: "touch",
      });
      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(
        screen.queryByRole("dialog", { name: "Notifications" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("posts only the notification id when a row is opened", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /1 unread/i }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });

    const form = within(panel)
      .getByRole("button", { name: "Unread: Appointment confirmed" })
      .closest("form");
    expect(form).not.toBeNull();

    const fields = Array.from(
      form?.querySelectorAll("input") ?? [],
      (input) => [input.name, input.value],
    );
    expect(fields).toEqual([["notificationId", UNREAD.id]]);
  });

  it("distinguishes an empty inbox from a failed read", async () => {
    const user = userEvent.setup();
    const { unmount } = renderMenu({
      unread: 0,
      recent: { status: "ok", notifications: [] },
    });

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    unmount();

    renderMenu({ unread: 0, recent: { status: "unavailable" } });
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(
      await screen.findByText(/couldn't load your latest notifications/i),
    ).toBeInTheDocument();
  });
});
