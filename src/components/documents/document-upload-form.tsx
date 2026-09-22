"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_FIELD_LIMITS,
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  isAllowedMimeType,
} from "@/config/documents";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_UPLOAD_COPY,
} from "@/features/documents/content";
import { FILE_REJECTION_MESSAGES } from "@/features/documents/errors";
import { DOCUMENT_TYPES } from "@/features/documents/status";

/**
 * The upload form.
 *
 * ## Why this is the one place in the feature that uses `XMLHttpRequest`
 *
 * Section 49 requires upload progress, and section 113 requires the whole
 * thing to work from a phone. `fetch` cannot report how many bytes of a
 * request body have been sent; `XMLHttpRequest.upload.onprogress` can, and
 * is the only browser API that does. So the form posts multipart to
 * `/api/patient-documents` rather than calling a server action.
 *
 * Everything security-relevant happens on the server. This component
 * controls what section 53 says client state may control — loading, progress
 * and which message is on screen — and nothing it sends is trusted: there is
 * no patient id, no practitioner id, no storage path and no MIME type in the
 * payload, because none of those is a field.
 *
 * ## Success is never claimed early
 *
 * Section 49's last sentence. `upload.onprogress` reaching 100% means the
 * bytes left the browser, not that anything was stored — the server is still
 * inspecting the signature and writing the row. So 100% shows "Almost done —
 * saving the document…" and the success state waits for a `201`.
 *
 * ## Validation happens twice, and neither is the other's substitute
 *
 * Client-side here, so somebody does not watch a 9 MB file upload before
 * being told it is the wrong type. Server-side in
 * `features/documents/upload.ts`, over the actual bytes, which is the check
 * that counts. This one reads `file.type` and `file.size`, both of which the
 * uploader controls — it is a courtesy, and it is commented as one.
 *
 * ## No HTML `required`
 *
 * The Phase 12 defect, guarded from the start: `Field` sets the `required`
 * attribute from its prop, and the browser's own constraint validation then
 * refuses to fire a `submit` event at all — which, with a JavaScript submit
 * handler, means pressing the button does visibly nothing. The fields keep
 * `aria-required` and the required marker; the checks below produce the
 * errors.
 */
