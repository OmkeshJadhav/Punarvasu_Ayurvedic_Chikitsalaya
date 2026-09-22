"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_FIELD_LIMITS } from "@/config/documents";
import { archiveDocumentAction } from "@/features/documents/actions";
import {
  DOCUMENT_ARCHIVE_COPY,
  DOCUMENT_DETAIL_COPY,
} from "@/features/documents/content";
import { IDLE_DOCUMENT_FORM_STATE } from "@/features/documents/types";

/**
 * Archiving a document (`phase_14.md` sections 34-35).
 *
 * The only removal there is, and it is **a status change, never a delete**:
 * the row, the file, the reason and the whole history survive, and the
 * document stays downloadable. There is no delete control anywhere in this
 * feature because there is no delete function, no delete grant and no delete
 * policy in the database either — absent at four levels rather than hidden
 * at one.
 *
 * It asks first, because withdrawing a report from somebody's record changes
 * what their practitioner will see at the next consultation. The reason is
 * optional and the dialog says it is kept.
 *
 * The control is rendered only for the document's uploader, and that is a
 * courtesy: `archive_patient_document` resolves the document by id **and**
 * by the caller being the uploader in one statement, so somebody who reached
 * this by other means is refused by the database.
 */
export function ArchiveDocumentDialog({
  documentId,
}: {
  readonly documentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    archiveDocumentAction,
    IDLE_DOCUMENT_FORM_STATE,
  );

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "archived") setOpen(false);
  }

  useEffect(() => {
    if (state.status !== "archived") return;
    router.refresh();
  }, [state.status, router]);

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {DOCUMENT_ARCHIVE_COPY.triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="documentId" value={documentId} />

            <DialogHeader>
              <DialogTitle>{DOCUMENT_ARCHIVE_COPY.dialogTitle}</DialogTitle>
              <DialogDescription>
                {DOCUMENT_ARCHIVE_COPY.dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <Field
              name="reason"
              label={DOCUMENT_ARCHIVE_COPY.reasonLabel}
              description={DOCUMENT_ARCHIVE_COPY.reasonDescription}
              disabled={pending}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  maxLength={DOCUMENT_FIELD_LIMITS.archiveReason}
                  autoComplete="off"
                  data-1p-ignore
                />
              )}
            </Field>

            {state.status === "error" && state.message ? (
              <Alert
                tone="danger"
                title={DOCUMENT_DETAIL_COPY.accessErrorTitle}
              >
                {state.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                {DOCUMENT_ARCHIVE_COPY.cancelLabel}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={pending}
                loadingLabel={DOCUMENT_ARCHIVE_COPY.confirmingLabel}
                disabled={pending}
              >
                {DOCUMENT_ARCHIVE_COPY.confirmLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
