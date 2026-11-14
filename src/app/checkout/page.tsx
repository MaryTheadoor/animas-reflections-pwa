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
import { resolveAddonPrice } from "@/types";
import type { CustomerField } from "@/types";
import { useSiteConfig, useSiteConfigLoading } from "@/hooks/useSiteConfig";
import { isPlaceholderVariantName } from "@/lib/modifier-selection";

// Square SDK is loaded once per page lifecycle. The module-level flag prevents
// re-initialization on React re-renders, but the useEffect cleanup resets it on
// unmount so re-mounting (route back-and-forth) triggers a fresh setup.
let squareInitialized = false;

// Fallback customer fields used when site config hasn't loaded or has none.
// Mirrors the traditional shipping form so checkout always works.
const FALLBACK_CUSTOMER_FIELDS: CustomerField[] = [
  { id: "firstName", label: "First Name", type: "text", required: true, squareMapping: "firstName" },
  { id: "lastName", label: "Last Name", type: "text", required: false, squareMapping: "lastName" },
  { id: "email", label: "Email", type: "email", required: true, squareMapping: "email" },
  { id: "phone", label: "Phone", type: "tel", required: false, squareMapping: "phone" },
  { id: "address", label: "Street Address", type: "text", required: true, squareMapping: "address.addressLine1" },
  { id: "city", label: "City", type: "text", required: true, squareMapping: "address.locality" },
  { id: "state", label: "State", type: "text", required: false, squareMapping: "address.administrativeDistrictLevel1" },
  { id: "zip", label: "ZIP Code", type: "text", required: true, squareMapping: "address.postalCode" },
];

