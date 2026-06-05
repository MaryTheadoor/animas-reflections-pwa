"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PlaceholderImage from "@/components/ui/placeholder-image";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useCart } from "@/context/cart-context";
import PageLayout from "@/components/layout/page-layout";
import type { SquareCatalogItem } from "@/types";

interface DesignAsset {
  id: string;
  name: string;
  category: string;
  image_url: string;
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
  const { addItem } = useCart();

  const [product, setProduct] = useState<SquareCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<DesignAsset[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [selectedDesign, setSelectedDesign] = useState<DesignAsset | null>(null);
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!productId) { setLoading(false); return; }

    httpsCallable<object, { items: SquareCatalogItem[] }>(functions, "fetchSquareCatalog")({})
      .then((r) => {
        const found = (r.data.items ?? []).find((i) => i.id === productId);
        setProduct(found ?? null);
      })
      .finally(() => setLoading(false));

    getDoc(doc(db, "designs", "catalog"))
      .then((snap) => {
        if (snap.exists()) {
          setDesigns((snap.data() as { items?: DesignAsset[] }).items ?? []);
        }
      })
      .catch(() => {});
  }, [productId]);

  const variation = product?.variations[selectedVariation];
  const filteredDesigns = useMemo(() => {
    if (!product) return designs;
    // Filter designs that match product categories
    return designs.filter((d) => {
      const cat = d.category.toLowerCase();
      const name = product.name.toLowerCase();
      return name.includes(cat) || cat.includes("all") || designs.length <= 10;
    });
  }, [designs, product]);

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

  const price = variation?.price ?? 0;
  const imageUrl = product.image_url ?? "";

  return (
    <PageLayout>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        {/* Breadcrumb */}
        <div className="text-xs text-teal/40 mb-4">
          <Link href="/shop" className="hover:text-gold">Shop</Link>
          <span className="mx-1">/</span>
          <span className="text-teal/60">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Mockup / Image */}
          <div className="relative aspect-square bg-warm-sand rounded-2xl overflow-hidden shadow-card">
            {imageUrl ? (
              <Image src={imageUrl} alt={product.name} fill className="object-contain p-4" sizes="(max-width:768px) 100vw, 50vw" />
            ) : (
              <PlaceholderImage />
            )}
            {/* Design overlay if selected */}
            {selectedDesign && (
              <Image
                src={selectedDesign.image_url}
                alt={selectedDesign.name}
                width={200}
                height={200}
                className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[50%] h-auto opacity-90 mix-blend-multiply pointer-events-none"
              />
            )}
            {/* Text overlay */}
            {customText && (
              <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-xl font-bold text-teal/60 pointer-events-none">
                {customText}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-2">{product.name}</h1>
            {product.description && (
              <div
                className="text-sm text-teal/60 mb-4 leading-relaxed line-clamp-4"
                dangerouslySetInnerHTML={{
                  __html: product.description.replace(/<[^>]*>/g, " ").substring(0, 400),
                }}
              />
            )}

            {/* Price */}
            <p className="text-3xl font-bold text-gold mb-6">
              ${price.toFixed(2)}
              {product.variations.length > 1 && (
                <span className="text-sm font-normal text-teal/50 ml-2">
                  Starting at ${Math.min(...product.variations.map((v) => v.price)).toFixed(2)}
                </span>
              )}
            </p>

            {/* Variation Picker */}
            {product.variations.length > 1 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-teal block mb-2">Style / Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.variations.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        i === selectedVariation
                          ? "bg-teal text-white btn-tactile btn-teal-tactile"
                          : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
                      }`}
                    >
                      {v.name || `Option ${i + 1}`}
                      {v.price > 0 && <span className="ml-1 opacity-70">${v.price.toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pre-designed Graphics */}
            {filteredDesigns.length > 0 && (
              <div className="mb-6">
                <span className="text-xs font-medium text-teal block mb-2">
                  Choose a Design {selectedDesign ? `— "${selectedDesign.name}" selected` : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDesign(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                      !selectedDesign ? "bg-teal text-white" : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
                    }`}
                  >
                    None (Custom)
                  </button>
                  {filteredDesigns.slice(0, 12).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDesign(d)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        selectedDesign?.id === d.id
                          ? "bg-teal text-white"
                          : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
                      }`}
                    >
                      <Image src={d.image_url} alt={d.name} width={20} height={20} className="rounded" />
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Text */}
            <div className="mb-6">
              <label className="text-xs font-medium text-teal block mb-1">
                Name / Number (optional)
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. SMITH 42"
                className="w-full max-w-xs px-4 py-2 rounded-xl border border-teal/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
            </div>

            {/* Add to Cart */}
            <button
              onClick={() => {
                if (!variation) return;
                addItem({
                  id: `${product.id}_${Date.now()}`,
                  product_id: product.id,
                  variation_id: variation.id,
                  name: `${product.name} — ${variation.name}`,
                  base_price: price,
                  quantity: 1,
                  selected_view: "front",
                  design_url: selectedDesign?.image_url,
                  design_text: customText || undefined,
                  addons: [],
                });
              }}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
            >
              Add to Cart — ${price.toFixed(2)}
            </button>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
