"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useCart } from "@/context/cart-context";
import { SITE } from "@/lib/content";
import { SQUARE_APP_ID, SQUARE_LOCATION_ID } from "@/lib/constants";

let squareInitialized = false;

export default function CheckoutPage() {
  const { cart, subtotal, addonsTotal, shipping, total, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    orderId: string;
    paymentId: string;
    paymentStatus: string;
  } | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const squareCardRef = useRef<unknown>(null);

  const initSquare = useCallback(async () => {
    if (squareInitialized || !cardRef.current) return;
    try {
      const scriptId = "square-web-payments-sdk";
      if (!document.getElementById(scriptId)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://web.squarecdn.com/v1/square.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Square SDK"));
          document.head.appendChild(script);
        });
      }

      const payments = (
        window as unknown as Record<string, unknown>
      ).Square as {
        payments: (
          appId: string,
          locationId: string
        ) => Promise<{
          card: () => Promise<{ attach: (selector: string) => Promise<void> }>;
        }>;
      };

      if (!payments) {
        throw new Error("Square SDK not loaded");
      }

      const paymentInstance = await payments.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
      const card = await paymentInstance.card();
      await card.attach("#card-container");
      squareCardRef.current = card;
      squareInitialized = true;
      setCardReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment system unavailable"
      );
    }
  }, []);

  useEffect(() => {
    const container = cardRef.current;
    if (container && !squareInitialized) {
      initSquare();
    }
    return () => {
      if (squareCardRef.current) {
        const card = squareCardRef.current as { destroy?: () => void };
        card.destroy?.();
        squareCardRef.current = null;
        squareInitialized = false;
      }
    };
    // Only run on mount — initializes Square SDK
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePayment = async () => {
    if (!squareCardRef.current) {
      setError("Payment form not ready");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const card = squareCardRef.current as {
        tokenize: () => Promise<{
          status: string;
          errors?: { message: string }[];
          token?: string;
        }>;
      };

      const tokenResult = await card.tokenize();

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error(
          tokenResult.errors?.[0]?.message ?? "Card verification failed"
        );
      }

      const createOrder = httpsCallable(functions, "createSquareOrderAndPay");

      const orderResult = await createOrder({
        lineItems: cart.items.map((item) => ({
          catalogObjectId: item.variation_id,
          quantity: item.quantity,
          note: [
            item.design_url ? `Design: ${item.design_url}` : "",
            item.design_text ? `Text: ${item.design_text}` : "",
            item.addons.length
              ? `Add-ons: ${item.addons.map((a) => a.label).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" | "),
        })),
        shippingRate: shipping,
        sourceId: tokenResult.token,
        idempotencyKey: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      });

      const data = orderResult.data as {
        success: boolean;
        orderId: string;
        paymentId: string;
        paymentStatus: string;
      };

      if (data.success) {
        setResult({
          orderId: data.orderId,
          paymentId: data.paymentId,
          paymentStatus: data.paymentStatus,
        });
        clearCart();
      } else {
        throw new Error("Order creation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (cart.items.length === 0 && !result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 px-6 text-center">
        <h1 className="text-4xl font-bold font-display mb-4">Your cart is empty</h1>
        <p className="text-teal/60 mb-6">Add some products to get started.</p>
        <Link
          href="/shop"
          className="px-8 py-3 bg-gold text-white rounded-2xl font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 px-6 text-center">
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-display mb-2">Order Confirmed!</h2>
          <p className="text-teal/60 mb-4">Thank you for your order.</p>
          <div className="text-sm text-teal/50 space-y-1 mb-6">
            <p>Order ID: {result.orderId}</p>
            <p>Payment: {result.paymentStatus}</p>
          </div>
          <Link
            href="/shop"
            className="block w-full py-3 bg-teal text-white rounded-2xl font-semibold hover:bg-teal-light transition-colors text-center"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt={SITE.name} width={40} height={40} className="rounded-xl" priority />
            <span className="text-lg font-bold font-display hidden sm:inline">{SITE.name}</span>
          </Link>
          <Link href="/shop" className="text-sm font-medium hover:text-gold transition-colors">
            Back to Shop
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-3xl font-bold font-display mb-8">Checkout</h1>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-teal">
                  {item.name} x{item.quantity}
                  {item.design_text ? ` — "${item.design_text}"` : ""}
                </span>
                <span className="font-medium">${(item.base_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-warm-sand space-y-1 text-sm">
            <div className="flex justify-between text-teal/60">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {addonsTotal > 0 && (
              <div className="flex justify-between text-teal/60">
                <span>Add-ons</span>
                <span>${addonsTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-teal/60">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-warm-sand">
              <span>Total</span>
              <span className="text-gold">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Card Payment */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Payment</h2>
          <div
            id="card-container"
            ref={cardRef}
            className="min-h-[100px] rounded-xl border border-teal/20 p-4 bg-warm-sand/30"
          />
          {!cardReady && !error && (
            <p className="text-sm text-teal/50 mt-2">Loading payment form...</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={processing || !cardReady || cart.items.length === 0}
          className="w-full py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </button>

        <p className="text-xs text-teal/40 text-center mt-4">
          Secured by Square. We accept Visa, Mastercard, Amex, Discover, JCB, Apple Pay, Google Pay, and Cash App.
        </p>
      </main>
    </div>
  );
}
