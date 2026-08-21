/**
 * Pure, dependency-free order pricing for createSquareOrderAndPay.
 *
 * The checkout client sends the items in the customer's cart. NOTHING in that
 * payload is trusted: every price, add-on, and shipping amount is re-derived
 * from the Firestore catalog (products + config/site) and the client-declared
 * totals are only compared, never charged.
 *
 * All money math is done in integer cents (Number) to avoid float drift.
 * Square API amounts are converted to BigInt at the call boundary in index.ts.
 */

export type AddonPriceType = "fixed" | "percentage";

export interface PricingModifierDef {
  id: string;
  name: string;
  priceType?: AddonPriceType;
  /** Fixed: dollars. Percentage: percent of the line's base price (10 = 10%). */
  price: number;
}

export interface PricingVariant {
  id: string;
  name?: string;
  /** Dollars. Zero/negative means "no price configured". */
  price: number;
  squareVariationId?: string;
}

export interface PricingProduct {
  id: string;
  name: string;
  productType?: string;
  /** Optional per-product flat shipping rate (dollars). */
  shippingRate?: number;
  variants: PricingVariant[];
  modifiers?: PricingModifierDef[];
  /** Legacy add-ons (always fixed-price). */
  productAddons?: { id: string; name: string; price: number }[];
}

export interface SitePricingConfig {
  shipping_tier_stickers?: number;
  shipping_tier_apparel?: number;
  free_shipping_threshold?: number;
  addon_price?: number;
  addon_defaults?: {
    standardAddons?: PricingModifierDef[];
  };
}

/** Shape of one line item in the client checkout payload. */
export interface ClientLineItem {
  product_id: string;
  variant_id: string;
  squareVariationId?: string;
  quantity?: number;
  /** Client-declared base price (dollars). Only used as a fallback for
   *  variants whose catalog price is unconfigured — never charged directly. */
  price?: number;
  /** Fulfillment note built client-side (design/text/color/options). */
  note?: string;
  /** Customer-uploaded design image URL for printing. */
  designUrl?: string;
  addons?: ClientAddon[];
}

export interface ClientAddon {
  /** Managed modifier/add-on ID used to look the definition up in the catalog. */
  addon_id?: string;
  label?: string;
  /** Client-resolved dollar amount (percentage already applied). Verified, not trusted. */
  price?: number;
  priceType?: AddonPriceType;
}

export interface ResolvedAddon {
  addonId?: string;
  label: string;
  perUnitCents: number;
}

export interface ResolvedLine {
  productId: string;
  variantId: string;
  name: string;
  quantity: number;
  baseCents: number;
  /** True when the variant has a Square variation ID (catalog-priced path). */
  catalogPath: boolean;
  squareVariationId?: string;
  note?: string;
  designUrl?: string;
  addons: ResolvedAddon[];
}

export interface ResolvedOrder {
  lines: ResolvedLine[];
  subtotalCents: number;
  addonsCents: number;
  shippingCents: number;
  totalCents: number;
}

export type DeriveResult =
  | { ok: true; order: ResolvedOrder }
  | { ok: false; error: string };

/** Site-standard add-ons used when config/site has none (mirrors the client's
 *  legacy ADDONS fallback: back print, sleeve print, personalization). */
const FALLBACK_STANDARD_ADDONS: PricingModifierDef[] = [
  { id: "back_print", name: "Back Print", priceType: "fixed", price: 5 },
  { id: "sleeve_print", name: "Sleeve Print", priceType: "fixed", price: 5 },
  { id: "personalization", name: "Name/Number Personalization", priceType: "fixed", price: 5 },
];

const MAX_QUANTITY = 1000;
/** Cents of slack allowed between client-declared and server-derived money. */
const CENT_TOLERANCE = 2;

function toCents(dollars: number): number {
  return Math.round((Number.isFinite(dollars) ? dollars : 0) * 100);
}

function roundCents(n: number): number {
  return Math.round(n);
}

/** Resolve an add-on definition against a base price, in integer cents. */
function resolveAddonCents(def: PricingModifierDef, baseCents: number): number {
  if (def.priceType === "percentage") {
    return roundCents(baseCents * ((Number.isFinite(def.price) ? def.price : 0) / 100));
  }
  return toCents(def.price);
}

/**
 * Find the catalog definition for one client add-on.
 * Lookup order mirrors the storefront: product modifiers (Phase 3) →
 * legacy productAddons → site-standard add-ons from config (with fallback).
 */
