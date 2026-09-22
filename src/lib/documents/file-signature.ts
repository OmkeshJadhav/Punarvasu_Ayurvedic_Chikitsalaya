/**
 * What a file actually is, read from its own bytes.
 *
 * ## Why the browser's answer is not enough
 *
 * `phase_14.md` sections 11, 84, 85 and attack 9. `file.type` is whatever the
 * browser inferred, usually from the extension, and both are chosen by the
 * uploader:
 *
 * ```text
 * bad   if (file.name.endsWith(".pdf")) upload();
 * good  declared type + extension + the file's own signature must agree
 * ```
 *
 * So a Windows executable renamed `report.pdf` and posted with
 * `Content-Type: application/pdf` passes both of the checks an uploader
 * controls, and fails this one — because its first bytes are `MZ` and not
 * `%PDF-`.
 *
 * ## What this is not
 *
 * Section 85: *"do not attempt to implement an incomplete antivirus engine.
 * Document limitations clearly."*
 *
 * This reads the first few bytes of a file and answers one question: is this
 * a container of the type it claims to be? It does **not** answer whether the
 * contents are safe. A genuine PDF can carry an embedded script; a genuine
 * JPEG can be crafted to exploit a decoder. Those are the province of a
 * malware scanner, which this deployment does not have — recorded in
 * `docs/progress/progress_phase_14.md` as a stated limitation rather than
 * implied away.
 *
 * What makes that acceptable is that nothing in Punarvasu ever *executes*, or
 * server-side renders, an uploaded file (section 41). It is stored, and it is
 * handed back to the person who is entitled to it. The one place a file meets
 * a renderer is a preview, and that is a sandboxed frame or an `<img>` for
 * the four formats a browser handles safely.
 *
 * ## Why signatures and not a library
 *
 * Six formats, each with a documented magic number, is forty lines. A
 * dependency would be more code in the bundle and one more thing to trust
 * with a path that patient data flows down.
 */

import { isAllowedMimeType, type AllowedMimeType } from "@/config/documents";

/** Enough bytes for every signature below, with room to spare. */
export const SIGNATURE_SAMPLE_BYTES = 32;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** `%PDF-`. The version follows; it is not checked, because it varies. */
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** SOI plus the first marker byte. Every JPEG variant starts this way. */
const JPEG = [0xff, 0xd8, 0xff];

/** The eight-byte PNG signature, including the CRLF/EOF trap bytes. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * ISO base media brands that mean "this is a still image in HEIF".
 *
 * `heic`/`heix`/`hevc`/`hevx` are what an iPhone writes; `mif1`/`msf1` are
 * the generic image and image-sequence brands. Anything else in an ISO-BMFF
 * container — `mp4`, `qt`, `avif` — is not on the allowlist and is refused,
 * which matters: they share the same first eight bytes.
 */
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "heim", "heis", "hevm", "hevs"]);

/**
 * The type these bytes actually are, or `null` for anything not on the
 * allowlist.
 *
 * `null` is the safe answer for an empty file, a truncated file, an unknown
 * format and a dangerous one alike — the caller refuses all four the same
 * way, so there is no branch in which "we could not tell" becomes "allow it".
 */
export function detectMimeType(bytes: Uint8Array): AllowedMimeType | null {
  if (startsWith(bytes, PDF)) return "application/pdf";
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";

  // RIFF....WEBP. The four bytes between are the chunk size, so they are
  // skipped rather than matched.
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }

  if (asciiAt(bytes, 4, 4) === "ftyp") {
    const brand = asciiAt(bytes, 8, 4).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "image/heic";
    if (HEIF_BRANDS.has(brand)) return "image/heif";
    // A video or an AVIF in the same container family. Not on the allowlist.
    return null;
  }

  return null;
}

/** The extensions a given detected type may legitimately carry. */
const EXTENSIONS_FOR_TYPE: Readonly<
  Record<AllowedMimeType, readonly string[]>
> = {
  "application/pdf": ["pdf"],
  // Both spellings, because both are what cameras and phones produce.
  "image/jpeg": ["jpg", "jpeg", "jpe"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  // A phone frequently writes `.heic` for a file whose brand is `mif1`, and
  // the reverse. Treating the two as interchangeable is correct rather than
  // lenient: both are HEIF stills, neither is rendered, and refusing the
  // mismatch would reject ordinary iPhone photographs.
  "image/heic": ["heic", "heif"],
  "image/heif": ["heic", "heif"],
};

/** The declared types a given detected type may legitimately be sent as. */
const DECLARED_TYPES_FOR_TYPE: Readonly<
  Record<AllowedMimeType, readonly string[]>
> = {
  "application/pdf": ["application/pdf"],
  "image/jpeg": ["image/jpeg", "image/jpg", "image/pjpeg"],
  "image/png": ["image/png", "image/x-png"],
  "image/webp": ["image/webp"],
  "image/heic": ["image/heic", "image/heif", "image/heic-sequence"],
  "image/heif": ["image/heic", "image/heif", "image/heif-sequence"],
};

export type FileRejectionReason =
  | "empty"
  | "too_large"
  | "unsupported_signature"
  | "extension_mismatch"
  | "declared_type_mismatch";

export type FileInspection =
  | { readonly ok: true; readonly mimeType: AllowedMimeType }
  | { readonly ok: false; readonly reason: FileRejectionReason };

export function fileExtensionOf(fileName: string): string {
  // `split` rather than a regex over the whole name, so a name containing a
  // path separator cannot produce a surprising match. The name is metadata
  // here and never becomes a path, but the check should still not be the
  // clever one.
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * The server's verdict on one uploaded file.
 *
 * All three of section 11's checks, in the order that makes the cheapest one
 * decisive first — but every one of them must pass:
 *
 * ```text
 * the bytes           what the file actually is
 * the extension       must be one this type may carry
 * the declared type   must be one this type may be sent as
 * ```
 *
 * The **detected** type is what is returned and what gets stored, so the
 * declared one is never written anywhere even when it agrees.
 */
export function inspectUploadedFile({
  bytes,
  fileName,
  declaredType,
  size,
  maxBytes,
}: {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly declaredType: string;
  readonly size: number;
  readonly maxBytes: number;
}): FileInspection {
  if (size <= 0 || bytes.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (size > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const detected = detectMimeType(bytes);
  if (detected === null) {
    return { ok: false, reason: "unsupported_signature" };
  }

  const extension = fileExtensionOf(fileName);
  if (!EXTENSIONS_FOR_TYPE[detected].includes(extension)) {
    return { ok: false, reason: "extension_mismatch" };
  }

  const declared = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!DECLARED_TYPES_FOR_TYPE[detected].includes(declared)) {
    return { ok: false, reason: "declared_type_mismatch" };
  }

  // Unreachable by construction — every value in the detection table is on
  // the allowlist — and asserted anyway, because this is the value that
  // becomes a storage path and a `Content-Type`.
  if (!isAllowedMimeType(detected)) {
    return { ok: false, reason: "unsupported_signature" };
  }

  return { ok: true, mimeType: detected };
}
