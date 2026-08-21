"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { CartItem, CartAddon, AddonType, AddonPriceType } from "@/types";
import { resolveAddonPrice } from "@/types";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "TOGGLE_ADDON"; id: string; addonType: AddonType; addonId?: string; addonPrice: number; addonLabel?: string; priceType?: AddonPriceType }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.id),
      };
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
            return {
              ...i,
              addons: i.addons.filter((a) => a.type !== action.addonType),
            };
          }
          const addon: CartAddon = {
            type: action.addonType,
            // Use the caller-provided label when available; fall back to a
            // readable default for the three legacy add-on types.
            label:
              action.addonLabel ??
              (action.addonType === "back_print"
                ? "Back Print"
                : action.addonType === "sleeve_print"
                  ? "Sleeve Print"
                  : "Name/Number Personalization"),
            price: action.addonPrice,
            priceType: action.priceType,
            addon_id: action.addonId,
          };
          return { ...i, addons: [...i.addons, addon] };
        }),
      };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    default:
      return state;
  }
}

const initialCart: CartState = {
  items: [],
};

interface CartContextValue {
  cart: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleAddon: (id: string, addonType: AddonType, modifierId?: string, addonLabel?: string, priceType?: AddonPriceType, addonPrice?: number) => void;
  clearCart: () => void;
  subtotal: number;
  addonsTotal: number;
  shipping: number;
  total: number;
  itemCount: number;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  lastAdded: CartItem | null;
  dismissToast: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<CartItem | null>(null);
  const siteConfig = useSiteConfig();
  const freeThreshold = siteConfig.free_shipping_threshold;
  const shippingTierStickers = siteConfig.shipping_tier_stickers;
  const shippingTierApparel = siteConfig.shipping_tier_apparel;

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: "ADD_ITEM", item });
    setLastAdded(item);
  }, []);

  const dismissToast = useCallback(() => setLastAdded(null), []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 4000);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", id });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", id, quantity });
  }, []);

  const toggleAddon = useCallback(
    (id: string, addonType: AddonType, addonId?: string, addonLabel?: string, priceType?: AddonPriceType, addonPrice?: number) => {
      dispatch({
        type: "TOGGLE_ADDON",
        id,
        addonType,
        addonId,
        addonLabel,
        priceType,
        addonPrice: addonPrice ?? siteConfig.addon_price,
      });
    },
    [siteConfig.addon_price]
  );

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.base_price * i.quantity,
    0
  );

  // Addons are multiplied by quantity (each item gets its own add-ons).
  // Percentage add-ons resolve against the line's base price via resolveAddonPrice.
  // Example: 2 shirts with Back Print (+$5) = $10 addon total.
  const addonsTotal = cart.items.reduce(
    (sum, i) => sum + i.addons.reduce((s, a) => s + resolveAddonPrice(a, i.base_price), 0) * i.quantity,
    0
  );

  // Shipping: free above threshold; otherwise the higher of the per-product
  // rate or the global tier. An empty cart ships nothing.
  const shipping =
    cart.items.length === 0 || subtotal >= freeThreshold
      ? 0
      : (() => {
          const perProductMax = cart.items.reduce((max, i) => Math.max(max, i.shipping_rate ?? 0), 0);
          const tierRate =
            cart.items.every((i) => i.productType === "sticker")
              ? shippingTierStickers
              : shippingTierApparel;
          return Math.max(perProductMax, tierRate);
        })();

  const total = subtotal + addonsTotal + shipping;
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
      <CartContext.Provider
      value={{
        cart,
        addItem,
        removeItem,
        updateQuantity,
        toggleAddon,
        clearCart,
        subtotal,
        addonsTotal,
        shipping,
        total,
        itemCount,
        cartOpen,
        setCartOpen,
        lastAdded,
        dismissToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
