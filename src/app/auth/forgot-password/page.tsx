import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AUTH_PAGES } from "@/features/auth/content";
import { LOGIN_PATH } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: AUTH_PAGES.forgotPassword.title,
  robots: { index: false, follow: false },
};

/**
 * Request password reset instructions.
 *
 * The page itself holds no state and reads nothing from the URL. Everything
 * that matters here is in the action: it answers identically whether the
 * address is registered, unregistered, or the mail provider is down
 * (`docs/SECURITY.md` section 13).
 */
export default function ForgotPasswordPage() {
  const copy = AUTH_PAGES.forgotPassword;

  return (
    <>
      <AuthPageHeading title={copy.heading} description={copy.description} />
      <ForgotPasswordForm />

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
