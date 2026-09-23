import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `openNotificationAction` — opening a notification from the bell's preview.
 *
 * What is asserted:
 *
 *   * the destination is the **stored** link of the caller's own row, looked
 *     up by id — a `linkPath` or `url` field on the form is never read;
 *   * a stored value that is not an application path is **never redirected
 *     to**, so the action cannot become an open redirect;
 *   * an invalid id, an absent row (somebody else's, under row-level
 *     security) or no session lands on the notification centre and writes
 *     nothing;
 *   * a failed mark-read still opens the resource — reading it matters more
 *     than the housekeeping.
 *
 * The Supabase client is a recording stub; the database's own refusals are
 * asserted structurally in `notification-security.test.ts`.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "33333333-3333-4333-8333-333333333333";
const LINK = `/patient/appointments/${"22222222-2222-4222-8222-222222222222"}`;

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResult: { data: unknown; error: unknown } = { data: true, error: null };
let lookupIds: unknown[] = [];
let lookupResult: { data: unknown; error: unknown } = {
  data: { link_path: LINK },
  error: null,
};

const getCurrentUser = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, value: unknown) => {
          lookupIds.push(value);
          return { maybeSingle: async () => lookupResult };
        },
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ name, args });
      return rpcResult;
    },
  }),
}));

vi.mock("@/lib/logging/logger", () => {
  const noop = () => {};
  return { logger: { debug: noop, info: noop, warn: noop, error: noop } };
});

const { openNotificationAction } =
  await import("@/features/notifications/actions");

function form(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("notificationId", NOTIFICATION_ID);
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function destination(data: FormData): Promise<string> {
  try {
    await openNotificationAction(data);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.to;
    throw error;
  }
  throw new Error("openNotificationAction returned without redirecting");
}

beforeEach(() => {
  rpcCalls = [];
  lookupIds = [];
  rpcResult = { data: true, error: null };
  lookupResult = { data: { link_path: LINK }, error: null };
  getCurrentUser.mockResolvedValue({ id: USER_ID, role: "patient" });
});

describe("openNotificationAction", () => {
  it("marks the notification read and opens its stored link", async () => {
    expect(await destination(form())).toBe(LINK);
    expect(lookupIds).toEqual([NOTIFICATION_ID]);
    expect(rpcCalls).toEqual([
      {
        name: "mark_notification_read",
        args: { p_notification_id: NOTIFICATION_ID },
      },
    ]);
  });

  it("ignores a destination planted on the form", async () => {
    expect(
      await destination(
        form({ linkPath: "https://evil.example", url: "//evil.example" }),
      ),
    ).toBe(LINK);
  });

  it.each([
    "https://evil.example/patient",
    "//evil.example",
    "/\\evil.example",
  ])("never redirects to a stored %j", async (stored) => {
    lookupResult = { data: { link_path: stored }, error: null };

    expect(await destination(form())).toBe("/notifications");
    expect(rpcCalls).toEqual([]);
  });

  it("lands on the centre for somebody else's id, and writes nothing", async () => {
    lookupResult = { data: null, error: null };

    expect(await destination(form())).toBe("/notifications");
    expect(rpcCalls).toEqual([]);
  });

  it("lands on the centre for an invalid id without querying", async () => {
    expect(await destination(form({ notificationId: "not-a-uuid" }))).toBe(
      "/notifications",
    );
    expect(lookupIds).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it("lands on the centre without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(await destination(form())).toBe("/notifications");
    expect(lookupIds).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it("still opens the resource when marking it read fails", async () => {
    rpcResult = {
      data: null,
      error: { code: "XX000", message: "boom", details: null, hint: null },
    };

    expect(await destination(form())).toBe(LINK);
  });
});
