"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/cart-context";
import { useCatalog, getProductImageUrl } from "@/hooks/useCatalog";
import Customizer, { type DesignState, defaultDesignPosition } from "@/components/customizer/customizer";
import FileUpload from "@/components/customizer/file-upload";
import { SITE_NAME } from "@/lib/constants";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import type { AddonType, DesignAsset, ManagedProduct, ManagedVariant, PrintZone, PrintZoneTemplate, ProductAddon } from "@/types";

const DEFAULT_PRINT_ZONE: PrintZone = {
  x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48,
};
const DEFAULT_BACK_PRINT_ZONE: PrintZone = {
  x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35,
};
const DEFAULT_SLEEVE_PRINT_ZONE: PrintZone = {
  x_percent: 65, y_percent: 20, width_percent: 25, height_percent: 55,
};
const DEFAULT_SIDE_PRINT_ZONE: PrintZone = {
  x_percent: 5, y_percent: 15, width_percent: 30, height_percent: 40,
};

interface ProductViewConfig {
  key: string;
  label: string;
  baseImage: string;
  printZone: PrintZone;
}

function getPrintZone(zones: PrintZoneTemplate | undefined, view: string): PrintZone {
  if (!zones) {
    switch (view) {
      case "back": return DEFAULT_BACK_PRINT_ZONE;
      case "sleeve": return DEFAULT_SLEEVE_PRINT_ZONE;
      case "sideL": case "sideR": return DEFAULT_SIDE_PRINT_ZONE;
      default: return DEFAULT_PRINT_ZONE;
    }
  }
  if (view === "back" && zones.back) return zones.back;
  if (view === "sleeve" && zones.sleeve) return zones.sleeve;
  if (view === "sideL" && zones.sideL) return zones.sideL;
  if (view === "sideR" && zones.sideR) return zones.sideR;
  return zones.front ?? DEFAULT_PRINT_ZONE;
}

function getProductViews(product: ManagedProduct | null): ProductViewConfig[] {
  const mockups = product?.mockupImages;
  const fallback = product
    ? (getProductImageUrl(product) || product.images?.[0] || "/hero-bg.jpg")
    : "/hero-bg.jpg";
  const frontImage = mockups?.front ?? fallback;
  const backImage = mockups?.back ?? fallback;
  const sleeveImage = mockups?.sleeve ?? fallback;
  const sideLImage = mockups?.sideL ?? fallback;
  const sideRImage = mockups?.sideR ?? fallback;
  const zones = product?.printZones;
  const pType = product?.productType ?? "other";
  const isApparel = pType === "apparel";

  const views: ProductViewConfig[] = [
    { key: "front", label: "Front", baseImage: frontImage, printZone: getPrintZone(zones, "front") },
  ];

  // Back view: apparel, or if back zone explicitly exists
  if (isApparel || zones?.back) {
    views.push({ key: "back", label: "Back", baseImage: backImage, printZone: getPrintZone(zones, "back") });
  }

  // Sleeve/side views: only for apparel (or if zones explicitly exist)
  if (isApparel || zones?.sleeve) {
    views.push({ key: "sleeve", label: "Sleeve", baseImage: sleeveImage, printZone: getPrintZone(zones, "sleeve") });
  }

  if (zones?.sideL) {
    views.push({ key: "sideL", label: "Left Side", baseImage: sideLImage, printZone: getPrintZone(zones, "sideL") });
  }
  if (zones?.sideR) {
    views.push({ key: "sideR", label: "Right Side", baseImage: sideRImage, printZone: getPrintZone(zones, "sideR") });
  }

  return views;
}

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

/** Compute initial design state centered within a view's print zone */
function defaultStateForView(views: ProductViewConfig[], viewKey: string): DesignState {
  const view = views.find((v) => v.key === viewKey);
  const zone = view?.printZone ?? DEFAULT_PRINT_ZONE;
  const pos = defaultDesignPosition(zone);
  return { ...pos, scale: 1, rotation: 0 };
}

