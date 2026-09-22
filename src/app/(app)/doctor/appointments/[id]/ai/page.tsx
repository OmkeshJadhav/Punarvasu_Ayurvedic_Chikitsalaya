import type { Metadata } from "next";
import Link from "next/link";

import { ClinicalAISupportPanel } from "@/components/clinical-ai/ai-support-panel";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { PatientClinicalHeader } from "@/components/clinical/patient-clinical-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";
import {
  getClinicalAIAvailability,
  getConsultationContextFingerprint,
  listSelectableDocuments,
} from "@/features/clinical-ai/queries";
import { getConsultationSubject } from "@/features/clinical/queries";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the patient's name and never the task. A page title reaches browser
  // history, the tab strip and a screen share, and a consulting-room screen is
  // read over shoulders — the same rule the consultation page follows.
  title: CLINICAL_AI_COPY.heading,
  robots: { index: false, follow: false },
};

/**
 * AI clinical support for one appointment.
 *
 * ## Reached from the consultation, and separate from it
 *
 * Section 73's flow — `doctor -> consultation -> AI clinical support` — and
 * section 135's rule that AI must not dominate the workflow. It is its own
 * route rather than a block inside the consultation, which has two
 * consequences worth naming:
 *
 *   * a practitioner who never opens it never sees it, and the consultation
 *     page is byte-for-byte what it was before this phase apart from one link;
 *   * a request in flight cannot freeze the consultation (section 138),
 *     because the consultation is a different page they can walk back to.
 *
 * ## Authorization
 *
 * Four independent scopes, and this page adds none of them itself:
 *
 *   * `requirePermission("clinical_ai.use")` — the route guard;
 *   * `assert_care_practitioner()` — inside every database function;
 *   * `appointments_select_own_practitioner` — the appointment, and so the
 *     patient;
 *   * `patients_select_doctor_care`, `clinical_records_select_author`,
 *     `patient_documents_select_doctor_care` — everything the context builder
 *     can read.
 *
 * A request for another practitioner's appointment is `not_found` before a
 * single clinical field is read, and that is the same answer an appointment
 * that never existed gets.
 *
 * ## Four unavailable states, and each is a different page
 *
 * | state | what it means |
 * | --- | --- |
 * | `not_configured` | this deployment has no AI, which is an ordinary state |
 * | `no_practitioner_record` | this account is not on the scheduling roster |
 * | `unavailable` | something is wrong right now |
 * | `ready` | ready |
 *
 * Each sends somebody to check a different thing. Section 122: an unconfigured
 * deployment shows "AI unavailable", not a broken application.
 */
export default async function ClinicalAIPage({
  params,
}: PageProps<"/doctor/appointments/[id]/ai">) {
  await requirePermission("clinical_ai.use", "/doctor/appointments");

  const { id } = await params;

  const availability = await getClinicalAIAvailability();

  if (availability.status !== "ready") {
    const copy =
      availability.status === "not_configured"
        ? CLINICAL_AI_COPY.notConfigured
        : availability.status === "no_practitioner_record"
          ? CLINICAL_AI_COPY.noPractitionerRecord
          : CLINICAL_AI_COPY.unavailable;

    return (
      <AIShell appointmentId={id}>
        {availability.status === "unavailable" ? (
          <ErrorState
            title={copy.title}
            description={copy.body}
            action={
              <Button asChild variant="secondary">
                <Link href={`/doctor/appointments/${id}/ai`}>Try again</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={copy.title}
            description={copy.body}
            action={
              <Button asChild>
                <Link href={`/doctor/appointments/${id}/consultation`}>
                  {CLINICAL_AI_COPY.backLabel}
                </Link>
              </Button>
            }
          />
        )}
      </AIShell>
    );
  }

  const subject = await getConsultationSubject(id);

  if (subject.status !== "found") {
    return (
      <AIShell appointmentId={id}>
        <EmptyState
          title={CLINICAL_AI_COPY.notFound.title}
          description={CLINICAL_AI_COPY.notFound.body}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">Back to appointments</Link>
            </Button>
          }
        />
      </AIShell>
    );
  }

  const [fingerprint, documents] = await Promise.all([
    getConsultationContextFingerprint(id),
    listSelectableDocuments(id),
  ]);

  return (
    <AIShell appointmentId={id}>
      <div className="flex flex-col gap-10">
        {/*
          The same header the consultation uses, so a practitioner can satisfy
          themselves this is the right person before reading anything generated
          about them. Reused rather than rebuilt — it already carries name,
          date of birth, derived age and phone, which is the set that
          distinguishes two people with the same name.
        */}
        <PatientClinicalHeader
          patient={subject.patient}
          appointment={subject.appointment}
        />

        {/*
          Deliberately not a second `<section aria-labelledby>`.

          It was one, headed with the same words as the `<h1>`, and axe
          reported `landmark-unique` at both widths: two `region` landmarks
          sharing one accessible name, so a screen-reader user navigating by
          landmark met "AI clinical support" twice and could not tell which was
          which. That is precisely the defect Phase 11 found on three doctor
          pages and fixed there, arriving again — and it is the defect that
          only a real browser can see, because the component suite renders the
          panel on its own and the collision only exists once a page puts one
          inside a named region.

          The outer `Section` already names this region from the `<h1>`. A
          nested one adds a landmark and a heading that both say what has
          already been said, so both are gone and the intro sits directly under
          the heading it belongs to.
        */}
        <div className="flex flex-col gap-6">
          <p className="text-body text-muted-foreground measure">
            {CLINICAL_AI_COPY.intro}
          </p>

          <ClinicalAISupportPanel
            appointmentId={id}
            currentFingerprint={fingerprint}
            usage={availability.usage}
            documents={documents}
          />
        </div>
      </div>
    </AIShell>
  );
}

/**
 * The page frame.
 *
 * Owns the single `<h1>`, which is the generic phrase and never the patient's
 * name — the same rule the consultation page follows, for the same reason.
 * The back link goes to the consultation rather than the appointment, because
 * that is where the practitioner came from and where their notes are.
 */
function AIShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="clinical-ai-heading">
      <Container width="content">
        <Link
          href={`/doctor/appointments/${appointmentId}/consultation`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {CLINICAL_AI_COPY.backLabel}
        </Link>

        <h1
          id="clinical-ai-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {CLINICAL_AI_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
