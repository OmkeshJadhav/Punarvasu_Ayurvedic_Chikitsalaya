/**
 * Content-Security-Policy.
 *
 * ## Why this arrives in Phase 19 and not earlier
 *
 * Phase 01 deferred a policy on the grounds that one written before the
 * application loads anything is either broken or decorative. Phase 02 recorded
 * it as unblocked, and Phases 03-18 each carried it forward. What settles it
 * now is not that somebody finally got round to it: it is that the set of
 * origins the browser reaches is closed and knowable, so the policy can be an
 * allow-list of things that genuinely exist rather than a guess.
 *
 * ## Two tiers, and why the split is real rather than convenient
 *
 * A nonce-based policy requires dynamic rendering: Next.js injects the nonce
 * during server rendering, from the CSP header on the request, so a page
 * prerendered at build time has no nonce to inject and its scripts are
 * blocked. That is not a detail to work around — it is the whole trade.
 *
 * Punarvasu's route table divides along exactly the line that matters:
 *
 * ```text
 *   protected paths   every route under `isProtectedPath()`. All dynamic
 *                     (the `(app)` layout is `force-dynamic`). All patient
 *                     and clinical data lives here.   -> STRICT, nonce
 *
 *   everything else   the static marketing site, the two static auth pages.
 *                     Content is developer-authored configuration; no user
 *                     input is rendered on any of them.  -> BASELINE
 * ```
 *
 * So the strong policy costs nothing — it is applied only to pages that were
 * already rendered per request — and it is applied precisely where an injected
 * script would have a session and a patient record to steal.
 *
 * Making the public pages strict as well would mean making thirty statically
 * prerendered pages dynamic, which is a deliberate result of Phases 03-05 and
 * a real performance regression, in exchange for hardening pages that render
 * no untrusted content. That trade is refused, and this comment is the record
 * of refusing it rather than of overlooking it.
 *
 * ## `'unsafe-inline'` in `style-src`, on both tiers
 *
 * `phase_19.md` section 77 permits it where technically required and
 * documented. It is required, and here is the evidence rather than the
 * assertion:
 *
 *   * Radix positions its popovers, selects and dialogs with inline `style`
 *     attributes, and drives the accordion's height from
 *     `--radix-accordion-content-height` the same way.
 *   * Six components of our own set an inline width or font from a runtime
 *     value: the two progress bars, the upload progress meter, the analytics
 *     chart, `Reveal`, and `global-error.tsx` — which by definition renders
 *     when the stylesheet may not have loaded.
 *
 * Under CSP Level 3 an inline `style` *attribute* falls back to `style-src`
 * when `style-src-attr` is absent, and a nonce cannot cover it: a nonce
 * applies to an element, and an attribute has none. Blocking them would break
 * every dialog, select and progress indicator in the product.
 *
 * The exposure this leaves is narrow and worth stating plainly: inline styles
 * permit CSS-based exfiltration tricks against content already on the page.
 * They do not execute script. `script-src` is where the real boundary is, and
 * on the tier that holds clinical data it carries no `'unsafe-inline'` at all.
 *
 * ## What the browser is actually allowed to reach
 *
 * Nothing in this application uses the browser Supabase client — verified: no
 * client component imports `lib/supabase/browser.ts`, and nothing imports
 * `@supabase/ssr` outside the server modules. So `connect-src` is `'self'`,
 * and the database is not a browser-reachable origin at all.
 *
 * Two frame origins exist, one per tier, each the narrowest thing that works:
 *
 *   * baseline — `https://www.google.com`, the contact page's map.
 *   * strict   — the Supabase origin, for a signed document preview. A
 *                patient's PDF renders in a sandboxed frame whose `src` is a
 *                short-lived signed URL on that origin.
 */

interface CspInputs {
  /**
   * The Supabase project origin, or `null` when it is unconfigured.
   *
   * Origin only — never the full URL, and never a key. A policy naming a path
   * is a policy that stops working the day a path changes.
   */
  readonly supabaseOrigin: string | null;
  /**
   * `next dev` only. React's development build uses `eval` to reconstruct
   * server stacks in the browser, and HMR opens a websocket. Neither is true
   * of a production build, and neither relaxation is ever emitted there.
   */
  readonly isDevelopment: boolean;
}

/**
 * Directives every response carries, whichever tier it is on.
 *
 * `frame-ancestors 'none'` is the modern statement of the clickjacking
 * protection `X-Frame-Options: DENY` has been making since Phase 01. Both are
 * sent: the older header is still honoured by some intermediaries, and the two
 * do not conflict.
 */
