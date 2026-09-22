import type { Metadata } from "next";

import { AuthPageHeading } from "@/components/auth/auth-page-heading";
import { RegisterForm } from "@/components/auth/register-form";
import { AUTH_PAGES } from "@/features/auth/content";

export const metadata: Metadata = {
  title: AUTH_PAGES.register.title,
  robots: { index: false, follow: false },
};

/**
 * Create an account.
 *
 * A server component; only the form itself is a client component. An
 * already-signed-in visitor is sent to their account by the proxy before this
 * renders, so there is no second "create an account" state to reason about.
 */
export default function RegisterPage() {
  const copy = AUTH_PAGES.register;

  return (
    <>
      <AuthPageHeading title={copy.heading} description={copy.description} />
      <RegisterForm />
    </>
  );
}
