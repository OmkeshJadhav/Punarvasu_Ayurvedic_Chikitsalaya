import { Alert } from "@/components/ui/alert";
import { REVIEW_NOTICE } from "@/features/services/content";

/**
 * Says out loud that treatment copy has not been signed off.
 *
 * ## Why this is visible to visitors and not just to the team
 *
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2 requires an obviously marked
 * placeholder wherever real clinic information is unavailable, and
 * `docs/implementation-plan/phase_04.md` section 68 requires that development
 * content never look like verified medical guidance. A comment in a source
 * file satisfies neither: the person at risk is the reader.
 *
 * So the notice renders in the page, in plain language, for as long as the
 * content is unreviewed. It is driven by each treatment's `reviewStatus`, so
 * it disappears one treatment at a time as a practitioner signs the copy off
 * — nobody has to remember to delete anything.
 *
 * `info` rather than `warning`: the content is provisional, not dangerous,
 * and a page of amber alerts would train readers to ignore the one that
 * matters. It is `role="status"` accordingly, set by `Alert`.
 */
export type ContentReviewNoticeContext = "listing" | "detail";

export interface ContentReviewNoticeProps {
  readonly context: ContentReviewNoticeContext;
  readonly className?: string;
}

export function ContentReviewNotice({
  context,
  className,
}: ContentReviewNoticeProps) {
  const notice = REVIEW_NOTICE[context];

  return (
    <Alert tone="info" title={notice.title} className={className}>
      {notice.body}
    </Alert>
  );
}
