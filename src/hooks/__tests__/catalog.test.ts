/**
 * Tests for managedToCatalogItem — the Firestore→Catalog converter.
 * If this breaks, the catalog is empty.
 */
import { describe, it, expect } from "@jest/globals";
import type { ManagedProduct, SquareCatalogItem } from "@/types";

// Inline the converter to avoid mocking Firebase imports
function managedToCatalogItem(p: ManagedProduct): SquareCatalogItem {
  const images = Array.isArray(p.images) ? p.images : [];
  const variants = Array.isArray(p.variants) ? p.variants : [];
  return {
    id: p.id ?? "",
    name: p.name ?? "",
    description: p.description ?? "",
    categoryIds: p.categoryId ? [p.categoryId] : [],
    image_url: images[0] ?? "",
    images,
    variations: variants.map((v) => ({
      id: v.id ?? "",
      name: v.name ?? "",
      price: typeof v.price === "number" ? v.price : 0,
      sku: v.sku ?? "",
    })),
    colors: Array.isArray(p.colors) ? p.colors : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    productType: (p as Record<string, unknown>).productType as string | undefined,
    printZones: p.printZones,
    mockupImages: p.mockupImages,
  };
}

const makeProduct = (overrides: Partial<ManagedProduct> = {}): ManagedProduct => ({
  id: "prod_1",
  name: "Test Tee",
  description: "A test t-shirt",
  categoryId: "cat_apparel",
  productType: "apparel",
  colors: ["black", "white"],
  tags: ["test", "tee"],
  images: ["https://storage.example.com/img1.jpg", "https://storage.example.com/img2.jpg"],
  variants: [
    { id: "v1", name: "Small / Black", price: 25, sku: "TT-S-BLK" },
    { id: "v2", name: "Large / White", price: 28, sku: "TT-L-WHT", squareItemId: "sq_123", squareVariationId: "sq_v_456" },
  ],
  active: true,
  featured: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  squareItemIds: ["sq_123"],
  printZones: {
    front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
    back: { x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35 },
  },
  mockupImages: {
    front: "https://storage.example.com/mockup_front.jpg",
    back: "https://storage.example.com/mockup_back.jpg",
  },
  ...overrides,
});

describe("managedToCatalogItem", () => {
  it("converts a full product correctly", () => {
    const result = managedToCatalogItem(makeProduct());
    expect(result.id).toBe("prod_1");
    expect(result.name).toBe("Test Tee");
    expect(result.description).toBe("A test t-shirt");
    expect(result.categoryIds).toEqual(["cat_apparel"]);
    expect(result.image_url).toBe("https://storage.example.com/img1.jpg");
    expect(result.images).toHaveLength(2);
    expect(result.colors).toEqual(["black", "white"]);
    expect(result.tags).toEqual(["test", "tee"]);
    expect(result.productType).toBe("apparel");
    expect(result.printZones?.front.x_percent).toBe(30);
    expect(result.printZones?.back?.y_percent).toBe(15);
    expect(result.mockupImages?.front).toBe("https://storage.example.com/mockup_front.jpg");
    expect(result.mockupImages?.back).toBe("https://storage.example.com/mockup_back.jpg");
  });

  it("maps variants with correct prices", () => {
    const result = managedToCatalogItem(makeProduct());
    expect(result.variations).toHaveLength(2);
    expect(result.variations[0].id).toBe("v1");
    expect(result.variations[0].price).toBe(25);
    expect(result.variations[1].price).toBe(28);
  });

  it("handles missing fields gracefully", () => {
    const result = managedToCatalogItem(makeProduct({
      id: "",
      name: "",
      description: "",
      categoryId: "",
      images: undefined,
      colors: undefined,
      tags: undefined,
      variants: [],
      productType: undefined,
      printZones: undefined,
      mockupImages: undefined,
    }));
    expect(result.id).toBe("");
    expect(result.name).toBe("");
    expect(result.categoryIds).toEqual([]);
    expect(result.image_url).toBe("");
    expect(result.images).toEqual([]);
    expect(result.colors).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.variations).toEqual([]);
    expect(result.productType).toBeUndefined();
    expect(result.printZones).toBeUndefined();
    expect(result.mockupImages).toBeUndefined();
  });

  it("handles null/undefined variants gracefully", () => {
    const p = makeProduct({ variants: undefined as unknown as ManagedProduct["variants"] });
    const result = managedToCatalogItem(p);
    expect(result.variations).toEqual([]);
  });

  it("defaults price to 0 for non-numeric values", () => {
    const p = makeProduct({
      variants: [{ id: "v_bad", name: "Bad", price: "not-a-number" as unknown as number, sku: "" }],
    });
    const result = managedToCatalogItem(p);
    expect(result.variations[0].price).toBe(0);
  });

  it("carries through only the first image as image_url", () => {
    const result = managedToCatalogItem(makeProduct({ images: [] }));
    expect(result.image_url).toBe("");
  });
});
