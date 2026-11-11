/**
 * Tests for the server-side order derivation (functions/src/pricing.ts).
 * This is the security core of createSquareOrderAndPay: every price, add-on,
 * and shipping amount must come from the catalog, never the client payload.
 */
import { describe, it, expect } from "@jest/globals";
import { deriveOrder } from "../../../../functions/src/pricing";
import type {
  PricingProduct,
  PricingVariant,
  ClientLineItem,
  SitePricingConfig,
} from "../../../../functions/src/pricing";

function variant(overrides: Partial<PricingVariant> = {}): PricingVariant {
  return { id: "v1", name: "Large / Black", price: 25, ...overrides };
}

function product(overrides: Partial<PricingProduct> = {}): PricingProduct {
  return {
    id: "p1",
    name: "Test Tee",
    productType: "apparel",
    variants: [variant()],
    ...overrides,
  };
}

function line(overrides: Partial<ClientLineItem> = {}): ClientLineItem {
  return {
    product_id: "p1",
    variant_id: "v1",
    quantity: 1,
    ...overrides,
  };
}

const DEFAULT_SITE: SitePricingConfig = {
  shipping_tier_stickers: 3,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100,
};

function derive(
  products: PricingProduct[],
  lines: ClientLineItem[],
  site: SitePricingConfig = DEFAULT_SITE,
) {
  return deriveOrder(new Map(products.map((p) => [p.id, p])), site, lines);
}

