import { apiSuccess } from "@/lib/api/response";
import { createRouteHandler } from "@/lib/api/route-handler";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  forbiddenError,
  internalError,
  rateLimitedError,
  unauthorizedError,
  validationError,
} from "@/lib/errors/app-error";
import { uploadPatientDocument } from "@/features/documents/upload";
import type { DocumentUploadResult } from "@/features/documents/types";

/**
 * Uploading a patient document.
 *
 * ## Why a route handler rather than a server action
 *
 * `phase_14.md` section 49 requires upload progress, and section 113 requires
 * it to work from a phone on a mobile connection — where a 6 MB scan takes
 * long enough that a spinner with no number is genuinely distressing.
 *
 * A server action gives no progress. `XMLHttpRequest.upload.onprogress`
 * against an endpoint does, and it is the only browser API that reports
 * bytes sent. So the browser posts multipart here, and the one thing the
 * client learns from the reply is a document id.
 *
 * Everything else about the request is treated exactly as a server action's
 * payload would be: authenticated, authorized, validated against a strict
 * schema, and with every identity that matters derived rather than accepted.
 *
 * ## What it discloses
 *
 * A document id, and nothing else. The page then reloads and renders the new
 * row through the ordinary authorized read, so nothing on screen comes from
 * a payload this endpoint handed back.
 *
 * ## What it never accepts
 *
 * A patient id, a practitioner id, an uploader id, a storage path, a MIME
 * type, a file size, a checksum or a status. The first three are derived,
 * the path is generated and then **recomputed by the database** and
 * compared, and the last three are properties of the bytes that the server
 * measures for itself. A field carrying any of them is rejected by
 * `strict()` rather than dropped.
 *
 * ## Caching
 *
 * `private, no-store`. A reply carries a document id, and a mutation must
 * not be cached by anything under any circumstances (section 66).
 */
export const POST = createRouteHandler(
  "patient-documents.upload",
  async (request) => {
    const user = await getCurrentUser();
    if (!user) throw unauthorizedError();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      // A malformed or truncated multipart body. Nothing was stored, and the
      // parser's own message describes our framework rather than their file.
      throw validationError(
        {},
        {
          message:
            "We couldn't read that upload. The file was not saved — please try again.",
          cause: new Error("Unparseable multipart body."),
        },
      );
    }

    const outcome = await uploadPatientDocument(user, formData);

    if (!outcome.ok) {
      // The workflow has already logged the cause against an opaque user id.
      // Which `AppError` category it becomes decides the status code and
      // nothing else; the message is the safe one the workflow chose, and it
      // never contains a path, a bucket, a table or a policy.
      if (outcome.reason === "forbidden") {
        throw forbiddenError({
          message: outcome.message,
          cause: new Error("Missing a document upload permission."),
        });
      }

      if (outcome.reason === "rate_limited") {
        // Phase 19. A real 429, so a client can tell "slow down" from "that
        // file was wrong" — and so a script gets the status that says stop
        // rather than one that says try a different file.
        throw rateLimitedError({
          message: outcome.message,
          cause: new Error("Document upload rate limit exceeded."),
        });
      }

      if (
        outcome.reason === "storage_failed" ||
        outcome.reason === "metadata_failed"
      ) {
        throw internalError({
          message: outcome.message,
          cause: new Error(`Document upload failed: ${outcome.reason}`),
        });
      }

      throw validationError(
        outcome.fieldErrors
          ? Object.fromEntries(
              Object.entries(outcome.fieldErrors).map(([key, value]) => [
                key,
                [value],
              ]),
            )
          : {},
        {
          message: outcome.message,
          cause: new Error(`Document upload rejected: ${outcome.reason}`),
        },
      );
    }

    return apiSuccess<DocumentUploadResult>(
      { documentId: outcome.documentId },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  },
);