// Set a value at a dot-separated path on a nested object (e.g. "address.locality").
function setNestedPath(obj: Record<string, unknown>, path: string, value: string) {
  const keys = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== "object" || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, addonsTotal, shipping, total, clearCart } = useCart();
  const siteConfig = useSiteConfig();
  // Paying before config/site resolves would price shipping from the FALLBACK
  // rates (e.g. $3 stickers where the live rate is $1), so expectedTotal would
  // differ from the server's derivation and the order would be refused. Block
  // the button until the real settings are in.
  const siteConfigLoading = useSiteConfigLoading();
  // Customer fields come from site config (admin-managed); fall back to the
  // standard shipping form when config has none.
  const customerFields: CustomerField[] =
    siteConfig.customer_fields?.length ? siteConfig.customer_fields : FALLBACK_CUSTOMER_FIELDS;

  // Customer values keyed by field id.
  const [customer, setCustomer] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderId: string; paymentId: string; paymentStatus: string; mirrored?: boolean } | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const squareCardRef = useRef<unknown>(null);
  // Held for the lifetime of a single purchase intent. Retrying after an ambiguous
  // failure (e.g. a network timeout where the server may already have charged the
  // card) must reuse the SAME idempotency key so Square returns the cached result
  // instead of charging again. Regenerated only when the cart contents change —
  // keying on the total alone meant two different carts with the same sum shared
  // a key.
  const idempotencyRef = useRef<{ key: string; signature: string } | null>(null);

  const initSquare = useCallback(async () => {
    if (squareInitialized) return;
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
      // The container renders only once the cart has a line, and the cart now
      // hydrates from localStorage after first paint. Wait for the node itself
      // rather than relying on a ref that is null at that moment.
      for (let i = 0; i < 60 && !document.getElementById("card-container"); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!document.getElementById("card-container")) {
        throw new Error("The payment form could not be placed — please refresh the page.");
      }
      await card.attach("#card-container");
      squareCardRef.current = card;
      squareInitialized = true;
      setCardReady(true);
    } catch (err) {
      // Square's card() rejects with a generic sentence; the reason is in
      // err.errors[]. Surface it in the console so a 401 is diagnosable instead
      // of reading as "payment unavailable".
      console.error("Square payment init failed", {
        error: err,
        errors: (err as { errors?: unknown }).errors,
      });
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Payment system unavailable — please refresh, or call us to order.",
      );
    }
  }, []);

  // Initialise once on mount. `initSquare` waits for the card container itself,
  // because the container only renders when the cart has a line and the cart
  // hydrates from localStorage after first paint.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initSquare sets cardReady after its awaits
    initSquare();
    return () => {
      if (squareCardRef.current) (squareCardRef.current as { destroy?: () => void }).destroy?.();
      squareCardRef.current = null;
      squareInitialized = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCustomer = (fieldId: string, value: string) => {
    setCustomer((prev) => ({ ...prev, [fieldId]: value }));
  };

  // A field is valid if it's optional and empty, or non-empty; email fields also
  // need a plausible address. Required fields must be non-empty.
  const isFieldValid = (field: CustomerField): boolean => {
    const value = (customer[field.id] ?? "").trim();
    if (!value) return !field.required;
    if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return true;
  };
  const customerValid = customerFields.every(isFieldValid);

  // Build the customer payload for the payment backend by mapping each field's
  // value into the nested shape the backend expects, driven by squareMapping.
  const buildCustomerPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const field of customerFields) {
      const value = (customer[field.id] ?? "").trim();
      if (field.squareMapping && value) setNestedPath(payload, field.squareMapping, value);
    }
    return payload;
  };

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
        product_id: item.product_id,
        variant_id: item.variant_id,
        squareVariationId: item.squareVariationId,
        name: isPlaceholderVariantName(item.variant_name)
          ? item.name
          : `${item.name} — ${item.variant_name}`,
        price: item.base_price,
        quantity: item.quantity,
        designUrl: item.design_url,
        note: [
          item.design_url ? `Design: ${item.design_url}` : "",
          item.design_text ? `Text: ${item.design_text}` : "",
          item.selected_color ? `Color: ${item.selected_color}` : "",
          item.selectedOptions?.length
            ? `Options: ${item.selectedOptions.map((o) => `${o.optionName}: ${o.value}`).join(", ")}`
            : "",
          item.modifierInputs?.length
            ? `Modifier Inputs: ${item.modifierInputs.map((m) => `${m.modifierName}: ${m.value ?? ""}`).join(", ")}`
            : "",
          `View: ${item.selected_view}`,
          (item.design_x != null) ? `Pos: ${item.design_x.toFixed(0)}%,${item.design_y?.toFixed(0)}%` : "",
          (item.design_scale != null) ? `Scale: ${item.design_scale.toFixed(2)}` : "",
          (item.design_rotation != null) ? `Rot: ${item.design_rotation}\u00B0` : "",
          item.addons.length ? `Add-ons: ${item.addons.map((a) => a.label).join(", ")}` : "",
        ].filter(Boolean).join(" | "),
        addons: item.addons.map((a) => ({
          addon_id: a.addon_id,
          squareModifierId: a.squareModifierId,
          label: a.label,
          // Resolve percentage add-ons to a dollar amount — Square requires fixed
          // cents. The backend re-derives this from the catalog; it is sent only
          // for verification.
          price: resolveAddonPrice(a, item.base_price),
          priceType: a.priceType ?? "fixed",
        })),
      }));

      // Payment provider: Square
      const createOrder = httpsCallable(functions, "createSquareOrderAndPay");
      const cartSignature = cart.items
        .map((item) =>
          `${item.id}:${item.quantity}:${item.base_price.toFixed(2)}:${item.addons.map((a) => resolveAddonPrice(a, item.base_price).toFixed(2)).join(",")}`
        )
        .join("|");
      if (!idempotencyRef.current || idempotencyRef.current.signature !== cartSignature) {
        idempotencyRef.current = { key: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, signature: cartSignature };
      }
      const orderResult = await createOrder({
        lineItems,
        // Verified server-side against the catalog before any charge happens.
        expectedTotal: total,
        shippingRate: shipping,
        sourceId: tokenResult.token,
        idempotencyKey: idempotencyRef.current.key,
        customer: buildCustomerPayload(),
      });

      const data = orderResult.data as { success: boolean; orderId: string; paymentId: string; paymentStatus: string; mirrored?: boolean };
      if (data.success) {
        idempotencyRef.current = null; // purchase complete — next purchase gets a fresh key
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
      const mirrorParam = result.mirrored === false ? "&mirrored=0" : "";
      router.replace(`/order-confirmation?orderId=${encodeURIComponent(result.orderId)}&status=${encodeURIComponent(result.paymentStatus)}${mirrorParam}`);
    }
  }, [result, clearCart, router]);

  if (cart.items.length === 0 && !result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 px-6 text-center">
        <h1 className="text-4xl font-bold font-display mb-4">Your cart is empty</h1>
        <p className="text-foreground mb-6">Add some products to get started.</p>
        <Link href="/shop" className="px-8 py-3 bg-gold text-on-gold rounded-2xl font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile">Browse Products</Link>
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
        <p className="mt-4 text-foreground">Redirecting to your order confirmation...</p>
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
          <Link href="/shop" className="text-sm font-medium hover:text-gold-deep transition-colors">Back to Shop</Link>
        </nav>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-3xl font-bold font-display mb-8">Checkout</h1>

        {/* Customer Info — rendered dynamically from site-config customer_fields */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Shipping Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customerFields.map((field) => {
              // Email, phone, and address span both columns; short fields use one.
              const wide = field.type === "email" || field.type === "tel" || field.id === "address" || field.squareMapping?.startsWith("address.addressLine1");
              return (
                <div key={field.id} className={wide ? "sm:col-span-2" : ""}>
                  <label className="text-xs font-medium text-primary block mb-1">
                    {field.label}{field.required ? " *" : ""}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={customer[field.id] ?? ""}
                      onChange={(e) => updateCustomer(field.id, e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                      required={field.required}
                    >
                      <option value="">{field.placeholder ?? "Select..."}</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      placeholder={field.placeholder ?? field.label}
                      value={customer[field.id] ?? ""}
                      onChange={(e) => updateCustomer(field.id, e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                      required={field.required}
                    />
                  )}
                </div>
              );
            })}
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
            <div className="flex justify-between text-foreground"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {addonsTotal > 0 && <div className="flex justify-between text-foreground"><span>Add-ons</span><span>${addonsTotal.toFixed(2)}</span></div>}
            <div className="flex justify-between text-foreground"><span>Shipping</span><span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-warm-sand"><span>Total</span><span className="text-gold-deep">${total.toFixed(2)}</span></div>
            <p className="text-xs text-foreground/70">
              Sales tax is calculated by Square and added to the final charge.
            </p>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="font-bold mb-4">Payment</h2>
          <div id="card-container" className="min-h-[100px] rounded-xl border border-primary/20 p-4 bg-warm-sand/30" />
          {!cardReady && !error && <p className="text-sm text-foreground mt-2">Loading payment form...</p>}
        </div>

        {error && <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-6 text-sm">{error}</div>}

        <button
          onClick={handlePayment}
          disabled={processing || !cardReady || !customerValid || siteConfigLoading}
          className="w-full py-3 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </button>
        {!customerValid && <p className="text-xs text-foreground/80 text-center mt-2">Fill in all required fields (*) to continue</p>}
        <p className="text-xs text-foreground/80 text-center mt-3">
          By placing this order you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gold-deep transition-colors">
            Terms of Sale
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-gold-deep transition-colors">
            Privacy Policy
          </Link>
          . Questions?{" "}
          <Link href="/contact" className="underline hover:text-gold-deep transition-colors">
            Contact us
          </Link>
          .
        </p>
        <p className="text-xs text-foreground/80 text-center mt-4">Secured by Square. We accept Visa, Mastercard, Amex, Discover, JCB, Apple Pay, Google Pay, and Cash App.</p>
      </main>
    </div>
  );
}
