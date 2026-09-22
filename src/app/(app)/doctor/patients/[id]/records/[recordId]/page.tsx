import type { Metadata } from "next";
import Link from "next/link";

import { ClinicalRecordStatusBadge } from "@/components/clinical/clinical-record-status";
import { ClinicalRecordView } from "@/components/clinical/clinical-section";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatClinicDateTime } from "@/features/appointments/time";
import {
  CLINICAL_AREA,
  CLINICAL_RECORD_VIEW_COPY,
} from "@/features/clinical/content";
import { getClinicalRecord } from "@/features/clinical/queries";
import { isClinicalRecordEditable } from "@/features/clinical/status";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the patient's name and never a clinical word beyond the generic
  // area title. A page title reaches browser history and the tab strip.
  title: CLINICAL_AREA.record.title,
  robots: { index: false, follow: false },
};

/**
 * One clinical record, read.
 *
 * ## The ids in the URL are filters, not keys to the door
 *
 * This is section 56's case exactly: `GET /doctor/patients/A/records/B` must
 * not return record B to any authenticated doctor, and changing either id
 * must not help.
 *
 * It does not. `getClinicalRecord` checks `clinical_records.read` and then
 * runs under `clinical_records_select_author`, which admits the record only
 * when its `practitioner_id` is the caller's own practitioner record. A
 * colleague's record returns `not_found` — the same answer as an id that
 * never existed, so the id is not an oracle either (section 57).
 *
 * The patient id in the path is used for **navigation only**: the "back"
 * link, and a consistency check. It grants nothing, and swapping it does not
 * change which record is returned. The check below refuses a record that does
 * not belong to the patient in the path, so a mismatched pair renders
 * not-found rather than a record filed under the wrong person's page — which
 * would be a clinical safety problem even though it is not a security one.
 *
 * ## No amendment control
 *
 * Section 16 and example 5: a completed record is not editable, and there is
 * no "edit" button here that would be refused. The notice explains the rule
 * instead, which is more useful than a disabled control — and section 17's
 * amendment workflow is deliberately not built.
 *
 * ## No delete control
 *
 * Sections 45 and 46: no automatic deletion, and no hard delete of a
 * completed record through normal UI actions. There is no delete button on
 * this page, no server action behind one, no RPC, and no delete grant or
 * policy on the table. It is absent at four levels rather than hidden at one.
 */
export default async function ClinicalRecordPage({
  params,
}: PageProps<"/doctor/patients/[id]/records/[recordId]">) {
  await requirePermission("clinical_records.read", "/doctor/patients");

  const { id: patientId, recordId } = await params;
  const result = await getClinicalRecord(recordId);

  if (result.status === "unavailable") {
    return (
      <RecordShell patientId={patientId}>
        <ErrorState
          title={CLINICAL_RECORD_VIEW_COPY.loadErrorTitle}
          description={CLINICAL_RECORD_VIEW_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/patients/${patientId}/records/${recordId}`}>
                {CLINICAL_RECORD_VIEW_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </RecordShell>
    );
  }

  // The mismatch case is folded into not-found deliberately: distinguishing
  // "this record exists but belongs to another patient" would disclose that
  // it exists.
  if (result.status === "not_found" || result.record.patientId !== patientId) {
    return (
      <RecordShell patientId={patientId}>
        <EmptyState
          title={CLINICAL_RECORD_VIEW_COPY.notFoundTitle}
          description={CLINICAL_RECORD_VIEW_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/patients">
                {CLINICAL_RECORD_VIEW_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </RecordShell>
    );
  }

  const { record } = result;
  const stillADraft = isClinicalRecordEditable(record.status);

  return (
    <RecordShell patientId={patientId}>
      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-center gap-3">
          <ClinicalRecordStatusBadge status={record.status} />
        </div>

        {stillADraft ? (
          <>
            <Alert
              tone="warning"
              title={CLINICAL_RECORD_VIEW_COPY.draftNotice.title}
            >
              {CLINICAL_RECORD_VIEW_COPY.draftNotice.body}
            </Alert>
            <div>
              <Button asChild>
                <Link
                  href={`/doctor/appointments/${record.appointmentId}/consultation`}
                >
                  {CLINICAL_RECORD_VIEW_COPY.continueDraftLabel}
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <Alert
            tone="success"
            title={CLINICAL_RECORD_VIEW_COPY.completedNotice.title}
          >
            {CLINICAL_RECORD_VIEW_COPY.completedNotice.body}
          </Alert>
        )}

        <ProfileSection
          id="clinical-record-meta"
          // Not "Clinical record": the page's `<h1>` is already that, and both
          // this group and the page frame are named `region` landmarks. Two
          // landmarks of the same role sharing an accessible name is an axe
          // `landmark-unique` violation — the defect Phase 11's browser pass
          // found on five pages.
          title={CLINICAL_RECORD_VIEW_COPY.appointmentLabel}
        >
          <ProfileFieldList>
            <ProfileField
              label={CLINICAL_RECORD_VIEW_COPY.recordedOnLabel}
              value={formatClinicDateTime(record.createdAt)}
            />
            <ProfileField
              label={CLINICAL_RECORD_VIEW_COPY.lastUpdatedLabel}
              value={formatClinicDateTime(record.updatedAt)}
            />
            {record.completedAt ? (
              <ProfileField
                label={CLINICAL_RECORD_VIEW_COPY.completedOnLabel}
                value={formatClinicDateTime(record.completedAt)}
              />
            ) : null}
          </ProfileFieldList>

          <div className="mt-5">
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${record.appointmentId}`}>
                {CLINICAL_RECORD_VIEW_COPY.openAppointmentLabel}
              </Link>
            </Button>
          </div>
        </ProfileSection>

        <ClinicalRecordView content={record} />
      </div>
    </RecordShell>
  );
}

/**
 * The page frame, shared by all three outcomes.
 *
 * It owns the `<h1>` so every state has exactly one, including the two that
 * render an error rather than a record. The heading is the generic
 * "Clinical record" — never the patient's name, never the chief complaint.
 */
function RecordShell({
  patientId,
  children,
}: {
  readonly patientId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="clinical-record-heading">
      <Container width="content">
        <Link
          href={`/doctor/patients/${patientId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {CLINICAL_RECORD_VIEW_COPY.backLabel}
        </Link>

        <h1
          id="clinical-record-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {CLINICAL_RECORD_VIEW_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
