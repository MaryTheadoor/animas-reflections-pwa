/**
 * Tests for searchProducts, fuzzyScore, and useProductSearch.
 * These are pure functions — no mocking needed.
 */
import { describe, it, expect } from "@jest/globals";
import { searchProducts, type SearchFilters } from "@/hooks/useSearch";
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
    // Category filter keeps items matching category OR with score >= 50
    const result = searchProducts(catalog, { ...emptyFilters, query: "jersey", categoryId: "cat_apparel" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((p) => p.id === "6")).toBe(true);
  });
});
