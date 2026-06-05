"use client";

import { useCart } from "@/context/cart-context";

export default function CartNavButton() {
  const { itemCount, cartOpen, setCartOpen } = useCart();

  return (
    <button onClick={() => setCartOpen(!cartOpen)} className="nav-dock-link relative" aria-label="Cart">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
      <span>Cart</span>
      {itemCount > 0 && (
        <span className="absolute -top-0.5 right-0 bg-gold text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
          {itemCount}
        </span>
      )}
    </button>
  );
}
