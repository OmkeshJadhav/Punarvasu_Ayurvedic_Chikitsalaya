import { redirect } from "next/navigation";

import { ADMIN_LANDING_PATH } from "@/lib/authorization/routes";

/**
 * The administration area has no overview of its own.
 *
 * An administrator's work begins on the clinic dashboard, so `/admin` sends
 * them there. The route still exists — rather than being deleted — because
 * `/admin` is the area's address: it is what the area navigation, the
 * breadcrumbs and any bookmark point at, and each of those should arrive
 * somewhere useful rather than at a 404.
 *
 * The admin layout above has already checked the permission before this runs,
 * so an unauthorized request is refused there and never reaches the redirect.
 */
export default function AdminIndexPage() {
  redirect(ADMIN_LANDING_PATH);
}
