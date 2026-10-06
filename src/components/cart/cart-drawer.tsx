"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/context/cart-context";
import { resolveAddonPrice } from "@/types";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, removeItem, subtotal, addonsTotal, shipping, total } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  // Dialog keyboard behavior: Escape to close, Tab focus trap, focus restore
  // to the element that opened the drawer on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users land inside the trap.
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full outline-none"
      >
        <div className="flex items-center justify-between p-4 border-b border-warm-sand">
          <h2 className="font-bold font-display text-lg">Your Cart</h2>
          <button onClick={onClose} className="text-foreground hover:text-primary transition-colors" aria-label="Close cart">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.items.length === 0 ? (
            <p className="text-foreground text-center py-8">Your cart is empty</p>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 bg-warm-sand/50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.name}</h3>
                  {item.variant_name && (
                    <p className="text-xs text-foreground/80">{item.variant_name}</p>
                  )}
                  {item.selected_color && (
                    <p className="text-xs text-foreground/80 capitalize">Color: {item.selected_color}</p>
                  )}
                  <p className="text-xs text-foreground">Qty: {item.quantity}</p>
                  {item.selectedOptions?.map((o) => (
                    <p key={o.optionId} className="text-xs text-foreground/80">
                      {o.optionName}: {o.value}
                    </p>
                  ))}
                  {item.addons.map((a) => (
                    <span key={a.addon_id ?? a.type} className="inline-block text-xs bg-plum/10 text-plum rounded-full px-2 py-0.5 mt-1 mr-1">
                      +{a.label} (${resolveAddonPrice(a, item.base_price).toFixed(2)})
                    </span>
                  ))}
                  {item.modifierInputs?.map((m) => (
                    <p key={m.modifierId} className="text-xs text-foreground/80 mt-1">
                      {m.modifierName}: {m.value ?? ""}
                    </p>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-sm">${(item.base_price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-xs text-danger hover:opacity-80">
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-warm-sand p-4 space-y-2">
            <div className="flex justify-between text-sm text-foreground">
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {addonsTotal > 0 && (
              <div className="flex justify-between text-sm text-foreground">
                <span>Add-ons</span><span>${addonsTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-foreground">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-primary pt-2 border-t border-warm-sand">
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full text-center py-3 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors"
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
