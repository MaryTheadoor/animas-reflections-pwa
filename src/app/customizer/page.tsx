"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/cart-context";
import { useCatalog } from "@/hooks/useCatalog";
import Customizer, { type DesignState } from "@/components/customizer/customizer";
import FileUpload from "@/components/customizer/file-upload";
import { SITE_NAME } from "@/lib/constants";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import type { AddonType, DesignAsset, SquareCatalogItem } from "@/types";

const PRODUCT_VIEWS = [
  {
    key: "front",
    label: "Front",
    printZone: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
  },
  {
    key: "back",
    label: "Back",
    printZone: { x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35 },
  },
];

const ADDONS: { type: AddonType; label: string }[] = [
  { type: "back_print", label: "Back Print (+$5)" },
  { type: "sleeve_print", label: "Sleeve Print (+$5)" },
  { type: "personalization", label: "Name/Number (+$5)" },
];

const DEFAULT_DESIGN_STATE: DesignState = {
  xPercent: 30,
  yPercent: 22,
  scale: 1,
  rotation: 0,
};

const BASE_PRICE_FALLBACK = 20.0;

function getProductPrice(product: SquareCatalogItem | null, variationIndex: number): number {
  if (!product || !product.variations.length) return BASE_PRICE_FALLBACK;
  const v = product.variations[variationIndex] ?? product.variations[0];
  return v.price > 0 ? v.price : BASE_PRICE_FALLBACK;
}

function getProductImage(product: SquareCatalogItem | null): string {
  if (product?.image_url) return product.image_url;
  return "/hero-bg.jpg";
}

function getProductViews(product: SquareCatalogItem | null) {
  const baseImage = getProductImage(product);
  return PRODUCT_VIEWS.map((v) => ({ ...v, baseImage }));
}

export default function CustomizerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex gap-3"><div className="w-3 h-3 bg-gold rounded-full animate-bounce" /><div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" /><div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" /></div>
      </div>
    }>
      <CustomizerContent />
    </Suspense>
  );
}

