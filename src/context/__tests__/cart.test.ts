/**
 * Tests for the cart reducer — pure state transitions.
 * No React rendering needed.
 */
import { describe, it, expect } from "@jest/globals";
import type { CartItem, AddonType, AddonPriceType } from "@/types";
import { resolveAddonPrice } from "@/types";

// --- Inline the reducer for pure-function testing ---

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "TOGGLE_ADDON"; id: string; addonType: AddonType; modifierId?: string; addonPrice: number; addonLabel?: string; priceType?: AddonPriceType }
  | { type: "CLEAR_CART" };

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
          i.id === action.id ? { ...i, quantity: Math.max(1, action.quantity) } : i
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
});