const BASE_PRICE_FALLBACK = 20.0;

function getProductPrice(product: ManagedProduct | null, variantIndex: number): number {
  if (!product || !product.variants.length) return BASE_PRICE_FALLBACK;
  const v = product.variants[variantIndex] ?? product.variants[0];
  return v.price > 0 ? v.price : BASE_PRICE_FALLBACK;
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
  const { products: catalogProducts, loading: catalogLoading } = useCatalog();

  const [selectedProduct, setSelectedProduct] = useState<ManagedProduct | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [activeView, setActiveView] = useState("front");
  const [designUrl, setDesignUrl] = useState<string>();
  const [designText, setDesignText] = useState<string>();
  const [textColor, setTextColor] = useState("#111827");
  const [textFont, setTextFont] = useState("var(--font-display)");
  const [designState, setDesignState] = useState<DesignState>(DEFAULT_DESIGN_STATE);
  const [perViewDesign, setPerViewDesign] = useState<Record<string, DesignState>>({});
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  // Use per-product add-ons if defined, otherwise fall back to hardcoded defaults
  const effectiveAddons: (ProductAddon | { id: string; name: string; price: number })[] =
    (selectedProduct?.productAddons?.length ?? 0) > 0
      ? selectedProduct!.productAddons!
      : ADDONS.map((a) => ({ id: a.type, name: a.label, price: addonPrice }));
  const [orderId] = useState(() => crypto.randomUUID());
  const [designLibrary, setDesignLibrary] = useState<DesignAsset[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Per-product designs from product.designAssets
  const productDesigns = selectedProduct?.designAssets ?? [];

  // Preselect product from query param when catalog loads
  const preselected = useRef(false);
  useEffect(() => {
    if (catalogLoading || !catalogProducts.length || preselected.current) return;
    if (preselectedProductId) {
      const found = catalogProducts.find((p) => p.id === preselectedProductId);
      if (found) {
        preselected.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedProduct(found);
      }
    }
  }, [catalogLoading, catalogProducts, preselectedProductId]);

  // Load design library from Firestore (individual docs in designs/ collection, fallback to old catalog format)
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "designs"));
        const items: DesignAsset[] = [];
        snap.forEach((d) => {
          const data = d.data() as DesignAsset;
          if (data.name && data.image_url) items.push(data);
        });
        if (items.length > 0) {
          setDesignLibrary(items);
          return;
        }
      } catch {}
      // Fallback: old designs/catalog format
      try {
        const snap = await getDoc(doc(db, "designs", "catalog"));
        if (snap.exists()) {
          setDesignLibrary((snap.data() as { items?: DesignAsset[] }).items ?? []);
        }
      } catch {}
    };
    load();
  }, []);

  const handleUploadComplete = useCallback((url: string) => {
    setDesignUrl(url);
  }, []);

  const handleToggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectDesign = (asset: DesignAsset) => {
    setDesignUrl(asset.image_url);
    setLibraryOpen(false);
  };

  const handleProductSelect = (productId: string) => {
    const product = catalogProducts.find((p) => p.id === productId) ?? null;
    setSelectedProduct(product);
    setVariantIndex(0);
    setPerViewDesign({});
    const views = product ? getProductViews(product) : [];
    setDesignState(defaultStateForView(views, activeView));
  };

  const handleViewChange = (view: string) => {
    // Save current view's design state
    setPerViewDesign((prev) => ({ ...prev, [activeView]: designState }));
    // Restore target view's saved state, or compute default
    const saved = perViewDesign[view];
    if (saved) {
      setDesignState(saved);
    } else {
      const views = getProductViews(selectedProduct);
      setDesignState(defaultStateForView(views, view));
    }
    setActiveView(view);
  };

  const handleAddToCart = () => {
    const price = getProductPrice(selectedProduct, variantIndex);
    const variant: ManagedVariant | undefined = selectedProduct?.variants[variantIndex];

    addItem({
      id: orderId,
      product_id: selectedProduct?.id ?? "custom",
      variant_id: variant?.id ?? "",
      squareVariationId: variant?.squareVariationId,
      name: selectedProduct?.name ?? "Custom Design",
      variant_name: variant?.name ?? "",
      base_price: price,
      productType: selectedProduct?.productType ?? "other",
      quantity: 1,
      selected_view: activeView as "front" | "back" | "sleeve" | "sideL" | "sideR",
      design_url: designUrl,
      design_text: designText,
      design_x: designState.xPercent,
      design_y: designState.yPercent,
      design_scale: designState.scale,
      design_rotation: designState.rotation,
      addons: Array.from(selectedAddons).map((id) => {
        const addon = effectiveAddons.find((a) => a.id === id);
        return {
          type: id as AddonType,
          label: addon?.name ?? id,
          price: addon?.price ?? addonPrice,
          addon_id: id,
        };
      }),
    });
  };

  const productViews = getProductViews(selectedProduct);
  const currentView = productViews.find((v) => v.key === activeView) ?? productViews[0];
  const basePrice = getProductPrice(selectedProduct, variantIndex);
  const addonsCost = Array.from(selectedAddons).reduce((sum, id) => {
    const addon = effectiveAddons.find((a) => a.id === id);
    return sum + (addon?.price ?? addonPrice);
  }, 0);
  const totalPrice = basePrice + addonsCost;

  // Sort catalog products for dropdown
  const sortedCatalog = [...catalogProducts].sort((a, b) => a.name.localeCompare(b.name));

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
              onViewChange={handleViewChange}
              designUrl={designUrl}
              designText={designText}
              textColor={textColor}
              textFont={textFont}
              onTextColorChange={setTextColor}
              onTextFontChange={setTextFont}
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
                        {p.name} — from ${((p.variants ?? [])[0]?.price ?? 0).toFixed(2)}
                      </option>
                    ))}
                  </select>

                  {/* Variation Picker */}
                  {selectedProduct && (selectedProduct.variants ?? []).length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedProduct.variants ?? []).map((v, i) => (
                        <button
                          key={v.id}
                          onClick={() => setVariantIndex(i)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                            i === variantIndex
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
                        src={getProductImageUrl(selectedProduct) || selectedProduct.images?.[0] || "/hero-bg.jpg"}
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
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {/* Per-product designs */}
                    {productDesigns.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-primary/40 uppercase tracking-wider mb-1 px-1">Product Designs</p>
                        <div className="space-y-1">
                          {productDesigns.map((asset) => (
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
                              <p className="text-xs font-medium truncate">{asset.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Global design library */}
                    {designLibrary.length === 0 && productDesigns.length === 0 ? (
                      <p className="text-xs text-primary/30 text-center py-4">
                        No designs available. Upload designs in the Admin Dashboard.
                      </p>
                    ) : (
                      <div>
                        {productDesigns.length > 0 && (
                          <p className="text-[10px] font-semibold text-primary/40 uppercase tracking-wider mb-1 px-1 mt-2">All Designs</p>
                        )}
                        <div className="space-y-1">
                          {designLibrary.map((asset) => (
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
                          ))}
                        </div>
                      </div>
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
                {effectiveAddons.map((addon) => (
                  <label
                    key={addon.id}
                    className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-warm-sand/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAddons.has(addon.id)}
                      onChange={() => handleToggleAddon(addon.id)}
                      className="accent-gold w-4 h-4"
                    />
                    <span className="text-sm text-primary">{addon.name}</span>
                    <span className="ml-auto text-sm text-gold font-medium">+${addon.price.toFixed(2)}</span>
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
                  <div className="flex justify-between text-sm">
                    <span className="text-primary/60">Add-ons</span>
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
