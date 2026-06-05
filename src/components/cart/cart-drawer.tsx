"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, removeItem, subtotal, addonsTotal, shipping, total } = useCart();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-warm-sand">
          <h2 className="font-bold font-display text-lg">Your Cart</h2>
          <button onClick={onClose} className="text-primary/50 hover:text-primary transition-colors" aria-label="Close cart">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.items.length === 0 ? (
            <p className="text-primary/50 text-center py-8">Your cart is empty</p>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 bg-warm-sand/50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.name}</h3>
                  <p className="text-xs text-primary/50">Qty: {item.quantity}</p>
                  {item.addons.map((a) => (
                    <span key={a.type} className="inline-block text-xs bg-plum/10 text-plum rounded-full px-2 py-0.5 mt-1 mr-1">
                      +{a.label} (${a.price})
                    </span>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-sm">${(item.base_price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-warm-sand p-4 space-y-2">
            <div className="flex justify-between text-sm text-primary/60">
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {addonsTotal > 0 && (
              <div className="flex justify-between text-sm text-primary/60">
                <span>Add-ons</span><span>${addonsTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-primary/60">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-primary pt-2 border-t border-warm-sand">
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full text-center py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors"
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
