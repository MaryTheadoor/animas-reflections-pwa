/**
 * Tests for the cart reducer — pure state transitions.
 * No React rendering needed.
 */
import { describe, it, expect, jest } from "@jest/globals";
import type { CartItem, AddonType, AddonPriceType } from "@/types";
import { resolveAddonPrice } from "@/types";
import { calculateCartTotals } from "@/context/cart-context";

jest.mock("@/hooks/useSiteConfig", () => ({ useSiteConfig: jest.fn() }));

// --- Inline the reducer for pure-function testing ---

type CartState = { items: CartItem[] };

/** Mirrors MAX_LINE_QUANTITY in src/context/cart-context.tsx. */
const MAX_LINE_QUANTITY = 99;

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "TOGGLE_ADDON"; id: string; addonType: AddonType; modifierId?: string; addonPrice: number; addonLabel?: string; priceType?: AddonPriceType }
  | { type: "CLEAR_CART" };

function clampQuantity(quantity: number): number {
  const rounded = Math.round(quantity);
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, rounded));
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "UPDATE_QUANTITY":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, quantity: clampQuantity(action.quantity) } : i
        ),
      };
    case "TOGGLE_ADDON": {
      return {
        ...state,
        items: state.items.map((i) => {
          if (i.id !== action.id) return i;
          const existing = i.addons.find((a) => a.type === action.addonType);
          if (existing) {
            return { ...i, addons: i.addons.filter((a) => a.type !== action.addonType) };
          }
          const label =
            action.addonLabel ??
            (action.addonType === "back_print"
              ? "Back Print"
              : action.addonType === "sleeve_print"
                ? "Sleeve Print"
                : "Name/Number Personalization");
          return { ...i, addons: [...i.addons, { type: action.addonType, label, price: action.addonPrice, priceType: action.priceType }] };
        }),
      };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    default:
      return state;
  }
}

// --- Test data ---
const makeItem = (id: string, price: number, name = "Test Product"): CartItem => ({
  id,
  product_id: `p_${id}`,
  variant_id: `v_${id}`,
  name: `${name} — Standard`,
  variant_name: "Standard",
  base_price: price,
  productType: "apparel",
  quantity: 1,
  selected_view: "front" as const,
  addons: [],
});

const emptyCart: CartState = { items: [] };

// Add-ons are per unit and charged once per unit (× quantity); percentage
// add-ons resolve against the line's BASE price, not the multiplied total.
const totalsOf = (state: CartState) => calculateCartTotals(state.items, 100, 3, 7.5);
const subtotalOf = (state: CartState) => totalsOf(state).subtotal;
const addonsTotalOf = (state: CartState) => totalsOf(state).addonsTotal;

const itemCountOf = (state: CartState) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);