export function DocumentUploadForm({
  /** Present only for a practitioner uploading from their own appointment. */
  appointmentId,
  guidance,
  heading,
  description,
}: {
  readonly appointmentId?: string;
  readonly guidance: string;
  readonly heading?: string;
  readonly description?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "finalising" | "done"
  >("idle");
  const [percent, setPercent] = useState(0);

  const pending = phase === "uploading" || phase === "finalising";

  function reset() {
    formRef.current?.reset();
    setFieldErrors({});
    setFailure(null);
    setPercent(0);
    setPhase("idle");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    // The file is taken from the input rather than from the form's own
    // serialisation. Two reasons, and the first is the one that matters:
    // it makes "no file chosen" a state this component can describe
    // precisely, instead of a zero-byte entry it has to infer. The second
    // is that jsdom's `FormData` does not carry a file input's selection,
    // so a form that relied on it could not be driven in the component
    // suite at all — and a component the suite cannot drive is one it
    // cannot catch a defect in.
    const file = fileRef.current?.files?.[0] ?? null;
    if (file) {
      data.set("file", file);
    } else {
      data.delete("file");
    }

    const errors = validate(data);
    setFieldErrors(errors);
    setFailure(null);

    if (Object.keys(errors).length > 0) return;

    setPercent(0);
    setPhase("uploading");

    const request = new XMLHttpRequest();
    request.open("POST", "/api/patient-documents");
    // The reply is JSON either way; asking for it keeps a proxy from
    // negotiating something else.
    request.setRequestHeader("Accept", "application/json");

    request.upload.addEventListener("progress", (progress) => {
      if (!progress.lengthComputable) return;
      const next = Math.round((progress.loaded / progress.total) * 100);
      setPercent(next);
      // The bytes are gone but the server has not answered. Saying "done"
      // here is exactly what section 49 forbids.
      if (next >= 100) setPhase("finalising");
    });

    request.addEventListener("load", () => {
      if (request.status === 201) {
        setPhase("done");
        // The new row is rendered by the page's own authorized read, not
        // from anything this reply carried.
        router.refresh();
        return;
      }
      setPhase("idle");
      setPercent(0);
      setFailure(readSafeMessage(request.responseText));
    });

    request.addEventListener("error", () => {
      setPhase("idle");
      setPercent(0);
      setFailure(DOCUMENT_UPLOAD_COPY.networkFailure);
    });

    request.addEventListener("abort", () => {
      setPhase("idle");
      setPercent(0);
    });

    request.send(data);
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title={DOCUMENT_UPLOAD_COPY.successTitle}>
          {DOCUMENT_UPLOAD_COPY.successBody}
        </Alert>
        <div>
          <Button type="button" variant="secondary" onClick={reset}>
            {DOCUMENT_UPLOAD_COPY.uploadAnotherLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      noValidate
    >
      {appointmentId ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
      ) : null}

      {heading ? (
        <div>
          <h3 className="text-h4 text-heading font-sans font-medium">
            {heading}
          </h3>
          {description ? (
            <p className="text-body-sm text-muted-foreground measure mt-1">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-body-sm text-muted-foreground measure">{guidance}</p>

      {/*
        A real, visible `<input type="file">`. A hidden input behind a styled
        button is the usual way to make one look designed, and it is also the
        usual way to lose the focus ring and the keyboard affordance. Native
        is what opens the camera or the gallery on a phone, which section 113
        asks for and which no custom control can do.
      */}
      <Field
        name="file"
        label={DOCUMENT_UPLOAD_COPY.fileLabel}
        description={DOCUMENT_UPLOAD_COPY.fileDescription}
        error={fieldErrors.file}
        required
        disabled={pending}
      >
        {(control) => (
          <input
            {...control}
            ref={fileRef}
            type="file"
            accept={DOCUMENT_ACCEPT_ATTRIBUTE}
            required={false}
            className="text-body text-foreground file:border-border file:bg-secondary file:text-foreground hover:file:bg-muted focus-visible:outline-ring block min-h-11 w-full cursor-pointer rounded-md py-2 file:mr-4 file:min-h-9 file:cursor-pointer file:rounded-md file:border file:px-4 file:py-2 file:font-sans file:text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        )}
      </Field>

      <Field
        name="documentType"
        label={DOCUMENT_UPLOAD_COPY.typeLabel}
        description={DOCUMENT_UPLOAD_COPY.typeDescription}
        error={fieldErrors.documentType}
        required
        disabled={pending}
      >
        {(control) => (
          <NativeSelect {...control} required={false} defaultValue="">
            <option value="" disabled>
              {DOCUMENT_UPLOAD_COPY.typePlaceholder}
            </option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        name="title"
        label={DOCUMENT_UPLOAD_COPY.titleLabel}
        description={DOCUMENT_UPLOAD_COPY.titleDescription}
        error={fieldErrors.title}
        required
        disabled={pending}
      >
        {(control) => (
          <Input
            {...control}
            required={false}
            maxLength={DOCUMENT_FIELD_LIMITS.title}
            autoComplete="off"
            data-1p-ignore
          />
        )}
      </Field>

      <Field
        name="description"
        label={DOCUMENT_UPLOAD_COPY.descriptionLabel}
        description={DOCUMENT_UPLOAD_COPY.descriptionDescription}
        error={fieldErrors.description}
        disabled={pending}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={DOCUMENT_FIELD_LIMITS.description}
            autoComplete="off"
            data-1p-ignore
          />
        )}
      </Field>

      {pending ? <UploadProgress percent={percent} phase={phase} /> : null}

      {failure ? (
        <Alert tone="danger" title={DOCUMENT_UPLOAD_COPY.failureTitle}>
          {failure}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button
          type="submit"
          loading={pending}
          loadingLabel={DOCUMENT_UPLOAD_COPY.submittingLabel}
          disabled={pending}
          block
          className="sm:w-auto"
        >
          {DOCUMENT_UPLOAD_COPY.submitLabel}
        </Button>
      </div>

      {/*
        Section 40, said rather than implied. Claiming a file is safe when
        nothing checks it would be the worse of the two failures.
      */}
      <p className="text-body-sm text-muted-foreground measure">
        {DOCUMENT_UPLOAD_COPY.scanningNotice}
      </p>
    </form>
  );
}

/**
 * The progress indicator.
 *
 * A `role="progressbar"` with a real `aria-valuenow`, and a **separate**
 * `role="status"` that announces only the coarse phase. Announcing every
 * percentage point would produce forty interruptions on a slow connection,
 * which is worse than no announcement at all; the bar carries the number for
 * anybody who asks for it, and the live region says "uploading" once and
 * "almost done" once.
 */
function UploadProgress({
  percent,
  phase,
}: {
  readonly percent: number;
  readonly phase: "uploading" | "finalising";
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={DOCUMENT_UPLOAD_COPY.progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-body-sm text-muted-foreground"
      >
        {phase === "finalising"
          ? DOCUMENT_UPLOAD_COPY.finalisingText
          : DOCUMENT_UPLOAD_COPY.progressText(percent)}
      </p>
    </div>
  );
}

/**
 * Client-side checks, for feedback only.
 *
 * `file.type` and `file.size` are both the uploader's to choose, so none of
 * this is a security control — the server reads the bytes. What it buys is
 * that somebody on a phone is told about the wrong file *before* spending a
 * minute sending it.
 */
function validate(data: FormData): Record<string, string> {
  const errors: Record<string, string> = {};

  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) {
    errors.file = FILE_REJECTION_MESSAGES.empty;
  } else if (file.size > MAX_DOCUMENT_BYTES) {
    errors.file = FILE_REJECTION_MESSAGES.too_large;
  } else if (file.type !== "" && !isAllowedMimeType(file.type)) {
    // An empty type is common on Android and for HEIC, so it is not treated
    // as a failure here — the server's signature check is what decides.
    errors.file = FILE_REJECTION_MESSAGES.unsupported_signature;
  }

  const documentType = data.get("documentType");
  if (typeof documentType !== "string" || documentType === "") {
    errors.documentType = "Choose what kind of document this is.";
  }

  const title = data.get("title");
  if (typeof title !== "string" || title.trim() === "") {
    errors.title = "Give the document a short title.";
  } else if (title.trim().length > DOCUMENT_FIELD_LIMITS.title) {
    errors.title = `The title is limited to ${DOCUMENT_FIELD_LIMITS.title} characters.`;
  }

  const description = data.get("description");
  if (
    typeof description === "string" &&
    description.trim().length > DOCUMENT_FIELD_LIMITS.description
  ) {
    errors.description = `The description is limited to ${DOCUMENT_FIELD_LIMITS.description} characters.`;
  }

  return errors;
}

/**
 * The message from the API envelope, or a safe fallback.
 *
 * The envelope's `message` is always safe to display by construction
 * (`lib/api/response.ts`), so this is a parse rather than a sanitize — but
 * anything unparseable falls back to our own copy rather than to whatever a
 * proxy or a gateway returned, which might be an HTML error page.
 */
function readSafeMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error?: { message?: unknown } }).error?.message ===
        "string"
    ) {
      return (parsed as { error: { message: string } }).error.message;
    }
  } catch {
    // Not our envelope.
  }
  return DOCUMENT_UPLOAD_COPY.failureBody;
}

/** Exported for the size hint beside the file input. */
export const MAX_UPLOAD_LABEL = formatFileSize(MAX_DOCUMENT_BYTES);
