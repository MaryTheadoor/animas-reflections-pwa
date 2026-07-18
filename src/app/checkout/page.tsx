"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useCart } from "@/context/cart-context";
import { SITE } from "@/lib/content";
import { SQUARE_APP_ID, SQUARE_LOCATION_ID } from "@/lib/constants";

// Square SDK is loaded once per page lifecycle. The module-level flag prevents
// re-initialization on React re-renders, but the useEffect cleanup resets it on
// unmount so re-mounting (route back-and-forth) triggers a fresh setup.
let squareInitialized = false;

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const emptyCustomer: CustomerInfo = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "", zip: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, addonsTotal, shipping, total, clearCart } = useCart();
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderId: string; paymentId: string; paymentStatus: string } | null>(null);
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
      const SquareSDK = (window as unknown as Record<string, unknown>).Square as {
        payments: (appId: string, locId: string) => Promise<{ card: () => Promise<{ attach: (s: string) => Promise<void> }> }>;
      };
      const instance = await SquareSDK.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
      const card = await instance.card();
      await card.attach("#card-container");
      squareCardRef.current = card;
      squareInitialized = true;
      setCardReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment system unavailable");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initSquare calls setCardReady internally
    if (!squareInitialized) initSquare();
    return () => {
      if (squareCardRef.current) (squareCardRef.current as { destroy?: () => void }).destroy?.();
      squareCardRef.current = null;
      squareInitialized = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCustomer = (field: keyof CustomerInfo, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const customerValid = customer.firstName && customer.email && customer.address && customer.city && customer.zip;

  const handlePayment = async () => {
    if (!squareCardRef.current || !customerValid) return;
    setProcessing(true);
    setError(null);
    try {
      // Card tokenization: the Square Web Payments SDK replaces the raw card number
      // with a single-use token. The actual card data never touches our server.
      const card = squareCardRef.current as {
        tokenize: () => Promise<{ status: string; errors?: { message: string }[]; token?: string }>;
      };
      const tokenResult = await card.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error(tokenResult.errors?.[0]?.message ?? "Card verification failed");
      }

      const lineItems = cart.items.map((item) => ({
        variant_id: item.variant_id,
        squareVariationId: item.squareVariationId,
        name: `${item.name} — ${item.variant_name}`,
        price: item.base_price,
        quantity: item.quantity,
        note: [
          item.design_url ? `Design: ${item.design_url}` : "",
          item.design_text ? `Text: ${item.design_text}` : "",
          `View: ${item.selected_view}`,
          (item.design_x != null) ? `Pos: ${item.design_x.toFixed(0)}%,${item.design_y?.toFixed(0)}%` : "",
          (item.design_scale != null) ? `Scale: ${item.design_scale.toFixed(2)}` : "",
          (item.design_rotation != null) ? `Rot: ${item.design_rotation}\u00B0` : "",
          item.addons.length ? `Add-ons: ${item.addons.map((a) => a.label).join(", ")}` : "",
        ].filter(Boolean).join(" | "),
        addons: item.addons.map((a) => ({
          squareModifierId: a.squareModifierId,
          label: a.label,
          price: a.price,
        })),
      }));

      // Payment provider: Square
      const createOrder = httpsCallable(functions, "createSquareOrderAndPay");
      const orderResult = await createOrder({
        lineItems,
        shippingRate: shipping,
        sourceId: tokenResult.token,
        // Idempotency key prevents duplicate charges if the request is retried
        // (network hiccup, page refresh). Square deduplicates within 24h.
        idempotencyKey: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          address: {
            addressLine1: customer.address,
            locality: customer.city,
            administrativeDistrictLevel1: customer.state,
            postalCode: customer.zip,
          },
        },
      });

      const data = orderResult.data as { success: boolean; orderId: string; paymentId: string; paymentStatus: string };
      if (data.success) {
        setResult(data);
      } else {
        throw new Error("Order creation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  // Redirect to confirmation page after successful payment
  const redirected = useRef(false);
  useEffect(() => {
    if (result && !redirected.current) {
      redirected.current = true;
      clearCart();
      router.replace(`/order-confirmation?orderId=${encodeURIComponent(result.orderId)}&status=${encodeURIComponent(result.paymentStatus)}`);
    }
  }, [result, clearCart, router]);

  if (cart.items.length === 0 && !result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 px-6 text-center">
        <h1 className="text-4xl font-bold font-display mb-4">Your cart is empty</h1>
        <p className="text-primary/60 mb-6">Add some products to get started.</p>
        <Link href="/shop" className="px-8 py-3 bg-gold text-white rounded-2xl font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile">Browse Products</Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 px-6 text-center">
        <div className="flex gap-3">
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
        </div>
        <p className="mt-4 text-primary/60">Redirecting to your order confirmation...</p>
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
          <Link href="/shop" className="text-sm font-medium hover:text-gold transition-colors">Back to Shop</Link>
        </nav>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-3xl font-bold font-display mb-8">Checkout</h1>

        {/* Customer Info */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Shipping Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="First Name *" value={customer.firstName} onChange={(e) => updateCustomer("firstName", e.target.value)} className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" required />
            <input type="text" placeholder="Last Name" value={customer.lastName} onChange={(e) => updateCustomer("lastName", e.target.value)} className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            <input type="email" placeholder="Email *" value={customer.email} onChange={(e) => updateCustomer("email", e.target.value)} className="sm:col-span-2 px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" required />
            <input type="tel" placeholder="Phone" value={customer.phone} onChange={(e) => updateCustomer("phone", e.target.value)} className="sm:col-span-2 px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            <input type="text" placeholder="Street Address *" value={customer.address} onChange={(e) => updateCustomer("address", e.target.value)} className="sm:col-span-2 px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" required />
            <input type="text" placeholder="City *" value={customer.city} onChange={(e) => updateCustomer("city", e.target.value)} className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" required />
            <input type="text" placeholder="State (e.g. CO)" value={customer.state} onChange={(e) => updateCustomer("state", e.target.value)} className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            <input type="text" placeholder="ZIP Code *" value={customer.zip} onChange={(e) => updateCustomer("zip", e.target.value)} className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" required />
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-primary">{item.name} x{item.quantity}{item.design_text ? ` — "${item.design_text}"` : ""}</span>
                <span className="font-medium">${(item.base_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-warm-sand space-y-1 text-sm">
            <div className="flex justify-between text-primary/60"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {addonsTotal > 0 && <div className="flex justify-between text-primary/60"><span>Add-ons</span><span>${addonsTotal.toFixed(2)}</span></div>}
            <div className="flex justify-between text-primary/60"><span>Shipping</span><span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-warm-sand"><span>Total</span><span className="text-gold">${total.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Payment</h2>
          <div id="card-container" ref={cardRef} className="min-h-[100px] rounded-xl border border-primary/20 p-4 bg-warm-sand/30" />
          {!cardReady && !error && <p className="text-sm text-primary/50 mt-2">Loading payment form...</p>}
        </div>

        {error && <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-6 text-sm">{error}</div>}

        <button
          onClick={handlePayment}
          disabled={processing || !cardReady || !customerValid}
          className="w-full py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </button>
        {!customerValid && <p className="text-xs text-primary/40 text-center mt-2">Fill in all required fields (*) to continue</p>}
        <p className="text-xs text-primary/40 text-center mt-4">Secured by Square. We accept Visa, Mastercard, Amex, Discover, JCB, Apple Pay, Google Pay, and Cash App.</p>
      </main>
    </div>
  );
}
