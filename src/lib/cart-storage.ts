/**
 * Cart persistence — survive a reload, a new tab, or a phone call.
 *
 * The cart used to live only in React memory: a refresh emptied it, and a link
 * straight to /checkout/ looked broken. On a phone, switching to a banking app
 * can unload the tab entirely — losing the cart mid-purchase.
 *
 * What is stored is the cart's INPUTS (which product, which variant, how many,
 * which add-ons, which artwork). Prices are stored for display only: the server
 * re-derives every amount in createSquareOrderAndPay and refuses the order if the
 * client total has drifted, so a stale cached price can never be charged.
 *
 * The key carries a version. Bump it when CartItem changes shape; parseCart drops
 * anything it cannot validate rather than throwing, so a bad payload degrades to
 * an empty cart instead of a broken page.
 */
import type { CartItem, CartAddon, AddonType, AddonPriceType } from "@/types";

export const CART_STORAGE_KEY = "animas-cart-v1";
const MAX_ITEMS = 50;
const MAX_QTY = 99;
const VIEWS = ["front", "back", "sleeve", "sideL", "sideR"] as const;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseAddon(raw: unknown): CartAddon | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const type = str(a.type);
  const price = num(a.price);
  if (!type || price === undefined) return null;
  return {
    type: type as AddonType,
    addon_id: str(a.addon_id),
    label: str(a.label) ?? "",
    price,
    priceType: (str(a.priceType) as AddonPriceType | undefined) ?? "fixed",
  };
}

function parseItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const id = str(i.id);
  const productId = str(i.product_id);
  const variantId = str(i.variant_id);
  const name = str(i.name);
  const basePrice = num(i.base_price);
  const quantity = num(i.quantity);
  if (!id || !productId || !variantId || !name || basePrice === undefined || quantity === undefined) {
    return null;
  }
  const view = VIEWS.includes(i.selected_view as (typeof VIEWS)[number])
    ? (i.selected_view as CartItem["selected_view"])
    : "front";
  const addons = Array.isArray(i.addons)
    ? i.addons.map(parseAddon).filter((a): a is CartAddon => a !== null)
    : [];

  return {
    id,
    product_id: productId,
    variant_id: variantId,
    squareVariationId: str(i.squareVariationId),
    name,
    variant_name: str(i.variant_name) ?? "",
    base_price: basePrice,
    productType: (str(i.productType) ?? "other") as CartItem["productType"],
    quantity: Math.min(MAX_QTY, Math.max(1, Math.round(quantity))),
    selected_view: view,
    selected_color: str(i.selected_color),
    design_url: str(i.design_url),
    design_text: str(i.design_text),
    design_x: num(i.design_x),
    design_y: num(i.design_y),
    design_scale: num(i.design_scale),
    design_rotation: num(i.design_rotation),
    addons,
    selectedOptions: Array.isArray(i.selectedOptions)
      ? (i.selectedOptions as CartItem["selectedOptions"])
      : undefined,
    modifierInputs: Array.isArray(i.modifierInputs)
      ? (i.modifierInputs as CartItem["modifierInputs"])
      : undefined,
    shipping_rate: num(i.shipping_rate),
  };
}

/** Parse a stored cart. Anything unparseable yields an empty cart, never a throw. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map(parseItem)
    .filter((i): i is CartItem => i !== null)
    .slice(0, MAX_ITEMS);
}

export function serializeCart(items: CartItem[]): string {
  return JSON.stringify(items.slice(0, MAX_ITEMS));
}

/** Read the persisted cart in the browser. Safe to call during an effect only. */
export function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeStoredCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items));
  } catch {
    // Storage can be full or blocked (private mode); a lost cart is not fatal.
  }
}
