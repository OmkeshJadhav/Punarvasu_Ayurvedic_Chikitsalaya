/**
 * Patient document configuration.
 *
 * ## Why this is configuration rather than a constant in a validator
 *
 * `phase_14.md` section 12 is explicit: the size limit must be centralized
 * rather than hard-coded at a random call site, and it has to be chosen
 * against real constraints — Supabase's own limits, the deployment's request
 * limits, what a clinic's reports actually weigh, and what a patient can
 * upload from a phone on a mobile connection.
 *
 * ## The same numbers exist in three places, on purpose
 *
 * ```text
 * src/config/documents.ts      so the browser can refuse a file before
 *                              spending a minute uploading it
 * public.patient_documents     check constraints, which hold against any
 *                              writer whatever the application does
 * the patient-documents bucket file_size_limit and allowed_mime_types, which
 *                              hold even if a write reached storage directly
 * ```
 *
 * Three copies of a rule is a divergence waiting to happen, and the failure
 * it produces here is concrete: a patient watches a 9 MB scan upload and is
 * then told it is too large. So `documents.test.ts` **parses the migration**
 * and asserts that all three agree. A test that restated the numbers would
 * agree with a wrong migration; this one reads it.
 *
 * ## The allowlist, and what is deliberately not on it
 *
 * Sections 10 and 29. PDFs and photographs, because that is what a lab report
 * and a scan actually are.
 *
 * **`image/svg+xml` is not on the list and must never be.** An SVG is a
 * document that can carry script, and rendering one from a patient's upload
 * would be handing an attacker a same-origin XSS on a healthcare portal.
 * `text/html`, `application/xml`, archives and anything executable are absent
 * for the same family of reasons. The allowlist is closed: a type not named
 * here is rejected, so adding a format is a deliberate decision somebody
 * reviews rather than an omission somebody exploits.
 */

/**
 * Every type the clinic accepts, with the extension the server gives the
 * stored object and whether a browser can be trusted to render it.
 *
 * `previewable` is a **safety** judgement, not a capability one. A PDF and
 * the three web image formats render in a sandboxed frame or an `<img>` with
 * no scripting and no same-origin reach; HEIC is a container no browser
 * renders, so it is offered for download only and the UI says so rather than
 * showing an empty box.
 */
export const ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": { extension: "pdf", label: "PDF", previewable: true },
  "image/jpeg": { extension: "jpg", label: "JPEG image", previewable: true },
  "image/png": { extension: "png", label: "PNG image", previewable: true },
  "image/webp": { extension: "webp", label: "WebP image", previewable: true },
  /**
   * The format an iPhone produces by default. Excluded, it would be the
   * single most common upload failure a clinic in India sees; included, a
   * patient can send the photograph they already have. No browser renders
   * it, so it downloads rather than previews.
   */
  "image/heic": { extension: "heic", label: "HEIC image", previewable: false },
  "image/heif": { extension: "heif", label: "HEIF image", previewable: false },
} as const satisfies Record<
  string,
  {
    readonly extension: string;
    readonly label: string;
    readonly previewable: boolean;
  }
>;

export type AllowedMimeType = keyof typeof ALLOWED_DOCUMENT_TYPES;

export const ALLOWED_MIME_TYPES = Object.keys(
  ALLOWED_DOCUMENT_TYPES,
) as readonly AllowedMimeType[];

/** The `accept` attribute for a file input, so the picker filters for us. */
export const DOCUMENT_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_MIME_TYPES,
  // Some Android pickers match on extension rather than type, and an iPhone
  // reports `image/heic` inconsistently across versions.
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
].join(",");

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(ALLOWED_DOCUMENT_TYPES, value);
}

export function documentExtensionFor(mimeType: AllowedMimeType): string {
  return ALLOWED_DOCUMENT_TYPES[mimeType].extension;
}

export function isPreviewableMimeType(mimeType: string): boolean {
  return (
    isAllowedMimeType(mimeType) && ALLOWED_DOCUMENT_TYPES[mimeType].previewable
  );
}

/**
 * The largest file the clinic accepts, in bytes.
 *
 * 10 MB. Chosen, not guessed: a scanned multi-page pathology report is
 * typically 1–4 MB, a phone photograph of a report 2–6 MB, and a plain
 * diagnostic PDF well under 1 MB. It leaves headroom for a long scanned
 * record while staying inside what a patient can upload over a mobile
 * connection without the request timing out, and well inside Supabase's own
 * per-object limits.
 *
 * Mirrored by `patient_documents_file_size_range` and by the bucket's
 * `file_size_limit`.
 */
export const MAX_DOCUMENT_BYTES = 10_485_760;

/** The bucket. Private, and the only one that holds patient data. */
export const DOCUMENT_BUCKET = "patient-documents";

/**
 * How long a signed URL lives (section 32).
 *
 * Five minutes: long enough to open a PDF on a slow connection, short enough
 * that a URL copied out of a network panel or left in a shared browser is
 * worthless within the length of a consultation. It is emphatically not the
 * thirty days section 32 warns against.
 *
 * The URL is minted per request, after authorization, and is never stored —
 * not in the database, not in a page, not in browser storage.
 */
export const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The most documents one list renders.
 *
 * Bounded rather than paged, like every other list in this project: the query
 * limits itself, the page says so, and a patient with more than twenty
 * documents is not somebody a page-two control would help more than a
 * narrower view would. Section 114's "do not download all documents".
 */
export const DOCUMENT_LIST_LIMIT = 20;

/** Field bounds, mirrored by the migration's check constraints. */
export const DOCUMENT_FIELD_LIMITS = {
  title: 160,
  description: 500,
  fileName: 255,
  archiveReason: 300,
} as const;

/**
 * A human-readable size.
 *
 * Deliberately coarse — one decimal place at most. A patient deciding whether
 * a file will upload over a mobile connection needs "2.4 MB", not
 * "2,517,113 bytes".
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

/** The limit, as the UI says it. One sentence, one source. */
export const MAX_DOCUMENT_SIZE_LABEL = formatFileSize(MAX_DOCUMENT_BYTES);
