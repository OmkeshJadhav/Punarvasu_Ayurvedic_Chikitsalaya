import { readFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  AUTH_EMAIL_MESSAGES,
  MAX_TIMESTAMP_SKEW_SECONDS,
  buildActionLink,
  buildEmailJsRequest,
  parseOrigin,
  verifyWebhookSignature,
  type SendEmailHookPayload,
} from "../../supabase/functions/send-auth-email/lib";

/**
 * Send Email hook logic.
 *
 * The signature check is the whole authentication for that endpoint: it is
 * deployed with `verify_jwt = false`, because Supabase Auth calls it with a
 * webhook signature rather than a JWT. If this check is wrong, the URL is an
 * open relay that sends mail from the clinic's address carrying any link an
 * attacker chooses. So it is tested the way a security control should be -
 * against forged, stale, truncated and absent signatures, not only a happy
 * path.
 */

const SECRET_BYTES = randomBytes(32);

/**
 * The shape Supabase actually issues: `v1,whsec_<base64>`.
 *
 * The tests originally used `v1,<base64>` — a plausible guess that was wrong,
 * and wrong in the worst way. `Buffer.from(value, "base64")` silently skips
 * characters outside the alphabet, so leaving `whsec_` attached did not throw:
 * it decoded to a key that was wrong but perfectly well-formed, and every
 * genuine call from Supabase was rejected with 401. Signing the fixtures the
 * way Supabase does is what makes these tests evidence rather than decoration.
 */
const SECRET = `v1,whsec_${SECRET_BYTES.toString("base64")}`;
const APP_URL = "https://punarvasu.example";

/** Signs a body the way Supabase does, so the tests exercise the real scheme. */
function sign(
  body: string,
  { id = "msg_1", timestamp = Math.floor(Date.now() / 1000) } = {},
) {
  const signature = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return {
    headers: { id, timestamp: String(timestamp), signature: `v1,${signature}` },
    timestamp,
  };
}

const PAYLOAD: SendEmailHookPayload = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "patient@example.test",
  },
  email_data: {
    token: "123456",
    token_hash: "a-real-one-time-token-hash",
    redirect_to: `${APP_URL}/account`,
    email_action_type: "signup",
    site_url: APP_URL,
  },
};

/**
 * The Deno/Node gap.
 *
 * This file runs under Node, where `Buffer`, `process` and friends are
 * globals. `lib.ts` runs under Deno, where they are not - you have to import
 * them from `node:*`. So a missing import is invisible to every test in this
 * file: the code works here and throws
 * `ReferenceError: Buffer is not defined` in production, on the first real
 * call, with nothing but a generic 500 to show for it.
 *
 * That happened. These assertions read the source and check that anything
 * Node-global it uses is imported, because behaviour alone cannot prove it.
 */
