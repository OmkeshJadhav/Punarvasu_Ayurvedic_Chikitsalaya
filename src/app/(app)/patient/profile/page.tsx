import type { Metadata } from "next";
import Link from "next/link";

import { ProfileCompletenessPanel } from "@/components/patient/profile-completeness";
import { ProfileEditor } from "@/components/patient/profile-editor";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { ProfileSummary } from "@/components/patient/profile-summary";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { evaluateCompleteness } from "@/features/patients/completeness";
import {
  PATIENT_AREA,
  PROFILE_COPY,
  PROFILE_FIELDS,
  PROFILE_SECTIONS,
} from "@/features/patients/content";
import { formatMemberSince } from "@/features/patients/format";
import { getPatientProfile } from "@/features/patients/queries";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Metadata for a page holding one person's personal details.
 *
 * `noindex, nofollow`, and the title is the generic "Your profile" — never the
 * patient's name (`phase_07.md` sections 93-94). No description, no Open
 * Graph, no structured data: there is nothing about this page that should
 * appear anywhere outside the session that opened it.
 *
 * The `(app)` layout sets the same robots directive, so this is belt and
 * braces; `robots.txt` disallows `/patient/` as a third layer. None of the
 * three is an access control — `requireUser()` and row-level security are.
 */
export const metadata: Metadata = {
  title: PATIENT_AREA.profile.title,
  robots: { index: false, follow: false },
};

/**
 * The patient profile page.
 *
 * ## Identity and ownership
 *
 * `requireUser()` redirects before anything renders, and
 * `getPatientProfile()` takes no argument — there is no user id to pass, so
 * there is none to substitute. The query is scoped to the verified session and
 * the database's own policy restricts it to the caller's row as well
 * (`phase_07.md` sections 11-12, 47, 52).
 *
 * **Nothing is read from the URL.** No id, no email, no name
 * (sections 11, 83).
 *
 * ## Caching
 *
 * The `(app)` layout is `force-dynamic` and the proxy sets
 * `private, no-store` on every response under `/patient`, so this page is
 * rendered per request and never stored by a shared cache
 * (section 81).
 *
 * ## Three states, three screens
 *
 * A failed read gets an error with a way to retry; no record gets the
 * onboarding form; a record gets the summary with an edit action
 * (sections 64-66).
 */
export default async function PatientProfilePage() {
  const user = await requireUser("/patient/profile");
  const result = await getPatientProfile();

  const copy = PATIENT_AREA.profile;
  const profile = result.status === "found" ? result.profile : null;

  return (
    <Section aria-labelledby="patient-profile-heading">
      <Container width="content">
        <SectionHeader
          as="h1"
          titleId="patient-profile-heading"
          title={
            result.status === "absent"
              ? PROFILE_COPY.createHeading
              : copy.heading
          }
          description={
            result.status === "absent"
              ? PROFILE_COPY.createDescription
              : copy.description
          }
        />

        {result.status === "unavailable" ? (
          <div className="mt-8">
            <ErrorState
              title={PROFILE_COPY.loadErrorTitle}
              description={PROFILE_COPY.loadErrorBody}
              action={
                <Button asChild variant="secondary">
                  {/*
                    A link to this same page rather than a client retry button:
                    the read happens during server rendering, so re-requesting
                    the page is the retry. No client component, and it works
                    before hydration.
                  */}
                  <Link href="/patient/profile">
                    {PROFILE_COPY.loadErrorRetryLabel}
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {profile ? (
              <ProfileCompletenessPanel
                completeness={evaluateCompleteness(profile)}
              />
            ) : null}

            <ProfileEditor
              profile={profile}
              email={user.email}
              summary={
                profile ? (
                  <ProfileSummary profile={profile} email={user.email} />
                ) : null
              }
            />

            {profile ? (
              <ProfileSection
                id="account"
                title={PROFILE_SECTIONS.account.title}
                description={PROFILE_SECTIONS.account.description}
              >
                <ProfileFieldList>
                  <ProfileField
                    label={PROFILE_FIELDS.email.label}
                    value={user.email}
                  />
                  <ProfileField
                    label="Email verified"
                    value={user.emailVerified ? "Yes" : "Not yet"}
                  />
                  {/*
                    Month and year, and nothing more. No row id, no user id, no
                    role, no `updated_at` (`phase_07.md` sections 41-43).
                  */}
                  <ProfileField
                    label="Patient since"
                    value={formatMemberSince(profile.createdAt)}
                  />
                </ProfileFieldList>
              </ProfileSection>
            ) : null}
          </div>
        )}
      </Container>
    </Section>
  );
}