describe("deriveOrder — base items", () => {
  it("derives base price from the catalog, ignoring nothing", () => {
    const result = derive([product()], [line({ price: 1 })]); // client claims $1
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.subtotalCents).toBe(2500);
    expect(result.order.lines[0].baseCents).toBe(2500);
    expect(result.order.lines[0].catalogPath).toBe(false);
  });

  it("marks variants with a Square variation ID as catalog-path", () => {
    const result = derive(
      [product({ variants: [variant({ squareVariationId: "sq_1" })] })],
      [line()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.lines[0].catalogPath).toBe(true);
    expect(result.order.lines[0].squareVariationId).toBe("sq_1");
  });

  it("refuses a zero-priced variant instead of trusting the client price", () => {
    const result = derive(
      [product({ variants: [variant({ price: 0 })] })],
      [line({ price: 20 })],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("has no price configured");
  });

  it("refuses a negatively-priced variant", () => {
    const result = derive(
      [product({ variants: [variant({ price: -5 })] })],
      [line({ price: 20 })],
    );
    expect(result.ok).toBe(false);
  });

  it("keeps a design URL from our own Storage bucket", () => {
    const result = derive(
      [product()],
      [line({ designUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/uploads%2Fu%2Fa.png?alt=media" })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.lines[0].designUrl).toContain("firebasestorage.googleapis.com");
  });

  it("drops a design URL pointing anywhere else", () => {
    for (const url of ["https://evil.example/a.png", "javascript:alert(1)", "http://firebasestorage.googleapis.com/x.png"]) {
      const result = derive([product()], [line({ designUrl: url })]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.order.lines[0].designUrl).toBeUndefined();
    }
  });

  it("rejects a missing product", () => {
    const result = derive([], [line()]);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing variant", () => {
    const result = derive([product()], [line({ variant_id: "nope" })]);
    expect(result.ok).toBe(false);
  });

  it("clamps quantity to 1..1000", () => {
    const result = derive([product()], [line({ quantity: 0 }), line({ quantity: 5000 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.lines[0].quantity).toBe(1);
    expect(result.order.lines[1].quantity).toBe(1000);
  });

  it("matches a variant by squareVariationId when the managed id is absent", () => {
    const result = derive(
      [product({ variants: [variant({ squareVariationId: "sq_9" })] })],
      [line({ variant_id: "", squareVariationId: "sq_9" })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.lines[0].variantId).toBe("v1");
  });
});

describe("deriveOrder — add-ons", () => {
  it("charges a fixed modifier from the product", () => {
    const result = derive(
      [product({
        modifiers: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }],
      })],
      [line({ addons: [{ addon_id: "back_print", label: "Back Print", price: 5, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(500);
    expect(result.order.lines[0].addons[0].perUnitCents).toBe(500);
  });

  it("resolves percentage modifiers against the base price in cents", () => {
    const result = derive(
      [product({
        modifiers: [{ id: "engrave", name: "Engraving", priceType: "percentage", price: 10 }],
      })],
      [line({ addons: [{ addon_id: "engrave", label: "Engraving", price: 2.5, priceType: "percentage" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(250); // 10% of $25
  });

  it("multiplies add-on cost by quantity", () => {
    const result = derive(
      [product({
        modifiers: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }],
      })],
      [line({ quantity: 3, addons: [{ addon_id: "back_print", label: "Back Print", price: 5, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(1500);
  });

  it("rejects a client-declared add-on price below the catalog derivation", () => {
    const result = derive(
      [product({
        modifiers: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }],
      })],
      [line({ addons: [{ addon_id: "back_print", label: "Back Print", price: 0.01, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an add-on that cannot be found in the catalog", () => {
    const result = derive(
      [product()],
      [line({ addons: [{ addon_id: "mystery", label: "Mystery", price: 5, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(false);
  });

  it("resolves site-standard add-ons when the product configures none", () => {
    const site: SitePricingConfig = {
      ...DEFAULT_SITE,
      addon_defaults: {
        standardAddons: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }],
      },
    };
    const result = derive(
      [product()],
      [line({ addons: [{ addon_id: "back_print", label: "Back Print", price: 5, priceType: "fixed" }] })],
      site,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(500);
  });

  it("resolves legacy productAddons (fixed price)", () => {
    const result = derive(
      [product({ productAddons: [{ id: "back_print", name: "Back Print", price: 7.5 }] })],
      [line({ addons: [{ addon_id: "back_print", label: "Back Print", price: 7.5, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(750);
  });

  it("matches legacy add-ons by label when addon_id is missing", () => {
    const result = derive(
      [product({ modifiers: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }] })],
      [line({ addons: [{ label: "Back Print", price: 5 }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(500);
  });
});

describe("deriveOrder — shipping", () => {
  it("charges the apparel tier by default", () => {
    const result = derive([product()], [line()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.shippingCents).toBe(750);
  });

  it("charges the sticker tier when every line is a sticker", () => {
    const result = derive(
      [product({ productType: "sticker" })],
      [line()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.shippingCents).toBe(300);
  });

  it("charges apparel tier for mixed carts", () => {
    const sticker = product({ id: "s1", productType: "sticker", variants: [variant({ price: 3 })] });
    const apparel = product();
    const result = derive([sticker, apparel], [
      line({ product_id: "s1", variant_id: "v1" }),
      line({ product_id: "p1", variant_id: "v1" }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.shippingCents).toBe(750);
  });

  it("ships free at the threshold", () => {
    const result = derive(
      [product({ variants: [variant({ price: 120 })] })],
      [line()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.shippingCents).toBe(0);
  });

  it("uses the higher of the per-product rate and the tier", () => {
    const result = derive(
      [product({ shippingRate: 12 })],
      [line()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.shippingCents).toBe(1200);
  });
});

describe("deriveOrder — totals", () => {
  it("sums subtotal + add-ons + shipping in integer cents", () => {
    const result = derive(
      [product({
        modifiers: [{ id: "back_print", name: "Back Print", priceType: "fixed", price: 5 }],
      })],
      [line({ quantity: 2, addons: [{ addon_id: "back_print", label: "Back Print", price: 5, priceType: "fixed" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.subtotalCents).toBe(5000);
    expect(result.order.addonsCents).toBe(1000);
    expect(result.order.shippingCents).toBe(750);
    expect(result.order.totalCents).toBe(6750);
  });

  it("rounds percentage add-ons to whole cents", () => {
    const result = derive(
      [product({
        variants: [variant({ price: 19.99 })],
        modifiers: [{ id: "engrave", name: "Engraving", priceType: "percentage", price: 10 }],
      })],
      [line({ addons: [{ addon_id: "engrave", label: "Engraving", price: 1.999, priceType: "percentage" }] })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.addonsCents).toBe(200);
  });
});
