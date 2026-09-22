import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AUTH_PAGES } from "@/features/auth/content";
import { getCurrentUser } from "@/lib/auth/current-user";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/auth/paths";

/**
 * Reads the session, so it is rendered per request. Declared rather than
 * inferred: a prerendered copy of this page would show one visitor's state to
 * the next (`phase_06.md` section 74).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: AUTH_PAGES.resetPassword.title,
  robots: { index: false, follow: false },
};

/**
 * Choose a new password.
 *
 * ## The gate
 *
 * The form renders only when a session exists, verified on the server with
 * `getUser()` before anything is sent to the browser
 * (`phase_06.md` section 19). Holding a recovery session means having opened
 * the emailed link, so the session *is* the authorization: no token, user id
 * or email is read from this page or posted by its form, which leaves nothing
 * for a caller to substitute.
 *
 * Without a session the page is the "this link is no longer valid" state, with
 * the way to get a new one. That covers all three of the states
 * `phase_06.md` section 20 asks for - expired, already used, and never valid -
 * which are deliberately not distinguished: they are the same instruction to
 * the user, and telling them apart is a small oracle about a token they may
 * not hold.
 *
 * ## Why this route is dynamic
 *
 * It reads the session, so Next.js renders it per request. It must never be
 * statically generated: a prerendered copy would show one visitor's state to
 * the next (`phase_06.md` section 74).
 */
export default async function ResetPasswordPage(
  props: PageProps<"/auth/reset-password">,
) {
  const searchParams = await props.searchParams;
  const linkFailed = searchParams["status"] === "link-invalid";
  const user = await getCurrentUser();
  const copy = AUTH_PAGES.resetPassword;

  if (!user) {
    return (
      <>
        <AuthPageHeading title={copy.invalidHeading} />

        <Alert tone="warning" title="Request a new link" className="mb-6">
          {copy.invalidBody}
        </Alert>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg" block>
            <Link href={FORGOT_PASSWORD_PATH}>{copy.requestNewLinkLabel}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" block>
            <Link href={LOGIN_PATH}>Back to sign in</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthPageHeading title={copy.heading} description={copy.description} />

      {/*
        A session exists, so the form is usable — but the link that brought the
        user here did not work. That happens when an already-signed-in person
        opens an expired or already-used reset link. Rendering the form in
        silence would leave them believing the link worked; saying so, while
        still letting them change the password they are entitled to change, is
        the honest state (`phase_06.md` section 20).
      */}
      {linkFailed ? (
        <Alert tone="warning" title="That link had expired" className="mb-6">
          You&rsquo;re already signed in, so you can still choose a new password
          here. The link itself is no longer valid and cannot be used again.
        </Alert>
      ) : null}

      <ResetPasswordForm />
    </>
  );
}
