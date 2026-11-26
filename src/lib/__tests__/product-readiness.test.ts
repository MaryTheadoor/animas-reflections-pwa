import { describe, it, expect } from "@jest/globals";
import { assessProduct, blockersFor, isReadyUnder, summarise } from "../product-readiness";
import type { ManagedProduct } from "@/types";

function product(over: Partial<ManagedProduct> = {}): ManagedProduct {
  return {
    id: "p1",
    name: "Bella Canvas Tee",
    description: "A soft combed-cotton tee, printed in Durango, Colorado.",
    images: ["https://example.test/front.png"],
    categoryId: "cat_apparel",
    productType: "apparel",
    active: true,
    variants: [{ id: "v1", name: "Large", price: 25, sku: "L" }],
    modifiers: [],
    ...over,
  } as ManagedProduct;
}

describe("assessProduct", () => {
  it("passes a fully configured product", () => {
    const r = assessProduct(product());
    expect(r.ready).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.maxPrice).toBe(25);
  });

  it("blocks a product with no sellable price", () => {
    expect(assessProduct(product({ variants: [{ id: "v", name: "Regular", price: 0, sku: "x" }] as never })).blockers).toContain("no-price");
    expect(assessProduct(product({ variants: [] })).blockers).toContain("no-variants");
  });

  it("blocks a product with no photo of any kind", () => {
    expect(assessProduct(product({ images: [] })).blockers).toContain("no-image");
    expect(assessProduct(product({ images: [], mockupImages: { front: "https://example.test/m.png" } })).ready).toBe(true);
    expect(
      assessProduct(product({ images: [], mockupImagesByColor: { Black: { front: "https://example.test/b.png" } } })).ready,
    ).toBe(true);
  });

  it("blocks a thin description", () => {
    expect(assessProduct(product({ description: "soft shirt" })).blockers).toContain("thin-description");
  });

  it("blocks a $1 design record", () => {
    expect(assessProduct(product({ variants: [{ id: "v", name: "Regular", price: 1, sku: "x" }] as never })).blockers).toContain(
      "design-record-price",
    );
  });

  it("blocks duplicate-looking names", () => {
    for (const name of ["Hoodie (1)", "Copy of Hoodie", "Test Product"]) {
      expect(assessProduct(product({ name })).blockers).toContain("duplicate-name");
    }
  });

  it("blocks a product whose tracked stock is all gone", () => {
    const variants = [{ id: "v", name: "L", price: 25, sku: "L", inventory: 0 }] as never;
    expect(assessProduct(product({ variants })).blockers).toContain("out-of-stock");
  });

  it("treats a missing category as a warning, not a blocker", () => {
    const r = assessProduct(product({ categoryId: "" }));
    expect(r.ready).toBe(true);
    expect(r.warnings).toContain("no-category");
  });

  it("warns about an implausible size surcharge", () => {
    const modifiers = [
      { id: "m1", name: "XXL", priceType: "fixed", price: 17 },
      { id: "m2", name: "Large", priceType: "fixed", price: 0 },
    ] as never;
    const r = assessProduct(product({ modifiers }));
    expect(r.warnings).toContain("price-anomaly");
    expect(r.ready).toBe(true);
  });

  it("does not mark an inactive product ready", () => {
    expect(isReadyUnder(product({ active: false }), "strict")).toBe(false);
  });
});

describe("blockersFor / modes", () => {
  const noPhoto = product({ images: [], description: "short" });

  it("strict hides a product that lacks a photo or copy", () => {
    expect(blockersFor(assessProduct(noPhoto), "strict").length).toBeGreaterThan(0);
  });

  it("blocking-only keeps a product whose only gaps are photo/copy", () => {
    expect(blockersFor(assessProduct(noPhoto), "blocking-only")).toEqual([]);
  });

  it("blocking-only still hides a product with no price", () => {
    const noPrice = product({ variants: [{ id: "v", name: "Regular", price: 0, sku: "x" }] as never });
    expect(blockersFor(assessProduct(noPrice), "blocking-only")).toContain("no-price");
  });
});

describe("summarise", () => {
  it("counts ready, to-unlist and issue frequencies", () => {
    const products = [
      product(),
      product({ id: "p2", images: [] }),
      product({ id: "p3", active: false }),
      product({ id: "p4", variants: [{ id: "v", name: "Regular", price: 0, sku: "x" }] as never }),
    ];
    const strict = summarise(products, "strict");
    expect(strict.total).toBe(4);
    expect(strict.active).toBe(3);
    expect(strict.ready).toBe(1);
    expect(strict.toUnlist).toBe(2);
    expect(strict.byIssue["no-image"]).toBe(1);
    expect(strict.byIssue["no-price"]).toBe(1);

    const loose = summarise(products, "blocking-only");
    expect(loose.ready).toBe(2);
    expect(loose.toUnlist).toBe(1);
  });
});

describe("a product that preselects a $1 variant", () => {
  it("blocks a real product whose first variant is a design-record price", () => {
    // LITTLE STRANGER, as found live: four unnamed variants at $1 / $5 / $15 / $25.
    // The max-price rule could not see it, because the max is a real $25.
    const p = product({
      variants: [
        { id: "v1", name: "Regular", price: 1, sku: "920601F" },
        { id: "v2", name: "Regular", price: 5, sku: "1543873" },
        { id: "v3", name: "Regular", price: 15, sku: "142976T" },
        { id: "v4", name: "Regular", price: 25, sku: "2280102" },
      ],
    });
    const r = assessProduct(p);
    expect(r.blockers).toContain("low-default-price");
    expect(r.ready).toBe(false);
  });

  it("leaves a bulk product alone when its default variant is the real price", () => {
    // 4 Inch Slaps is legitimately priced per unit, starting at $0.71 — the cheap
    // variant is not the one the page preselects.
    const p = product({
      variants: [
        { id: "v1", name: "4 Inch Slaps 1 - 25 Unit Price", price: 6, sku: "A" },
        { id: "v2", name: "4 Inch Slaps 26 - 50 Unit Price", price: 0.71, sku: "B" },
      ],
    });
    expect(assessProduct(p).blockers).not.toContain("low-default-price");
  });

  it("leaves a cheap product alone when every variant is cheap", () => {
    const p = product({ variants: [{ id: "v1", name: "Sticker", price: 0.75, sku: "C" }] });
    expect(assessProduct(p).blockers).not.toContain("low-default-price");
  });
});
