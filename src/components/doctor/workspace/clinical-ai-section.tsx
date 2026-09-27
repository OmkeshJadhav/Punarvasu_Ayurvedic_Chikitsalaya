import Link from "next/link";

import { ClinicalAISupportPanel } from "@/components/clinical-ai/ai-support-panel";
import { WorkspaceSection } from "@/components/doctor/workspace/workspace-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";
import {
  getClinicalAIAvailability,
  getConsultationContextFingerprint,
  listSelectableDocuments,
} from "@/features/clinical-ai/queries";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  appointmentWorkspaceHref,
} from "@/features/doctor/workspace";

/**
 * AI clinical support for this appointment — formerly its own page at `/ai`.
 *
 * Last among the sections, and deliberately so: `phase_17.md` section 135
 * keeps the primary workflow patient -> clinical record -> doctor decision,
 * with AI secondary. It produces nothing that is saved; the notes, the
 * prescription and the plan above are the record.
 *
 * The caller renders this only when `clinical_ai.use` is held.
 * `getClinicalAIAvailability` asserts it again, and every database function
 * behind the panel re-checks the role (`phase_08.md` section 10, layer 1).
 */
export async function ClinicalAISection({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const availability = await getClinicalAIAvailability();
  const id = WORKSPACE_SECTIONS.ai;
  const title = DOCTOR_WORKSPACE_COPY.sections.ai;

  if (availability.status !== "ready") {
    const copy =
      availability.status === "not_configured"
        ? CLINICAL_AI_COPY.notConfigured
        : availability.status === "no_practitioner_record"
          ? CLINICAL_AI_COPY.noPractitionerRecord
          : CLINICAL_AI_COPY.unavailable;

    return (
      <WorkspaceSection id={id} title={title}>
        {availability.status === "unavailable" ? (
          <ErrorState
            title={copy.title}
            description={copy.body}
            action={
              <Button asChild variant="secondary">
                <Link href={appointmentWorkspaceHref(appointmentId, "ai")}>
                  Try again
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState title={copy.title} description={copy.body} />
        )}
      </WorkspaceSection>
    );
  }

  const [fingerprint, documents] = await Promise.all([
    getConsultationContextFingerprint(appointmentId),
    listSelectableDocuments(appointmentId),
  ]);

  return (
    <WorkspaceSection
      id={id}
      title={title}
      description={CLINICAL_AI_COPY.intro}
    >
      <ClinicalAISupportPanel
        appointmentId={appointmentId}
        currentFingerprint={fingerprint}
        usage={availability.usage}
        documents={documents}
      />
    </WorkspaceSection>
  );
}
