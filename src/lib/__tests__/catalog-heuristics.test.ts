import { describe, it, expect } from "@jest/globals";
import {
  extractSize,
  extractColors,
  extractTags,
  detectBrand,
  detectProductType,
  deriveOptionValues,
} from "@/lib/catalog-heuristics";

describe("extractSize", () => {
  it("resolves full words to canonical sizes", () => {
    expect(extractSize("Large")).toBe("L");
    expect(extractSize("Medium")).toBe("M");
    expect(extractSize("X-Large")).toBe("XL");
    expect(extractSize("2XL")).toBe("2XL");
  });
  it("resolves bare sizes only as whole words", () => {
    expect(extractSize("L")).toBe("L");
    expect(extractSize("L / Navy")).toBe("L");
    // 'L' inside a word must not match, and neither must the letters of other words
    expect(extractSize("Large / Navy")).toBe("L");
    expect(extractSize("Standard")).toBe("Standard");
    expect(extractSize("One Size")).toBe("One Size");
  });
  it("keeps quoted diameters as their own value", () => {
    expect(extractSize('3"')).toBe('3"');
    expect(extractSize('3.5" ornament')).toBe('3.5"');
  });
  it("returns null when there is no size", () => {
    expect(extractSize("Navy")).toBeNull();
    expect(extractSize("")).toBeNull();
  });
});

describe("extractColors", () => {
  it("finds canonical colour names", () => {
    expect(extractColors("L / Navy")).toEqual(["navy"]);
    expect(extractColors("Black")).toEqual(["black"]);
    expect(extractColors("Heather Grey")).toEqual(["gray", "heather"]);
  });
  it("returns an empty list when there is no colour", () => {
    expect(extractColors("L")).toEqual([]);
  });
});

describe("detectBrand", () => {
  it("matches the catalog's own brands", () => {
    expect(detectBrand("Biscuit Hockey Tee")).toBe("Biscuit Hockey");
    expect(detectBrand("LITTLE STRANGER Hoodie")).toBe("LITTLE STRANGER");
    expect(detectBrand("Dunphy Stock FAM Can Hugger")).toBe("Dunphy Stock FAM");
  });
  it("returns null rather than a generic brand when nothing matches", () => {
    // The old sync defaulted everything to "Animas Reflections", which filed generic
    // products under a brand category they did not belong to.
    expect(detectBrand("Unbranded Widget")).toBeNull();
  });
});

describe("extractTags / detectProductType", () => {
  it("tags from the name and description", () => {
    const tags = extractTags("Classic Tee", "A soft t-shirt", []);
    expect(tags).toContain("apparel");
  });
  it("infers a product type from the text", () => {
    expect(detectProductType(["Classic Tee"])).toBe("apparel");
    expect(detectProductType(["Wood Sign"])).toBe("sign");
    expect(detectProductType(["Sticker Pack"])).toBe("sticker");
    expect(detectProductType(["Mystery Item"])).toBe("other");
  });
});

describe("deriveOptionValues", () => {
  it("splits a combined label into dimensions", () => {
    expect(deriveOptionValues("L / Navy")).toEqual({ size: "L", colors: ["navy"] });
    expect(deriveOptionValues("One Size")).toEqual({ size: "One Size", colors: [] });
    expect(deriveOptionValues("Black")).toEqual({ size: null, colors: ["black"] });
  });
});
