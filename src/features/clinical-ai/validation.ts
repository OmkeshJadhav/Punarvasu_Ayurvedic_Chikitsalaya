/**
 * The trust boundary for a clinical AI request.
 *
 * ## What a request may carry, in full
 *
 * An appointment id, a task name, four booleans and up to five document ids.
 * That is the complete list, and it is short on purpose: sections 92 and 93
 * forbid a generic endpoint that accepts arbitrary prompts, patient ids and
 * model configuration, and the cheapest way to honour that is for those
 * parameters not to exist.
 *
 * ## What a request may not carry, and what happens when it tries
 *
 * `patientId`, `practitionerId`, `doctorId`, `clinicalRecordId`, `userId`,
 * `role`, `permission`, `model`, `provider`, `temperature`, `maxTokens`,
 * `systemPrompt`, `prompt`, `instructions`, `promptVersion`, `apiKey`.
 *
 * Every one is **rejected, not stripped**. `strict()` refuses an unexpected
 * key, and the action reads the form through a fixed field list before that,
 * so an extra field is never read in the first place. Two layers, and the
 * reason for the second is Phase 08's lesson: a dropped field is invisible,
 * and a rejected request is a line in a log somebody can investigate.
 *
 * The values themselves would do nothing even if they arrived — the model and
 * the prompt come from frozen tables, and the patient and practitioner are
 * resolved inside the database from `auth.uid()` and the appointment. The
 * schema is a fence around a field that is already empty; it exists so that
 * "can the browser choose the model?" is answerable by reading one file.
 */

import { z } from "zod";

import {
  CLINICAL_AI_TASKS,
  CLINICAL_AI_CONTEXT_LIMITS,
} from "@/config/clinical-ai";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * A checkbox posts `"on"` or is absent. Anything else is somebody hand-writing
 * a request, and `"true"` is accepted alongside `"on"` because a fetch caller
 * would reasonably send it.
 */
const checkboxSchema = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

/**
 * The document selection.
 *
 * Bounded at the context limit, deduplicated, and every entry must be a uuid —
 * so a path, a wildcard or a SQL fragment never reaches a query. Being able to
 * *name* a document is not being able to *read* one: the query filters by the
 * patient and runs under `patient_documents_select_doctor_care`, so an id for
 * another patient's file returns no row (section 58).
 */
const documentIdsSchema = z
  .array(uuidSchema)
  .max(CLINICAL_AI_CONTEXT_LIMITS.maxDocuments)
  .optional()
  .transform((ids) => [...new Set(ids ?? [])]);

export const clinicalAIRequestSchema = z
  .object({
    appointmentId: uuidSchema,
    task: z.enum(CLINICAL_AI_TASKS),
    includeHistory: checkboxSchema,
    includePrescriptions: checkboxSchema,
    includeTreatmentPlans: checkboxSchema,
    documentIds: documentIdsSchema,
  })
  .strict();

export type ClinicalAIRequestInput = z.infer<typeof clinicalAIRequestSchema>;

/**
 * The fields the form is allowed to carry.
 *
 * The first allowlist gate: the action reads only these names out of the
 * `FormData`, so a field the form does not declare is never read at all.
 * Document ids are handled separately because they are repeated.
 */
export const CLINICAL_AI_REQUEST_FIELDS = [
  "appointmentId",
  "task",
  "includeHistory",
  "includePrescriptions",
  "includeTreatmentPlans",
] as const;

/** The repeated field holding selected document ids. */
export const CLINICAL_AI_DOCUMENT_FIELD = "documentIds";
