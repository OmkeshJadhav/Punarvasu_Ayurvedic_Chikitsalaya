import { RecentNotifications } from "@/components/notifications/recent-notifications";
import { PATIENT_DASHBOARD } from "@/features/patients/content";
import type { NotificationListResult } from "@/features/notifications/types";

/**
 * The patient dashboard's "recent updates" panel.
 *
 * The panel itself is `RecentNotifications`, shared with the practitioner's
 * day; this supplies the patient's words. Keeping the binding here rather than
 * passing `PATIENT_DASHBOARD.updates` in from the page means the dashboard
 * still renders `<RecentUpdates result={...} />` and the copy for a patient
 * screen still lives beside the patient screen.
 *
 * Everything the panel does — the unread word rather than a tint, the absent
 * "mark as read", the link that authorizes nothing — is documented there.
 */
export function RecentUpdates({
  result,
}: {
  readonly result: NotificationListResult;
}) {
  return (
    <RecentNotifications result={result} copy={PATIENT_DASHBOARD.updates} />
  );
}
