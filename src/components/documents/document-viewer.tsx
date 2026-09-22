"use client";

import { Download, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SIGNED_URL_TTL_SECONDS } from "@/config/documents";
import { requestDocumentAccessAction } from "@/features/documents/actions";
import { DOCUMENT_DETAIL_COPY } from "@/features/documents/content";

/**
 * Opening a document: preview, and download.
 *
 * ## Nothing is fetched until somebody asks
 *
 * Sections 30, 31 and 115. The page renders the document's *metadata*; no
 * signed URL exists until a button is pressed, and the one that is then
 * minted is for that one document, by the server, after it has re-authorized
 * the caller. A list of twenty documents therefore costs zero credentials
 * and zero bytes of file transfer.
 *
 * ## The URL lives in component state and nowhere else
 *
 * Section 67: never in `localStorage`, `sessionStorage` or `IndexedDB`, and
 * never in the URL bar. It is held in a `useState` for as long as the
 * preview is open and discarded when it closes, when it expires, or when the
 * page unmounts. A signed URL is a bearer credential; anything that outlives
 * the moment is a credential somebody left lying about.
 *
 * ## Expiry is handled rather than waited for
 *
 * Section 32 and the acceptance criterion "expired access behaves correctly".
 * A timer closes the preview a little before the URL's own lifetime runs
 * out, so the reader gets a sentence telling them to open it again rather
 * than a frame that silently turns into an XML error from the storage
 * service.
 *
 * ## Why the preview is framed the way it is
 *
 * Section 29, 69 and 70. Only the four formats a browser renders safely are
 * offered a preview at all — and never an SVG or an HTML document, which are
 * not on the upload allowlist in the first place.
 *
 *   * an image renders in an `<img>`, which cannot execute anything;
 *   * a PDF renders in a **sandboxed** `<iframe>`. The frame's origin is the
 *     storage service's, not the application's, so `allow-same-origin` grants
 *     the document its own foreign origin rather than ours — it cannot read
 *     this page, its cookies or its session. `allow-scripts` is present
 *     because a browser's PDF viewer needs it, and the two together are only
 *     dangerous when the framed document is same-origin with the embedder,
 *     which this one is not. Top-level navigation, form submission and
 *     popups are all withheld, and `referrerPolicy="no-referrer"` keeps the
 *     signed URL out of the next request's `Referer`.
 *
 * Nothing is ever sent to a third-party viewer service (section 70).
 */
export function DocumentViewer({
  documentId,
  previewable,
  archived,
}: {
  readonly documentId: string;
  readonly previewable: boolean;
  readonly archived: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "download">(null);
  const [failure, setFailure] = useState<string | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, []);

  function closePreview() {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
    setPreviewUrl(null);
    setPreviewType(null);
  }

  async function openPreview() {
    setBusy("preview");
    setFailure(null);

    const result = await requestDocumentAccessAction(documentId, "preview");

    setBusy(null);

    if (!result.ok) {
      setFailure(result.message);
      return;
    }

    setPreviewUrl(result.access.url);
    setPreviewType(result.access.mimeType);

    // A few seconds before the server's own expiry, so the reader is told
    // rather than shown a storage error.
    const closeAfter = Math.max(result.access.expiresInSeconds - 10, 5) * 1000;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(() => {
      setPreviewUrl(null);
      setPreviewType(null);
      setFailure(DOCUMENT_DETAIL_COPY.expiryNotice);
    }, closeAfter);
  }

  async function download() {
    setBusy("download");
    setFailure(null);

    const result = await requestDocumentAccessAction(documentId, "download");

    setBusy(null);

    if (!result.ok) {
      setFailure(result.message);
      return;
    }

    // The signed URL carries `Content-Disposition: attachment` with the safe
    // filename the server chose, so this downloads rather than navigating.
    // Assigning `location` rather than opening a window keeps a popup
    // blocker out of it, and the URL never becomes this page's address.
    window.location.href = result.access.url;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {previewable ? (
          previewUrl ? (
            <Button type="button" variant="secondary" onClick={closePreview}>
              <EyeOff aria-hidden />
              {DOCUMENT_DETAIL_COPY.previewCloseLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={openPreview}
              loading={busy === "preview"}
              loadingLabel={DOCUMENT_DETAIL_COPY.previewLoadingLabel}
              disabled={busy !== null}
            >
              <Eye aria-hidden />
              {DOCUMENT_DETAIL_COPY.previewOpenLabel}
            </Button>
          )
        ) : null}

        <Button
          type="button"
          onClick={download}
          loading={busy === "download"}
          loadingLabel={DOCUMENT_DETAIL_COPY.downloadPreparingLabel}
          disabled={busy !== null}
        >
          <Download aria-hidden />
          {DOCUMENT_DETAIL_COPY.downloadLabel}
        </Button>
      </div>

      {!previewable ? (
        <Alert tone="info" title={DOCUMENT_DETAIL_COPY.previewUnavailableTitle}>
          {archived
            ? DOCUMENT_DETAIL_COPY.previewArchivedBody
            : DOCUMENT_DETAIL_COPY.previewUnavailableBody}
        </Alert>
      ) : null}

      {failure ? (
        <Alert tone="warning" title={DOCUMENT_DETAIL_COPY.accessErrorTitle}>
          {failure}
        </Alert>
      ) : null}

      {previewUrl ? (
        <figure className="flex flex-col gap-2">
          <div className="border-border bg-muted overflow-hidden rounded-lg border">
            {previewType === "application/pdf" ? (
              <iframe
                src={previewUrl}
                title={DOCUMENT_DETAIL_COPY.previewFrameTitle}
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                className="h-[60vh] max-h-[720px] min-h-80 w-full border-0"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element --
                 A signed, short-lived, cross-origin URL. `next/image` would
                 proxy it through the optimizer, which would cache a patient's
                 document on a shared CDN — exactly what section 66 forbids. */
              <img
                src={previewUrl}
                alt={DOCUMENT_DETAIL_COPY.previewFrameTitle}
                className="mx-auto block max-h-[720px] w-auto max-w-full"
              />
            )}
          </div>
          <figcaption className="text-body-sm text-muted-foreground">
            {DOCUMENT_DETAIL_COPY.expiryNotice}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

/** Exported so a test can assert the timer is derived from the configured TTL. */
export const PREVIEW_TTL_SECONDS = SIGNED_URL_TTL_SECONDS;
