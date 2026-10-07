import { describe, it, expect } from "@jest/globals";
import { findDuplicateGroups, mergeGroup, fingerprint, variantSignature } from "@/lib/duplicate-products";
import type { ManagedProduct } from "@/types";

function product(over: Partial<ManagedProduct>): ManagedProduct {
  return {
    id: over.id ?? "id",
    name: over.name ?? "Tee",
    description: "",
    categoryId: "",
    productType: "apparel",
    colors: [],
    tags: [],
    images: [],
    variants: [],
    active: true,
    featured: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("fingerprint", () => {
  it("ignores variant order", () => {
    const a = product({ variants: [{ id: "1", name: "L", price: 20, sku: "T-L" }, { id: "2", name: "M", price: 20, sku: "T-M" }] });
    const b = product({ variants: [{ id: "9", name: "M", price: 20, sku: "T-M" }, { id: "8", name: "L", price: 20, sku: "T-L" }] });
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("ignores name casing and spacing, but not prices", () => {
    expect(fingerprint(product({ name: "  Classic   Tee " }))).toBe(fingerprint(product({ name: "classic tee" })));
    const cheap = product({ variants: [{ id: "1", name: "L", price: 20, sku: "X" }] });
    const dear = product({ variants: [{ id: "1", name: "L", price: 25, sku: "X" }] });
    expect(fingerprint(cheap)).not.toBe(fingerprint(dear));
  });

  it("distinguishes products whose variants differ", () => {
    expect(variantSignature(product({ variants: [{ id: "1", name: "L", price: 20, sku: "A" }] })))
      .not.toBe(variantSignature(product({ variants: [{ id: "1", name: "L", price: 20, sku: "B" }] })));
  });
});

describe("findDuplicateGroups", () => {
  it("groups semantically identical products and omits singletons", () => {
    const groups = findDuplicateGroups([
      product({ id: "a", name: "Classic Tee", variants: [{ id: "1", name: "L", price: 20, sku: "T-L" }] }),
      product({ id: "b", name: "classic tee", variants: [{ id: "2", name: "L", price: 20, sku: "T-L" }] }),
      product({ id: "c", name: "Different Hat", variants: [{ id: "3", name: "One Size", price: 15, sku: "H" }] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("recommends the richer copy as the keeper", () => {
    const groups = findDuplicateGroups([
      product({ id: "thin", name: "Tee", variants: [{ id: "1", name: "L", price: 20, sku: "T" }] }),
      product({
        id: "rich",
        name: "Tee",
        description: "A lovely tee",
        categoryId: "cat-x",
        images: ["u1", "u2"],
        colors: ["black"],
        variants: [{ id: "2", name: "L", price: 20, sku: "T" }],
      }),
    ]);
    expect(groups[0].keeperId).toBe("rich");
  });
});

describe("mergeGroup", () => {
  it("unions arrays and keeps the keeper's curation", () => {
    const groups = findDuplicateGroups([
      product({
        id: "keep",
        name: "Tee",
        description: "Curated copy",
        colors: ["black"],
        images: ["a"],
        tags: ["apparel"],
        variants: [{ id: "1", name: "L", price: 20, sku: "T-L" }],
      }),
      product({
        id: "dupe",
        name: "Tee",
        description: "Other copy",
        colors: ["white"],
        images: ["b"],
        variants: [{ id: "2", name: "L", price: 20, sku: "T-L" }],
      }),
    ]);
    const merged = mergeGroup(groups[0]);
    expect(merged.id).toBe("keep");
    expect(merged.description).toBe("Curated copy");
    expect(merged.colors).toEqual(["black", "white"]);
    expect(merged.images).toEqual(["a", "b"]);
    expect(merged.variants).toHaveLength(1);
  });

  it("does not lose inventory held only by the copy being discarded", () => {
    const groups = findDuplicateGroups([
      product({
        id: "keep",
        name: "Tee",
        variants: [{ id: "1", name: "L", price: 20, sku: "T-L", inventory: 2 }],
      }),
      product({
        id: "dupe",
        name: "Tee",
        variants: [{ id: "2", name: "L", price: 20, sku: "T-L", inventory: 9 }],
      }),
    ]);
    const merged = mergeGroup(groups[0]);
    expect(merged.variants[0].inventory).toBe(9);
    expect(groups[0].inventoryConsistent).toBe(false);
  });

  it("flags consistent inventory when the copies agree", () => {
    const mk = (id: string, inv: number) =>
      product({ id, name: "Tee", variants: [{ id, name: "L", price: 20, sku: "T", inventory: inv }] });
    const groups = findDuplicateGroups([mk("a", 5), mk("b", 5)]);
    expect(groups[0].inventoryConsistent).toBe(true);
  });

  it("prefers a specific productType over the generic fallback", () => {
    const groups = findDuplicateGroups([
      product({ id: "keep", name: "Tee", productType: "other" }),
      product({ id: "dupe", name: "Tee", productType: "accessory" }),
    ]);
    expect(mergeGroup(groups[0]).productType).toBe("accessory");
  });
});