function CustomizerContent() {
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("product") || "";

  const { addItem } = useCart();
  const siteConfig = useSiteConfig();
  const addonPrice = siteConfig.addon_price;
  const { items: catalogItems, loading: catalogLoading } = useCatalog();

  const [selectedProduct, setSelectedProduct] = useState<SquareCatalogItem | null>(null);
  const [variationIndex, setVariationIndex] = useState(0);
  const [activeView, setActiveView] = useState("front");
  const [designUrl, setDesignUrl] = useState<string>();
  const [designText, setDesignText] = useState<string>();
  const [designState, setDesignState] = useState<DesignState>(DEFAULT_DESIGN_STATE);
  const [selectedAddons, setSelectedAddons] = useState<Set<AddonType>>(new Set());
  const [orderId] = useState(() => crypto.randomUUID());
  const [designLibrary, setDesignLibrary] = useState<DesignAsset[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Preselect product from query param when catalog loads
  useEffect(() => {
    if (catalogLoading || !catalogItems.length) return;
    if (preselectedProductId) {
      const found = catalogItems.find((p) => p.id === preselectedProductId);
      if (found) setSelectedProduct(found);
    }
  }, [catalogLoading, catalogItems, preselectedProductId]);

  // Load design library from Firestore
  useEffect(() => {
    getDoc(doc(db, "designs", "catalog"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { items?: DesignAsset[] };
          setDesignLibrary(data.items ?? []);
        }
      })
      .catch(() => {});
  }, []);

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

  const handleSelectDesign = (asset: DesignAsset) => {
    setDesignUrl(asset.image_url);
    setLibraryOpen(false);
  };

  const handleProductSelect = (productId: string) => {
    const product = catalogItems.find((p) => p.id === productId) ?? null;
    setSelectedProduct(product);
    setVariationIndex(0);
    setDesignState(DEFAULT_DESIGN_STATE);
  };

  const handleAddToCart = () => {
    const price = getProductPrice(selectedProduct, variationIndex);
    const variation = selectedProduct?.variations[variationIndex];

    addItem({
      id: orderId,
      product_id: selectedProduct?.id ?? "custom",
      variation_id: variation?.id ?? "",
      name: selectedProduct
        ? `${selectedProduct.name}${variation ? ` — ${variation.name}` : ""}`
        : `Custom Design`,
      base_price: price,
      quantity: 1,
      selected_view: activeView as "front" | "back" | "sleeve",
      design_url: designUrl,
      design_text: designText,
      addons: Array.from(selectedAddons).map((type) => ({
        type,
        label: ADDONS.find((a) => a.type === type)?.label ?? type,
        price: addonPrice,
      })),
      isSynthetic: false,
    });
  };

  const productViews = getProductViews(selectedProduct);
  const currentView = productViews.find((v) => v.key === activeView) ?? productViews[0];
  const basePrice = getProductPrice(selectedProduct, variationIndex);
  const addonsCost = selectedAddons.size * addonPrice;
  const totalPrice = basePrice + addonsCost;

  // Sort catalog items for dropdown
  const sortedCatalog = [...catalogItems].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={SITE_NAME}
              width={40}
              height={40}
              className="rounded-xl"
              priority
            />
            <span className="text-lg font-bold font-display hidden sm:inline">
              {SITE_NAME}
            </span>
          </Link>
          <Link
            href="/shop"
            className="text-sm font-medium hover:text-gold transition-colors"
          >
            Back to Shop
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customizer Canvas */}
          <div className="lg:col-span-2">
            <Customizer
              baseImage={currentView.baseImage}
              viewName={currentView.label}
              views={productViews}
              activeView={activeView}
              onViewChange={setActiveView}
              designUrl={designUrl}
              designText={designText}
              onDesignChange={setDesignState}
              designState={designState}
              onTextChange={setDesignText}
            />
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Product Selection */}
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Product</h2>
              {catalogLoading ? (
                <div className="flex gap-2 py-2">
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
                </div>
              ) : (
                <>
                  <select
                    value={selectedProduct?.id ?? ""}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full p-2.5 border border-primary/20 rounded-xl bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                  >
                    <option value="">Select a product...</option>
                    {sortedCatalog.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — from ${Math.min(...p.variations.map((v) => v.price)).toFixed(2)}
                      </option>
                    ))}
                  </select>

                  {/* Variation Picker */}
                  {selectedProduct && selectedProduct.variations.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProduct.variations.map((v, i) => (
                        <button
                          key={v.id}
                          onClick={() => setVariationIndex(i)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                            i === variationIndex
                              ? "bg-primary text-white"
                              : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                          }`}
                        >
                          {v.name || `Option ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected product image preview */}
                  {selectedProduct && (
                    <div className="mt-3 relative aspect-video bg-warm-sand rounded-xl overflow-hidden">
                      <Image
                        src={getProductImage(selectedProduct)}
                        alt={selectedProduct.name}
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Design Source */}
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Design</h2>

              <FileUpload
                onUploadComplete={handleUploadComplete}
                onError={(err) => console.error(err)}
              />

              {/* Design Library */}
              <div className="mt-3">
                <button
                  onClick={() => setLibraryOpen(!libraryOpen)}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-primary/20 rounded-xl text-sm text-primary/50 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {libraryOpen ? "Close Library" : "Browse Design Library"}
                </button>

                {libraryOpen && (
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
                    {designLibrary.length === 0 ? (
                      <p className="text-xs text-primary/30 text-center py-4">
                        No designs available. Upload designs in the Admin Dashboard.
                      </p>
                    ) : (
                      designLibrary.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelectDesign(asset)}
                          className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                            designUrl === asset.image_url
                              ? "bg-gold/10 border border-gold/30"
                              : "hover:bg-warm-sand/50 border border-transparent"
                          }`}
                        >
                          <Image
                            src={asset.image_url}
                            alt={asset.name}
                            width={36}
                            height={36}
                            className="rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{asset.name}</p>
                            <p className="text-[10px] text-primary/40 truncate">
                              {asset.category}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {(designUrl || designText) && (
                <button
                  onClick={() => {
                    setDesignUrl(undefined);
                    setDesignText(undefined);
                    setDesignState(DEFAULT_DESIGN_STATE);
                  }}
                  className="mt-3 w-full px-4 py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Clear Design
                </button>
              )}
            </div>

            {/* Add-ons */}
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Add-ons</h2>
              <div className="space-y-2">
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
                  </label>
                ))}
              </div>
            </div>

            {/* Price & Add to Cart */}
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary/60">Base price</span>
                  <span>${basePrice.toFixed(2)}</span>
                </div>
                {addonsCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-primary/60">Add-ons (+${addonPrice.toFixed(2)} each)</span>
                    <span>+${addonsCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-warm-sand">
                  <span>Total</span>
                  <span className="text-gold">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={!selectedProduct || (!designUrl && !designText)}
                className="mt-4 w-full py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart — ${totalPrice.toFixed(2)}
              </button>
              {!selectedProduct && (
                <p className="text-xs text-amber-500 text-center mt-2">
                  Select a product above first
                </p>
              )}
              {selectedProduct && !designUrl && !designText && (
                <p className="text-xs text-primary/30 text-center mt-2">
                  Upload a design or add text to continue
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
