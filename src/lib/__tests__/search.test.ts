/**
 * Tests for searchProducts, fuzzyScore, and useProductSearch.
 * These are pure functions — no mocking needed.
 */
import { describe, it, expect } from "@jest/globals";
import { searchProducts, compareByPrice, type SearchFilters } from "@/hooks/useSearch";
import type { ManagedProduct } from "@/types";

// --- Test data ---

function makeProduct(
  id: string,
  name: string,
  description: string,
  categoryId: string,
  price: number,
  colors: string[] = [],
  tags: string[] = []
): ManagedProduct {
  return {
    id,
    name,
    description,
    categoryId,
    productType: "other",
    colors,
    tags,
    images: [],
    variants: [{ id: `v_${id}`, name: "Standard", price, sku: "" }],
    active: true,
    featured: false,
    createdAt: "",
    updatedAt: "",
  };
}

const catalog: ManagedProduct[] = [
  makeProduct("1", "Biscuit Hockey Tee", "Custom hockey t-shirt design", "cat_hockey", 25, ["black", "white"], ["hockey", "biscuit"]),
  makeProduct("2", "Animas Reflections Hoodie", "Warm hoodie with mountain logo", "cat_apparel", 45, ["navy", "gray"], ["hoodie", "mountain"]),
  makeProduct("3", "Custom Sticker Pack", "Set of 5 vinyl stickers", "cat_stickers", 8, ["white"], ["sticker", "vinyl"]),
  makeProduct("4", "Jewelry Necklace Durango", "Handmade silver necklace", "cat_jewelry", 65, ["silver"], ["jewelry", "necklace"]),
  makeProduct("5", "Wood Sign Custom", "Engraved wood sign 12x18", "cat_signs", 35, [], ["wood", "sign", "custom"]),
  makeProduct("6", "Team Jersey Pro", "Full sublimation team jersey", "cat_apparel", 55, ["red", "blue"], ["team", "jersey"]),
];

// --- fuzzyScore (tested indirectly via searchProducts) ---

describe("searchProducts", () => {
  const emptyFilters: SearchFilters = { query: "", categoryId: null, colors: [], minPrice: null, maxPrice: null };

  it("returns all items with empty query and no filters", () => {
    const result = searchProducts(catalog, emptyFilters);
    expect(result).toHaveLength(6);
  });

  it("matches exact name", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "Biscuit Hockey Tee" });
    expect(result[0].id).toBe("1");
  });

  it("matches partial name (case insensitive)", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "hoodie" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain("Hoodie");
  });

  it("matches by description", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "mountain" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("matches by tag", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "vinyl" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("returns empty for no match", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "zzznotexistzzz" });
    expect(result).toHaveLength(0);
  });

  it("filters by category", () => {
    const result = searchProducts(catalog, { ...emptyFilters, categoryId: "cat_apparel" });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.categoryId === "cat_apparel")).toBe(true);
  });

  it("filters by color", () => {
    const result = searchProducts(catalog, { ...emptyFilters, colors: ["red"] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("6");
  });

  it("filters by min price", () => {
    const result = searchProducts(catalog, { ...emptyFilters, minPrice: 40 });
    const hasVariants = result.filter((p) => p.variants.length > 0);
    expect(hasVariants.every((p) => Math.min(...p.variants.map((v) => v.price)) >= 40)).toBe(true);
  });

  it("filters by max price", () => {
    const result = searchProducts(catalog, { ...emptyFilters, maxPrice: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("sorts by price ascending", () => {
    const result = searchProducts(catalog, emptyFilters, "price-asc");
    const prices = result.map((p) => Math.min(...p.variants.map((v) => v.price)));
    expect(prices).toEqual([8, 25, 35, 45, 55, 65]);
  });

  it("sorts by price descending", () => {
    const result = searchProducts(catalog, emptyFilters, "price-desc");
    const prices = result.map((p) => Math.min(...p.variants.map((v) => v.price)));
    expect(prices).toEqual([65, 55, 45, 35, 25, 8]);
  });

  it("sorts by name ascending", () => {
    const result = searchProducts(catalog, emptyFilters, "name-asc");
    expect(result[0].name).toBe("Animas Reflections Hoodie");
  });

  it("sorts by relevance (higher score first)", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "hockey" });
    expect(result[0].id).toBe("1"); // "Biscuit Hockey Tee" has highest match
  });

  it("combines query + category filter", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "jersey", categoryId: "cat_apparel" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((p) => p.id === "6")).toBe(true);
  });

  it("treats category as a hard AND filter alongside a query", () => {
    // "hockey" scores far above 50 on a name match alone, so the old
    // OR-with-score rule let the hockey tee through when filtering on another
    // category. The category filter must win.
    const wrongCategory = searchProducts(catalog, {
      ...emptyFilters,
      query: "hockey",
      categoryId: "cat_stickers",
    });
    expect(wrongCategory).toHaveLength(0);

    const rightCategory = searchProducts(catalog, {
      ...emptyFilters,
      query: "hockey",
      categoryId: "cat_hockey",
    });
    expect(rightCategory.map((p) => p.id)).toEqual(["1"]);
  });

  it("excludes products outside the category even with a matching name", () => {
    const result = searchProducts(catalog, { ...emptyFilters, query: "hoodie", categoryId: "cat_hockey" });
    expect(result).toHaveLength(0);
    expect(result.every((p) => p.categoryId === "cat_hockey")).toBe(true);
  });
});

// --- Pricing edge cases: a variant priced 0 is not sellable ---

describe("searchProducts price handling", () => {
  const emptyFilters: SearchFilters = { query: "", categoryId: null, colors: [], minPrice: null, maxPrice: null };

  // "9" has a $0 variant, "10" has no variants at all — neither is orderable
  // (checkout rejects a non-positive price), so neither may sort as "cheapest".
  const withUnpriced: ManagedProduct[] = [
    makeProduct("7", "Priced Low", "Cheap item", "cat_a", 10),
    makeProduct("8", "Priced High", "Expensive item", "cat_a", 90),
    makeProduct("9", "Zero Price", "Not configured", "cat_b", 0),
    {
      ...makeProduct("10", "No Variants", "Variant-less item", "cat_b", 0),
      variants: [],
    },
  ];

  it("sorts products with no price last when ascending", () => {
    const result = searchProducts(withUnpriced, emptyFilters, "price-asc");
    expect(result.map((p) => p.id)).toEqual(["7", "8", "9", "10"]);
  });

  it("sorts products with no price last when descending", () => {
    const result = searchProducts(withUnpriced, emptyFilters, "price-desc");
    expect(result.map((p) => p.id)).toEqual(["8", "7", "9", "10"]);
  });

  it("keeps unpriced products out of price range filters", () => {
    const withMax = searchProducts(withUnpriced, { ...emptyFilters, maxPrice: 1000 });
    expect(withMax.map((p) => p.id).sort()).toEqual(["7", "8"]);
  });

  it("orders the same way as the shop page comparator", () => {
    const asc = searchProducts(withUnpriced, emptyFilters, "price-asc").map((p) => p.id);
    const shared = [...withUnpriced]
      .sort((a, b) => compareByPrice(a, b, "asc"))
      .map((p) => p.id);
    expect(asc).toEqual(shared);
  });
});
