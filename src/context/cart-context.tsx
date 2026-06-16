"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, CartAddon, AddonType } from "@/types";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface CartState {
  items: CartItem[];
  shippingTier: "stickers" | "apparel" | "free";
}

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "TOGGLE_ADDON"; id: string; addonType: AddonType; addonId?: string; addonPrice: number }
  | { type: "SET_SHIPPING_TIER"; tier: "stickers" | "apparel" | "free" }
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
            label:
              action.addonType === "back_print"
                ? "Back Print"
                : action.addonType === "sleeve_print"
                  ? "Sleeve Print"
                  : "Name/Number Personalization",
            price: action.addonPrice,
            addon_id: action.addonId,
          };
          return { ...i, addons: [...i.addons, addon] };
        }),
      };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "SET_SHIPPING_TIER":
      return { ...state, shippingTier: action.tier };
    default:
      return state;
  }
}

const initialCart: CartState = {
  items: [],
  shippingTier: "apparel",
};

interface CartContextValue {
  cart: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleAddon: (id: string, addonType: AddonType, modifierId?: string) => void;
  clearCart: () => void;
  subtotal: number;
  addonsTotal: number;
  shipping: number;
  total: number;
  itemCount: number;
  setShippingTier: (tier: "stickers" | "apparel" | "free") => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [cartOpen, setCartOpen] = useState(false);
  const siteConfig = useSiteConfig();
  const freeThreshold = siteConfig.free_shipping_threshold;
  const shippingTierStickers = siteConfig.shipping_tier_stickers;
  const shippingTierApparel = siteConfig.shipping_tier_apparel;

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: "ADD_ITEM", item });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", id });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", id, quantity });
  }, []);

  const toggleAddon = useCallback(
    (id: string, addonType: AddonType, addonId?: string) => {
      dispatch({ type: "TOGGLE_ADDON", id, addonType, addonId, addonPrice: siteConfig.addon_price });
    },
    [siteConfig.addon_price]
  );

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const setShippingTier = useCallback(
    (tier: "stickers" | "apparel" | "free") => {
      dispatch({ type: "SET_SHIPPING_TIER", tier });
    },
    []
  );

  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.base_price * i.quantity,
    0
  );

  const addonsTotal = cart.items.reduce(
    (sum, i) => sum + i.addons.reduce((s, a) => s + a.price, 0) * i.quantity,
    0
  );

  const shipping =
    subtotal >= freeThreshold
      ? 0
      : cart.shippingTier === "stickers"
        ? shippingTierStickers
        : shippingTierApparel;

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
        setShippingTier,
        cartOpen,
        setCartOpen,
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
