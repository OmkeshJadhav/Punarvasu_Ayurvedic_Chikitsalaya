import { describe, expect, it } from "vitest";

import type { ClinicContact } from "@/config/clinic";

import { buildClinicJsonLd, serializeJsonLd } from "./structured-data";

const base = {
  siteUrl: "https://example.org",
  description: "An Ayurvedic clinic.",
  socialLinks: [] as readonly { readonly href: string }[],
};

describe("buildClinicJsonLd", () => {
  it("emits a MedicalClinic with the identity facts that are known", () => {
    const data = buildClinicJsonLd({ ...base, contact: {} });

    expect(data["@type"]).toBe("MedicalClinic");
    expect(data.name).toBe("Punarvasu");
    expect(data.url).toBe("https://example.org/");
  });

  it("omits every contact property when nothing is verified", () => {
    const data = buildClinicJsonLd({ ...base, contact: {} });

    // A search engine republishes what it finds here, so an absent fact must
    // be absent rather than empty.
    expect(data).not.toHaveProperty("address");
    expect(data).not.toHaveProperty("telephone");
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("sameAs");
  });

  it("never emits a rating, review or price", () => {
    // Checked through `Object.keys` rather than a cast: the builder's return
    // type genuinely has no index signature, and asserting one away would
    // weaken the type that makes fabrication hard in the first place.
    const keys = Object.keys(buildClinicJsonLd({ ...base, contact: {} }));

    for (const key of [
      "aggregateRating",
      "review",
      "priceRange",
      "openingHours",
      "openingHoursSpecification",
    ]) {
      expect(keys).not.toContain(key);
    }
  });

  it("includes contact details once they exist", () => {
    const contact: ClinicContact = {
      phone: "+910000000000",
      email: "clinic@example.org",
      address: {
        streetAddress: "1 Example Road",
        locality: "Examplepur",
        region: "MH",
        postalCode: "400001",
        country: "IN",
      },
    };

    const data = buildClinicJsonLd({
      ...base,
      contact,
      socialLinks: [{ href: "https://example.org/profile" }],
    });

    expect(data.telephone).toBe("+910000000000");
    expect(data.email).toBe("clinic@example.org");
    expect(data.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "1 Example Road",
      addressLocality: "Examplepur",
      addressRegion: "MH",
      postalCode: "400001",
      addressCountry: "IN",
    });
    expect(data.sameAs).toEqual(["https://example.org/profile"]);
  });

  it("normalizes a site URL that carries a trailing slash", () => {
    const data = buildClinicJsonLd({
      ...base,
      siteUrl: "https://example.org///",
      contact: {},
    });

    expect(data.url).toBe("https://example.org/");
    expect(data.logo).toBe("https://example.org/images/logo.png");
  });
});

describe("serializeJsonLd", () => {
  it("escapes '<' so a value cannot close the script tag", () => {
    const output = serializeJsonLd({ name: "</script><img onerror=x>" });

    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c");
  });

  it("still parses back to the original value", () => {
    const value = { name: "a < b", nested: { list: [1, 2] } };

    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});
