import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES } from "@/config/documents";
import {
  detectMimeType,
  fileExtensionOf,
  inspectUploadedFile,
  SIGNATURE_SAMPLE_BYTES,
} from "./file-signature";

/**
 * What a file actually is.
 *
 * ## The attack this file exists to defeat
 *
 * `phase_14.md` attack 9, and sections 11, 84 and 85. A dangerous file
 * renamed `report.pdf` and posted with `Content-Type: application/pdf`
 * passes both of the checks the uploader controls. The signature check is
 * the one they do not control, and every case below is written from that
 * angle: *what does somebody send to get a bad file past this?*
 *
 * ## What is deliberately not asserted
 *
 * That an accepted file is safe. It is not — a genuine PDF can carry an
 * embedded script and a genuine JPEG can be crafted to exploit a decoder.
 * Section 85 forbids pretending otherwise, and the limitation is recorded in
 * `docs/progress/progress_phase_14.md` rather than implied away here.
 */

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/**
 * Bytes from readable pieces: text spelled out, and raw bytes as numbers.
 *
 * The container fixtures are built this way rather than from escapes,
 * because a signature written as `"RIFF", NUL, NUL, NUL, NUL, "WEBP"` is
 * something a reader can check against the format specification, and the
 * same thing written as a quoted string full of escaped zero bytes is not.
 *
 * It also keeps the file clear of the corruption Phase 06 recorded, where the
 * formatter rewrote unicode escapes **inside a regex character class** into
 * the literal bytes they denote. That does not happen inside an ordinary
 * string literal — verified after formatting, and guarded repository-wide by
 * `tests/integration/source-hygiene.test.ts` — so the few escapes left below
 * are safe. These helpers are for legibility.
 */
function build(...parts: (string | number)[]): Uint8Array {
  const values: number[] = [];
  for (const part of parts) {
    if (typeof part === "number") values.push(part);
    else for (const character of part) values.push(character.charCodeAt(0));
  }
  return new Uint8Array(values);
}

function ascii(text: string): Uint8Array {
  return build(text);
}

const NUL = 0x00;

const PDF = build("%PDF-1.7", 0x0a, "some content");
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
const WEBP = build("RIFF", NUL, NUL, NUL, NUL, "WEBPVP8 ");

/** An ISO base media container: a box length, `ftyp`, and a brand. */
function heif(brand: string): Uint8Array {
  return build(NUL, NUL, NUL, 0x18, "ftyp", brand);
}

