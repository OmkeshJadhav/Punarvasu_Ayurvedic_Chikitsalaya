import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The notification server actions.
 *
 * These assert the properties every Phase 15 write rests on:
 *
 *   * an unauthenticated caller writes nothing, and an unauthorized one is
 *     refused without being told what they would have needed;
 *   * **no user id, recipient, address, title, body, link or status is ever
 *     read from the request and passed on** — `phase_15.md` sections 54, 97,
 *     110 and 129, and example 9. Every hostile field is planted one at a
 *     time, so a failure names the field that got through;
 *   * the RPC argument lists are exactly what the database declares, so a
 *     field added to a form cannot become a parameter;
 *   * a database failure reaches the person as a sentence rather than as a
 *     PostgREST error (sections 78, 79);
 *   * **no log line carries a notification's content** (sections 77, 78).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary: it proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently, that
 * `mark_notification_read` matches nothing for somebody else's id — is a
 * property of the migration, asserted structurally in
 * `notification-security.test.ts` and against a live project in
 * `docs/progress/progress_phase_15.md`.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();
const logLines: string[] = [];

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
  }),
}));

vi.mock("@/lib/logging/logger", () => {
  const record = (event: string, ...rest: unknown[]) => {
    logLines.push(`${event} ${JSON.stringify(rest)}`);
  };
  return {
    logger: {
      debug: record,
      info: record,
      warn: record,
      error: record,
      child: () => ({
        debug: record,
        info: record,
        warn: record,
        error: record,
      }),
    },
  };
});

const {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  setNotificationPreferenceAction,
} = await import("@/features/notifications/actions");

const { IDLE_NOTIFICATION_FORM_STATE } =
  await import("@/features/notifications/types");

function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

function markReadForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("notificationId", NOTIFICATION_ID);
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function preferenceForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("category", "appointment_reminders");
  data.set("channel", "email");
  data.set("enabled", "false");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function callsTo(name: string): RpcCall[] {
  return rpcCalls.filter((call) => call.name === name);
}

beforeEach(() => {
  rpcCalls = [];
  rpcResults = {
    mark_notification_read: { data: true, error: null },
    mark_all_notifications_read: { data: 3, error: null },
    set_notification_preference: { data: false, error: null },
  };
  logLines.length = 0;
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    role: "patient",
    email: "patient@example.test",
  });
});

/* ------------------------------------------------------------------------ */
/* Authorization                                                             */
/* ------------------------------------------------------------------------ */

describe("authorization", () => {
  it("writes nothing without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    for (const run of [
      () =>
        markNotificationReadAction(
          IDLE_NOTIFICATION_FORM_STATE,
          markReadForm(),
        ),
      () => markAllNotificationsReadAction(IDLE_NOTIFICATION_FORM_STATE),
      () =>
        setNotificationPreferenceAction(
          IDLE_NOTIFICATION_FORM_STATE,
          preferenceForm(),
        ),
    ]) {
      const state = await run();
      expect(state.status).toBe("error");
    }

    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses a role without the permission, and says nothing about the model", async () => {
    // `phase_08.md` section 12: a refusal names no role and no required
    // permission.
    getCurrentUser.mockResolvedValue({ id: USER_ID, role: null });

    const state = await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm(),
    );

    expect(state.status).toBe("error");
    expect(state.message).not.toMatch(/patient|doctor|receptionist|admin/i);
    expect(state.message).not.toMatch(/notifications\.\w+/);
    expect(rpcCalls).toHaveLength(0);
  });

  it("lets every role manage their own notifications", async () => {
    // A notification is addressed to an account, not to a kind of person.
    for (const role of ["patient", "receptionist", "doctor", "admin"]) {
      rpcCalls = [];
      getCurrentUser.mockResolvedValue({ id: USER_ID, role });

      const state = await markNotificationReadAction(
        IDLE_NOTIFICATION_FORM_STATE,
        markReadForm(),
      );

      expect(state.status, `${role} was refused`).toBe("success");
    }
  });
});

/* ------------------------------------------------------------------------ */
/* No recipient, no content                                                  */
/* ------------------------------------------------------------------------ */