function sharedDirectives(inputs: CspInputs): string[] {
  const directives = [
    "default-src 'self'",
    // A `<base>` injected into a page rewrites every relative URL on it,
    // including the ones forms post to.
    "base-uri 'self'",
    // No Flash, no applets, no `<object>`. Nothing in the product uses one,
    // and an `<object>` is a script-execution context.
    "object-src 'none'",
    "frame-ancestors 'none'",
    // A form on our origin may post only to our origin. This is the directive
    // that turns an injected form into a dead end.
    "form-action 'self'",
    // Fonts are self-hosted by `next/font`, so there is no third-party font
    // request to permit (`docs/SECURITY.md` section 23).
    "font-src 'self'",
    // `data:` for the inline SVG placeholders `next/image` emits, `blob:` for
    // the object URLs an upload preview creates.
    "img-src 'self' data: blob:",
    "media-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    // Reasoned at length in this module's header. Not an oversight.
    "style-src 'self' 'unsafe-inline'",
  ];

  directives.push(
    inputs.isDevelopment
      ? // HMR's websocket. `ws:`/`wss:` rather than a host, because the dev
        // server's port moves.
        "connect-src 'self' ws: wss:"
      : // The browser talks to this origin and nothing else. See the header.
        "connect-src 'self'",
  );

  if (!inputs.isDevelopment) {
    // Rewrites any accidental `http://` subresource to `https://` before the
    // request leaves the browser. Omitted in development, where the dev server
    // is plain HTTP and this would break every asset.
    directives.push("upgrade-insecure-requests");
  }

  return directives;
}

/**
 * The policy for a protected, dynamically rendered route.
 *
 * `'strict-dynamic'` means a browser that understands it ignores `'self'` and
 * every host expression in `script-src`, trusting only the nonced scripts and
 * whatever those scripts load. That is what makes the policy resistant to an
 * injected `<script src>`: the attacker would have to guess the nonce.
 *
 * @param nonce Fresh per request. A reused nonce is not a nonce.
 */
export function buildStrictCsp(nonce: string, inputs: CspInputs): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(inputs.isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  return serialize([
    ...sharedDirectives(inputs),
    `script-src ${scriptSources.join(" ")}`,
    // The signed image preview is fetched from the storage origin. Declared
    // after the shared `img-src` so it replaces it: a CSP takes the *first*
    // occurrence of a directive, so the order here matters and this list is
    // filtered below rather than relying on that.
    ...(inputs.supabaseOrigin
      ? [`img-src 'self' data: blob: ${inputs.supabaseOrigin}`]
      : []),
    // The document preview frame, whose `src` is a short-lived signed URL.
    // With Supabase unconfigured there is nothing to frame, so the directive
    // closes rather than opening to everything.
    inputs.supabaseOrigin
      ? `frame-src 'self' ${inputs.supabaseOrigin}`
      : "frame-src 'none'",
  ]);
}

/**
 * The policy for a static, publicly cacheable route.
 *
 * `script-src` carries `'unsafe-inline'` because Next.js streams its flight
 * payload through inline `<script>` tags and a prerendered page cannot be
 * given a nonce. That is the documented consequence of static rendering, not a
 * shortcut: the alternative is dynamic rendering for the whole marketing site.
 *
 * What makes it an acceptable trade *here specifically* is that these routes
 * render no user-controlled content at all. Every string on them comes from
 * `config/` or `features/*\/content.ts`, both developer-authored and both in
 * version control. There is no stored value, no query parameter and no
 * uploaded field rendered on any of them — so there is no injection point for
 * `'unsafe-inline'` to make exploitable.
 */
export function buildBaselineCsp(inputs: CspInputs): string {
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(inputs.isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  return serialize([
    ...sharedDirectives(inputs),
    `script-src ${scriptSources.join(" ")}`,
    // The contact page's map. One origin, named exactly.
    "frame-src 'self' https://www.google.com",
  ]);
}

/**
 * The origin of a configured Supabase URL, or `null`.
 *
 * Never throws: a CSP builder that can fail takes the whole site down when a
 * variable is malformed, which is a worse outcome than a policy that closes
 * `frame-src` on a deployment with no database.
 */
export function supabaseOriginFor(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // A CSP source expression may carry no path, query or credentials, and
    // `origin` is the only part guaranteed to carry none of them.
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

/**
 * A fresh nonce.
 *
 * 128 bits from the platform CSPRNG, base64-encoded. `crypto.getRandomValues`
 * rather than `Math.random`, and rather than a UUID: a nonce's only job is to
 * be unguessable, and a v4 UUID spends six of its bits on version and variant
 * markers for no benefit here.
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Joins directives into a header value.
 *
 * A duplicate directive name is dropped rather than emitted, because a browser
 * honours the **first** occurrence and silently ignores the rest — so a second
 * `img-src` would look like a widening and behave like nothing at all. Callers
 * that mean to override a shared directive list it last; this keeps the later,
 * more specific one.
 */
function serialize(directives: readonly string[]): string {
  const byName = new Map<string, string>();
  for (const directive of directives) {
    const value = directive.trim();
    const name = value.split(/\s+/)[0] ?? value;
    byName.set(name, value);
  }
  return [...byName.values()].join("; ");
}
