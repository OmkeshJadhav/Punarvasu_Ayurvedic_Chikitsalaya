/**
 * The sections of the doctor's appointment workspace, and how to link to one.
 *
 * The consultation notes, prescription, treatment plan, documents and AI
 * support for an appointment are all sections of
 * `/doctor/appointments/[id]`. Each has a stable fragment id, and every link
 * into the workspace — from the dashboard, a patient's history, or one of the
 * retired sub-routes that now redirect — goes through `appointmentWorkspaceHref`
 * so the ids live in one place.
 */
export const WORKSPACE_SECTIONS = {
  overview: "overview",
  consultation: "consultation",
  prescription: "prescription",
  treatmentPlan: "treatment-plan",
  documents: "documents",
  ai: "ai-support",
  history: "history",
} as const;

export type WorkspaceSection = keyof typeof WORKSPACE_SECTIONS;

export function appointmentWorkspaceHref(
  appointmentId: string,
  section?: WorkspaceSection,
): string {
  const base = `/doctor/appointments/${encodeURIComponent(appointmentId)}`;
  return section ? `${base}#${WORKSPACE_SECTIONS[section]}` : base;
}
