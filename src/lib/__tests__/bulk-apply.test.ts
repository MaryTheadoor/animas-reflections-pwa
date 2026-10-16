/**
 * Tests for the bulk-apply planners.
 *
 * The planners exist so a bulk write can be previewed and then applied exactly
 * as previewed. What matters here: a product that already matches is omitted
 * rather than listed as a fake change, an unavailable view is reported instead
 * of silently skipped, and applying twice is a no-op the second time.
 */
import { describe, it, expect } from "@jest/globals";
import {
  describeBlankPlan,
  planBlankApply,
  planPriceApply,
  selectTargets,
  summarizeBlankPlans,
  summarizePricePlans,
} from "@/lib/bulk-apply";
import { blankPhotoSets } from "@/lib/product-photos";
import type { ManagedProduct, ProductPhoto } from "@/types";

const photo = (over: Partial<ProductPhoto> & { id: string }): ProductPhoto =>
  ({
    name: "Gildan 18500 Hoodie",
    image_url: `https://example.test/${over.id}.png`,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as ProductPhoto;

const BLANK = () =>
  blankPhotoSets([
    photo({ id: "f", view: "front" }),
    photo({ id: "b", view: "back" }),
    photo({ id: "cf", view: "front", color: "Charcoal" }),
  ])[0];

const product = (over: Partial<ManagedProduct> & { id: string }): ManagedProduct =>
  ({
    name: over.id,
    categoryId: "c1",
    productType: "apparel",
    colors: [],
    tags: [],
    images: [],
    variants: [],
    active: true,
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as ManagedProduct;

const frontUrl = "https://example.test/f.png";
const backUrl = "https://example.test/b.png";

describe("selectTargets", () => {
  const products = [
    product({ id: "a", categoryId: "c1", productType: "apparel" }),
    product({ id: "b", categoryId: "c2", productType: "apparel" }),
    product({ id: "c", categoryId: "c1", productType: "sticker" }),
  ];

  it("filters by category", () => {
    expect(selectTargets(products, { categoryId: "c1" }).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by product type, treating 'all' as no filter", () => {
    expect(selectTargets(products, { productType: "sticker" }).map((p) => p.id)).toEqual(["c"]);
    expect(selectTargets(products, { productType: "all" })).toHaveLength(3);
  });

  it("combines filters", () => {
    expect(selectTargets(products, { categoryId: "c1", productType: "apparel" }).map((p) => p.id)).toEqual(["a"]);
  });

  it("returns everything with no filters", () => {
    expect(selectTargets(products)).toHaveLength(3);
  });
});

describe("planBlankApply", () => {
  it("fills the views a product is missing", () => {
    const plans = planBlankApply([product({ id: "a" })], BLANK());
    expect(plans).toHaveLength(1);
    expect(plans[0].fill).toEqual({ front: frontUrl, back: backUrl });
    expect(plans[0].fillByColor).toEqual({ Charcoal: { front: "https://example.test/cf.png" } });
  });

  it("omits a product that already matches, rather than reporting a fake change", () => {
    const target = product({
      id: "a",
      mockupImages: { front: frontUrl, back: backUrl },
      mockupImagesByColor: { Charcoal: { front: "https://example.test/cf.png" } },
    });
    expect(planBlankApply([target], BLANK())).toEqual([]);
  });

  it("only lists the views that actually differ", () => {
    const target = product({ id: "a", mockupImages: { front: frontUrl } });
    const plans = planBlankApply([target], BLANK());
    expect(plans[0].fill).toEqual({ back: backUrl });
  });

  it("reports the views the blank cannot fill", () => {
    const plans = planBlankApply([product({ id: "a" })], BLANK());
    expect(plans[0].unavailable).toEqual(["sleeve", "sideL", "sideR"]);
  });

  it("respects the filters", () => {
    const products = [
      product({ id: "a", categoryId: "c1" }),
      product({ id: "b", categoryId: "c2" }),
    ];
    expect(planBlankApply(products, BLANK(), { categoryId: "c1" }).map((p) => p.productId)).toEqual(["a"]);
  });

  it("is empty when the blank has no views at all", () => {
    const loose = blankPhotoSets([photo({ id: "loose" })])[0];
    expect(planBlankApply([product({ id: "a" })], loose)).toEqual([]);
  });
});

describe("planPriceApply", () => {
  const priced = () =>
    product({
      id: "a",
      variants: [
        { id: "v1", name: "S", price: 20, sku: "" },
        { id: "v2", name: "M", price: 25, sku: "" },
        { id: "v3", name: "L", price: 30, sku: "" },
      ],
    } as unknown as Partial<ManagedProduct> & { id: string });

  it("lists only the variants whose price differs", () => {
    const plans = planPriceApply([priced()], 25);
    expect(plans).toHaveLength(1);
    expect(plans[0].changes.map((c) => c.variantId)).toEqual(["v1", "v3"]);
    expect(plans[0].changes[0].from).toBe(20);
    expect(plans[0].to).toBe(25);
  });

  it("is a no-op the second time the same price is applied", () => {
    const allAt25 = product({
      id: "a",
      variants: [{ id: "v1", name: "S", price: 25, sku: "" }],
    } as unknown as Partial<ManagedProduct> & { id: string });
    expect(planPriceApply([allAt25], 25)).toEqual([]);
  });

  it("ignores a nonsensical price rather than writing it", () => {
    expect(planPriceApply([priced()], Number.NaN)).toEqual([]);
    expect(planPriceApply([priced()], -5)).toEqual([]);
  });

  it("accepts zero, which is a legitimate price", () => {
    expect(planPriceApply([priced()], 0)[0].changes).toHaveLength(3);
  });
});

describe("descriptions and summaries", () => {
  it("describes a mixed plan", () => {
    const plan = planBlankApply([product({ id: "a" })], BLANK())[0];
    expect(describeBlankPlan(plan)).toBe("2 views + 1 colour view");
  });

  it("totals the products and views a blank apply would touch", () => {
    const plans = planBlankApply([product({ id: "a" }), product({ id: "b" })], BLANK());
    expect(summarizeBlankPlans(plans)).toEqual({ products: 2, views: 6 });
  });

  it("totals the products and variants a price apply would touch", () => {
    const plans = planPriceApply(
      [
        product({ id: "a", variants: [{ id: "v1", name: "S", price: 1, sku: "" }] }),
        product({ id: "b", variants: [{ id: "v2", name: "S", price: 1, sku: "" }, { id: "v3", name: "M", price: 1, sku: "" }] }),
      ] as unknown as ManagedProduct[],
      9,
    );
    expect(summarizePricePlans(plans)).toEqual({ products: 2, variants: 3 });
  });
});

describe("bulk modifier backgrounds", () => {
  it("plans and describes modifier-keyed background changes", () => {
    const set = blankPhotoSets([photo({ id: "bp", view: "back", modifier: "Back Print" })])[0];
    const plans = planBlankApply([product({ id: "a" })], set);
    expect(plans).toHaveLength(1);
    expect(plans[0].fillByModifier).toEqual({ "Back Print": { back: "https://example.test/bp.png" } });
    expect(describeBlankPlan(plans[0])).toContain("modifier view");
  });

  it("omits a product that already has that modifier background", () => {
    const set = blankPhotoSets([photo({ id: "bp", view: "back", modifier: "Back Print" })])[0];
    const target = product({
      id: "a",
      mockupImagesByModifier: { "Back Print": { back: "https://example.test/bp.png" } },
    });
    expect(planBlankApply([target], set)).toEqual([]);
  });
});