describe("detectMimeType", () => {
  it("recognises every format on the allowlist", () => {
    expect(detectMimeType(PDF)).toBe("application/pdf");
    expect(detectMimeType(JPEG)).toBe("image/jpeg");
    expect(detectMimeType(PNG)).toBe("image/png");
    expect(detectMimeType(WEBP)).toBe("image/webp");

    for (const brand of ["heic", "heix", "hevc", "hevx"]) {
      expect(detectMimeType(heif(brand)), brand).toBe("image/heic");
    }
    for (const brand of ["mif1", "msf1", "heim", "heis", "hevm", "hevs"]) {
      expect(detectMimeType(heif(brand)), brand).toBe("image/heif");
    }
  });

  it("refuses an executable, a script and an archive", () => {
    // A Windows executable, an ELF binary, a shell script, a Zip/Office
    // container and a Mach-O binary. Every one of these is something an
    // attacker would like stored under a name the clinic will later open.
    expect(detectMimeType(ascii("MZ\u0090\u0000"))).toBeNull();
    expect(detectMimeType(bytes(0x7f, 0x45, 0x4c, 0x46))).toBeNull();
    expect(detectMimeType(ascii("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(detectMimeType(ascii("PK\u0003\u0004"))).toBeNull();
    expect(detectMimeType(bytes(0xcf, 0xfa, 0xed, 0xfe))).toBeNull();
  });

  it("refuses the two formats a browser would execute", () => {
    // An SVG and an HTML document are not on the allowlist, and this is the
    // layer that notices when one arrives under another name.
    expect(
      detectMimeType(ascii('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBeNull();
    expect(detectMimeType(ascii("<!DOCTYPE html><html>"))).toBeNull();
    expect(detectMimeType(ascii("<?xml version=\u00221.0\u0022?>"))).toBeNull();
  });

  it("refuses a video or an AVIF sharing the HEIF container", () => {
    // `ftyp` alone is not enough: `mp4`, `qt` and `avif` have the identical
    // first eight bytes, and only the brand tells them apart.
    for (const brand of ["mp42", "isom", "qt  ", "avif", "avis", "M4V "]) {
      expect(detectMimeType(heif(brand)), brand).toBeNull();
    }
  });

  it("refuses an empty or truncated file rather than guessing", () => {
    expect(detectMimeType(new Uint8Array(0))).toBeNull();
    expect(detectMimeType(ascii("%PD"))).toBeNull();
    expect(detectMimeType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectMimeType(ascii("RIFF"))).toBeNull();
    // RIFF with the wrong form type is a WAV, not a WebP.
    expect(
      detectMimeType(ascii("RIFF\u0000\u0000\u0000\u0000WAVE")),
    ).toBeNull();
  });

  it("needs no more than the sample the caller reads", () => {
    // The upload path passes only the first `SIGNATURE_SAMPLE_BYTES`, so a
    // signature that needed more would silently never match.
    for (const sample of [PDF, JPEG, PNG, WEBP, heif("heic")]) {
      expect(detectMimeType(sample.subarray(0, SIGNATURE_SAMPLE_BYTES))).toBe(
        detectMimeType(sample),
      );
    }
  });
});

describe("fileExtensionOf", () => {
  it("reads the extension, lower-cased", () => {
    expect(fileExtensionOf("report.PDF")).toBe("pdf");
    expect(fileExtensionOf("scan.jpeg")).toBe("jpeg");
    expect(fileExtensionOf("a.b.c.png")).toBe("png");
  });

  it("is not confused by a path or by a missing extension", () => {
    expect(fileExtensionOf("../../etc/passwd")).toBe("");
    expect(fileExtensionOf("C:\\reports\\scan.png")).toBe("png");
    expect(fileExtensionOf("report")).toBe("");
    expect(fileExtensionOf("")).toBe("");
    expect(fileExtensionOf(".pdf")).toBe("pdf");
  });
});

describe("inspectUploadedFile", () => {
  function inspect(overrides: {
    bytes?: Uint8Array;
    fileName?: string;
    declaredType?: string;
    size?: number;
    maxBytes?: number;
  }) {
    return inspectUploadedFile({
      bytes: overrides.bytes ?? PDF,
      fileName: overrides.fileName ?? "report.pdf",
      declaredType: overrides.declaredType ?? "application/pdf",
      size: overrides.size ?? (overrides.bytes ?? PDF).length,
      maxBytes: overrides.maxBytes ?? MAX_DOCUMENT_BYTES,
    });
  }

  it("accepts a genuine file whose three signals agree", () => {
    expect(inspect({})).toEqual({ ok: true, mimeType: "application/pdf" });
    expect(
      inspect({
        bytes: JPEG,
        fileName: "scan.JPG",
        declaredType: "image/jpeg",
      }),
    ).toEqual({ ok: true, mimeType: "image/jpeg" });
  });

  it("returns the DETECTED type, not the declared one", () => {
    // What gets stored, and what becomes the object's `Content-Type` and the
    // download's extension, is what the bytes say — never what was claimed,
    // even when the two agree.
    const result = inspect({
      bytes: JPEG,
      fileName: "scan.jpg",
      declaredType: "image/pjpeg",
    });
    expect(result).toEqual({ ok: true, mimeType: "image/jpeg" });
  });

  it("rejects MIME spoofing: a dangerous file declared as a PDF", () => {
    // **Attack 9.** An executable renamed and posted as `application/pdf`.
    expect(
      inspect({
        bytes: ascii("MZ\u0090\u0000"),
        fileName: "report.pdf",
        declaredType: "application/pdf",
      }),
    ).toEqual({ ok: false, reason: "unsupported_signature" });
  });

  it("rejects an SVG however it is dressed up", () => {
    // The format that would be a same-origin XSS if it were ever rendered.
    // It fails on the signature whatever the name or the declared type says.
    for (const [fileName, declaredType] of [
      ["logo.svg", "image/svg+xml"],
      ["logo.png", "image/png"],
      ["report.pdf", "application/pdf"],
    ] as const) {
      expect(
        inspect({
          bytes: ascii('<svg xmlns="http://www.w3.org/2000/svg"><script/>'),
          fileName,
          declaredType,
        }),
      ).toEqual({ ok: false, reason: "unsupported_signature" });
    }
  });

  it("rejects an HTML document declared as an image", () => {
    expect(
      inspect({
        bytes: ascii("<!DOCTYPE html><html><script>alert(1)</script>"),
        fileName: "scan.png",
        declaredType: "image/png",
      }),
    ).toEqual({ ok: false, reason: "unsupported_signature" });
  });

  it("rejects a genuine PDF wearing the wrong extension", () => {
    // Section 11 requires all three to agree, not two of three.
    expect(inspect({ fileName: "report.exe" })).toEqual({
      ok: false,
      reason: "extension_mismatch",
    });
    expect(inspect({ fileName: "report.html" })).toEqual({
      ok: false,
      reason: "extension_mismatch",
    });
    expect(inspect({ fileName: "report" })).toEqual({
      ok: false,
      reason: "extension_mismatch",
    });
  });

  it("rejects a genuine PDF declared as something else", () => {
    expect(inspect({ declaredType: "text/html" })).toEqual({
      ok: false,
      reason: "declared_type_mismatch",
    });
    expect(inspect({ declaredType: "" })).toEqual({
      ok: false,
      reason: "declared_type_mismatch",
    });
  });

  it("tolerates the declared-type spellings real browsers send", () => {
    // A charset parameter, a legacy spelling and mixed case all arrive in
    // practice, and refusing them would refuse ordinary uploads.
    for (const declaredType of [
      "application/pdf; charset=binary",
      "APPLICATION/PDF",
      " application/pdf ",
    ]) {
      expect(inspect({ declaredType }), declaredType).toEqual({
        ok: true,
        mimeType: "application/pdf",
      });
    }

    expect(
      inspect({ bytes: JPEG, fileName: "a.jpeg", declaredType: "image/jpg" }),
    ).toEqual({ ok: true, mimeType: "image/jpeg" });
  });

  it("treats the two HEIF spellings as interchangeable", () => {
    // A phone frequently writes `.heic` for a file whose brand is `mif1`,
    // and the reverse. Refusing the mismatch would reject ordinary iPhone
    // photographs; neither is ever rendered.
    expect(
      inspect({
        bytes: heif("mif1"),
        fileName: "IMG_0001.HEIC",
        declaredType: "image/heic",
      }),
    ).toEqual({ ok: true, mimeType: "image/heif" });

    expect(
      inspect({
        bytes: heif("heic"),
        fileName: "IMG_0001.heif",
        declaredType: "image/heif",
      }),
    ).toEqual({ ok: true, mimeType: "image/heic" });
  });

  it("rejects an oversized file", () => {
    // **Attack: oversized file.** Checked against the declared size, so the
    // request is refused without the bytes being kept.
    expect(inspect({ size: MAX_DOCUMENT_BYTES + 1 })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects an empty file", () => {
    expect(inspect({ bytes: new Uint8Array(0), size: 0 })).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(inspect({ size: 0 })).toEqual({ ok: false, reason: "empty" });
  });

  it("is not fooled by a path-shaped filename", () => {
    // **Attack 8.** The name never becomes a path — `buildDocumentStoragePath`
    // does not take one — but the extension check still reads the basename
    // rather than something that happens to contain a dot.
    expect(inspect({ fileName: "../../another-document.pdf" })).toEqual({
      ok: true,
      mimeType: "application/pdf",
    });

    expect(inspect({ fileName: "../../etc/passwd" })).toEqual({
      ok: false,
      reason: "extension_mismatch",
    });
  });

  it("refuses every reason with a value the caller must handle", () => {
    // `null` is never returned for "we could not tell": the caller refuses
    // an unknown format, a truncated one and a dangerous one the same way,
    // so there is no branch in which uncertainty becomes acceptance.
    const result = inspect({ bytes: bytes(0x00, 0x01, 0x02, 0x03) });
    expect(result.ok).toBe(false);
  });
});
