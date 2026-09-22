import type { Metadata } from "next";

import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH_PAGES } from "@/features/auth/content";
import { readNextParam, safeRedirectPath } from "@/lib/auth/redirect";

/**
 * Rendered per request.
 *
 * It already was, because it reads `searchParams` — but Phase 19 gives this
 * page a nonce-based Content-Security-Policy, and a nonce only works on a
 * route Next.js renders on demand. Declaring it means the header keeps
 * working if the `next` parameter is ever read some other way, rather than
 * silently breaking every script on the sign-in page.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: AUTH_PAGES.login.title,
  robots: { index: false, follow: false },
};

/**
 * Sign in.
 *
 * The `next` parameter is validated **here**, before it is rendered into a
 * hidden field, and validated **again** in the server action before it becomes
 * a redirect. Two passes, on purpose: this one keeps a hostile value out of
 * the HTML entirely, and the action's pass holds even if this page is
 * bypassed, which it can be - a form post does not require our page to have
 * rendered it (`phase_06.md` sections 16 and 83).
 *
 * `safeRedirectPath` with an empty fallback is used so that a rejected
 * destination produces *no* hidden field at all, rather than one carrying the
 * default. The result is the same landing page, without a field that suggests
 * the request was honoured.
 *
 * An already-signed-in visitor is redirected to their account by the proxy
 * before this page renders (`phase_06.md` section 42).
 */
export default async function LoginPage(props: PageProps<"/auth/login">) {
  const searchParams = await props.searchParams;
  const next = safeRedirectPath(readNextParam(searchParams), "");

  const copy = AUTH_PAGES.login;

  return (
    <>
      <AuthPageHeading title={copy.heading} description={copy.description} />
      <LoginForm {...(next === "" ? {} : { next })} />
    </>
  );
}
