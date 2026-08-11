"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PlaceholderImage from "@/components/ui/placeholder-image";
import { useCatalog, getProductImageUrl } from "@/hooks/useCatalog";
import { sanitizeHTML } from "@/lib/html-utils";
import { useCart } from "@/context/cart-context";
import PageLayout from "@/components/layout/page-layout";
import { BreadcrumbJsonLd } from "@/components/layout/json-ld";

function ProductJsonLd({
  name,
  description,
  imageUrl,
  price,
  productId,
  sku,
}: {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  productId: string;
  sku: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description.replace(/<[^>]*>/g, " ").substring(0, 300),
    image: imageUrl || "https://www.animasreflections.com/logo.png",
    sku,
    offers: {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `https://www.animasreflections.com/product?id=${productId}`,
    },
    brand: {
      "@type": "Brand",
      name: "Animas Reflections",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
  const { products, loading } = useCatalog();
  const { addItem } = useCart();

  const product = productId ? products.find((p) => p.id === productId) ?? null : null;
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [customText, setCustomText] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>();

  const variant = product?.variants[selectedVariant];

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

  if (!product) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold font-display mb-4">Product Not Found</h1>
          <Link href="/shop" className="px-6 py-3 bg-gold text-white rounded-2xl font-semibold btn-tactile btn-gold-tactile">
            Browse Products
          </Link>
        </div>
      </PageLayout>
    );
  }

  const price = variant?.price ?? 0;
  const imageUrl = getProductImageUrl(product);
  // The displayed color falls back to the product's first color until the
  // customer picks one; a stale pick from a previously viewed product is
  // ignored (the product id check resets it automatically).
  const effectiveColor =
    product && selectedColor && product.colors.includes(selectedColor) ? selectedColor : product?.colors?.[0];
  // Gated by productAddons so the Name/Number field only shows when the
  // personalization add-on is enabled per product (undefined = site defaults).
  const showPersonalization = product.productAddons === undefined || product.productAddons.some((a) => a.id === "personalization");

  return (
    <PageLayout>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        {/* JSON-LD Structured Data */}
        <ProductJsonLd
          name={product.name}
          description={product.description}
          imageUrl={imageUrl}
          price={price}
          productId={product.id}
          sku={variant?.sku || product.id}
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
        <div className="text-xs text-primary/40 mb-4">
          <Link href="/shop" className="hover:text-gold">Shop</Link>
          <span className="mx-1">/</span>
          <span className="text-primary/60">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Mockup / Image */}
          <div className="relative aspect-square bg-warm-sand rounded-2xl overflow-hidden shadow-card">
            {imageUrl ? (
              <Image src={imageUrl} alt={product.name} fill className="object-contain p-4" sizes="(max-width:768px) 100vw, 50vw" />
            ) : (
              <PlaceholderImage />
            )}
            {/* Text overlay — only when personalization is on for this product */}
            {showPersonalization && customText && (
              <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-xl font-bold text-primary/60 pointer-events-none">
                {customText}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-2">{product.name}</h1>
            {product.description && (() => {
              const stripped = product.description.replace(/<[^>]*>/g, " ");
              const isLong = stripped.length > 200;
              const hasHTML = /<[a-z][\s\S]*?>/i.test(product.description);
              // Rich formatting shows immediately for short descriptions; long
              // ones keep the collapsed plain-text preview until expanded.
              const showRich = hasHTML && (descExpanded || !isLong);
              return (
                <div className="mb-4">
                  <div className={`text-sm text-primary/60 leading-relaxed ${!showRich && isLong ? "line-clamp-3" : ""}`}>
                    {showRich ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(product.description) }} className="rich-desc" />
                    ) : (
                      <p>{stripped}</p>
                    )}
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-gold hover:text-gold-light mt-1 transition-colors"
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
                  <span className="text-[10px] font-medium text-primary/40 uppercase tracking-wider block mb-1.5">Specifications</span>
                  <div className="flex flex-wrap gap-2 text-xs text-primary/60">
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

            {/* Price */}
            <p className="text-3xl font-bold text-gold mb-6">
              ${price.toFixed(2)}
              {product.variants.length > 1 && (
                <span className="text-sm font-normal text-primary/50 ml-2">
                  Starting at ${Math.min(...product.variants.map((v) => v.price)).toFixed(2)}
                </span>
              )}
            </p>

            {/* Variant Picker */}
            {product.variants.length > 1 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-primary block mb-2">Style / Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        i === selectedVariant
                          ? "bg-primary text-white btn-tactile btn-primary-tactile"
                          : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                      }`}
                    >
                      {v.name || `Option ${i + 1}`}
                      {v.price > 0 && <span className="ml-1 opacity-70">${v.price.toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color — shown when the product has garment colors configured */}
            {product.colors.length > 0 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-primary block mb-2">Color</span>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => {
                    const tint = product.colorTints?.[color];
                    const swatch = tint || (/^#[0-9a-f]{6}$/i.test(color) ? color : "#cccccc");
                    const isActive = effectiveColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                          isActive
                            ? "bg-primary text-white"
                            : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
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
                  if (!variant) return;
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
                    design_text: showPersonalization ? (customText || undefined) : undefined,
                    selected_color: effectiveColor,
                    shipping_rate: product.shippingRate,
                    addons: [],
                  });
                }}
                className="flex-1 px-6 py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
              >
                Add to Cart — ${price.toFixed(2)}
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
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