describe("the request cannot name a person", () => {
  const HOSTILE: Readonly<Record<string, string>> = {
    userId: OTHER_USER_ID,
    recipientUserId: OTHER_USER_ID,
    recipientEmail: "attacker@example.test",
    recipientPhone: "+919999999999",
    to: "victim@example.test",
    role: "admin",
    permission: "roles.manage",
    isAdmin: "true",
    status: "active",
    title: "Prescription details",
    body: "Take 500mg twice daily",
    linkPath: "/patient/prescriptions/other",
    url: "https://evil.test",
    channel: "sms",
    provider: "emailjs",
  };

  it.each(Object.entries(HOSTILE))(
    "mark-as-read ignores a planted %s",
    async (field, value) => {
      const state = await markNotificationReadAction(
        IDLE_NOTIFICATION_FORM_STATE,
        markReadForm({ [field]: value }),
      );

      // The action reads only its declared fields, so a planted one is never
      // read at all — the request succeeds and carries none of it onward.
      expect(state.status).toBe("success");

      const args = callsTo("mark_notification_read")[0]?.args ?? {};
      expect(Object.keys(args)).toEqual(["p_notification_id"]);
      expect(JSON.stringify(args)).not.toContain(value);
    },
  );

  it.each(Object.entries(HOSTILE))(
    "the preference action ignores a planted %s",
    async (field, value) => {
      rpcCalls = [];

      await setNotificationPreferenceAction(
        IDLE_NOTIFICATION_FORM_STATE,
        // `channel` is a real field of this form, so planting it is a
        // *value* test rather than an extra-field test — and an invalid
        // channel must be refused rather than forwarded.
        preferenceForm(field === "channel" ? {} : { [field]: value }),
      );

      const args = callsTo("set_notification_preference")[0]?.args ?? {};

      expect(Object.keys(args).sort()).toEqual([
        "p_category",
        "p_channel",
        "p_enabled",
      ]);
      expect(JSON.stringify(args)).not.toContain(OTHER_USER_ID);
      expect(JSON.stringify(args)).not.toContain("attacker@example.test");
    },
  );

  it("refuses a channel that does not exist rather than forwarding it", async () => {
    const state = await setNotificationPreferenceAction(
      IDLE_NOTIFICATION_FORM_STATE,
      preferenceForm({ channel: "sms" }),
    );

    expect(state.status).toBe("error");
    expect(callsTo("set_notification_preference")).toHaveLength(0);
  });

  it("sends the id it was given and resolves ownership nowhere in the application", async () => {
    // Section 55. Somebody else's id is forwarded — and matches no rows,
    // because `mark_notification_read` scopes by `auth.uid()` in the
    // statement. The application deliberately does not pre-check, because
    // reading the row first would reach a weaker version of the same answer
    // after an extra round trip.
    await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm({ notificationId: OTHER_NOTIFICATION_ID }),
    );

    expect(callsTo("mark_notification_read")[0]?.args).toEqual({
      p_notification_id: OTHER_NOTIFICATION_ID,
    });
  });

  it("marks all read with no arguments at all", async () => {
    await markAllNotificationsReadAction(IDLE_NOTIFICATION_FORM_STATE);

    const call = callsTo("mark_all_notifications_read")[0];
    expect(call).toBeDefined();
    expect(Object.keys(call?.args ?? {})).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Outcomes                                                                  */
/* ------------------------------------------------------------------------ */

describe("outcomes", () => {
  it("says nothing was unread when nothing was", async () => {
    rpcResults.mark_all_notifications_read = { data: 0, error: null };

    const state = await markAllNotificationsReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
    );

    expect(state.status).toBe("success");
    expect(state.message?.toLowerCase()).toContain("no unread");
  });

  it("confirms when something was marked", async () => {
    const state = await markAllNotificationsReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
    );

    expect(state.status).toBe("success");
    expect(state.message?.toLowerCase()).toContain("marked as read");
  });

  it("explains a mandatory channel rather than failing generically", async () => {
    rpcResults.set_notification_preference = {
      data: null,
      error: pgError("PV051"),
    };

    const state = await setNotificationPreferenceAction(
      IDLE_NOTIFICATION_FORM_STATE,
      preferenceForm({ channel: "in_app", category: "appointment_updates" }),
    );

    expect(state.status).toBe("error");
    expect(state.message?.toLowerCase()).toContain("care");
  });

  it("never lets a database message reach the person", async () => {
    rpcResults.mark_notification_read = {
      data: null,
      error: pgError("42P01", 'relation "public.notifications" does not exist'),
    };

    const state = await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm(),
    );

    expect(state.status).toBe("error");

    // "notifications" is the product's own word for the feature and appears
    // in the safe copy, so the assertion is about the *database* sense of
    // the message: a relation, a schema-qualified name, a SQLSTATE. Phase 10
    // narrowed an over-broad `/relation/i` for the same reason.
    expect(state.message).not.toMatch(/\brelation\b/i);
    expect(state.message).not.toContain("public.");
    expect(state.message).not.toContain("42P01");
    expect(state.message).not.toMatch(/does not exist/i);
  });

  it("revalidates the notification centre after a change", async () => {
    await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm(),
    );

    expect(revalidatePath).toHaveBeenCalledWith("/notifications", undefined);
  });
});

/* ------------------------------------------------------------------------ */
/* Logging                                                                   */
/* ------------------------------------------------------------------------ */

describe("logging", () => {
  it("carries no content and no address", async () => {
    // Sections 77 and 78. What is logged is the operation and an opaque user
    // id — section 78's own safe example.
    rpcResults.set_notification_preference = {
      data: null,
      error: pgError("42501", "permission denied for table notifications"),
    };

    await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm(),
    );
    await setNotificationPreferenceAction(
      IDLE_NOTIFICATION_FORM_STATE,
      preferenceForm(),
    );

    const log = logLines.join("\n");

    expect(log).not.toContain("patient@example.test");
    expect(log).not.toContain("permission denied");
    expect(log).not.toContain("Take 500mg");
    expect(log).not.toContain("/patient/");
  });

  it("logs an opaque user id, which is what makes a refusal investigable", async () => {
    getCurrentUser.mockResolvedValue({ id: USER_ID, role: null });

    await markNotificationReadAction(
      IDLE_NOTIFICATION_FORM_STATE,
      markReadForm(),
    );

    expect(logLines.join("\n")).toContain(USER_ID);
  });
});
