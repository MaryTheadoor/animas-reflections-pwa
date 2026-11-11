"use client";

import { useCart } from "@/context/cart-context";

/** Cart control for the customizer's standalone header.
 *
 *  `/customizer/` renders its own header (logo + Back to Shop) instead of the
 *  site nav, so it had no cart control at all: after adding an item the only
 *  route to the cart was Back to Shop → Cart, and the drawer was unreachable.
 *  This is the same action as the nav-dock cart, restyled for a text header —
 *  `CartNavButton`'s `nav-dock-link` class is a small vertical icon+label dock
 *  cell and reads as a 0.55rem stack inline here. */
export default function CustomizerCartButton() {
  const { itemCount, setCartOpen } = useCart();

  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/20 text-sm font-medium text-primary hover:border-gold hover:text-gold-deep transition-colors"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
        />
      </svg>
      <span>Cart</span>
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-gold-deep text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold leading-none">
          {itemCount}
        </span>
      )}
    </button>
  );
}