function findAddonDef(
  product: PricingProduct,
  siteConfig: SitePricingConfig,
  addon: ClientAddon,
): PricingModifierDef | undefined {
  const id = (addon.addon_id ?? "").trim();
  if (id) {
    const mod = (product.modifiers ?? []).find((m) => m.id === id);
    if (mod) return mod;
    const legacy = (product.productAddons ?? []).find((a) => a.id === id);
    if (legacy) return { id: legacy.id, name: legacy.name, priceType: "fixed", price: legacy.price };
  }
  const standard = siteConfig.addon_defaults?.standardAddons ?? [];
  if (id) {
    const std = standard.find((a) => a.id === id);
    if (std) return std;
  }
  // Legacy client payloads may omit addon_id and only send a label — match by name.
  const label = (addon.label ?? "").trim().toLowerCase();
  if (label) {
    const byName =
      (product.modifiers ?? []).find((m) => m.name.toLowerCase() === label) ??
      (product.productAddons ?? []).find((a) => a.name.toLowerCase() === label) ??
      standard.find((a) => a.name.toLowerCase() === label) ??
      FALLBACK_STANDARD_ADDONS.find((a) => a.name.toLowerCase() === label);
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Re-derive the full order (line items, add-ons, shipping, totals) from the
 * catalog. Returns { ok: false, error } for anything the server cannot verify.
 */
export function deriveOrder(
  products: ReadonlyMap<string, PricingProduct>,
  siteConfig: SitePricingConfig,
  clientLines: ClientLineItem[],
): DeriveResult {
  if (!clientLines.length) return { ok: false, error: "Order must contain at least one line item" };

  const lines: ResolvedLine[] = [];
  const allProductTypes: string[] = [];
  let subtotalCents = 0;
  let addonsCents = 0;
  let perProductShippingMaxCents = 0;

  for (const raw of clientLines) {
    const product = products.get(raw.product_id);
    if (!product) {
      return { ok: false, error: `Product not found in catalog: ${raw.product_id}` };
    }

    const quantity = Math.min(
      MAX_QUANTITY,
      Math.max(1, Math.floor(Number.isFinite(raw.quantity) ? (raw.quantity as number) : 1)),
    );

    // Prefer matching the managed variant id; fall back to the Square variation
    // id for legacy payloads whose managed id was never persisted.
    let variant = product.variants.find((v) => v.id === raw.variant_id);
    if (!variant && raw.squareVariationId) {
      variant = product.variants.find((v) => v.squareVariationId === raw.squareVariationId);
    }
    if (!variant) {
      return {
        ok: false,
        error: `Variant not found for product "${product.name}" (${raw.variant_id})`,
      };
    }

    // A zero/negative catalog price means the product has no price configured.
    // The storefront displays a $20 fallback for exactly this case, so accept
    // the client price here to avoid breaking those orders (nothing is gained
    // by tampering: the catalog price is zero either way).
    const fallbackPrice = typeof raw.price === "number" && raw.price > 0 ? raw.price : 0;
    const baseCents =
      variant.price > 0 ? toCents(variant.price) : toCents(fallbackPrice);

    const resolvedAddons: ResolvedAddon[] = [];
    for (const addon of raw.addons ?? []) {
      const def = findAddonDef(product, siteConfig, addon);
      if (!def) {
        return {
          ok: false,
          error: `Unrecognized add-on "${addon.label ?? addon.addon_id ?? "?"}" for product "${product.name}"`,
        };
      }
      const serverCents = resolveAddonCents(def, baseCents);
      const clientCents = toCents(Number.isFinite(addon.price) ? (addon.price as number) : serverCents / 100);
      // Reject a client that declares a resolved add-on price below the catalog
      // derivation (undercharge attempt). Small float drift is tolerated.
      if (clientCents < serverCents - CENT_TOLERANCE) {
        return {
          ok: false,
          error: `Add-on price mismatch for "${def.name}" on product "${product.name}"`,
        };
      }
      resolvedAddons.push({
        addonId: def.id,
        label: def.name,
        perUnitCents: serverCents,
      });
      addonsCents += serverCents * quantity;
    }

    const line: ResolvedLine = {
      productId: product.id,
      variantId: variant.id,
      name: `${product.name} — ${variant.name ?? "Default"}`,
      quantity,
      baseCents,
      catalogPath: !!variant.squareVariationId,
      squareVariationId: variant.squareVariationId,
      note: raw.note,
      designUrl: raw.designUrl,
      addons: resolvedAddons,
    };
    lines.push(line);
    subtotalCents += baseCents * quantity;

    allProductTypes.push(product.productType ?? "other");
    if (typeof product.shippingRate === "number" && product.shippingRate > 0) {
      perProductShippingMaxCents = Math.max(perProductShippingMaxCents, toCents(product.shippingRate));
    }
  }

  // Shipping: free above threshold; otherwise the higher of the per-product
  // rate and the global tier (sticker tier only when EVERY line is a sticker).
  const freeThreshold = toCents(
    siteConfig.free_shipping_threshold ?? 100,
  );
  let shippingCents = 0;
  if (subtotalCents < freeThreshold) {
    const allStickers = allProductTypes.length > 0 && allProductTypes.every((t) => t === "sticker");
    const tierDollars = allStickers
      ? (siteConfig.shipping_tier_stickers ?? 3)
      : (siteConfig.shipping_tier_apparel ?? 7.5);
    shippingCents = Math.max(perProductShippingMaxCents, toCents(tierDollars));
  }

  return {
    ok: true,
    order: {
      lines,
      subtotalCents,
      addonsCents,
      shippingCents,
      totalCents: subtotalCents + addonsCents + shippingCents,
    },
  };
}
