import { redirect } from "next/navigation";

import { appointmentWorkspaceHref } from "@/features/doctor/workspace";

/**
 * Retired: the documents are a section of the appointment page now.
 *
 * Kept as a redirect so bookmarks, browser history and any link still
 * pointing here land on the right section instead of a 404. The destination
 * guards itself, so nothing is checked here and nothing is read.
 */
export default async function DocumentsRedirect({
  params,
}: PageProps<"/doctor/appointments/[id]/documents">) {
  const { id } = await params;
  redirect(appointmentWorkspaceHref(id, "documents"));
}
