import { Info } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { REVIEW_NOTICE } from "@/features/services/content";
import { cn } from "@/lib/utils/cn";

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
 *
 * ## Appearance
 *
 * `quiet` sets the same words as an editorial footnote under a hairline, for
 * the services page, where a tinted box would be the loudest object in a row
 * of photographs. The wording, the role and the visibility are unchanged -
 * only the container is.
 */
export type ContentReviewNoticeContext = "listing" | "detail";

export interface ContentReviewNoticeProps {
  readonly context: ContentReviewNoticeContext;
  readonly appearance?: "alert" | "quiet";
  readonly className?: string;
}

export function ContentReviewNotice({
  context,
  appearance = "alert",
  className,
}: ContentReviewNoticeProps) {
  const notice = REVIEW_NOTICE[context];

  if (appearance === "quiet") {
    return (
      <div
        role="status"
        className={cn(
          "border-border flex items-start gap-3 border-t pt-5",
          className,
        )}
      >
        <Info
          aria-hidden="true"
          className="text-gold mt-0.5 size-4 shrink-0"
          strokeWidth={1.5}
        />
        <p className="text-body-sm text-muted-foreground measure">
          <strong className="text-heading font-medium">{notice.title}.</strong>{" "}
          {notice.body}
        </p>
      </div>
    );
  }

  return (
    <Alert tone="info" title={notice.title} className={className}>
      {notice.body}
    </Alert>
  );
}
