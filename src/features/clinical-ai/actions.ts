"use server";

/**
 * The clinical AI server action.
 *
 * ## One action, and it returns text
 *
 * There is exactly one exported action in this feature, it generates a
 * suggestion, and it returns it as panel state. There is no `applyAction`, no
 * `acceptAction`, no `saveAction` and no `copyToRecordAction` — sections 72,
 * 76 and 111, and example 9. A practitioner who wants to use something they
 * read here types it into the consultation form, which is a different feature
 * with a different action and its own validation.
 *
 * That is not an oversight to be fixed later. It is the structural half of
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` section 6: "a note in a specification
 * saying the doctor should review this is not a control". The control is that
 * there is nowhere for AI text to go.
 *
 * ## What it reads from the request
 *
 * Five named fields and a repeated document id. Read through a fixed list, so
 * an extra field is never read; parsed with `strict()`, so an unexpected key
 * is rejected rather than dropped. A request carrying `patientId`,
 * `practitionerId`, `model`, `systemPrompt` or `temperature` is refused, and
 * would have done nothing had it been accepted (sections 92, 93).
 *
 * ## Why `can()` rather than `assertPermission()` at this layer
 *
 * The same reason as the patient, reception, doctor and clinical actions: this
 * reports failure as state beside a control. An action that throws inside a
 * form submission produces an error boundary, and here that would replace the
 * consultation the practitioner is in the middle of — which is exactly what
 * section 50 says an AI failure must never do. The service re-checks the
 * permission on its own trusted path, and the database re-checks the role.
 *
 * ## What is never logged
 *
 * No clinical content, no prompt, no response, no patient name, no patient id.
 * The operation, the actor's opaque id, the task and a failure category
 * (section 90, example in section 162).
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";

import { describeClinicalAIFailure } from "./errors";
import { generateClinicalAISupport } from "./service";
import type { ClinicalAIPanelState } from "./types";
import {
  CLINICAL_AI_DOCUMENT_FIELD,
  CLINICAL_AI_REQUEST_FIELDS,
  clinicalAIRequestSchema,
} from "./validation";

export async function generateClinicalAIAction(
  _previousState: ClinicalAIPanelState,
  formData: FormData,
): Promise<ClinicalAIPanelState> {
  const user = await getCurrentUser();

  if (!user || !can(user.role, "clinical_ai.use")) {
    if (user) {
      logger.warn("authz.denied", {
        userId: user.id,
        reason: "permission",
        permission: "clinical_ai.use",
      });
    }

    // Names no role and no permission (`phase_08.md` section 12).
    return {
      status: "failed",
      failureCode: "not_configured",
      message: describeClinicalAIFailure("not_configured"),
    };
  }

  // The first allowlist gate: only these names are read out of the form.
  const values: Record<string, string> = {};
  for (const field of CLINICAL_AI_REQUEST_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }

  const documentIds = formData
    .getAll(CLINICAL_AI_DOCUMENT_FIELD)
    .filter((value): value is string => typeof value === "string");

  const parsed = clinicalAIRequestSchema.safeParse({
    ...values,
    // Absent rather than an empty array when nothing is selected, so the
    // schema's own optional handling applies rather than an empty list being
    // treated as a deliberate "none".
    ...(documentIds.length > 0 ? { documentIds } : {}),
    // A checkbox that was not ticked is absent from the form, and reading it
    // above produced an empty string. `undefined` is what the schema expects.
    includeHistory: values.includeHistory || undefined,
    includePrescriptions: values.includePrescriptions || undefined,
    includeTreatmentPlans: values.includeTreatmentPlans || undefined,
  });

  if (!parsed.success) {
    logger.warn("clinical_ai.invalid_request", { userId: user.id });
    return {
      status: "failed",
      failureCode: "context_unavailable",
      message: describeClinicalAIFailure("context_unavailable"),
    };
  }

  const request = parsed.data;

  const outcome = await generateClinicalAISupport({
    appointmentId: request.appointmentId,
    task: request.task,
    selection: {
      includeHistory: request.includeHistory,
      includePrescriptions: request.includePrescriptions,
      includeTreatmentPlans: request.includeTreatmentPlans,
      documentIds: request.documentIds,
    },
  });

  if (outcome.status === "failed") {
    return {
      status: "failed",
      failureCode: outcome.failureCode,
      message: outcome.message,
    };
  }

  // Deliberately no `revalidatePath`. Nothing was written, so there is nothing
  // to revalidate — and revalidating the consultation would discard a
  // practitioner's unsaved notes to display a suggestion about them.
  return { status: "ok", result: outcome.result };
}
