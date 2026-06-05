"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCatalog } from "@/hooks/useCatalog";
import ProductCard from "@/components/product/product-card";
import ProductDetail from "@/components/product/product-detail";
import { SITE } from "@/lib/content";
import type { SquareCatalogItem } from "@/types";

export default function ShopPage() {
  const { items, categories, loading, error, refresh } = useCatalog();
  const [selectedItem, setSelectedItem] = useState<SquareCatalogItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory) {
      result = result.filter((i) => i.categoryId === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, activeCategory, search]);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt={SITE.name} width={40} height={40} className="rounded-xl" priority />
            <span className="text-lg font-bold font-display hidden sm:inline">{SITE.name}</span>
          </Link>
          <Link
            href="/customizer"
            className="text-sm font-medium px-4 py-2 rounded-xl btn-tactile btn-gold-tactile"
          >
            Customizer
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Hero Bar */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display mb-3">Shop All Products</h1>
          <p className="text-teal/60 max-w-xl mx-auto">
            Browse {items.length} customizable products. Click any item to view details, choose options, and design your own.
          </p>
        </div>

        {/* Search + Categories */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-teal/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                activeCategory === null
                  ? "bg-teal text-white"
                  : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "bg-teal text-white"
                    : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
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
            <button
              onClick={refresh}
              className="px-6 py-2.5 rounded-xl btn-tactile btn-teal-tactile"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-teal/50">
              {search || activeCategory
                ? "No products match your filters."
                : "No products available yet."}
            </p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <>
            <p className="text-xs text-teal/40 mb-4">
              Showing {filteredItems.length} of {items.length} products
            </p>
            <div className="tile-grid-sites">
              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedItem && (
        <ProductDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
