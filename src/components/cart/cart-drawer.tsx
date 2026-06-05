"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";

export default function CartDrawer() {
  const { cart, removeItem, subtotal, addonsTotal, shipping, total, itemCount } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Cart Toggle Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gold text-white rounded-full w-14 h-14 flex items-center justify-center shadow-elevated hover:bg-gold-light transition-colors"
        aria-label="Open cart"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-teal text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {itemCount}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-warm-sand">
              <h2 className="font-bold font-display text-lg">Your Cart</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-teal/50 hover:text-teal transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.items.length === 0 ? (
                <p className="text-teal/50 text-center py-8">Your cart is empty</p>
              ) : (
                cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-warm-sand/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{item.name}</h3>
                      <p className="text-xs text-teal/50">Qty: {item.quantity}</p>
                      {item.addons.map((a) => (
                        <span key={a.type} className="inline-block text-xs bg-plum/10 text-plum rounded-full px-2 py-0.5 mt-1 mr-1">
                          +{a.label} (${a.price})
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-sm">${(item.base_price * item.quantity).toFixed(2)}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.items.length > 0 && (
              <div className="border-t border-warm-sand p-4 space-y-2">
                <div className="flex justify-between text-sm text-teal/60">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {addonsTotal > 0 && (
                  <div className="flex justify-between text-sm text-teal/60">
                    <span>Add-ons</span>
                    <span>${addonsTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-teal/60">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between font-bold text-teal pt-2 border-t border-warm-sand">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors"
                >
                  Checkout
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
