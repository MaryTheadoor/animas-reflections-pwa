/**
 * Tests for featured products selection logic.
 * Verifies the featured flag is respected with fallback to first N products.
 */
import { describe, it, expect } from "@jest/globals";
import type { ManagedProduct } from "@/types";

function selectFeatured(products: ManagedProduct[], max = 6): ManagedProduct[] {
  const featuredProducts = products.filter((p) => p.featured);
  if (featuredProducts.length > 0) return featuredProducts.slice(0, max);
  return products.slice(0, max);
}

function makeProduct(id: string, featured: boolean): ManagedProduct {
  return {
    id,
    name: `Product ${id}`,
    description: "",
    categoryId: "cat_misc",
    productType: "other",
    colors: [],
    tags: [],
    images: [],
    variants: [{ id: `v_${id}`, name: "Standard", price: 10, sku: "" }],
    active: true,
    featured,
    createdAt: "",
    updatedAt: "",
  };
}

describe("selectFeatured", () => {
  it("returns only featured products when some are marked", () => {
    const products = [
      makeProduct("1", false),
      makeProduct("2", true),
      makeProduct("3", false),
      makeProduct("4", true),
    ];
    const result = selectFeatured(products, 6);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.featured)).toBe(true);
  });

  it("capped at max count", () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(`${i}`, true));
    const result = selectFeatured(products, 6);
    expect(result).toHaveLength(6);
  });

  it("falls back to first active products when none are featured", () => {
    const products = [
      makeProduct("a", false),
      makeProduct("b", false),
      makeProduct("c", false),
    ];
    const result = selectFeatured(products, 6);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("a");
  });

  it("returns empty array when no products exist", () => {
    expect(selectFeatured([], 6)).toHaveLength(0);
  });

  it("returns all featured when fewer than max", () => {
    const products = [makeProduct("1", true), makeProduct("2", true)];
    const result = selectFeatured(products, 6);
    expect(result).toHaveLength(2);
  });
});
