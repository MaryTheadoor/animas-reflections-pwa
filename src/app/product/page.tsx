"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PlaceholderImage from "@/components/ui/placeholder-image";
import ModifierThumb from "@/components/ui/modifier-thumb";
import { useCatalog, getProductImageUrl } from "@/hooks/useCatalog";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useDesignLibrary } from "@/hooks/useDesignLibrary";
import { buildDesignIndex, modifierThumbnail } from "@/lib/modifier-design-match";
import { sanitizeHTML, stripTags } from "@/lib/html-utils";
import { useCart } from "@/context/cart-context";
import type { CartAddon, DesignAsset } from "@/types";
import {
  buildModifierAddons,
  captureModifierInputs,
  formatModifierDelta,
  groupModifiers,
  hasGenericVariants,
  modifierSelectedOptions,
  modifierTotal,
} from "@/lib/modifier-selection";
import PageLayout from "@/components/layout/page-layout";
import { BreadcrumbJsonLd } from "@/components/layout/json-ld";

function ProductJsonLd({
  name,
  description,
  imageUrl,
  price,
  productId,
  sku,
  availability,
}: {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  productId: string;
  sku: string;
  availability: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: stripTags(description).substring(0, 300),
    image: imageUrl || "https://www.animasreflections.com/logo.png",
    sku,
    // An unpriced item is not orderable online, so it must not advertise a
    // $0.00 Offer — that is a false price to Google and to shoppers. A Product
    // without `offers` is valid structured data.
    ...(price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: price.toFixed(2),
            priceCurrency: "USD",
            availability,
            url: `https://www.animasreflections.com/product?id=${productId}`,
          },
        }
      : {}),
    brand: {
      "@type": "Brand",
      name: "Animas Reflections",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
    />
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageLayout><div className="flex items-center justify-center min-h-[50vh]"><div className="flex gap-3"><div className="w-3 h-3 bg-gold rounded-full animate-bounce" /><div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" /><div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" /></div></div></PageLayout>}>
      <ProductContent />
    </Suspense>
  );
}

function ProductContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const { products, loading, error, refresh } = useCatalog();
  const { addItem } = useCart();
  const siteConfig = useSiteConfig();

  const product = productId ? products.find((p) => p.id === productId) ?? null : null;
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [customText, setCustomText] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>();
  const [selectedDesign, setSelectedDesign] = useState<DesignAsset | null>(null);
  // Modifier choices (sizes, colours, add-ons) for products whose variants are
  // placeholders — see usesModifierGroups below.
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [modifierInputs, setModifierInputs] = useState<Record<string, string>>({});
  // Design thumbnails beside modifier options (PROJECT_CONTEXT §15.6 S1). Read-only:
  // the library is matched by option name, nothing is written.
  const { designs: libraryDesigns } = useDesignLibrary();
  const designIndex = useMemo(() => buildDesignIndex(libraryDesigns), [libraryDesigns]);

  // /product?id=A → /product?id=B keeps the same component instance, so all
  // per-product selection state must reset when the product changes. Without
  // this, a stale variant index renders a dead $0.00 button and a color or
  // personalization text picked on product A leaks into product B's cart.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per-product selections on product change
    setSelectedVariant(0);
    setSelectedColor(undefined);
    setSelectedDesign(null);
    setCustomText("");
    setSelectedModifierIds([]);
    setModifierInputs({});
  }, [productId]);

  const variants = product?.variants ?? [];
  const colors = product?.colors ?? [];
  const variant = variants[selectedVariant] ?? variants[0];
  // Only a variant with a real price is sellable: checkout REJECTS a variant
  // whose catalog price is 0 or blank ("has no price configured"), so the
  // storefront must not offer an orderable button for one.
  const hasSellableVariant = variant != null && variant.price > 0;
  const pricedVariantPrices = variants.map((v) => v.price).filter((p) => Number.isFinite(p) && p > 0);
  const minVariantPrice = pricedVariantPrices.length ? Math.min(...pricedVariantPrices) : 0;
  // Schema.org availability mirrors the card's stock-badge logic.
  const hasInventory = variants.some((v) => v.inventory !== undefined);
  const totalStock = variants.reduce((sum, v) => sum + (v.inventory ?? 0), 0);
  // Per-variant stock check: inventory undefined = "not tracked" → treat as in stock.
  // inventory 0 (or less) = out of stock → block add-to-cart.
  const isOutOfStock = variant != null && variant.inventory !== undefined && variant.inventory <= 0;
  const canAddToCart = hasSellableVariant && !isOutOfStock;
  const availability =
    hasInventory && totalStock === 0
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex gap-3">
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold font-display mb-4">Something went wrong</h1>
          <p className="text-foreground mb-4">Couldn&apos;t load the catalog.</p>
          <button onClick={refresh} className="px-6 py-2.5 rounded-xl btn-tactile btn-primary-tactile">Retry</button>
        </div>
      </PageLayout>
    );
  }

  if (!product) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold font-display mb-4">Product Not Found</h1>
          <Link href="/shop" className="px-6 py-3 bg-gold text-on-gold rounded-2xl font-semibold btn-tactile btn-gold-tactile">
            Browse Products
          </Link>
        </div>
      </PageLayout>
    );
  }

  const price = variant?.price ?? 0;
  // 157 active products keep their real size and colour choices in `modifiers`
  // while their `variants` are placeholders (five identical "Regular" rows), so
  // the variant picker cannot express them. Those products render the modifier
  // groups instead; a product whose variant names are real and distinct already
  // expresses choice through the picker and keeps today's behaviour.
  const modifiers = product.modifiers ?? [];
  const usesModifierGroups = hasGenericVariants(product) && modifiers.length > 0;
  const modifierGroups = usesModifierGroups ? groupModifiers(modifiers) : [];
  const selectedModifierIdsInUse = usesModifierGroups ? selectedModifierIds : [];
  const selectedModifiers = modifiers.filter((m) => selectedModifierIdsInUse.includes(m.id));
  // Dollars added by the selected modifiers, resolved against THIS variant's
  // price (a percentage modifier applies to the base price, as in the cart).
  const modifierCost = modifierTotal(modifiers, selectedModifierIdsInUse, price);
  const unitPrice = Math.round((price + modifierCost) * 100) / 100;
  // The displayed color falls back to the product's first color until the
  // customer picks one. Selections reset on product change (see the effect
  // above), so a stale color can only survive for a single render.
  const effectiveColor =
    product && selectedColor && colors.includes(selectedColor) ? selectedColor : colors[0];
  // Dynamic image: when a color is selected, show its per-color image if one
  // is configured. Falls back to the front mockup, then the primary gallery image.
  const colorImage = effectiveColor
    ? product?.mockupImagesByColor?.[effectiveColor]?.front
    : undefined;
  // A selected modifier can carry its own background for this view — the
  // "design already printed on the garment" case the admin builds under
  // Modifier Images. It outranks the colour photo, exactly as in the customizer,
  // so an assignment made there is visible here too.
  const modifierImage = selectedModifiers
    .map((m) => product?.mockupImagesByModifier?.[m.name]?.front)
    .find((url) => Boolean(url));
  const imageUrl =
    modifierImage ?? colorImage ?? product?.mockupImages?.front ?? getProductImageUrl(product);
  // Gated by modifiers (Phase 3) or productAddons so the Name/Number field only
  // shows when a personalization/text input is enabled per product (undefined = site defaults).
  // A text modifier rendered inside its own group already has that input, so the
  // standalone field is suppressed to avoid two boxes for the same value.
  const showPersonalization =
    !usesModifierGroups &&
    (product.modifiers !== undefined
      ? product.modifiers.some((m) => m.inputType === "text")
      : product.productAddons === undefined || product.productAddons.some((a) => a.id === "personalization"));
  // When modifiers provide the text input, capture it as a modifier input too.
  const textModifier = usesModifierGroups ? undefined : product.modifiers?.find((m) => m.inputType === "text");
  // Text to print on the mockup: the selected text modifier's value, or the
  // legacy Name/Number field.
  const activeTextModifier = selectedModifiers.find(
    (m) => m.inputType === "text" && (modifierInputs[m.id] ?? "").trim() !== "",
  );
  const personalizationText = usesModifierGroups
    ? (modifierInputs[activeTextModifier?.id ?? ""] ?? "").trim()
    : showPersonalization
      ? customText
      : "";

  const toggleModifier = (id: string) => {
    setSelectedModifierIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id],
    );
  };


  return (
    <PageLayout>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        {/* JSON-LD Structured Data */}
        <ProductJsonLd
          name={product.seoTitle || product.name}
          description={product.seoDescription || product.description}
          imageUrl={imageUrl}
          price={price}
          productId={product.id}
          sku={variant?.sku || product.id}
          availability={availability}
        />
        {/* Breadcrumb structured data — mirrors the visible Shop / product trail below */}
        <BreadcrumbJsonLd
          items={[
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: product.name, path: `/product?id=${product.id}` },
          ]}
        />

        {/* Breadcrumb */}
        <div className="text-xs text-foreground/80 mb-4">
          <Link href="/shop" className="hover:text-gold-deep">Shop</Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Mockup / Image */}
          <div className="relative aspect-square bg-warm-sand rounded-2xl overflow-hidden shadow-card">
            {imageUrl ? (
              <Image src={imageUrl} alt={product.name} fill className="object-contain p-4" sizes="(max-width:768px) 100vw, 50vw" />
            ) : (
              <PlaceholderImage />
            )}
            {/* Text overlay — the selected text modifier, or the Name/Number field */}
            {personalizationText && (
              <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-xl font-bold text-foreground pointer-events-none">
                {personalizationText}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-2">{product.seoTitle || product.name}</h1>
            {product.description && (() => {
              const stripped = stripTags(product.description);
              const isLong = stripped.length > 200;
              const hasHTML = /<[a-z][\s\S]*?>/i.test(product.description);
              // Rich formatting shows immediately for short descriptions; long
              // ones keep the collapsed plain-text preview until expanded.
              const showRich = hasHTML && (descExpanded || !isLong);
              return (
                <div className="mb-4">
                  <div className={`text-sm text-foreground leading-relaxed ${!showRich && isLong ? "line-clamp-3" : ""}`}>
                    {showRich ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(product.description) }} className="rich-desc" />
                    ) : (
                      <p>{stripped}</p>
                    )}
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-gold-deep hover:text-gold-deep mt-1 transition-colors"
                    >
                      {descExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              );
            })(            )}

            {/* Product Attributes — shown only when configured */}
            {(() => {
              const attrs = product.attributes;
              if (!attrs) return null;
              const visible = attrs.backgroundColor || attrs.patchShape || attrs.borderStyle || (attrs.customFields?.length ?? 0) > 0;
              if (!visible) return null;
              return (
                <div className="border-t border-warm-sand pt-3 mt-3 mb-4">
                  <span className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider block mb-1.5">Specifications</span>
                  <div className="flex flex-wrap gap-2 text-xs text-foreground">
                    {attrs.backgroundColor && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warm-sand/30 rounded-full">
                        <span className="w-3 h-3 rounded-full border border-primary/20 inline-block shrink-0" style={{ backgroundColor: attrs.backgroundColor }} />
                        {attrs.backgroundColor}
                      </span>
                    )}
                    {attrs.patchShape && (
                      <span className="px-2 py-0.5 bg-warm-sand/30 rounded-full capitalize">{attrs.patchShape}</span>
                    )}
                    {attrs.borderStyle && attrs.borderStyle !== "none" && (
                      <span className="px-2 py-0.5 bg-warm-sand/30 rounded-full capitalize">{attrs.borderStyle} border</span>
                    )}
                    {(attrs.customFields ?? []).map((f) => (
                      <span key={f.key} className="px-2 py-0.5 bg-warm-sand/30 rounded-full">
                        {f.key}: {f.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Price — base variant plus the selected modifiers, never $0.00 for
                a variant checkout would reject */}
            <div className="mb-6">
              <p className="text-3xl font-bold text-gold-deep">
                {price > 0 ? `$${unitPrice.toFixed(2)}` : "Contact us for pricing"}
                {variants.length > 1 && minVariantPrice > 0 && price > 0 && (
                  <span className="text-sm font-normal text-foreground ml-2">
                    Starting at ${minVariantPrice.toFixed(2)}
                  </span>
                )}
              </p>
              {modifierCost > 0 && (
                <p className="text-xs text-foreground/80 mt-1">
                  Includes ${modifierCost.toFixed(2)} for the selected options
                </p>
              )}
            </div>

            {/* Variant Picker — only for products whose variants are real,
                distinguishable options. A product whose variants are placeholders
                (five identical "Regular" rows) names its choices in modifiers. */}
            {variants.length > 1 && !usesModifierGroups && (
              <div className="mb-6">
                <span className="text-xs font-medium text-primary block mb-2">Style / Size</span>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        i === selectedVariant
                          ? "bg-primary text-white btn-tactile btn-primary-tactile"
                          : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                      }`}
                    >
                      {v.name || `Option ${i + 1}`}
                      {v.price > 0 && <span className="ml-1">${v.price.toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modifier groups — the real size/colour/add-on choices. Every group
                is multi-select, exactly as the customizer renders it, because a
                toggle is what the cart can express as an add-on. */}
            {usesModifierGroups && (
              <div className="mb-6">
                {modifierGroups.map((group) => (
                  <fieldset key={group.name} className="mb-4 last:mb-0">
                    <legend className="text-xs font-medium text-primary mb-2">{group.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {group.modifiers.map((mod) => {
                        const active = selectedModifierIdsInUse.includes(mod.id);
                        const delta = formatModifierDelta(mod);
                        // Explicit admin assignment wins; otherwise the design whose
                        // label matches this option's name.
                        const thumbnail = modifierThumbnail(
                          mod,
                          designIndex,
                          product?.mockupImagesByModifier,
                        );
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleModifier(mod.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                              active
                                ? "bg-primary text-white"
                                : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                            }`}
                          >
                            {thumbnail && <ModifierThumb src={thumbnail} />}
                            <span
                              aria-hidden="true"
                              className={`flex items-center justify-center w-3.5 h-3.5 rounded border shrink-0 ${
                                active ? "bg-white border-white" : "border-primary/30"
                              }`}
                            >
                              {active && (
                                <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            {mod.name}
                            {delta && <span className={active ? "text-white/80" : "text-gold-deep"}>{delta}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Text and file modifiers collect their value once selected.
                        Artwork upload stays in the customizer, which owns the
                        storage path — the product page only links to it. */}
                    {group.modifiers
                      .filter(
                        (mod) =>
                          selectedModifierIdsInUse.includes(mod.id) &&
                          (mod.inputType === "text" || mod.inputType === "file"),
                      )
                      .map((mod) =>
                        mod.inputType === "text" ? (
                          <div key={mod.id} className="mt-2">
                            <label htmlFor={`modifier-${mod.id}`} className="block text-[11px] text-foreground/70 mb-1">
                              {mod.inputLabel ?? mod.name}
                            </label>
                            <input
                              id={`modifier-${mod.id}`}
                              type="text"
                              value={modifierInputs[mod.id] ?? ""}
                              onChange={(e) => setModifierInputs((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                              placeholder={mod.inputLabel ?? "Enter text"}
                              className="w-full max-w-xs px-3 py-1.5 rounded-lg border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                            />
                          </div>
                        ) : (
                          <p key={mod.id} className="mt-2 text-xs text-foreground/80">
                            {mod.name}:{" "}
                            <Link
                              href={`/customizer/?product=${encodeURIComponent(product.id)}`}
                              className="text-gold-deep hover:underline"
                            >
                              upload your artwork in the customizer
                            </Link>
                          </p>
                        ),
                      )}
                  </fieldset>
                ))}
              </div>
            )}

            {/* Color — shown when the product has garment colors configured */}
            {colors.length > 0 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-primary block mb-2">Color</span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => {
                    const tint = product.colorTints?.[color];
                    // Fall back to the admin-managed catalog color hex so named
                    // colors (e.g. "Heather Grey") show their real swatch even
                    // without a per-product colorTints entry.
                    const catalogHex = siteConfig.catalog_options?.colors?.find(
                      (c) => c.name.toLowerCase() === color.toLowerCase(),
                    )?.hex;
                    const swatch = tint || catalogHex || (/^#[0-9a-f]{6}$/i.test(color) ? color : "#cccccc");
                    const isActive = effectiveColor === color;
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
                        <span className="w-3 h-3 rounded-full border border-black/10 inline-block shrink-0" style={{ backgroundColor: swatch }} />
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Design — pick one directly here instead of entering the customizer.
                For products like a puzzle, the design is the whole point, so the
                customer chooses the background (colour/variant) and the design, then
                Add to Cart — no drag/resize step needed. */}
            {(product.designAssets?.length ?? 0) > 0 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-primary block mb-2">
                  Design{selectedDesign ? ` — ${selectedDesign.name}` : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.designAssets!.map((d) => {
                    const active = selectedDesign?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedDesign(active ? null : d)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          active
                            ? "bg-gold/10 border-gold/40 text-gold-deep"
                            : "bg-warm-sand/30 border-transparent text-foreground hover:border-primary/20"
                        }`}
                      >
                        <Image src={d.image_url} alt={d.name} width={28} height={28} className="rounded object-cover shrink-0" />
                        {d.name}
                      </button>
                    );
                  })}
                </div>
                {selectedDesign && (
                  <p className="text-[11px] text-foreground/70 mt-1.5">
                    This design will be printed on the {effectiveColor ?? "default"} background. Use “Customize This” if you want to move or resize it.
                  </p>
                )}
              </div>
            )}

            {/* Custom Text — gated by personalization add-on presence */}
            {showPersonalization && (
            <div className="mb-6">
              <label className="text-xs font-medium text-primary block mb-1">
                Name / Number (optional)
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. SMITH 42"
                className="w-full max-w-xs px-4 py-2 rounded-xl border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
            </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  if (!variant || !hasSellableVariant) return;
                  // Capture the customer's variant option choices and the chosen
                  // modifier options for fulfilment. The checkout note is built
                  // from these, so the line reads "Adult Size: XX-Large | Colour: Black".
                  const selectedOptions = [
                    ...(variant.options
                      ? Object.entries(variant.options).map(([optionName, value]) => ({
                          optionId: optionName.toLowerCase().replace(/\s+/g, "_"),
                          optionName,
                          value,
                        }))
                      : []),
                    ...modifierSelectedOptions(modifiers, selectedModifierIdsInUse, modifierInputs),
                  ];
                  // Typed/uploaded values for the selected modifiers, for fulfilment.
                  const capturedModifierInputs = captureModifierInputs(
                    modifiers,
                    selectedModifierIdsInUse,
                    modifierInputs,
                  );
                  // The personalization add-on price must ride on the cart line —
                  // the text alone is fulfillment data. Resolve the definition the
                  // same way the customizer does: product modifier → legacy
                  // productAddons → site-standard add-on. Modifier groups carry
                  // their own add-ons below, so the legacy path is skipped there.
                  const addons: CartAddon[] = buildModifierAddons(modifiers, selectedModifierIdsInUse);
                  if (showPersonalization && customText.trim()) {
                    const standardAddons = siteConfig.addon_defaults?.standardAddons ?? [];
                    const legacy = product.productAddons?.find((a) => a.id === "personalization");
                    const std = standardAddons.find((a) => a.id === "personalization");
                    if (textModifier) {
                      addons.push({
                        type: "personalization",
                        label: textModifier.name,
                        price: textModifier.price,
                        priceType: textModifier.priceType,
                        addon_id: textModifier.id,
                      });
                    } else if (legacy) {
                      addons.push({
                        type: "personalization",
                        label: legacy.name,
                        price: legacy.price,
                        addon_id: legacy.id,
                      });
                    } else if (std) {
                      addons.push({
                        type: "personalization",
                        label: std.name,
                        price: std.price,
                        priceType: std.priceType,
                        addon_id: std.id,
                      });
                    }
                  }
                  addItem({
                    id: crypto.randomUUID(),
                    product_id: product.id,
                    variant_id: variant.id,
                    squareVariationId: variant.squareVariationId,
                    name: product.name,
                    variant_name: variant.name,
                    base_price: price,
                    productType: product.productType,
                    quantity: 1,
                    selected_view: "front",
                    design_text: personalizationText || undefined,
                    selected_color: effectiveColor,
                    design_url: selectedDesign?.image_url || undefined,
                    shipping_rate: product.shippingRate,
                    addons,
                    selectedOptions,
                    modifierInputs: capturedModifierInputs.length > 0 ? capturedModifierInputs : undefined,
                  });
                }}
                disabled={!canAddToCart}
                className={`flex-1 px-6 py-3 rounded-2xl font-semibold transition-colors btn-tactile ${
                  canAddToCart
                    ? "bg-gold text-on-gold hover:bg-gold-light btn-gold-tactile"
                    : "bg-foreground/10 text-foreground/70 cursor-not-allowed"
                }`}
              >
                {isOutOfStock
                  ? "Out of Stock"
                  : hasSellableVariant
                    ? `Add to Cart — $${unitPrice.toFixed(2)}`
                    : "Not Available Online"}
              </button>
              {product.customizable !== false && (
                <Link
                  href={`/customizer?product=${encodeURIComponent(product.id)}&color=${encodeURIComponent(effectiveColor ?? "")}`}
                  className="flex-1 px-6 py-3 rounded-2xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors text-center btn-tactile"
                >
                  Customize This
                </Link>
              )}
            </div>

            {!hasSellableVariant && (
              <p className="text-xs text-foreground/80 mt-3">
                This item is not orderable online — contact us for pricing.
              </p>
            )}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
