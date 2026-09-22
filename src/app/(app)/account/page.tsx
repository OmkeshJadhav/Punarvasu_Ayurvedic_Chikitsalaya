import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/config/permissions";
import { NO_ROLE_NOTICE, ROLE_NEXT_STEPS } from "@/features/admin/content";
import { AUTH_PAGES } from "@/features/auth/content";
import { requireUser } from "@/lib/auth/current-user";
import { landingPathForRole } from "@/lib/authorization/routes";
import { AUTHENTICATED_LANDING_PATH, VERIFY_PATH } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: AUTH_PAGES.account.title,
  robots: { index: false, follow: false },
};

/**
 * The authenticated landing page.
 *
 * ## What this page is
 *
 * The proof that the identity foundation works end to end, and the destination
 * every successful sign-in resolves to. It shows the account's email address
 * and whether it has been verified, and offers sign-out. That is the whole
 * scope.
 *
 * ## What it deliberately is not
 *
 * Not a patient dashboard. Appointments, the patient profile, medical history,
 * documents, prescriptions and notifications all belong to later phases, and
 * building a placeholder version of any of them here would be exactly the
 * "placeholder functionality to make a phase look complete" that `AGENTS.md`
 * section 3 rules out. The page says so in plain words rather than showing
 * empty widgets for features that do not exist.
 *
 * ## Identity
 *
 * `requireUser()` again, even though the layout already called it. It is
 * memoised per render pass, so this costs nothing, and it means the page holds
 * the user rather than receiving it through a prop chain that a future
 * refactor could quietly detach from its guard.
 *
 * ## Showing the role (Phase 08)
 *
 * Phase 06 deliberately did not display it, because it authorized nothing and
 * a role badge would have invited the reading that the UI is where permissions
 * live. Now that it is real, the account page is the one place it belongs: a
 * person's own role, on their own account page, is a fact about them that
 * explains what they can see.
 *
 * That is a different thing from the refusal `phase_08.md` section 12 rules
 * out. Telling someone what they *do* have is not telling them what they would
 * have needed, and the forbidden page still says neither.
 *
 * The next step offered under it is chosen from the role, but that choice is
 * cosmetic: the areas themselves guard every request, so a user who somehow
 * saw the wrong card would follow it to a forbidden page rather than into
 * anything.
 */
export default async function AccountPage() {
  const user = await requireUser(AUTHENTICATED_LANDING_PATH);
  const copy = AUTH_PAGES.account;

  return (
    <Section aria-labelledby="account-heading">
      <Container width="prose">
        <SectionHeader
          as="h1"
          titleId="account-heading"
          title={copy.heading}
          description={copy.description}
        />

        <div className="mt-8 flex flex-col gap-6">
          {!user.emailVerified ? (
            <Alert tone="warning" title={copy.unverifiedTitle}>
              <span className="flex flex-col items-start gap-3">
                {copy.unverifiedBody}
                <Button asChild variant="secondary" size="sm">
                  <Link href={VERIFY_PATH}>{copy.verifyLinkLabel}</Link>
                </Button>
              </span>
            </Alert>
          ) : null}

          <Card>
            <CardContent>
              <h2 className="text-h5 font-sans">Sign-in details</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
                <dt className="text-label text-muted-foreground font-medium">
                  Email address
                </dt>
                <dd className="text-body text-foreground break-words">
                  {user.email ?? "Not available"}
                </dd>

                <dt className="text-label text-muted-foreground font-medium">
                  Email verified
                </dt>
                <dd className="text-body text-foreground">
                  {user.emailVerified ? "Yes" : "Not yet"}
                </dd>

                <dt className="text-label text-muted-foreground font-medium">
                  Your role
                </dt>
                <dd className="text-body text-foreground">
                  {user.role ? ROLE_LABELS[user.role] : NO_ROLE_NOTICE.label}
                </dd>
              </dl>
            </CardContent>
          </Card>

          {/*
            The next step for this role. Phase 07 hard-coded the patient card
            here and recorded why that was provisional: `phase_07.md` section 6
            is explicit that not every authenticated user should be assumed to
            be a patient, and sending a doctor's first sign-in to a patient
            onboarding form would be that assumption made silently. Phase 08
            supplies the role that makes the choice correctly.

            A role with no area of its own - a receptionist or a doctor today -
            gets a card with no action, saying so. `phase_08.md` section 23
            forbids fabricating a link to a workspace that does not exist, and
            a disabled menu item would be a promise rather than the truth.
          */}
          {user.role ? (
            <Card>
              <CardContent>
                <h2 className="text-h5 font-sans">
                  {ROLE_NEXT_STEPS[user.role].title}
                </h2>
                <p className="text-body-sm text-muted-foreground measure mt-2">
                  {ROLE_NEXT_STEPS[user.role].body}
                </p>
                {ROLE_NEXT_STEPS[user.role].action ? (
                  <Button asChild className="mt-5">
                    <Link href={landingPathForRole(user.role)}>
                      {ROLE_NEXT_STEPS[user.role].action}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Alert tone="warning" title={NO_ROLE_NOTICE.title}>
              {NO_ROLE_NOTICE.body}
            </Alert>
          )}

          <Card variant="muted">
            <CardContent>
              <h2 className="text-h5 font-sans">What comes next</h2>
              <p className="text-body-sm text-muted-foreground mt-2">
                Punarvasu does not send reminders or notifications yet, so
                please contact the clinic directly for anything your account
                cannot do.
              </p>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
