/**
 * Tests for the design library's label rule and filter.
 *
 * The defect these cover: 97 of 123 design docs share `name:
 * "Little Stranger Logos"`, with the distinguishing text in `description`.
 * Rendering `name` produced 97 identical labels AND 97 identical `alt`
 * strings, so the grid was unusable except by eyeballing thumbnails.
 */
import { describe, it, expect } from "@jest/globals";
import { designAssetLabel, filterDesignAssets } from "@/lib/design-assets";
import type { DesignAsset } from "@/types";

function design(over: Partial<DesignAsset> & { id: string }): DesignAsset {
  return {
    name: "Little Stranger Logos",
    category: "Logos",
    image_url: `https://example.test/${over.id}.png`,
    created_at: "",
    ...over,
  } as DesignAsset;
}

const SHROOMING = design({ id: "d1", description: "Shrooming Stranger" });
const BISCUIT = design({ id: "d2", description: "Biscuit Crossing", category: "Mascots" });
const NO_DESCRIPTION = design({ id: "d3", name: "River Badge" });
const BLANK_DESCRIPTION = design({ id: "d4", description: "   ", name: "Mountain Badge" });

const LIBRARY = [SHROOMING, BISCUIT, NO_DESCRIPTION, BLANK_DESCRIPTION];

describe("designAssetLabel", () => {
  it("prefers the description, which is what tells the 97 duplicates apart", () => {
    expect(designAssetLabel(SHROOMING)).toBe("Shrooming Stranger");
    expect(designAssetLabel(BISCUIT)).toBe("Biscuit Crossing");
  });

  it("falls back to the name when there is no description", () => {
    expect(designAssetLabel(NO_DESCRIPTION)).toBe("River Badge");
  });

  it("falls back to the name when the description is blank", () => {
    expect(designAssetLabel(BLANK_DESCRIPTION)).toBe("Mountain Badge");
  });

  it("trims the label so tiles do not show padded text", () => {
    expect(designAssetLabel(design({ id: "d5", description: "  Padded  " }))).toBe("Padded");
  });

  it("has a last-resort label for a design with neither field", () => {
    expect(designAssetLabel(design({ id: "d6", name: "", description: "" }))).toBe(
      "Untitled design",
    );
    expect(designAssetLabel(null)).toBe("Untitled design");
  });
});

describe("filterDesignAssets", () => {
  it("keeps the list for a blank query", () => {
    expect(filterDesignAssets(LIBRARY, "   ")).toHaveLength(4);
  });

  it("matches the description, not only the shared name", () => {
    expect(filterDesignAssets(LIBRARY, "shroom").map((d) => d.id)).toEqual(["d1"]);
    expect(filterDesignAssets(LIBRARY, "BISCUIT").map((d) => d.id)).toEqual(["d2"]);
  });

  it("matches the name when there is no description", () => {
    expect(filterDesignAssets(LIBRARY, "river").map((d) => d.id)).toEqual(["d3"]);
  });

  it("matches the category", () => {
    expect(filterDesignAssets(LIBRARY, "mascots").map((d) => d.id)).toEqual(["d2"]);
  });

  it("requires every token to match", () => {
    // "stranger" comes from the shared name, "shrooming" from the description.
    expect(filterDesignAssets(LIBRARY, "stranger shrooming").map((d) => d.id)).toEqual(["d1"]);
    expect(filterDesignAssets(LIBRARY, "shrooming biscuit")).toHaveLength(0);
  });

  it("does not mutate the input array", () => {
    const input = [...LIBRARY];
    const result = filterDesignAssets(input, "shroom");
    expect(input).toHaveLength(4);
    expect(result).toHaveLength(1);
  });
});
