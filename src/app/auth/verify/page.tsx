import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AUTH_PAGES } from "@/features/auth/content";
import { readPendingVerificationEmail } from "@/features/auth/pending-email";
import { AUTH_SAFE_MESSAGES } from "@/features/auth/errors";
import { LOGIN_PATH } from "@/lib/auth/paths";

/**
 * Reads the pending-email cookie, so it is rendered per request. Declared
 * rather than inferred, for the same reason as the reset page.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: AUTH_PAGES.verify.title,
  robots: { index: false, follow: false },
};

/**
 * "Check your email", and the way out when it never arrives.
 *
 * Reached from three directions: straight after registering, from a resend,
 * and from the callback when a verification link turned out to be expired or
 * already used.
 *
 * ## The address
 *
 * Read from the short-lived `httpOnly` cookie the registration action set, not
 * from a query parameter - an email address in a URL is written to access
 * logs, kept in browser history on what may be a shared computer, and sent as
 * a `Referer` (`features/auth/pending-email.ts`, `phase_06.md` section 75).
 * When the cookie has expired or the page was opened directly, the copy simply
 * does not name an address rather than guessing at one.
 *
 * ## The failed-link state
 *
 * `?status=link-invalid` is set by the callback route, and it is the only
 * value this page reads from the URL. It is compared against a constant, never
 * rendered, so the parameter cannot be used to put text on the page. The
 * message is ours; the provider's reason stayed in the server log
 * (`phase_06.md` sections 13 and 20).
 */
export default async function VerifyEmailPage(
  props: PageProps<"/auth/verify">,
) {
  const searchParams = await props.searchParams;
  const linkFailed = searchParams["status"] === "link-invalid";
  const pendingEmail = await readPendingVerificationEmail();

  const copy = AUTH_PAGES.verify;

  return (
    <>
      <AuthPageHeading
        title={copy.heading}
        description={
          pendingEmail ? (
            <>
              We&rsquo;ve sent a verification link to{" "}
              <strong className="text-foreground font-medium">
                {pendingEmail}
              </strong>
              . Open it on this device to finish setting up your account.
            </>
          ) : (
            copy.descriptionWithoutEmail
          )
        }
      />

      {linkFailed ? (
        <Alert tone="warning" title="That link didn't work" className="mb-6">
          {AUTH_SAFE_MESSAGES.expiredLink}
        </Alert>
      ) : (
        <div className="bg-muted text-body-sm text-muted-foreground mb-6 flex items-start gap-3 rounded-md p-4">
          <MailCheck
            aria-hidden="true"
            className="text-primary mt-0.5 size-5 shrink-0"
          />
          <p>{copy.spamHint}</p>
        </div>
      )}

      <Separator className="my-6" />

      <section aria-labelledby="resend-heading">
        <h2 id="resend-heading" className="text-h5 font-sans">
          {copy.resendHeading}
        </h2>
        <p className="text-body-sm text-muted-foreground mt-1 mb-5">
          {copy.resendDescription}
        </p>

        <ResendVerificationForm
          {...(pendingEmail ? { defaultEmail: pendingEmail } : {})}
        />
      </section>

      <p className="text-body-sm mt-8 text-center">
        <Link
          href={LOGIN_PATH}
          className="text-primary hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {copy.backToLoginLabel}
        </Link>
      </p>
    </>
  );
}