describe("cartReducer", () => {
  it("adds an item to empty cart", () => {
    const item = makeItem("1", 25);
    const state = cartReducer(emptyCart, { type: "ADD_ITEM", item });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe("1");
  });

  it("adds multiple items", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    expect(state.items).toHaveLength(2);
  });

  it("removes an item by id", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    state = cartReducer(state, { type: "REMOVE_ITEM", id: "1" });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe("2");
  });

  it("updates quantity", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: 3 });
    expect(state.items[0].quantity).toBe(3);
  });

  it("clamps quantity to minimum 1", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: -5 });
    expect(state.items[0].quantity).toBe(1);
  });

  it("clamps quantity to the 99 maximum", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: 1000 });
    expect(state.items[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("prices an updated line at quantity × base price (2 × $25 = $50)", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: 2 });
    expect(state.items[0].quantity).toBe(2);
    expect(subtotalOf(state)).toBe(50);
    expect(itemCountOf(state)).toBe(2);
  });

  it("merges quantities across lines into one count and subtotal", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: 2 });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "2", quantity: 3 });
    expect(itemCountOf(state)).toBe(5);
    expect(subtotalOf(state)).toBe(2 * 25 + 3 * 45); // $185.00
  });

  it("leaves other lines untouched when one quantity changes", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "2", quantity: 4 });
    expect(state.items[0].quantity).toBe(1);
    expect(state.items[1].quantity).toBe(4);
  });

  it("charges percentage add-ons per unit against the base price, not the line total", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 40) });
    state = cartReducer(state, {
      type: "TOGGLE_ADDON",
      id: "1",
      addonType: "back_print",
      addonPrice: 10,
      priceType: "percentage",
    });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", id: "1", quantity: 2 });

    // 10% of the $40 base price = $4 per unit — NOT 10% of $80.
    expect(resolveAddonPrice(state.items[0].addons[0], state.items[0].base_price)).toBeCloseTo(4);
    expect(addonsTotalOf(state)).toBeCloseTo(8); // $4 × 2 units
    expect(subtotalOf(state) + addonsTotalOf(state)).toBeCloseTo(88);
  });

  it("toggles an addon on", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "back_print", addonPrice: 5 });
    expect(state.items[0].addons).toHaveLength(1);
    expect(state.items[0].addons[0].type).toBe("back_print");
    expect(state.items[0].addons[0].price).toBe(5);
  });

  it("toggles an addon off", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "back_print", addonPrice: 5 });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "back_print", addonPrice: 5 });
    expect(state.items[0].addons).toHaveLength(0);
  });

  it("handles multiple addons on same item", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "back_print", addonPrice: 5 });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "sleeve_print", addonPrice: 5 });
    expect(state.items[0].addons).toHaveLength(2);
    expect(state.items[0].addons.map((a) => a.type).sort()).toEqual(["back_print", "sleeve_print"]);
  });

  it("clears the cart", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    state = cartReducer(state, { type: "CLEAR_CART" });
    expect(state.items).toHaveLength(0);
  });

  it("does not modify other items when toggling addon", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 25) });
    state = cartReducer(state, { type: "ADD_ITEM", item: makeItem("2", 45) });
    state = cartReducer(state, { type: "TOGGLE_ADDON", id: "1", addonType: "back_print", addonPrice: 5 });
    expect(state.items[1].addons).toHaveLength(0); // item 2 untouched
  });

  it("stores a custom label and priceType on toggled addon", () => {
    let state = cartReducer(emptyCart, { type: "ADD_ITEM", item: makeItem("1", 40) });
    state = cartReducer(state, {
      type: "TOGGLE_ADDON",
      id: "1",
      addonType: "back_print",
      addonPrice: 10,
      addonLabel: "Premium Back Print",
      priceType: "percentage",
    });
    expect(state.items[0].addons[0].label).toBe("Premium Back Print");
    expect(state.items[0].addons[0].priceType).toBe("percentage");
    expect(state.items[0].addons[0].price).toBe(10);
  });
});

describe("resolveAddonPrice", () => {
  it("returns fixed price as-is", () => {
    const addon = { type: "back_print" as const, label: "Back Print", price: 5, priceType: "fixed" as const };
    expect(resolveAddonPrice(addon, 100)).toBe(5);
  });

  it("resolves percentage against base price", () => {
    const addon = { type: "back_print" as const, label: "Back Print", price: 10, priceType: "percentage" as const };
    expect(resolveAddonPrice(addon, 40)).toBeCloseTo(4); // 10% of $40
  });

  it("defaults to fixed when priceType is omitted", () => {
    const addon = { type: "back_print" as const, label: "Back Print", price: 7 };
    expect(resolveAddonPrice(addon, 100)).toBe(7);
  });

  it("rounds a percentage add-on to whole cents", () => {
    const addon = { type: "back_print" as const, label: "Back Print", price: 10, priceType: "percentage" as const };
    expect(resolveAddonPrice(addon, 19.99)).toBe(2);
  });
});

describe("calculateCartTotals", () => {
  it("sums the per-line display values exactly to the total", () => {
    const first = makeItem("1", 19.99);
    first.addons = [{ type: "back_print", label: "Back Print", price: 10, priceType: "percentage" }];
    const items = [first, makeItem("2", 0.1), makeItem("3", 0.2)];

    const totals = calculateCartTotals(items, 0, 3, 7.5);
    const displayedLineCents = items.map((item) => {
      const baseCents = Math.round(item.base_price * 100) * item.quantity;
      const addonCents = item.addons.reduce(
        (sum, addon) => sum + Math.round(resolveAddonPrice(addon, item.base_price) * 100) * item.quantity,
        0,
      );
      return baseCents + addonCents;
    });
    const displayedTotal = displayedLineCents.reduce((sum, cents) => sum + cents, 0) / 100;

    expect(totals.subtotal).toBe(20.29);
    expect(totals.addonsTotal).toBe(2);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(22.29);
    expect(displayedTotal).toBe(totals.total);
  });
});
