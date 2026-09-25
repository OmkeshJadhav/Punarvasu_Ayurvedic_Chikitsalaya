import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ABOUT_IMAGES,
  BRAND_LOGO,
  HOME_IMAGES,
  PRACTITIONER_IMAGES,
  SERVICE_IMAGES,
  TREATMENT_IMAGES,
  type ImageAsset,
} from "@/config/images";

/**
 * Phase 20 invariants: assets, bundling and indexing.
 *
 * Each of these locks in a defect that was **found by measurement** rather
 * than by review, and each would be silent if it came back.
 *
 * `docs/QA_STRATEGY.md`'s structural-test convention applies: where the
 * property lives in configuration or in an import graph rather than in
 * behaviour, the test reads the source and asserts the property, with a
 * non-vacuity guard so a scan that stops matching fails loudly instead of
 * passing. Four phases of this project have recorded a scanner that quietly
 * stopped scanning; none of the scans below can.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Strips comments, so a file that *documents* a pattern does not match it. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

function sourceFiles(directory: string, extension = /\.(ts|tsx)$/): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, directory))) {
    const rel = `${directory}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory())
      out.push(...sourceFiles(rel, extension));
    else if (extension.test(entry)) out.push(rel);
  }
  return out;
}

const ALL_IMAGES: ReadonlyArray<readonly [string, ImageAsset]> = [
  ["BRAND_LOGO", BRAND_LOGO],
  ...Object.entries(HOME_IMAGES),
  ...Object.entries(ABOUT_IMAGES),
  ...Object.entries(SERVICE_IMAGES),
  ...Object.entries(PRACTITIONER_IMAGES),
  ...Object.entries(TREATMENT_IMAGES),
];

describe("image registry matches the files on disk", () => {
  it("declares at least the images the public site uses", () => {
    // Non-vacuity guard: if the registry were ever emptied or the import
    // shape changed, every assertion below would pass over nothing.
    expect(ALL_IMAGES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(ALL_IMAGES)("%s: the file exists", (_name, asset) => {
    expect(existsSync(join(ROOT, "public", asset.src))).toBe(true);
  });

  /**
   * Declared dimensions must be the real ones.
   *
   * This is not pedantry: `width`/`height` are what reserve layout space
   * before an image arrives, and a wrong pair is a Cumulative Layout Shift
   * that only appears on a slow connection. Phase 20 resized `logo.png` from
   * 1056x1080 to 512x524 and converted three PNGs to JPEG, so the registry and
   * the filesystem had every opportunity to drift apart.
   */
  it.each(ALL_IMAGES)(
    "%s: declared dimensions are the real ones",
    (_name, asset) => {
      const file = join(ROOT, "public", asset.src);
      const { width, height } = probeDimensions(readFileSync(file));
      expect({ width, height }).toEqual({
        width: asset.width,
        height: asset.height,
      });
    },
  );

  /**
   * No source image is larger than 400 KB.
   *
   * `next/image` re-encodes for delivery, so this is not about what a visitor
   * downloads. It is about the three places the raw file is still paid for:
   * the repository, the first uncached optimization of each size, and every
   * fetch that bypasses the optimizer - which is how a crawler reads
   * `logo.png`, published as the clinic's `logo` in `MedicalClinic` JSON-LD.
   *
   * Before Phase 20 the registry held 12.70 MB across twelve files, including
   * three photographs stored as alpha-free PNG at 1.3-1.4 MB each.
   */
  it.each(ALL_IMAGES)("%s: source file is under 400 KB", (_name, asset) => {
    const bytes = statSync(join(ROOT, "public", asset.src)).size;
    expect(bytes).toBeLessThan(400 * 1024);
  });

  it("keeps the whole public image set well under 2 MB", () => {
    const dir = join(ROOT, "public", "images");
    const total = readdirSync(dir).reduce(
      (sum, f) => sum + statSync(join(dir, f)).size,
      0,
    );
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });

  /**
   * The design mockups of a different clinic's website stay deleted.
   *
   * `progress_phase_04.md` recorded that `home-0/1/2.png` carried another
   * brand's name, fabricated practitioner details and invented testimonials,
   * and should be removed rather than left where someone might treat them as
   * assets. Phase 20 deleted them (4.0 MB). Restoring one would be a
   * content-safety problem, not merely a weight one.
   */
  it.each(["home-0.png", "home-1.png", "home-2.png"])(
    "%s (another clinic's mockup) is not in the repository",
    (name) => {
      expect(existsSync(join(ROOT, "public", "images", name))).toBe(false);
    },
  );
});

