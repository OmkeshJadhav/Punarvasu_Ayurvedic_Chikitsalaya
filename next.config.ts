import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * ## Where each header lives, and why
 *
 * ```text
 *   here, every response      nosniff, X-Frame-Options, Referrer-Policy,
 *                             Permissions-Policy, X-DNS-Prefetch-Control
 *
 *   here, /api/* only         a closed Content-Security-Policy. The proxy's
 *                             matcher excludes /api, so nothing else sets one
 *                             on those responses and there is no risk of two.
 *
 *   src/proxy.ts              the page Content-Security-Policy, which carries
 *                             a per-request nonce and therefore cannot be a
 *                             static config value, and Strict-Transport-
 *                             Security, which must never be sent over the
 *                             plain-HTTP dev server.
 * ```
 *
 * Splitting them is not tidiness: a `headers()` entry is a constant, and two
 * of these five have to be computed per request. Keeping the constants here
 * means they also cover the routes the proxy's matcher skips.
 */
const securityHeaders = [
  // Do not let the browser guess a response's type - an uploaded document
  // served as a guessed type is an XSS vector.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Patient-facing pages must not be framable; clickjacking a booking or a
  // clinical action is a real attack. `frame-ancestors 'none'` in the CSP says
  // the same thing to modern browsers; this is kept for intermediaries and
  // older clients that honour only the header.
  { key: "X-Frame-Options", value: "DENY" },
  // Never leak a full URL (which may identify a patient resource) to another
  // origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in the platform needs these devices; deny by default.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/**
 * The policy for API responses.
 *
 * Every one of them is JSON or a CSV attachment, so almost every directive is
 * moot — which is the point of making it closed rather than thinking about it.
 * `sandbox` is deliberately absent: it would apply to the CSV download and
 * some browsers treat a sandboxed attachment oddly.
 *
 * This matters for exactly one scenario, and it is worth stating because it is
 * not obvious: if a response were ever served with a type a browser renders,
 * `nosniff` stops the guess and this stops anything in it from executing.
 */
const apiContentSecurityPolicy = [
  "default-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/**
 * Image optimization (Phase 20).
 *
 * Every value here was chosen against a measurement or a boundary, not from a
 * checklist. There are exactly two `next/image` consumers in the application -
 * `components/brand/logo.tsx` and `components/marketing/media-frame.tsx` - and
 * between them they only ever render files from `public/images`.
 */
const images: NextConfig["images"] = {
  /**
   * AVIF first, WebP second.
   *
   * The default is `['image/webp']` alone. Order matters: the first entry the
   * browser's `Accept` header matches is the one served, so a browser without
   * AVIF support falls through to WebP rather than to the original JPEG.
   *
   * Measured on the hero at the width a 390px viewport actually requests:
   *
   * ```text
   *   AVIF   22,260 bytes
   *   WebP   37,728 bytes      AVIF is 41% smaller
   *   JPEG   48,806 bytes      the fallback, when neither is accepted
   * ```
   *
   * This was **not** taken on trust. The Next.js documentation recommends
   * WebP for most cases, and a first A/B run appeared to agree - AVIF looked
   * 780ms slower on LCP. That reading was wrong twice over: the AVIF image
   * cache was cold, so the server was encoding on the critical path, and the
   * host was under memory pressure with a 2,600ms spread between samples of
   * the *same* page. Re-run with warm caches, network-only throttling and
   * seven samples a page, the medians were:
   *
   * ```text
   *                          AVIF     WebP
   *   /                     1320ms   1332ms     tie
   *   /services/shirodhara  1176ms   1328ms     AVIF 152ms (11%) faster
   * ```
   *
   * So AVIF is kept. Encoding is slower - the documentation's ~50% figure
   * looks right - but it is paid once per (image, width) and then cached, and
   * this site's images are fixed assets rather than user uploads. Anything
   * deploying this should warm the cache or accept a slow first request per
   * size; that cost is the reason the first measurement lied.
   */
  formats: ["image/avif", "image/webp"],

  /**
   * One quality value, because the application uses exactly one.
   *
   * No component passes a `quality` prop, so every request is the default 75.
   * Declaring the allowlist turns any other value into a 400 instead of a new
   * optimization, which closes a cache-amplification vector: without it,
   * `?q=1` through `?q=100` are 100 distinct cache entries per image per
   * width, all reachable by anyone with the URL.
   */
  qualities: [75],

  /**
   * The optimizer may only touch `public/images`, and only without a query
   * string.
   *
   * This is a Phase 19 control expressed in Phase 20's file. Two things follow
   * from it that are worth stating, because both are currently true by
   * convention and are now true by configuration:
   *
   *   - **A patient document can never be optimized.** Phase 14 decided
   *     deliberately that document previews use a plain `<img>`/`<iframe>` and
   *     never `next/image`, because the optimizer would proxy a patient's file
   *     through a shared cache. Nothing enforced that but a comment. Now a
   *     signed storage URL is a remote URL, no `remotePatterns` are
   *     configured, and the request is refused.
   *   - **The optimizer is not a general-purpose fetcher.** `search: ''`
   *     rejects query strings outright rather than letting an unintended URL
   *     through, which is the case the Next.js documentation warns about when
   *     `search` is omitted.
   */
  localPatterns: [{ pathname: "/images/**", search: "" }],

  // Left at the default (`false`). Phase 14 excluded SVG from the upload
  // allowlist because an SVG is a document that can carry script; enabling it
  // here would reintroduce exactly that, one config line away from the
  // decision that excluded it.
  dangerouslyAllowSVG: false,
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hides the framework version from responses; free reduction in fingerprinting.
  poweredByHeader: false,
  images,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: apiContentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
