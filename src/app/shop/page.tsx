"use client";

import { useState, useMemo, useCallback } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";

type SortMode = "default" | "price-asc" | "price-desc" | "name-asc";

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "default", label: "Default" },
  { mode: "price-asc", label: "Price: Low to High" },
  { mode: "price-desc", label: "Price: High to Low" },
  { mode: "name-asc", label: "Name: A to Z" },
];

export default function ShopPage() {
  const { items, categories, loading, error, refresh } = useCatalog();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const catNameToId = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.name.trim().toLowerCase(), c.id));
    return map;
  }, [categories]);

  const getCategoryId = useCallback(
    (name: string) => catNameToId.get(name.toLowerCase().trim()) ?? null,
    [catNameToId]
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== "All") {
      const catId = getCategoryId(activeCategory);
      if (catId) {
        result = result.filter((i) => i.categoryIds.includes(catId));
      } else {
        const isSyntheticId = categories.some((c) => c.id === activeCategory);
        if (isSyntheticId) {
          result = result.filter((i) => i.categoryIds.includes(activeCategory));
        } else {
          const q = activeCategory.toLowerCase();
          result = result.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              (i.description?.toLowerCase() ?? "").includes(q)
          );
        }
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description?.toLowerCase() ?? "").includes(q)
      );
    }
    if (sortMode === "price-asc") {
      result = [...result].sort((a, b) => Math.min(...a.variations.map((v) => v.price)) - Math.min(...b.variations.map((v) => v.price)));
    } else if (sortMode === "price-desc") {
      result = [...result].sort((a, b) => Math.min(...b.variations.map((v) => v.price)) - Math.min(...a.variations.map((v) => v.price)));
    } else if (sortMode === "name-asc") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [items, activeCategory, search, sortMode, getCategoryId, categories]);

  const activeLabel =
    activeCategory === "All"
      ? "All Products"
      : categories.find((c) => c.id === activeCategory)?.name ??
        categories.find((c) => c.name === activeCategory)?.name ??
        activeCategory;

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display mb-3">Shop All Products</h1>
          <p className="text-primary/60 max-w-xl mx-auto">
            Browse {items.length} products. Click any item to view details and choose options.
          </p>
        </div>

        {/* Search + Sort */}
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
        </div>

        {/* Categories — dynamic from Firestore/Square */}
        <div className="space-y-3 mb-8">
          <div className="flex flex-wrap gap-1.5 items-center">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="sm:hidden w-full px-4 py-2.5 rounded-xl border border-primary/20 bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
            >
              <option value="All">All Products ({items.length})</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <div className="hidden sm:flex flex-wrap gap-1.5 items-center w-full">
              <button
                onClick={() => setActiveCategory("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === "All" ? "bg-gold text-white" : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                }`}
              >
                All
              </button>
              {activeCategory !== "All" && (
                <span className="text-xs text-primary/40 ml-2">
                  {activeLabel} ({filteredItems.length})
                </span>
              )}
            </div>
          </div>
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {categories.map((cat) => (
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
            ))}
          </div>
        </div>

        {/* Content */}
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

        {!loading && !error && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-primary/50">{search || activeCategory !== "All" ? "No products match your filters." : "No products available yet."}</p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <>
            <p className="text-xs text-primary/40 mb-4">
              Showing {filteredItems.length} of {items.length} products
              {activeCategory !== "All" ? ` in "${activeLabel}"` : ""}
            </p>
            <div className="tile-grid-sites">
              {filteredItems.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
    </PageLayout>
  );
}