describe("client bundles do not pull in the schema library", () => {
  /**
   * `features/auth/limits.ts` must import nothing.
   *
   * Its entire value is that a client component can reach a field length
   * without reaching the module that builds Zod schemas. One import - of a
   * schema, a database type, a server utility - silently undoes that and
   * puts 391 KB back onto `/auth/register` and `/auth/forgot-password`.
   */
  it("features/auth/limits.ts has no imports at all", () => {
    const source = withoutComments(read("src/features/auth/limits.ts"));
    expect(source).not.toMatch(/\bimport\b/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    // Non-vacuity: it really does export the constants it exists for.
    expect(source).toMatch(/export const PASSWORD_MIN_LENGTH/);
    expect(source).toMatch(/export const PASSWORD_MAX_LENGTH/);
  });

  /**
   * No client component reaches a Zod-carrying module by way of the auth
   * copy, which is how the regression happened in the first place:
   *
   * ```text
   *   register-form.tsx -> features/auth/content.ts -> features/auth/validation.ts -> zod
   * ```
   */
  it("features/auth/content.ts does not import the validation module", () => {
    const source = withoutComments(read("src/features/auth/content.ts"));
    expect(source).not.toMatch(/from\s+"\.\/validation"/);
    expect(source).toMatch(/from\s+"\.\/limits"/);
  });

  it("no auth client component imports features/auth/validation", () => {
    const clientComponents = sourceFiles("src/components/auth").filter((f) =>
      read(f).includes('"use client"'),
    );
    expect(clientComponents.length).toBeGreaterThanOrEqual(3);
    for (const file of clientComponents) {
      expect(withoutComments(read(file)), file).not.toMatch(
        /from\s+"@\/features\/auth\/validation"/,
      );
    }
  });
});

describe("image optimizer configuration", () => {
  const config = withoutComments(read("next.config.ts"));

  it("serves AVIF with a WebP fallback", () => {
    expect(config).toMatch(/formats:\s*\["image\/avif",\s*"image\/webp"\]/);
  });

  /**
   * The optimizer is restricted to `public/images` with no query string.
   *
   * This is the configuration that makes Phase 14's decision structural: a
   * patient document lives at a remote signed storage URL, no `remotePatterns`
   * are configured, so it can no longer be proxied through the optimizer and
   * cached even if someone pointed `next/image` at one.
   */
  it("restricts optimization to /images/** with no query string", () => {
    expect(config).toMatch(
      /localPatterns:\s*\[\{\s*pathname:\s*"\/images\/\*\*",\s*search:\s*""\s*\}\]/,
    );
    expect(config).not.toMatch(/remotePatterns/);
  });

  it("allows exactly one quality value", () => {
    expect(config).toMatch(/qualities:\s*\[75\]/);
  });

  it("does not enable SVG optimization", () => {
    expect(config).toMatch(/dangerouslyAllowSVG:\s*false/);
  });

  it("has exactly two next/image consumers, both rendering /images", () => {
    const consumers = sourceFiles("src/components").filter((f) =>
      read(f).includes('from "next/image"'),
    );
    expect(consumers.sort()).toEqual([
      "src/components/brand/logo.tsx",
      "src/components/marketing/media-frame.tsx",
    ]);
  });
});

describe("search indexing is environment-aware", () => {
  /**
   * `phase_20.md` sections 180 and 182: a preview or staging deployment must
   * not compete with production in search results. Both the crawler
   * instruction and the page-level directive are gated on the same helper, so
   * they cannot drift into disagreeing.
   */
  it("robots.txt is gated on the deployment environment", () => {
    const source = withoutComments(read("src/app/robots.ts"));
    expect(source).toMatch(/isIndexableDeployment\(\)/);
    expect(source).toMatch(/disallow:\s*"\/"/);
  });

  it("the root layout's robots directive is gated on the same helper", () => {
    const source = withoutComments(read("src/app/layout.tsx"));
    expect(source).toMatch(/isIndexableDeployment\(\)/);
    expect(source).toMatch(/index:\s*false,\s*follow:\s*false/);
  });

  it("indexing is decided by APP_ENV, not NODE_ENV", () => {
    const source = withoutComments(read("src/lib/seo/indexing.ts"));
    // NODE_ENV is "production" for a preview build too, so it cannot answer
    // this question - the distinction the module exists to make.
    expect(source).not.toMatch(/NODE_ENV/);
    expect(source).toMatch(/appEnv === "production"/);
  });
});

describe("every public page can be shared", () => {
  /**
   * An audit of every public route found `/services` shipping without an
   * `og:image` - the one page that can least afford it, since the sitemap
   * gives it priority 0.9 as the main entry point for search traffic.
   */
  const PUBLIC_SEGMENTS = [
    "src/app/(public)",
    "src/app/(public)/about",
    "src/app/(public)/services",
    "src/app/(public)/services/[slug]",
    "src/app/(public)/contact",
  ] as const;

  it.each(PUBLIC_SEGMENTS)("%s has an opengraph-image", (segment) => {
    expect(existsSync(join(ROOT, segment, "opengraph-image.tsx"))).toBe(true);
  });
});

describe("the sitemap agrees with the canonical URLs", () => {
  /**
   * The home page declares `alternates: { canonical: "/" }`, which Next
   * resolves against `metadataBase` to the bare origin with **no trailing
   * slash**. The sitemap used to emit `${origin}/`, so it advertised one URL
   * while the page it pointed at named a different one as canonical.
   */
  it("lists the home page in the same form its canonical uses", () => {
    const source = withoutComments(read("src/app/sitemap.ts"));
    expect(source).toMatch(/url:\s*origin,/);
    expect(source).not.toMatch(/url:\s*`\$\{origin\}\/`/);
  });

  it("generates treatment entries rather than listing them", () => {
    const source = withoutComments(read("src/app/sitemap.ts"));
    expect(source).toMatch(/getTreatmentSlugs\(\)/);
    // `/practitioners` was retired in favour of a modal on the About page.
    expect(source).not.toMatch(/practitioner/i);
  });
});

/**
 * Minimal intrinsic-size probe for the two formats this project ships.
 *
 * Deliberately not a dependency: `sharp` is present only as a transitive
 * Next.js package, and reading two headers is less code than justifying an
 * import that the test suite would then rely on.
 */
function probeDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG: 8-byte signature, then an IHDR chunk whose width/height are the
  // first two big-endian 32-bit values of its data.
  if (buffer.length > 24 && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: walk the marker segments to the frame header (SOF0/1/2...), whose
  // payload carries height then width as big-endian 16-bit values.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1] ?? 0;
      const isFrameHeader =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrameHeader) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  throw new Error("unsupported image format in the public image registry");
}
