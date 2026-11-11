/**
 * Tests for category-driven design pinning.
 *
 * Two behaviours are covered: which designs belong to a category (including the
 * "category tag" case the client described and the legacy free-text fallback
 * that keeps existing designs working), and the automatic pin pass, whose whole
 * point is that it never overrules a manual choice.
 */
import { describe, it, expect } from "@jest/globals";
import {
  DESIGN_PIN_LIMIT,
  autoFillDesignsForCategory,
  categoryKey,
  designMatchesCategory,
  designsForCategory,
  refreshPinnedDesigns,
} from "@/lib/design-category";
import type { DesignAsset, ManagedCategory } from "@/types";

const cat = (id: string, name: string, slug = name.toLowerCase().replace(/\s+/g, "-")): ManagedCategory =>
  ({ id, name, slug, order: 0, createdAt: "", updatedAt: "" }) as ManagedCategory;

const DURANGO = cat("c1", "Durango High Football");
const TEAMS = cat("c2", "Teams");

const design = (over: Partial<DesignAsset> & { id: string }): DesignAsset =>
  ({
    name: over.id,
    category: "",
    image_url: `https://example.test/${over.id}.png`,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as DesignAsset;

describe("categoryKey", () => {
  it("lowercases and strips every non-alphanumeric", () => {
    expect(categoryKey("Durango High School Alpine Team, Teams")).toBe(
      "durangohighschoolalpineteamteams",
    );
    expect(categoryKey("Teams > Durango Lacrosse")).toBe("teamsdurangolacrosse");
    expect(categoryKey("I'M OK R U")).toBe("imokru");
  });

  it("is total: nullish input folds to an empty key", () => {
    expect(categoryKey(undefined)).toBe("");
    expect(categoryKey("")).toBe("");
  });
});

describe("designMatchesCategory", () => {
  it("matches an explicit category id", () => {
    expect(designMatchesCategory(design({ id: "d1", categoryIds: ["c1"] }), DURANGO)).toBe(true);
  });

  it("does not match a different category", () => {
    expect(designMatchesCategory(design({ id: "d1", categoryIds: ["c2"] }), DURANGO)).toBe(false);
  });

  it("treats an EXPLICIT EMPTY categoryIds as an opt-out", () => {
    // The legacy text field happens to name the category, but the admin said
    // "no category" by giving the design an empty list — that must win.
    const optedOut = design({ id: "d1", categoryIds: [], category: "Durango High Football" });
    expect(designMatchesCategory(optedOut, DURANGO)).toBe(false);
  });

  it("falls back to the legacy free-text category when the field is absent", () => {
    expect(designMatchesCategory(design({ id: "d1", category: "Durango High Football" }), DURANGO)).toBe(true);
    expect(
      designMatchesCategory(design({ id: "d1", category: "durango high football" }), DURANGO),
    ).toBe(true);
  });

  it("matches a tag that names the category — the 'category tag' case", () => {
    expect(designMatchesCategory(design({ id: "d1", tags: ["teams"] }), TEAMS)).toBe(true);
    expect(designMatchesCategory(design({ id: "d1", tags: ["Durango High Football"] }), DURANGO)).toBe(true);
  });

  it("only matches when the TAG contains the category key, never the reverse", () => {
    expect(designMatchesCategory(design({ id: "d1", tags: ["durango high"] }), DURANGO)).toBe(false);
  });

  it("matches a tag that WRAPS the category name — 'little stranger logos' under 'Little Stranger'", () => {
    const littleStranger = cat("c4", "Little Stranger");
    expect(
      designMatchesCategory(design({ id: "d1", tags: ["little stranger logos"] }), littleStranger),
    ).toBe(true);
  });

  it("does not let a short category name swallow unrelated tags", () => {
    const art = cat("c5", "Art");
    expect(designMatchesCategory(design({ id: "d1", tags: ["cartoon"] }), art)).toBe(false);
  });

  it("matches by slug when the display name has punctuation", () => {
    const rugged = cat("c3", "Durango Lacrosse!", "durango-lacrosse");
    expect(designMatchesCategory(design({ id: "d1", tags: ["durango lacrosse"] }), rugged)).toBe(true);
  });

  it("ignores legacy text once the id list exists, even if the text disagrees", () => {
    const moved = design({ id: "d1", categoryIds: ["c2"], category: "Durango High Football" });
    expect(designMatchesCategory(moved, DURANGO)).toBe(false);
    expect(designMatchesCategory(moved, TEAMS)).toBe(true);
  });

  it("is false for an unknown or missing category", () => {
    expect(designMatchesCategory(design({ id: "d1", categoryIds: ["c1"] }), undefined)).toBe(false);
    expect(designMatchesCategory(design({ id: "d1", categoryIds: ["c1"] }), null)).toBe(false);
  });
});

describe("designsForCategory", () => {
  const library = [
    design({ id: "byId", categoryIds: ["c1"] }),
    design({ id: "byText", category: "Durango High Football" }),
    design({ id: "byTag", tags: ["Durango High Football"] }),
    design({ id: "other", categoryIds: ["c2"] }),
    design({ id: "optedOut", categoryIds: [], category: "Durango High Football" }),
  ];

  it("returns every matching design and nothing else", () => {
    expect(designsForCategory(library, DURANGO).map((d) => d.id)).toEqual(["byId", "byText", "byTag"]);
  });

  it("returns [] for a missing category", () => {
    expect(designsForCategory(library, undefined)).toEqual([]);
  });
});

describe("autoFillDesignsForCategory", () => {
  const lib = [
    design({ id: "a", categoryIds: ["c1"] }),
    design({ id: "b", categoryIds: ["c1"] }),
    design({ id: "c", categoryIds: ["c1"] }),
  ];

  it("pins every match on a new product (nothing pinned yet)", () => {
    const { designAssets, addedIds, removedIds, overflow } = autoFillDesignsForCategory({
      pinned: [],
      matching: lib,
      autoIds: new Set(),
    });
    expect(designAssets.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(addedIds).toEqual(["a", "b", "c"]);
    expect(removedIds).toEqual([]);
    expect(overflow).toBe(0);
  });

  it("does not duplicate a design that is already pinned", () => {
    const { designAssets, addedIds } = autoFillDesignsForCategory({
      pinned: [lib[0]],
      matching: lib,
      autoIds: new Set(),
    });
    expect(designAssets.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(addedIds).toEqual(["b", "c"]);
  });

  it("removes a previous pass's picks when the category changes", () => {
    const { designAssets, removedIds, addedIds } = autoFillDesignsForCategory({
      pinned: [lib[0], lib[1]],
      matching: [lib[2]],
      autoIds: new Set(["a", "b"]),
    });
    expect(designAssets.map((d) => d.id)).toEqual(["c"]);
    expect(removedIds).toEqual(["a", "b"]);
    expect(addedIds).toEqual(["c"]);
  });

  it("never removes a MANUAL pick, even when it does not match", () => {
    const { designAssets, removedIds } = autoFillDesignsForCategory({
      pinned: [lib[0], lib[1]],
      matching: [],
      // Only "a" was auto-added; "b" was chosen by hand and must survive.
      autoIds: new Set(["a"]),
    });
    expect(designAssets.map((d) => d.id)).toEqual(["b"]);
    expect(removedIds).toEqual(["a"]);
  });

  it("stops at the cap and reports the overflow instead of silently dropping", () => {
    const many = Array.from({ length: DESIGN_PIN_LIMIT + 3 }, (_, i) =>
      design({ id: `d${i}`, categoryIds: ["c1"] }),
    );
    const { designAssets, addedIds, overflow } = autoFillDesignsForCategory({
      pinned: [],
      matching: many,
      autoIds: new Set(),
    });
    expect(designAssets).toHaveLength(DESIGN_PIN_LIMIT);
    expect(addedIds).toHaveLength(DESIGN_PIN_LIMIT);
    expect(overflow).toBe(3);
  });

  it("frees room for a match by dropping a stale auto pick first", () => {
    const { designAssets, removedIds, overflow } = autoFillDesignsForCategory({
      pinned: Array.from({ length: DESIGN_PIN_LIMIT }, (_, i) => design({ id: `p${i}` })),
      matching: [lib[0]],
      autoIds: new Set(["p0"]),
      limit: DESIGN_PIN_LIMIT,
    });
    expect(removedIds).toEqual(["p0"]);
    expect(designAssets).toHaveLength(DESIGN_PIN_LIMIT);
    expect(designAssets.some((d) => d.id === "a")).toBe(true);
    expect(overflow).toBe(0);
  });

  it("is idempotent: running the same pass twice changes nothing the second time", () => {
    const first = autoFillDesignsForCategory({ pinned: [], matching: lib, autoIds: new Set() });
    const second = autoFillDesignsForCategory({
      pinned: first.designAssets,
      matching: lib,
      autoIds: new Set(first.addedIds),
    });
    expect(second.designAssets.map((d) => d.id)).toEqual(first.designAssets.map((d) => d.id));
    expect(second.addedIds).toEqual([]);
    expect(second.removedIds).toEqual([]);
  });
});

describe("refreshPinnedDesigns", () => {
  const pinned = design({ id: "d1", name: "Old name", image_url: "https://example.test/old.png" });

  it("replaces a stale snapshot with the current library version", () => {
    const current = design({ id: "d1", name: "New name", image_url: "https://example.test/new.png" });
    const { designAssets, updatedIds } = refreshPinnedDesigns([pinned], [current]);
    expect(designAssets[0].name).toBe("New name");
    expect(designAssets[0].image_url).toBe("https://example.test/new.png");
    expect(updatedIds).toEqual(["d1"]);
  });

  it("reports nothing when the snapshot is already current", () => {
    const { updatedIds, designAssets } = refreshPinnedDesigns([pinned], [pinned]);
    expect(updatedIds).toEqual([]);
    expect(designAssets[0]).toBe(pinned);
  });

  it("keeps the stored snapshot when the design has been deleted from the library", () => {
    const { designAssets, updatedIds } = refreshPinnedDesigns([pinned], []);
    expect(designAssets[0]).toEqual(pinned);
    expect(updatedIds).toEqual([]);
  });

  it("propagates a newly added category id", () => {
    const current = design({ id: "d1", name: "Old name", image_url: "https://example.test/old.png", categoryIds: ["c1"] });
    const { updatedIds } = refreshPinnedDesigns([pinned], [current]);
    expect(updatedIds).toEqual(["d1"]);
  });
});
