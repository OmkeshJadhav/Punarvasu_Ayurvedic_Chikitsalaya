import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FORBIDDEN_PAGE } from "@/features/admin/content";
import { AUTHENTICATED_LANDING_PATH } from "@/lib/auth/paths";

/**
 * The forbidden experience.
 *
 * ## What it says, and what it refuses to say
 *
 * It says that this part of Punarvasu is not available to your account, and it
 * gives you two ways out. It does **not** say which role you hold, which role
 * would have been required, which permission was missing, or which policy
 * refused you (`phase_08.md` section 12 and example 6). Those details would
 * tell an attacker with a low-privilege account exactly what the privilege
 * model looks like, and they tell a legitimate user nothing they can act on -
 * the remedy is the same sentence either way: ask the clinic.
 *
 * The specifics are in the server log against an opaque user id, where they
 * are diagnosable without being disclosable.
 *
 * ## Why it lives inside the authenticated shell
 *
 * Because it is a page a signed-in person reads, not a status code. Sitting in
 * `(app)` means it keeps the header, the navigation for the areas they *can*
 * use, and sign-out - so being refused one area does not strand them
 * (`phase_08.md` section 28). It also means `requireUser()` runs first, so an
 * unauthenticated visitor is sent to sign in rather than being told they are
 * forbidden from something they have not yet identified themselves for.
 *
 * ## Status code
 *
 * This is a redirect target, so the browser sees 303 then 200 rather than 403.
 * That is the right trade for a human navigating: a 403 body is not something
 * a browser renders usefully, and the page is `noindex` and behind
 * authentication either way. Programmatic callers do not come here - a server
 * action or route handler gets a `forbidden` `AppError` and a real 403 from
 * the response envelope.
 */
export const metadata: Metadata = {
  title: "Access not available",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <Section aria-labelledby="forbidden-heading">
      <Container width="prose">
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className="text-primary bg-accent flex size-12 items-center justify-center rounded-full"
          >
            <ShieldAlert className="size-5" />
          </span>

          <h1 id="forbidden-heading" className="text-h2 text-heading">
            {FORBIDDEN_PAGE.title}
          </h1>

          <p className="text-body text-muted-foreground measure">
            {FORBIDDEN_PAGE.description}
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href={AUTHENTICATED_LANDING_PATH}>
                {FORBIDDEN_PAGE.accountAction}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">{FORBIDDEN_PAGE.homeAction}</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