describe("Deno compatibility", () => {
  const source = readFileSync(
    new URL("../../supabase/functions/send-auth-email/lib.ts", import.meta.url),
    "utf8",
  );

  it.each([
    ["Buffer", "node:buffer"],
    ["createHmac", "node:crypto"],
    ["timingSafeEqual", "node:crypto"],
  ])("imports %s from %s rather than assuming a global", (name, module) => {
    if (
      !new RegExp(`\b${name}\b`).test(source.replace(/^import[^;]+;/gm, ""))
    ) {
      return; // Not used; nothing to import.
    }

    const imports =
      source.match(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/gm) ?? [];
    const imported = imports.some(
      (line) => line.includes(name) && line.includes(module),
    );
    expect(imported, `${name} must be imported from ${module}`).toBe(true);
  });

  it("uses no Node global that Deno does not provide", () => {
    const withoutImports = source.replace(/^import[^;]+;/gm, "");
    for (const forbidden of [
      "process.env",
      "__dirname",
      "__filename",
      "require(",
    ]) {
      expect(withoutImports).not.toContain(forbidden);
    }
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify(PAYLOAD);

  it("accepts a correctly signed request", () => {
    const { headers } = sign(body);
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(true);
  });

  describe("accepts every shape the secret is written in", () => {
    it.each([
      ["v1,whsec_<base64> — what Supabase issues", () => SECRET],
      [
        "whsec_<base64> — prefix without version",
        () => `whsec_${SECRET_BYTES.toString("base64")}`,
      ],
      [
        "v1,<base64> — version without prefix",
        () => `v1,${SECRET_BYTES.toString("base64")}`,
      ],
      ["bare base64", () => SECRET_BYTES.toString("base64")],
    ])("%s", (_name, make) => {
      const { headers } = sign(body);
      expect(verifyWebhookSignature(body, headers, make())).toBe(true);
    });
  });

  it("does not treat the whsec_ marker as key material", () => {
    // The regression. Decoding `whsec_<base64>` leniently yields a wrong but
    // well-formed key, so this asserts the marker is stripped rather than
    // absorbed: a signature made with the TRUE key must verify.
    const { headers } = sign(body);
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(true);

    // ...and one made with the mis-derived key must not.
    const mangled = Buffer.from(
      `whsec_${SECRET_BYTES.toString("base64")}`,
      "base64",
    );
    const ts = Math.floor(Date.now() / 1000);
    const wrong = createHmac("sha256", mangled)
      .update(`msg_1.${ts}.${body}`)
      .digest("base64");
    expect(
      verifyWebhookSignature(
        body,
        { id: "msg_1", timestamp: String(ts), signature: `v1,${wrong}` },
        SECRET,
      ),
    ).toBe(false);
  });

  describe("rejects", () => {
    it("a forged signature", () => {
      const { headers } = sign(body);
      const forged = { ...headers, signature: "v1,Zm9yZ2VkLXNpZ25hdHVyZQ==" };
      expect(verifyWebhookSignature(body, forged, SECRET)).toBe(false);
    });

    it("a signature made with a different secret", () => {
      // The exact attack the check exists to stop: someone who found the URL
      // but does not hold the hook secret.
      const otherSecret = randomBytes(32);
      const signature = createHmac("sha256", otherSecret)
        .update(`msg_1.${Math.floor(Date.now() / 1000)}.${body}`)
        .digest("base64");

      expect(
        verifyWebhookSignature(
          body,
          {
            id: "msg_1",
            timestamp: String(Math.floor(Date.now() / 1000)),
            signature: `v1,${signature}`,
          },
          SECRET,
        ),
      ).toBe(false);
    });

    it("a body that changed after signing", () => {
      const { headers } = sign(body);
      const tampered = body.replace(
        "patient@example.test",
        "attacker@example.test",
      );
      expect(verifyWebhookSignature(tampered, headers, SECRET)).toBe(false);
    });

    it("a replayed request from outside the window", () => {
      const stale =
        Math.floor(Date.now() / 1000) - MAX_TIMESTAMP_SKEW_SECONDS - 60;
      const { headers } = sign(body, { timestamp: stale });
      expect(verifyWebhookSignature(body, headers, SECRET)).toBe(false);
    });

    it("a request timestamped in the future", () => {
      const ahead =
        Math.floor(Date.now() / 1000) + MAX_TIMESTAMP_SKEW_SECONDS + 60;
      const { headers } = sign(body, { timestamp: ahead });
      expect(verifyWebhookSignature(body, headers, SECRET)).toBe(false);
    });

    it("a signature valid for a different message id", () => {
      const { headers } = sign(body, { id: "msg_1" });
      expect(
        verifyWebhookSignature(body, { ...headers, id: "msg_2" }, SECRET),
      ).toBe(false);
    });

    it.each([
      ["no id", { id: null }],
      ["no timestamp", { timestamp: null }],
      ["no signature", { signature: null }],
    ])("a request with %s", (_name, override) => {
      const { headers } = sign(body);
      expect(
        verifyWebhookSignature(body, { ...headers, ...override }, SECRET),
      ).toBe(false);
    });

    it("a non-numeric timestamp", () => {
      const { headers } = sign(body);
      expect(
        verifyWebhookSignature(body, { ...headers, timestamp: "soon" }, SECRET),
      ).toBe(false);
    });

    it("a truncated signature", () => {
      // `timingSafeEqual` throws on a length mismatch; this asserts the length
      // is checked first rather than the function crashing.
      const { headers } = sign(body);
      const truncated = {
        ...headers,
        signature: headers.signature.slice(0, 20),
      };
      expect(() =>
        verifyWebhookSignature(body, truncated, SECRET),
      ).not.toThrow();
      expect(verifyWebhookSignature(body, truncated, SECRET)).toBe(false);
    });

    it("an unversioned signature", () => {
      const { headers } = sign(body);
      const unversioned = { ...headers, signature: headers.signature.slice(3) };
      expect(verifyWebhookSignature(body, unversioned, SECRET)).toBe(false);
    });

    it("an empty secret", () => {
      const { headers } = sign(body);
      expect(verifyWebhookSignature(body, headers, "")).toBe(false);
      expect(verifyWebhookSignature(body, headers, "v1,")).toBe(false);
    });
  });

  describe("rotation", () => {
    it("accepts a signature made with any of several configured secrets", () => {
      // What the plural `secrets` field is for. During a rotation both the old
      // and the new secret are configured, so neither Supabase nor the
      // function has to change at the same instant.
      const older = randomBytes(32);
      const combined = `v1,whsec_${older.toString("base64")},v1,whsec_${SECRET_BYTES.toString("base64")}`;

      const { headers } = sign(body);
      expect(verifyWebhookSignature(body, headers, combined)).toBe(true);

      // And a signature made with the older key is still accepted.
      const ts = Math.floor(Date.now() / 1000);
      const olderSignature = createHmac("sha256", older)
        .update(`msg_1.${ts}.${body}`)
        .digest("base64");
      expect(
        verifyWebhookSignature(
          body,
          {
            id: "msg_1",
            timestamp: String(ts),
            signature: `v1,${olderSignature}`,
          },
          combined,
        ),
      ).toBe(true);
    });

    it("still rejects a secret that is in neither slot", () => {
      const a = randomBytes(32);
      const b = randomBytes(32);
      const combined = `v1,whsec_${a.toString("base64")},v1,whsec_${b.toString("base64")}`;
      const { headers } = sign(body);
      expect(verifyWebhookSignature(body, headers, combined)).toBe(false);
    });

    it("skips a malformed entry rather than failing the whole check", () => {
      // One bad value must not take authentication down for the good ones.
      const combined = `,,v1,whsec_${SECRET_BYTES.toString("base64")}`;
      const { headers } = sign(body);
      expect(verifyWebhookSignature(body, headers, combined)).toBe(true);
    });
  });

  it("accepts when one of several rotated signatures matches", () => {
    const { headers } = sign(body);
    const withOld = {
      ...headers,
      signature: `v1,b2xkLXNpZ25hdHVyZS12YWx1ZQ== ${headers.signature}`,
    };
    expect(verifyWebhookSignature(body, withOld, SECRET)).toBe(true);
  });
});

describe("buildActionLink", () => {
  it("points at this application's callback with the token and type", () => {
    const url = new URL(buildActionLink(APP_URL, "signup", "hash-value", ""));

    expect(url.origin).toBe(APP_URL);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("token_hash")).toBe("hash-value");
    expect(url.searchParams.get("type")).toBe("signup");
  });

  it("sends recovery to the page that sets a new password", () => {
    // The bug found against the live Auth server: a recovery link that lands
    // anywhere else signs the user in and strands them.
    const url = new URL(buildActionLink(APP_URL, "recovery", "hash", ""));
    expect(url.searchParams.get("next")).toBe("/auth/reset-password");
  });

  it("honours a same-origin redirect_to", () => {
    const url = new URL(
      buildActionLink(APP_URL, "signup", "hash", `${APP_URL}/patient/profile`),
    );
    expect(url.searchParams.get("next")).toBe("/patient/profile");
  });

  describe("never lets the payload choose the host", () => {
    it.each([
      "https://evil.example/steal",
      "https://punarvasu-example.evil/steal",
      "//evil.example",
      "http://punarvasu.example.evil/account",
    ])("ignores the cross-origin redirect_to %s", (redirect) => {
      const link = buildActionLink(APP_URL, "signup", "hash", redirect);
      const url = new URL(link);

      // This link arrives in an inbox wearing the clinic's name. A poisoned
      // redirect_to must not be able to aim it elsewhere.
      expect(url.origin).toBe(APP_URL);
      expect(link).not.toContain("evil.example");
    });

    it("keeps recovery on the reset page even when poisoned", () => {
      const url = new URL(
        buildActionLink(APP_URL, "recovery", "hash", "https://evil.example/"),
      );
      expect(url.origin).toBe(APP_URL);
      expect(url.searchParams.get("next")).toBe("/auth/reset-password");
    });

    it("does not loop back onto the callback", () => {
      const url = new URL(
        buildActionLink(APP_URL, "signup", "hash", `${APP_URL}/auth/callback`),
      );
      expect(url.searchParams.get("next")).toBe(null);
    });
  });
});

describe("parseOrigin", () => {
  it.each([
    ["https://punarvasu.in", "https://punarvasu.in"],
    ["https://punarvasu.in/", "https://punarvasu.in"],
    ["https://punarvasu.in///", "https://punarvasu.in"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["  https://punarvasu.in  ", "https://punarvasu.in"],
  ])("accepts %s", (input, expected) => {
    expect(parseOrigin(input)).toBe(expected);
  });

  it.each([
    ["no scheme", "localhost:3000"],
    ["bare host", "punarvasu.in"],
    ["empty", ""],
    ["whitespace", "   "],
    ["not a URL", "not a url at all"],
  ])("rejects %s rather than throwing", (_name, input) => {
    // `new URL()` throws on these, and a throw inside the hook became an
    // opaque "Internal Server Error" that named nothing. This is the fix.
    expect(() => parseOrigin(input)).not.toThrow();
    expect(parseOrigin(input)).toBe(null);
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"])(
    "rejects the %s scheme",
    (input) => {
      // APP_URL becomes the origin of a link in a patient's inbox.
      expect(parseOrigin(input)).toBe(null);
    },
  );
});

describe("buildActionLink with a bad APP_URL", () => {
  it("throws a message that names the setting and not its value", () => {
    expect(() =>
      buildActionLink("localhost:3000", "signup", "hash", ""),
    ).toThrow(/APP_URL/);
  });

  it("does not put the bad value in the message", () => {
    try {
      buildActionLink("javascript:alert(1)", "signup", "hash", "");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("alert(1)");
    }
  });
});

describe("buildEmailJsRequest", () => {
  const config = {
    serviceId: "service_test",
    templateId: "template_test",
    publicKey: "public_test",
    privateKey: "private_test",
    appUrl: APP_URL,
  };

  it("builds a request carrying the recipient and the link", () => {
    const prepared = buildEmailJsRequest(config, PAYLOAD);
    expect(prepared).not.toBe(null);

    const sent = JSON.parse(prepared!.body);
    expect(sent.service_id).toBe("service_test");
    expect(sent.user_id).toBe("public_test");
    expect(sent.accessToken).toBe("private_test");
    // Both conventional names, because which one the EmailJS template reads
    // is the template author's choice and the template is not in this repo.
    expect(sent.template_params.to_email).toBe("patient@example.test");
    expect(sent.template_params.email).toBe("patient@example.test");
    expect(sent.template_params.subject).toBe(
      AUTH_EMAIL_MESSAGES.signup.subject,
    );
    expect(sent.template_params.action_url).toContain("/auth/callback");
  });

  it("refuses an action it has no reviewed wording for", () => {
    // Guessing a subject line would put unreviewed words in front of a
    // patient, so an unknown action is refused rather than improvised.
    const unknown = {
      ...PAYLOAD,
      email_data: { ...PAYLOAD.email_data, email_action_type: "something_new" },
    } as unknown as SendEmailHookPayload;

    expect(buildEmailJsRequest(config, unknown)).toBe(null);
  });

  it("refuses a payload with no recipient or no token", () => {
    expect(
      buildEmailJsRequest(config, {
        ...PAYLOAD,
        user: { id: "x", email: "" },
      } as SendEmailHookPayload),
    ).toBe(null);

    expect(
      buildEmailJsRequest(config, {
        ...PAYLOAD,
        email_data: { ...PAYLOAD.email_data, token_hash: "" },
      }),
    ).toBe(null);
  });

  it("carries the recipient under every name the template may read", () => {
    // Regression: the template used `{{email}}` while the function sent only
    // `to_email`, and EmailJS answered "422 The recipients address is empty"
    // without saying which name it wanted.
    const sent = JSON.parse(buildEmailJsRequest(config, PAYLOAD)!.body);
    for (const key of ["to_email", "email"]) {
      expect(sent.template_params[key]).toBe(PAYLOAD.user.email);
    }
  });

  it("sends no clinical or personal content beyond the address", () => {
    const sent = JSON.parse(buildEmailJsRequest(config, PAYLOAD)!.body);
    const params = JSON.stringify(sent.template_params);

    // An auth email says an action was requested and offers a link. Anything
    // else is data handed to a third party for no reason.
    for (const forbidden of ["full_name", "phone", "role", "patient_id"]) {
      expect(params).not.toContain(forbidden);
    }
    // The numeric OTP is not needed for a link-based flow and is not sent.
    expect(params).not.toContain(PAYLOAD.email_data.token);
  });

  it("never states that an account exists", () => {
    // A message delivered to the wrong person must not confirm registration
    // (`docs/SECURITY.md` section 13).
    for (const message of Object.values(AUTH_EMAIL_MESSAGES)) {
      const text = `${message.subject} ${message.heading} ${message.body}`;
      expect(text).not.toMatch(
        /your account exists|you are registered|an account was found/i,
      );
    }
  });

  it("tells the reader the link is single-use and expiring", () => {
    for (const action of [
      "signup",
      "recovery",
      "magiclink",
      "invite",
    ] as const) {
      expect(AUTH_EMAIL_MESSAGES[action].body).toMatch(/once|expires/i);
    }
  });
});
