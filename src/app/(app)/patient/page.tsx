import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { AttentionPanel } from "@/components/patient/attention-panel";
import { CareSummary } from "@/components/patient/care-summary";
import { DashboardPanel } from "@/components/patient/dashboard-panel";
import { NextVisitCard } from "@/components/patient/next-visit-card";
import { RecentUpdates } from "@/components/patient/recent-updates";
import { Button } from "@/components/ui/button";
import { CONTACT_PATH } from "@/config/navigation";
import { DASHBOARD_NOTIFICATION_COUNT } from "@/config/notifications";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import { getNextAppointment } from "@/features/appointments/queries";
import {
  getUnreadNotificationCount,
  listRecentNotifications,
} from "@/features/notifications/queries";
import { deriveAttentionItems } from "@/features/patients/attention";
import { evaluateCompleteness } from "@/features/patients/completeness";
import { PATIENT_DASHBOARD } from "@/features/patients/content";
import { getPatientProfile } from "@/features/patients/queries";
import { listPatientPrescriptions } from "@/features/prescriptions/queries";
import { listPatientTreatmentPlans } from "@/features/treatment-plans/queries";
import { requireUser } from "@/lib/auth/current-user";

/**
 * The patient's home.
 *
 * ## What this page is
 *
 * `phase_18.md` section 5's order, top to bottom: the next appointment, what
 * needs the patient's attention, the care their practitioner has shared, and
 * what has happened recently. Four panels, each answering a question a patient
 * actually arrives with, and nothing else.
 *
 * Section 64 lists what it must not be — KPI cards, decorative charts, dense
 * tables, a "welcome back" shell — and the constraint that keeps it honest is
 * section 7: nothing here is invented. Every figure and every sentence comes
 * from a row the database returned, and where there is no row the panel says
 * so.
 *
 * ## The data: six small queries, in parallel, none unbounded
 *
 * Sections 81, 82, 94 and 128. There is deliberately no
 * `getEverythingForPatient()`. Each panel's data is fetched by the narrowest
 * query that answers it:
 *
 *   * the next appointment is **one row**, chosen by the database, not the
 *     whole appointment history filtered in JavaScript — the defect this phase
 *     found and fixed in `getNextAppointment`;
 *   * the care tiles ask for **one** prescription and **one** plan;
 *   * recent updates asks for **three** notifications;
 *   * the unread count is a bounded `head` count against a partial index.
 *
 * They run concurrently (section 83), so the page costs one round trip rather
 * than six in sequence.
 *
 * ## A failure in one panel does not take the page down
 *
 * Section 129. Every query returns a discriminated result rather than
 * throwing, so a document outage renders a quiet notice inside its own panel
 * while the next appointment above it still shows. The distinction between
 * "nothing" and "we could not read it" is carried all the way to the screen,
 * because telling a patient they have no prescription when the database was
 * briefly unreachable is a clinically misleading thing to do (section 72).
 *
 * ## Privacy
 *
 * The patient's name appears in the greeting — their own name, on their own
 * page, which is the personalization section 6 asks for. It does **not** appear
 * in the metadata below: section 99 wants a generic browser title, because a
 * title reaches history, a tab strip and a screenshot. Nothing clinical
 * appears anywhere on this page, and no identifier is rendered at all.
 */
export const metadata: Metadata = {
  title: PATIENT_DASHBOARD.title,
  robots: { index: false, follow: false },
};

export default async function PatientDashboardPage() {
  const user = await requireUser("/patient");

  // One clock for the whole render, so the "is it imminent?" line and the
  // "which appointment is next?" query cannot disagree by the milliseconds
  // between two calls.
  const now = new Date();

  const [
    profile,
    nextAppointment,
    prescriptions,
    treatmentPlans,
    recentNotifications,
    unread,
  ] = await Promise.all([
    getPatientProfile(),
    getNextAppointment(now),
    listPatientPrescriptions(1),
    listPatientTreatmentPlans(1),
    listRecentNotifications(DASHBOARD_NOTIFICATION_COUNT),
    getUnreadNotificationCount(),
  ]);

  const copy = PATIENT_DASHBOARD;

  // A failed profile read is treated as "we do not know", not as "absent":
  // `deriveAttentionItems` is given `null` only when the record genuinely is
  // not there, so an outage cannot produce a "complete your profile" prompt
  // for somebody who completed it last year.
  const completeness =
    profile.status === "found"
      ? evaluateCompleteness(profile.profile)
      : profile.status === "absent"
        ? evaluateCompleteness(null)
        : null;

  const attentionItems = deriveAttentionItems({
    completeness: profile.status === "absent" ? null : completeness,
    nextAppointment:
      nextAppointment.status === "found" ? nextAppointment.appointment : null,
    unreadNotifications: unread.status === "ok" ? unread.count : 0,
  });

  const greetingName =
    profile.status === "found"
      ? (profile.profile.preferredName ?? profile.profile.fullName)
      : (user.displayName ?? null);

  return (
    <Section aria-labelledby="patient-dashboard-heading">
      <Container width="content">
        <header className="flex flex-col gap-2">
          <h1
            id="patient-dashboard-heading"
            className="text-h2 text-heading font-medium"
          >
            {greetingName
              ? copy.greeting(greetingName)
              : copy.greetingAnonymous}
          </h1>
          <p className="text-body text-muted-foreground measure">
            {copy.description}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-12">
          <NextVisitCard result={nextAppointment} now={now} />

          <DashboardPanel
            heading={copy.attention.heading}
            headingId="patient-attention-heading"
          >
            <AttentionPanel items={attentionItems} />
          </DashboardPanel>

          <DashboardPanel
            heading={copy.care.heading}
            headingId="patient-care-heading"
            description={copy.care.description}
          >
            <CareSummary
              prescriptions={prescriptions}
              treatmentPlans={treatmentPlans}
            />
          </DashboardPanel>

          <DashboardPanel
            heading={copy.updates.heading}
            headingId="patient-updates-heading"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/notifications">{copy.updates.viewAllLabel}</Link>
              </Button>
            }
          >
            <RecentUpdates result={recentNotifications} />
          </DashboardPanel>

          {/*
            The one primary action the page closes on. Booking is the thing a
            patient most often came to do and did not find above, and
            `DESIGN_SYSTEM.md` section 46 warns against several competing
            primary calls to action — so there is exactly one here, and the
            rest of the page's destinations are quiet links.
          */}
          <DashboardPanel
            heading={copy.quickActions.heading}
            headingId="patient-actions-heading"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild>
                <Link href="/patient/appointments/book">
                  {APPOINTMENT_COPY.bookLabel}
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/patient/appointments">Your appointments</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/patient/profile">Your profile</Link>
              </Button>
            </div>
          </DashboardPanel>

          {/*
            Sections 59 and 60. One sentence, near the foot, where somebody
            scanning for "how do I get help" will find it — not a banner at the
            top, which section 59 warns turns into wallpaper, and not a triage
            widget, which section 60 forbids.
          */}
          <footer className="border-border flex flex-col gap-3 border-t pt-8">
            <p className="text-body-sm text-muted-foreground measure">
              {copy.emergencyNote}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {copy.helpNote}{" "}
              <Link
                href={CONTACT_PATH}
                className="text-primary focus-visible:outline-ring rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {copy.helpLinkLabel}
              </Link>
            </p>
          </footer>
        </div>
      </Container>
    </Section>
  );
}
