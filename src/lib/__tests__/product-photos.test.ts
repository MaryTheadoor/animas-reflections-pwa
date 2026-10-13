/**
 * Tests for the product photo library logic.
 *
 * The behaviour that matters commercially: applying one blank product fills
 * every mockup view in a single action, and it fills only what it has — a set
 * with front and back must never wipe a sleeve photo the operator added by hand.
 */
import { describe, it, expect } from "@jest/globals";
import {
  applySetPatch,
  blankPhotoSets,
  coveredViews,
  filterPhotos,
  inferViewFromFilename,
  missingViews,
  safePhotoName,
} from "@/lib/product-photos";
import type { ProductPhoto } from "@/types";

const photo = (over: Partial<ProductPhoto> & { id: string }): ProductPhoto =>
  ({
    name: "Gildan 18500 Hoodie",
    image_url: `https://example.test/${over.id}.png`,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as ProductPhoto;

describe("blankPhotoSets", () => {
  it("groups the views of one blank into a single set", () => {
    const sets = blankPhotoSets([
      photo({ id: "f", view: "front" }),
      photo({ id: "b", view: "back" }),
      photo({ id: "s", view: "sleeve" }),
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].byView).toEqual({
      front: "https://example.test/f.png",
      back: "https://example.test/b.png",
      sleeve: "https://example.test/s.png",
    });
    expect(coveredViews(sets[0])).toEqual(["front", "back", "sleeve"]);
    expect(missingViews(sets[0])).toEqual(["sideL", "sideR"]);
  });

  it("separates colour photos from the tinted general ones", () => {
    const sets = blankPhotoSets([
      photo({ id: "f", view: "front" }),
      photo({ id: "cf", view: "front", color: "Charcoal" }),
    ]);
    expect(sets[0].byView.front).toBe("https://example.test/f.png");
    expect(sets[0].byColorView.Charcoal.front).toBe("https://example.test/cf.png");
    // The colour photo covers the slot even though byView has it too.
    expect(missingViews(sets[0])).toEqual(["back", "sleeve", "sideL", "sideR"]);
  });

  it("keeps unplaced photos out of the mockup map", () => {
    const sets = blankPhotoSets([photo({ id: "loose" })]);
    expect(sets[0].unplaced.map((p) => p.id)).toEqual(["loose"]);
    expect(sets[0].byView).toEqual({});
  });

  it("treats different blank names as different sets", () => {
    const sets = blankPhotoSets([
      photo({ id: "a", name: "Gildan 18500 Hoodie", view: "front" }),
      photo({ id: "b", name: "Bella 3001 Tee", view: "front" }),
    ]);
    // Equal completeness, so the tie-break is the name.
    expect(sets.map((s) => s.name)).toEqual(["Bella 3001 Tee", "Gildan 18500 Hoodie"]);
  });

  it("sorts the most complete blanks first", () => {
    const sets = blankPhotoSets([
      photo({ id: "one", name: "Sparse", view: "front" }),
      photo({ id: "two", name: "Complete", view: "front" }),
      photo({ id: "three", name: "Complete", view: "back" }),
      photo({ id: "four", name: "Complete", view: "sleeve" }),
    ]);
    expect(sets[0].name).toBe("Complete");
  });

  it("keeps only the first photo for a view, so a re-upload cannot shadow it", () => {
    const sets = blankPhotoSets([
      photo({ id: "first", view: "front" }),
      photo({ id: "second", view: "front" }),
    ]);
    expect(sets[0].byView.front).toBe("https://example.test/first.png");
  });

  it("unions the category ids across the set", () => {
    const sets = blankPhotoSets([
      photo({ id: "f", view: "front", categoryIds: ["c1"] }),
      photo({ id: "b", view: "back", categoryIds: ["c2", "c1"] }),
    ]);
    expect(sets[0].categoryIds.sort()).toEqual(["c1", "c2"]);
  });

  it("ignores photos with no image url", () => {
    const sets = blankPhotoSets([photo({ id: "bad", image_url: "" }), photo({ id: "good", view: "front" })]);
    expect(sets).toHaveLength(1);
    expect(sets[0].size).toBe(1);
  });
});

describe("applySetPatch", () => {
  const set = () => blankPhotoSets([
    photo({ id: "f", view: "front" }),
    photo({ id: "b", view: "back" }),
    photo({ id: "cf", view: "front", color: "Charcoal" }),
  ])[0];

  it("returns a patch containing only the views the set provides", () => {
    const patch = applySetPatch(set());
    expect(patch.mockupImages).toEqual({
      front: "https://example.test/f.png",
      back: "https://example.test/b.png",
    });
    expect(patch.mockupImages?.sleeve).toBeUndefined();
    expect(patch.mockupImagesByColor).toEqual({
      Charcoal: { front: "https://example.test/cf.png" },
    });
  });

  it("reports which views it could not fill, so nothing is left to guess", () => {
    expect(applySetPatch(set()).appliedViews).toEqual(["front", "back"]);
    expect(applySetPatch(set()).missingViews).toEqual(["sleeve", "sideL", "sideR"]);
  });

  it("omits empty maps entirely rather than writing {} over a product's photos", () => {
    const loose = blankPhotoSets([photo({ id: "loose" })])[0];
    const patch = applySetPatch(loose);
    expect("mockupImages" in patch).toBe(false);
    expect("mockupImagesByColor" in patch).toBe(false);
    expect(patch.appliedViews).toEqual([]);
  });
});

describe("filterPhotos", () => {
  const library = [
    photo({ id: "hoodie", name: "Gildan 18500 Hoodie", view: "front", productType: "apparel", tags: ["fleece"] }),
    photo({ id: "tee", name: "Bella 3001 Tee", view: "front", productType: "apparel" }),
    photo({ id: "mug", name: "11oz Mug", view: "front", productType: "accessory" }),
    photo({ id: "charcoal", name: "Gildan 18500 Hoodie", view: "back", color: "Charcoal", productType: "apparel" }),
    photo({ id: "scoped", name: "Team Hoodie", view: "front", categoryIds: ["c1"] }),
  ];

  it("filters by product type, and an untyped photo fits any type", () => {
    // "scoped" carries no productType at all, so it is offered everywhere —
    // a wrong-but-visible photo beats a missing one. The manager should push
    // operators to set the type so the pre-filter actually narrows.
    expect(filterPhotos(library, { productType: "accessory" }).map((p) => p.id)).toEqual(["mug", "scoped"]);
    expect(filterPhotos(library, { productType: "apparel" }).map((p) => p.id)).toEqual([
      "hoodie",
      "tee",
      "charcoal",
      "scoped",
    ]);
  });

  it('treats productType "all" as no filter', () => {
    expect(filterPhotos(library, { productType: "all" })).toHaveLength(library.length);
  });

  it("filters by colour", () => {
    expect(filterPhotos(library, { color: "Charcoal" }).map((p) => p.id)).toEqual(["charcoal"]);
  });

  it("filters by the view being filled", () => {
    expect(filterPhotos(library, { view: "back" }).map((p) => p.id)).toEqual(["charcoal"]);
  });

  it("matches a category id, treating an unspecified list as 'fits anywhere' and [] as 'none'", () => {
    const forC1 = filterPhotos(library, { categoryId: "c1" }).map((p) => p.id);
    expect(forC1).toContain("scoped");
    expect(forC1).toContain("hoodie"); // no categoryIds -> offered to every category
    expect(filterPhotos([...library, photo({ id: "optedOut", view: "front", categoryIds: [] })], {
      categoryId: "c1",
    }).map((p) => p.id)).not.toContain("optedOut");
  });

  it("searches name, colour and tags", () => {
    expect(filterPhotos(library, { query: "hoodie" }).map((p) => p.id)).toEqual(["hoodie", "charcoal", "scoped"]);
    expect(filterPhotos(library, { query: "fleece" }).map((p) => p.id)).toEqual(["hoodie"]);
    expect(filterPhotos(library, { query: "mug" }).map((p) => p.id)).toEqual(["mug"]);
    expect(filterPhotos(library, { query: "nothing here" })).toEqual([]);
  });

  it("combines filters", () => {
    expect(filterPhotos(library, { productType: "apparel", query: "bella" }).map((p) => p.id)).toEqual(["tee"]);
  });
});

describe("inferViewFromFilename", () => {
  it("reads the view out of ordinary operator filenames", () => {
    expect(inferViewFromFilename("gildan-18500-front.png")).toBe("front");
    expect(inferViewFromFilename("Gildan 18500 BACK.jpg")).toBe("back");
    expect(inferViewFromFilename("hoodie_sleeve_print.png")).toBe("sleeve");
    expect(inferViewFromFilename("hoodie-sideL.png")).toBe("sideL");
    expect(inferViewFromFilename("hoodie right side.png")).toBe("sideR");
    expect(inferViewFromFilename("tee-left.png")).toBe("sideL");
    expect(inferViewFromFilename("tee_rear_view.webp")).toBe("back");
  });

  it("prefers the side views over the others", () => {
    // Contains both "side" and "front"; the ordered rule picks the side.
    expect(inferViewFromFilename("hoodie-left-side-front.png")).toBe("sideL");
  });

  it("does not match a view buried inside another word", () => {
    // Each keyword must end at a word boundary: a wrong automatic placement is
    // worse than one the operator makes by hand.
    expect(inferViewFromFilename("aside.png")).toBeUndefined();
    expect(inferViewFromFilename("backdrop.png")).toBeUndefined();
    expect(inferViewFromFilename("frontier.png")).toBeUndefined();
    expect(inferViewFromFilename("leftward.png")).toBeUndefined();
  });

  it("returns undefined when the name says nothing about a view", () => {
    expect(inferViewFromFilename("IMG_4821.jpg")).toBeUndefined();
    expect(inferViewFromFilename("")).toBeUndefined();
    expect(inferViewFromFilename("gildan18500.png")).toBeUndefined();
  });
});

describe("safePhotoName", () => {
  it("keeps the extension and strips anything exotic", () => {
    // A run of disallowed characters collapses to ONE underscore.
    expect(safePhotoName("Gildan 18500 (front).png")).toBe("Gildan_18500_front_.png");
    expect(safePhotoName("hoodie back.jpg")).toBe("hoodie_back.jpg");
  });

  it("reduces a path to its final segment", () => {
    // A browser File.name is already a base name; this is defensive against a
    // pasted path, and it must not carry separators into a Storage object key.
    const withPath = ["some", "folder", "tee-front.png"].join("/");
    expect(safePhotoName(withPath)).toBe("tee-front.png");
  });
});
