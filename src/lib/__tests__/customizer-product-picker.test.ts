/**
 * Tests for the customizer's product picker helpers.
 *
 * The defect these cover: the picker was one native <select> of the whole
 * catalog — 235 options, no search, no grouping, and `$0.00` rows mixed in.
 * The rules that decide what may be listed, how groups are ordered, and how a
 * query narrows the list are pure, so they are checked here rather than by
 * clicking through a 235-option dropdown.
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildProductPickerGroups,
  filterProductPickerGroups,
  flattenProductPickerOptions,
  indexOfProductOption,
  indexProductPickerGroups,
  isSellableProduct,
  lowestSellablePrice,
  matchesProductQuery,
  moveActiveIndex,
  productTypeLabel,
} from "@/lib/customizer-product-picker";
import type { ManagedProduct, ProductType } from "@/types";

function product(
  over: Partial<ManagedProduct> & { id: string; name: string },
): ManagedProduct {
  return {
    description: "",
    categoryId: "",
    productType: "apparel" as ProductType,
    colors: [],
    tags: [],
    images: [],
    variants: [{ id: `${over.id}-v`, name: "Regular", price: 20, sku: "" }],
    active: true,
    featured: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  } as ManagedProduct;
}

const CATEGORIES = [
  { id: "c-apparel", name: "Tees" },
  { id: "c-stickers", name: "Stickers" },
];

const TEE = product({ id: "tee", name: "Bella Tee", categoryId: "c-apparel" });
const HOODIE = product({ id: "hoodie", name: "Pullover Hoodie", categoryId: "c-apparel" });
const STICKER = product({
  id: "sticker",
  name: "Slap Sticker",
  categoryId: "c-stickers",
  productType: "sticker",
  variants: [{ id: "s1", name: "3in", price: 4, sku: "" }],
});
const FREE = product({
  id: "free",
  name: "Free Sample",
  variants: [
    { id: "f1", name: "One", price: 0, sku: "" },
    { id: "f2", name: "Two", price: 0, sku: "" },
  ],
});
const HIDDEN = product({ id: "hidden", name: "Archived Tee", active: false });
const MIXED = product({
  id: "mixed",
  name: "Mixed Pricing",
  variants: [
    { id: "m1", name: "Contact", price: 0, sku: "" },
    { id: "m2", name: "Small", price: 12, sku: "" },
    { id: "m3", name: "Large", price: 15, sku: "" },
  ],
});

const CATALOG = [TEE, HOODIE, STICKER, FREE, HIDDEN, MIXED];

describe("lowestSellablePrice", () => {
  it("returns the cheapest positively priced variant", () => {
    expect(lowestSellablePrice(MIXED)).toBe(12);
    expect(lowestSellablePrice(STICKER)).toBe(4);
  });

  it("returns undefined when every variant is $0.00 or blank", () => {
    expect(lowestSellablePrice(FREE)).toBeUndefined();
    expect(lowestSellablePrice(null)).toBeUndefined();
    expect(
      lowestSellablePrice({ variants: [{ price: NaN }, { price: -5 }] as never }),
    ).toBeUndefined();
  });
});

describe("isSellableProduct", () => {
  it("keeps an active product with one priced variant", () => {
    expect(isSellableProduct(TEE)).toBe(true);
    expect(isSellableProduct(MIXED)).toBe(true);
  });

  it("drops unpriced and inactive products", () => {
    expect(isSellableProduct(FREE)).toBe(false);
    expect(isSellableProduct(HIDDEN)).toBe(false);
    expect(isSellableProduct(undefined)).toBe(false);
  });
});

describe("productTypeLabel", () => {
  it("uses the catalog labels", () => {
    expect(productTypeLabel("sticker")).toBe("Sticker / Slap");
    expect(productTypeLabel("apparel")).toBe("Apparel");
  });

  it("falls back to Other for blank and capitalises admin-defined types", () => {
    expect(productTypeLabel("")).toBe("Other");
    expect(productTypeLabel(undefined)).toBe("Other");
    expect(productTypeLabel("drinkware")).toBe("Drinkware");
  });
});

describe("buildProductPickerGroups", () => {
  const groups = buildProductPickerGroups(CATALOG, CATEGORIES);

  it("excludes unpriced and inactive products", () => {
    const ids = flattenProductPickerOptions(groups).map((o) => o.id);
    expect(ids).not.toContain("free");
    expect(ids).not.toContain("hidden");
    expect(ids).toEqual(["tee", "mixed", "hoodie", "sticker"]);
  });

  it("groups by product type in catalog order", () => {
    expect(groups.map((g) => g.value)).toEqual(["apparel", "sticker"]);
    expect(groups.map((g) => g.label)).toEqual(["Apparel", "Sticker / Slap"]);
    expect(groups[0].options.map((o) => o.label)).toEqual([
      "Bella Tee",
      "Mixed Pricing",
      "Pullover Hoodie",
    ]);
  });

  it("carries the category name and the cheapest price", () => {
    const tee = groups[0].options.find((o) => o.id === "tee");
    expect(tee?.detail).toBe("Tees");
    expect(tee?.price).toBe(20);
    const mixed = groups[0].options.find((o) => o.id === "mixed");
    expect(mixed?.price).toBe(12);
  });

  it("leaves a blank detail when the category has no name", () => {
    const groups = buildProductPickerGroups(
      [product({ id: "x", name: "Uncategorised", categoryId: "missing" })],
      CATEGORIES,
    );
    expect(groups[0].options[0].detail).toBe("");
  });

  it("sorts admin-defined types after the known ones", () => {
    const groups = buildProductPickerGroups(
      [
        product({ id: "mug", name: "Mug", productType: "drinkware" as ProductType }),
        product({ id: "z", name: "Zzz Tee" }),
      ],
      [],
    );
    expect(groups.map((g) => g.value)).toEqual(["apparel", "drinkware"]);
  });

  it("returns no groups for an empty catalog", () => {
    expect(buildProductPickerGroups([], [])).toEqual([]);
    expect(buildProductPickerGroups(null, null)).toEqual([]);
  });
});

describe("filterProductPickerGroups", () => {
  const groups = buildProductPickerGroups(CATALOG, CATEGORIES);

  it("keeps everything for a blank query", () => {
    expect(flattenProductPickerOptions(filterProductPickerGroups(groups, "  "))).toHaveLength(4);
  });

  it("matches a name case-insensitively", () => {
    const matches = flattenProductPickerOptions(filterProductPickerGroups(groups, "HOOD"));
    expect(matches.map((o) => o.id)).toEqual(["hoodie"]);
  });

  it("matches the category name", () => {
    const matches = flattenProductPickerOptions(filterProductPickerGroups(groups, "sticker"));
    expect(matches.map((o) => o.id)).toEqual(["sticker"]);
  });

  it("drops groups left empty", () => {
    const filtered = filterProductPickerGroups(groups, "hoodie");
    expect(filtered.map((g) => g.value)).toEqual(["apparel"]);
  });

  it("matches the group label, so a type search keeps its whole group", () => {
    expect(
      flattenProductPickerOptions(filterProductPickerGroups(groups, "apparel")),
    ).toHaveLength(3);
  });

  it("requires every token to match", () => {
    // "tee" and "hoodie" are both in Pullover Hoodie's haystack ("…hoodie tees").
    expect(
      flattenProductPickerOptions(filterProductPickerGroups(groups, "tee hoodie")).map((o) => o.id),
    ).toEqual(["hoodie"]);
    expect(
      flattenProductPickerOptions(filterProductPickerGroups(groups, "tee mug")),
    ).toHaveLength(0);
  });

  it("returns no groups when nothing matches", () => {
    expect(filterProductPickerGroups(groups, "zzzz")).toEqual([]);
  });
});

describe("matchesProductQuery", () => {
  it("is case-insensitive and tolerant of padding", () => {
    expect(matchesProductQuery("bella tee tees", "  BELLA ")).toBe(true);
    expect(matchesProductQuery("bella tee tees", "mug")).toBe(false);
  });
});

describe("keyboard helpers", () => {
  const options = flattenProductPickerOptions(buildProductPickerGroups(CATALOG, CATEGORIES));

  it("finds the selected option", () => {
    expect(indexOfProductOption(options, "tee")).toBe(0);
    expect(indexOfProductOption(options, "sticker")).toBe(3);
    expect(indexOfProductOption(options, "free")).toBe(-1);
    expect(indexOfProductOption(options, "")).toBe(-1);
  });

  it("moves the active option and wraps at both ends", () => {
    expect(moveActiveIndex(0, 1, 4)).toBe(1);
    expect(moveActiveIndex(3, 1, 4)).toBe(0);
    expect(moveActiveIndex(0, -1, 4)).toBe(3);
    expect(moveActiveIndex(-1, 1, 4)).toBe(0);
    expect(moveActiveIndex(-1, -1, 4)).toBe(3);
    expect(moveActiveIndex(0, 1, 0)).toBe(-1);
  });
});

describe("indexProductPickerGroups", () => {
  it("numbers each group's first option in the flat list", () => {
    const groups = indexProductPickerGroups(
      buildProductPickerGroups(CATALOG, CATEGORIES),
    );
    expect(groups.map((g) => g.start)).toEqual([0, 3]);
    // The start index must equal where that group's first option really sits.
    const flat = flattenProductPickerOptions(groups);
    expect(flat[groups[1].start].id).toBe("sticker");
  });

  it("survives an empty list", () => {
    expect(indexProductPickerGroups([])).toEqual([]);
  });
});
