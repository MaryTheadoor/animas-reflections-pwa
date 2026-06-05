"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import Customizer from "@/components/customizer/customizer";
import FileUpload from "@/components/customizer/file-upload";
import { ADDON_PRICE, SITE_NAME } from "@/lib/constants";
import { USE_SYNTHETIC } from "@/hooks/useCatalog";
import type { AddonType } from "@/types";

// Placeholder product template — will be fetched from Firestore/Square in production
const PLACEHOLDER_TEMPLATE = {
  product_id: "sample_tee",
  base_price: 20.0,
  variation_id: "",
  name: "Custom T-Shirt",
  views: {
    front: {
      base_image: "/hero-bg.jpg", // TODO: replace with actual product mockup
      print_zone: { x_percent: 32.5, y_percent: 24.0, width_percent: 35.0, height_percent: 42.0 },
    },
  },
};

const ADDONS: { type: AddonType; label: string }[] = [
  { type: "back_print", label: "Back Print" },
  { type: "sleeve_print", label: "Sleeve Print" },
  { type: "personalization", label: "Name/Number Personalization" },
];

export default function CustomizerPage() {
  const { addItem } = useCart();
  const [activeView, setActiveView] = useState<"front">("front");
  const [designUrl, setDesignUrl] = useState<string>();
  const [designText, setDesignText] = useState<string>();
  const [selectedAddons, setSelectedAddons] = useState<Set<AddonType>>(new Set());
  const [orderId] = useState(() => crypto.randomUUID());

  const view = PLACEHOLDER_TEMPLATE.views[activeView];

  const handleUploadComplete = useCallback((url: string) => {
    setDesignUrl(url);
  }, []);

  const handleToggleAddon = (type: AddonType) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleAddToCart = () => {
    addItem({
      id: orderId,
      product_id: PLACEHOLDER_TEMPLATE.product_id,
      variation_id: PLACEHOLDER_TEMPLATE.variation_id,
      name: PLACEHOLDER_TEMPLATE.name,
      base_price: PLACEHOLDER_TEMPLATE.base_price,
      quantity: 1,
      selected_view: activeView,
      design_url: designUrl,
      design_text: designText,
        addons: Array.from(selectedAddons).map((type) => ({
          type,
          label: ADDONS.find((a) => a.type === type)?.label ?? type,
          price: ADDON_PRICE,
        })),
        isSynthetic: USE_SYNTHETIC,
      });
  };

  const addonsCost = selectedAddons.size * ADDON_PRICE;
  const totalPrice = PLACEHOLDER_TEMPLATE.base_price + addonsCost;

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt={SITE_NAME} width={40} height={40} className="rounded-xl" priority />
            <span className="text-lg font-bold font-display hidden sm:inline">{SITE_NAME}</span>
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-gold transition-colors">
            Back to Shop
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customizer Canvas */}
          <div className="lg:col-span-2">
            <Customizer
              baseImage={view.base_image}
              viewName={activeView}
              printZone={view.print_zone}
              designUrl={designUrl}
              designText={designText}
              onTextChange={setDesignText}
            />
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">
                {PLACEHOLDER_TEMPLATE.name}
              </h2>

              {/* File Upload */}
              <FileUpload
                onUploadComplete={handleUploadComplete}
                onError={(err) => console.error(err)}
              />

              {/* View Selector */}
              <div className="mt-4">
                <span className="block text-sm font-medium text-primary mb-2">View</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveView("front")}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      activeView === "front"
                        ? "bg-primary text-white"
                        : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                    }`}
                  >
                    Front
                  </button>
                </div>
              </div>

              {/* Add-ons */}
              <div className="mt-4 space-y-2">
                <span className="block text-sm font-medium text-primary mb-2">
                  Add-ons (+${ADDON_PRICE} each)
                </span>
                {ADDONS.map((addon) => (
                  <label
                    key={addon.type}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-warm-sand/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAddons.has(addon.type)}
                      onChange={() => handleToggleAddon(addon.type)}
                      className="accent-gold w-4 h-4"
                    />
                    <span className="text-sm text-primary">{addon.label}</span>
                    <span className="text-xs text-primary/40 ml-auto">+${ADDON_PRICE}</span>
                  </label>
                ))}
              </div>

              {/* Price Summary & Add to Cart */}
              <div className="mt-6 pt-4 border-t border-warm-sand space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-primary/60">Base price</span>
                  <span>${PLACEHOLDER_TEMPLATE.base_price.toFixed(2)}</span>
                </div>
                {addonsCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary/60">Add-ons</span>
                    <span>+${addonsCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-gold">${totalPrice.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
                >
                  Add to Cart — ${totalPrice.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
