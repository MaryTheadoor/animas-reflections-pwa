"use client";

import { useState, useMemo } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";
import { BreadcrumbJsonLd } from "@/components/layout/json-ld";
import { PRODUCT_TYPE_LABELS } from "@/types";
import { stripTags } from "@/lib/html-utils";
import DensityPicker, { DENSITY_CLASSES, type Density } from "@/components/product/density-picker";

type SortMode = "default" | "price-asc" | "price-desc" | "name-asc";
type BrowseMode = "design" | "type";

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "default", label: "Default" },
  { mode: "price-asc", label: "Price: Low to High" },
  { mode: "price-desc", label: "Price: High to Low" },
  { mode: "name-asc", label: "Name: A to Z" },
];

export default function ShopPage() {
  const { products, categories, loading, error, refresh } = useCatalog();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeType, setActiveType] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("design");
  const [density, setDensity] = useState<Density>(3);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (browseMode === "type" && activeType !== "All") {
      // By Product Type: filter on productType (apparel, sticker, sign, ...)
      result = result.filter((p) => p.productType === activeType);
    } else if (browseMode === "design" && activeCategory !== "All") {
      // By Design / Brand: filter on the design category
      const catId = categories.find((c) => c.id === activeCategory)?.id;
      if (catId) {
        result = result.filter((p) => p.categoryId === catId);
      } else {
        const q = activeCategory.toLowerCase();
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description ? stripTags(p.description).toLowerCase() : "").includes(q)
        );
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ? stripTags(p.description).toLowerCase() : "").includes(q)
      );
    }
    if (sortMode === "price-asc") {
      result = [...result].sort((a, b) => {
        const pricesA = (a.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0); const pa = pricesA.length > 0 ? Math.min(...pricesA) : Number.MAX_VALUE;
        const pricesB = (b.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0); const pb = pricesB.length > 0 ? Math.min(...pricesB) : Number.MAX_VALUE;
        return pa - pb;
      });
    } else if (sortMode === "price-desc") {
      result = [...result].sort((a, b) => {
        const pricesA = (a.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0); const pa = pricesA.length > 0 ? Math.min(...pricesA) : 0;
        const pricesB = (b.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0); const pb = pricesB.length > 0 ? Math.min(...pricesB) : 0;
        return pb - pa;
      });
    } else if (sortMode === "name-asc") {
      result = [...result].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    return result;
  }, [products, browseMode, activeCategory, activeType, search, sortMode, categories]);

  const activeLabel =
    browseMode === "type"
      ? activeType === "All"
        ? "All Types"
        : PRODUCT_TYPE_LABELS[activeType as keyof typeof PRODUCT_TYPE_LABELS] ?? activeType
      : activeCategory === "All"
        ? "All Products"
        : categories.find((c) => c.id === activeCategory)?.name ?? activeCategory;

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }]} />
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display mb-3">Shop All Products</h1>
          <p className="text-primary/60 max-w-xl mx-auto">
            Browse {products.length} products. Click any item to view details and choose options.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-3 py-2.5 rounded-xl border border-primary/20 bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.mode} value={opt.mode}>{opt.label}</option>
            ))}
          </select>

          {/* Tile density control */}
          <div className="ml-auto sm:ml-0">
            <DensityPicker value={density} onChange={setDensity} />
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-warm-sand/50 rounded-full p-1 gap-1">
            <button
              onClick={() => { setBrowseMode("design"); setActiveCategory("All"); setActiveType("All"); }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                browseMode === "design" ? "bg-primary text-white" : "text-primary/60 hover:text-primary"
              }`}
            >
              By Design / Brand
            </button>
            <button
              onClick={() => { setBrowseMode("type"); setActiveCategory("All"); setActiveType("All"); }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                browseMode === "type" ? "bg-primary text-white" : "text-primary/60 hover:text-primary"
              }`}
            >
              By Product Type
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Mobile select — shows design categories or product types per mode */}
            {browseMode === "design" ? (
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="sm:hidden w-full px-4 py-2.5 rounded-xl border border-primary/20 bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
              >
                <option value="All">All Products ({products.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={activeType}
                onChange={(e) => setActiveType(e.target.value)}
                className="sm:hidden w-full px-4 py-2.5 rounded-xl border border-primary/20 bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
              >
                <option value="All">All Types ({products.length})</option>
                {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
            <div className="hidden sm:flex flex-wrap gap-1.5 items-center w-full">
              <button
                onClick={() => browseMode === "design" ? setActiveCategory("All") : setActiveType("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  (browseMode === "design" ? activeCategory : activeType) === "All" ? "bg-gold text-white" : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                }`}
              >
                All
              </button>
              {(browseMode === "design" ? activeCategory : activeType) !== "All" && (
                <span className="text-xs text-primary/40 ml-2">
                  {activeLabel} ({filteredProducts.length})
                </span>
              )}
            </div>
          </div>
          {/* Desktop pills — design categories or product types per mode */}
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {browseMode === "design"
              ? categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id === activeCategory ? "All" : cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeCategory === cat.id
                        ? "bg-primary text-white"
                        : "bg-warm-sand/50 text-primary/60 hover:bg-warm-sand"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))
              : Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setActiveType(activeType === value ? "All" : value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeType === value
                        ? "bg-primary text-white"
                        : "bg-warm-sand/50 text-primary/60 hover:bg-warm-sand"
                    }`}
                  >
                    {label}
                  </button>
                ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex gap-3">
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={refresh} className="px-6 py-2.5 rounded-xl btn-tactile btn-primary-tactile">Retry</button>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-primary/50">{search || (browseMode === "design" ? activeCategory : activeType) !== "All" ? "No products match your filters." : "No products available yet."}</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <>
            <p className="text-xs text-primary/40 mb-4">
              Showing {filteredProducts.length} of {products.length} products
              {(browseMode === "design" ? activeCategory : activeType) !== "All" ? ` in "${activeLabel}"` : ""}
            </p>
            <div className={`grid gap-4 sm:gap-6 grid-cols-1 ${DENSITY_CLASSES[density]}`}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </main>
    </PageLayout>
  );
}
