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
import type { AddonType, DesignAsset, ManagedProduct, ManagedVariant, ModifierInput, PrintZone, PrintZoneTemplate, ProductAddon, ProductModifier } from "@/types";

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
  const preselectedColor = searchParams.get("color") || "";

  const { addItem } = useCart();
  const siteConfig = useSiteConfig();
  const addonPrice = siteConfig.addon_price;
  const { products: catalogProducts, loading: catalogLoading } = useCatalog();

  const [selectedProduct, setSelectedProduct] = useState<ManagedProduct | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>();
  const [activeView, setActiveView] = useState("front");
  const [designUrl, setDesignUrl] = useState<string>();
  const [designText, setDesignText] = useState<string>();
  const [textColor, setTextColor] = useState("#111827");
  const [textFont, setTextFont] = useState("var(--font-display)");
  const [designState, setDesignState] = useState<DesignState>(DEFAULT_DESIGN_STATE);
  const [perViewDesign, setPerViewDesign] = useState<Record<string, DesignState>>({});
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  // Three-state add-on resolution: undefined = use site-standard defaults,
  // [] = admin explicitly removed all add-ons for this product, [...] = exactly
  // these. This lets the admin prune irrelevant add-ons per product instead of
  // the previous all-or-nothing fallback that dumped every global add-on.
  const effectiveAddons: (ProductAddon | { id: string; name: string; price: number })[] =
    selectedProduct?.productAddons === undefined
      ? ADDONS.map((a) => ({ id: a.type, name: a.label, price: addonPrice }))
      : selectedProduct.productAddons;

  // Three-state modifier resolution (Phase 3). Modifiers take precedence over
  // the legacy productAddons when both are configured on the product.
  //   undefined = site-standard modifiers from config (or legacy ADDONS fallback)
  //   []        = admin explicitly removed all modifiers
  //   [...]     = exactly these modifiers
  const effectiveModifiers: ProductModifier[] =
    selectedProduct?.modifiers !== undefined
      ? selectedProduct.modifiers
      : selectedProduct?.productAddons !== undefined
        ? [] // product configured legacy add-ons — handled by effectiveAddons path
        : (siteConfig.addon_defaults?.standardAddons ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            priceType: a.priceType,
            price: a.price,
            inputType: a.id === "personalization" ? ("text" as const) : ("toggle" as const),
            inputLabel: a.id === "personalization" ? "Enter name/number" : undefined,
          }));

  // Customer inputs for text/file modifiers, keyed by modifier id.
  const [modifierInputs, setModifierInputs] = useState<Record<string, string>>({});

  // Resolve a modifier's price to a dollar amount (percentage applies to base price).
  const resolveModifierPrice = (mod: ProductModifier, base: number): number =>
    mod.priceType === "percentage" ? base * (mod.price / 100) : mod.price;

  const formatModifierPrice = (mod: ProductModifier): string =>
    mod.priceType === "percentage"
      ? `+${mod.price}%`
      : `+$${mod.price.toFixed(2)}`;
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
        // Prefer the color picked on the product page; fall back to the first color.
        const color = found.colors?.includes(preselectedColor) ? preselectedColor : found.colors?.[0];
        setSelectedColor(color || undefined);
      }
    }
  }, [catalogLoading, catalogProducts, preselectedProductId, preselectedColor]);

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
    // Default to the product's first color so the mockup tints immediately.
    setSelectedColor(product?.colors?.[0]);
    // Single-design products hide the text tool — clear any text from a prior
    // product so it can't leak into the cart while the input is hidden.
    if (product?.singleDesign) setDesignText(undefined);
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

    // Build addons from modifiers (Phase 3) when available; otherwise fall back
    // to the legacy add-on path. Modifier prices are resolved to dollars here
    // (percentage modifiers apply to the variant's base price).
    const useModifiers = selectedProduct?.modifiers !== undefined || selectedProduct?.productAddons === undefined;
    const addons = useModifiers
      ? Array.from(selectedAddons)
          .map((id) => {
            const mod = effectiveModifiers.find((m) => m.id === id);
            if (!mod) return null;
            return {
              type: (["back_print", "sleeve_print", "personalization"].includes(mod.id) ? mod.id : "back_print") as AddonType,
              label: mod.name,
              // Store the raw price + pricing model; the cart resolves percentage
              // add-ons against the line's base price via resolveAddonPrice.
              price: mod.price,
              priceType: mod.priceType,
              addon_id: mod.id,
            };
          })
          .filter((a): a is NonNullable<typeof a> => a !== null)
      : Array.from(selectedAddons).map((id) => {
          const addon = effectiveAddons.find((a) => a.id === id);
          return {
            type: id as AddonType,
            label: addon?.name ?? id,
            price: addon?.price ?? addonPrice,
            addon_id: id,
          };
        });

    // Capture customer inputs for text/file modifiers.
    const capturedModifierInputs: ModifierInput[] = useModifiers
      ? Array.from(selectedAddons)
          .map((id): ModifierInput | null => {
            const mod = effectiveModifiers.find((m) => m.id === id);
            if (!mod) return null;
            return {
              modifierId: mod.id,
              modifierName: mod.name,
              value: modifierInputs[mod.id] || undefined,
            };
          })
          .filter((m): m is ModifierInput => m !== null)
      : [];

    // Capture the customer's variant option choices for order fulfillment display.
    const selectedOptions = variant?.options
      ? Object.entries(variant.options).map(([optionName, value]) => ({
          optionId: optionName.toLowerCase().replace(/\s+/g, "_"),
          optionName,
          value,
        }))
      : undefined;

    addItem({
      // Fresh ID per line item — a shared ID makes REMOVE_ITEM/UPDATE_QUANTITY
      // match every item added this session and produces duplicate React keys.
      id: crypto.randomUUID(),
      product_id: selectedProduct?.id ?? "custom",
      variant_id: variant?.id ?? "",
      squareVariationId: variant?.squareVariationId,
      name: selectedProduct?.name ?? "Custom Design",
      variant_name: variant?.name ?? "",
      base_price: price,
      productType: selectedProduct?.productType ?? "other",
      quantity: 1,
      selected_view: activeView as "front" | "back" | "sleeve" | "sideL" | "sideR",
      selected_color: selectedColor,
      design_url: designUrl,
      design_text: designText,
      design_x: designState.xPercent,
      design_y: designState.yPercent,
      design_scale: designState.scale,
      design_rotation: designState.rotation,
      shipping_rate: selectedProduct?.shippingRate,
      addons,
      selectedOptions,
      modifierInputs: capturedModifierInputs.length > 0 ? capturedModifierInputs : undefined,
    });
  };

  const productViews = getProductViews(selectedProduct);
  const currentView = productViews.find((v) => v.key === activeView) ?? productViews[0];
  // Color-variant mockup: prefer a real per-color photo if one exists, otherwise
  // tint the default base image with the selected color's overlay.
  const colorMockup = selectedColor
    ? selectedProduct?.mockupImagesByColor?.[selectedColor]?.[activeView as "front" | "back" | "sleeve" | "sideL" | "sideR"]
    : undefined;
  const effectiveBaseImage = colorMockup ?? currentView.baseImage;
  const tintColor = !colorMockup && selectedColor ? selectedProduct?.colorTints?.[selectedColor] : undefined;
  const basePrice = getProductPrice(selectedProduct, variantIndex);
  // Add-on cost uses modifiers when available (percentage modifiers resolve against
  // the base price); otherwise falls back to the legacy flat-price add-ons.
  const useModifiersForCost = selectedProduct?.modifiers !== undefined || selectedProduct?.productAddons === undefined;
  const addonsCost = useModifiersForCost
    ? Array.from(selectedAddons).reduce((sum, id) => {
        const mod = effectiveModifiers.find((m) => m.id === id);
        return mod ? sum + resolveModifierPrice(mod, basePrice) : sum;
      }, 0)
    : Array.from(selectedAddons).reduce((sum, id) => {
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
            className="text-sm font-medium hover:text-gold-deep transition-colors"
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
              baseImage={effectiveBaseImage}
              tintColor={tintColor}
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
              hideTextTool={!!selectedProduct?.singleDesign}
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
                              : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                          }`}
                        >
                          {v.name || `Option ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Color Picker — tints the mockup to the chosen garment color */}
                  {selectedProduct && (selectedProduct.colors ?? []).length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-primary block mb-1">Color</span>
                      <div className="flex flex-wrap gap-2">
                        {(selectedProduct.colors ?? []).map((color) => {
                          const tint = selectedProduct.colorTints?.[color];
                          // Always show a swatch: the tint, the hex when the color
                          // key is itself a hex, or a neutral gray placeholder.
                          const swatch = tint || (/^#[0-9a-f]{6}$/i.test(color) ? color : "#cccccc");
                          const isActive = selectedColor === color;
                          return (
                            <button
                              key={color}
                              onClick={() => setSelectedColor(color)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                                isActive
                                  ? "bg-primary text-white"
                                  : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-black/10 inline-block shrink-0"
                                style={{ backgroundColor: swatch }}
                              />
                              {color}
                            </button>
                          );
                        })}
                      </div>
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
              {selectedProduct?.singleDesign && (
                <p className="text-xs text-foreground mb-3 -mt-2">
                  This item takes a single design — pick one image.
                </p>
              )}

              <FileUpload
                onUploadComplete={handleUploadComplete}
                onError={(err) => console.error(err)}
              />

              {/* Design Library */}
              <div className="mt-3">
                <button
                  onClick={() => setLibraryOpen(!libraryOpen)}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-primary/20 rounded-xl text-sm text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {libraryOpen ? "Close Library" : "Choose Design"}
                </button>

                {libraryOpen && (
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {/* Per-product designs */}
                    {productDesigns.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider mb-1 px-1">Product Designs</p>
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
                    {/* Global design library — exclude designs already shown above */}
                    {(() => {
                      const pinnedIds = new Set(productDesigns.map((d) => d.id));
                      const filteredLibrary = designLibrary.filter((d) => !pinnedIds.has(d.id));
                      if (filteredLibrary.length === 0 && productDesigns.length === 0) {
                        return (
                          <p className="text-xs text-foreground/70 text-center py-4">
                            No designs available. Upload designs in the Admin Dashboard.
                          </p>
                        );
                      }
                      if (filteredLibrary.length === 0) return null;
                      return (
                        <div>
                          {productDesigns.length > 0 && (
                            <p className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider mb-1 px-1 mt-2">All Designs</p>
                          )}
                          <div className="space-y-1">
                            {filteredLibrary.map((asset) => (
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
                                  <p className="text-[10px] text-foreground/80 truncate">
                                    {asset.category}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                  className="mt-3 w-full px-4 py-2 text-xs text-danger hover:text-danger hover:bg-red-50 rounded-xl transition-colors"
                >
                  Clear Design
                </button>
              )}
            </div>

            {/* Add-ons / Modifiers — hidden when no product or when the product offers none */}
            {selectedProduct && (useModifiersForCost ? effectiveModifiers.length > 0 : effectiveAddons.length > 0) && (
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Add-ons</h2>
              <div className="space-y-2">
                {useModifiersForCost
                  ? (() => {
                      const groups = new Map<string, (typeof effectiveModifiers)[number][]>();
                      for (const mod of effectiveModifiers) {
                        const g = (mod.group || "Add-ons").trim();
                        if (!groups.has(g)) groups.set(g, []);
                        groups.get(g)!.push(mod);
                      }
                      const showHeaders = groups.size > 1 || !groups.has("Add-ons");
                      return Array.from(groups.entries()).map(([groupName, mods]) => (
                        <div key={groupName}>
                          {showHeaders && (
                            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60 mt-3 mb-1.5 first:mt-0">
                              {groupName}
                            </h3>
                          )}
                          <div className="space-y-2">
                            {mods.map((mod) => (
                              <div key={mod.id} className="p-2 rounded-xl hover:bg-warm-sand/50 transition-colors">
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedAddons.has(mod.id)}
                                    onChange={() => handleToggleAddon(mod.id)}
                                    className="accent-gold w-4 h-4"
                                  />
                                  <span className="text-sm text-primary">{mod.name}</span>
                                  <span className="ml-auto text-sm text-gold-deep font-medium">
                                    {formatModifierPrice(mod)}
                                  </span>
                                </label>
                                {/* Text input for text modifiers — shown when the modifier is selected */}
                                {selectedAddons.has(mod.id) && mod.inputType === "text" && (
                                  <input
                                    type="text"
                                    value={modifierInputs[mod.id] ?? ""}
                                    onChange={(e) => setModifierInputs((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                                    placeholder={mod.inputLabel ?? "Enter text"}
                                    className="mt-2 ml-7 w-[calc(100%-1.75rem)] px-3 py-1.5 rounded-lg border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                                  />
                                )}
                                {/* File upload for file modifiers — shown when the modifier is selected */}
                                {selectedAddons.has(mod.id) && mod.inputType === "file" && (
                                  <div className="mt-2 ml-7">
                                    <FileUpload
                                      onUploadComplete={(url) => setModifierInputs((prev) => ({ ...prev, [mod.id]: url }))}
                                      onError={(err) => console.error(err)}
                                    />
                                    {modifierInputs[mod.id] && (
                                      <p className="text-xs text-green-600 mt-1">File uploaded</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()
                  : effectiveAddons.map((addon) => (
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
                        <span className="ml-auto text-sm text-gold-deep font-medium">+${addon.price.toFixed(2)}</span>
                      </label>
                    ))}
              </div>
            </div>
            )}

            {/* Price & Add to Cart */}
            <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
              <h2 className="font-bold font-display text-lg mb-4">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground">Base price</span>
                  <span>${basePrice.toFixed(2)}</span>
                </div>
                {addonsCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Add-ons</span>
                    <span>+${addonsCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-warm-sand">
                  <span>Total</span>
                  <span className="text-gold-deep">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={!selectedProduct || (!designUrl && !designText)}
                className="mt-4 w-full py-3 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart — ${totalPrice.toFixed(2)}
              </button>
              {!selectedProduct && (
                <p className="text-xs text-amber-500 text-center mt-2">
                  Select a product above first
                </p>
              )}
              {selectedProduct && !designUrl && !designText && (
                <p className="text-xs text-foreground/70 text-center mt-2">
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
