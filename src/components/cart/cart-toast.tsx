"use client";

import { useCart } from "@/context/cart-context";

export default function CartToast() {
  const { lastAdded, dismissToast, itemCount } = useCart();

  if (!lastAdded) return null;

  return (
    <div className="fixed top-24 right-4 z-[60] animate-slide-in-right max-w-xs w-full">
      <div className="bg-white rounded-2xl shadow-xl border border-gold/30 p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-gold-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {/* Live region, not the whole card: a status role must not wrap the
            Dismiss button, or screen readers trap the user inside it. */}
        <div className="flex-1 min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <p className="text-sm font-medium text-primary truncate">
            {lastAdded.name}
          </p>
          {lastAdded.variant_name && (
            <p className="text-xs text-foreground/80 truncate">{lastAdded.variant_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gold-deep font-semibold text-sm">
              ${(lastAdded.base_price * lastAdded.quantity).toFixed(2)}
            </span>
            {lastAdded.addons.length > 0 && (
              <span className="text-[10px] text-plum-ink bg-plum/10 rounded-full px-1.5">
                +{lastAdded.addons.length}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={dismissToast}
          className="text-foreground/70 hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-foreground/80 text-right mt-1 mr-1">
        {itemCount} item{itemCount !== 1 ? "s" : ""} in cart
      </p>
    </div>
  );
}
