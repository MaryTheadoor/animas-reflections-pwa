"use client";

import { useState, useMemo, useCallback } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";

type SortMode = "default" | "price-asc" | "price-desc" | "name-asc";

interface CategoryNode {
  name: string;
  id?: string;
  children?: CategoryNode[];
}

const CATEGORY_TREE: CategoryNode[] = [
  {
    name: "Bands",
    children: [
      { name: "LITTLE STRANGER FAN BASED FUNDRAISING" },
      { name: "Jordan Branch Music" },
      { name: "GREEN BUDDHA" },
      { name: "GREEN BUDDAH" },
      { name: "Dunphy Stock FAM" },
      { name: "ET Art" },
    ],
  },
  {
    name: "Teams",
    children: [
      { name: "Durango Hockey" },
      { name: "Durango High Hockey" },
      { name: "Durango High School Alpine Ski Team" },
      { name: "Durango Lacrosse" },
      { name: "Durango Roller Girls" },
    ],
  },
  { name: "Women In Aviation" },
  { name: "Custom Designs" },
  { name: "Custom Slaps" },
  { name: "BISCUIT HOCKEY" },
  { name: "I'M OK R U" },
  { name: "Jewelry" },
  { name: "Wood Signs" },
  { name: "Fly High AA Fundraiser" },
  { name: "Fundraiser For Stephanie Glenn's Mom" },
  {
    name: "Apparel Types",
    children: [
      { name: "T-Shirt" },
      { name: "Hoodie" },
      { name: "Tank" },
      { name: "Zip Up Hoodie" },
      { name: "Jacket" },
      { name: "Hat" },
      { name: "Pet Scarf" },
    ],
  },
  {
    name: "Accessories",
    children: [
      { name: "Ornaments" },
      { name: "Glass Cutting Boards" },
      { name: "Neoprene Drink Hugger" },
      { name: "Bottle Opener Key Chain" },
      { name: "Pen / Mobile Phone Stand" },
      { name: "Carpenter Pencil" },
      { name: "XL Gear Bag" },
    ],
  },
];

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "default", label: "Default" },
  { mode: "price-asc", label: "Price: Low → High" },
  { mode: "price-desc", label: "Price: High → Low" },
  { mode: "name-asc", label: "Name: A → Z" },
];

export default function ShopPage() {
  const { items, categories, loading, error, refresh } = useCatalog();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [showBrands, setShowBrands] = useState(true);

  // Build category name → ID map from Square categories or fallback
  const catNameToId = useMemo(() => {
    const map = new Map<string, string>();
    if (categories.length > 0) {
      categories.forEach((c) => map.set(c.name.trim(), c.id));
    }
    return map;
  }, [categories]);

  const getCategoryId = useCallback(
    (name: string) => catNameToId.get(name) ?? null,
    [catNameToId]
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== "All") {
      const catId = getCategoryId(activeCategory);
      if (catId) {
        result = result.filter((i) => i.categoryIds.includes(catId));
      } else {
        const q = activeCategory.toLowerCase();
        result = result.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description && i.description.toLowerCase().includes(q))
        );
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
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
  }, [items, activeCategory, search, sortMode, getCategoryId]);

  const CategoryPill = ({ name, isParent }: { name: string; isParent?: boolean }) => (
    <button
      onClick={() => setActiveCategory(name)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        activeCategory === name
          ? "bg-teal text-white"
          : isParent
            ? "bg-warm-sand text-teal font-bold"
            : "bg-warm-sand/50 text-teal/60 hover:bg-warm-sand"
      }`}
    >
      {name}
    </button>
  );

  const renderCategoryTree = (nodes: CategoryNode[], isChild = false) => (
    <div className={`flex flex-wrap gap-1.5 ${isChild ? "ml-4" : ""}`}>
      {nodes.map((node) => (
        <div key={node.name} className="flex flex-wrap items-center gap-1.5">
          <CategoryPill name={node.name} isParent={!isChild && !!node.children} />
          {node.children && renderCategoryTree(node.children, true)}
        </div>
      ))}
    </div>
  );

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display mb-3">Shop All Products</h1>
          <p className="text-teal/60 max-w-xl mx-auto">
            Browse {items.length} customizable products. Click any item to view details, choose options, and design your own.
          </p>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-teal/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-3 py-2.5 rounded-xl border border-teal/20 bg-white text-sm text-teal focus:border-gold focus:ring-1 focus:ring-gold outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.mode} value={opt.mode}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Categories */}
        <div className="space-y-3 mb-8">
          {/* All + clear — mobile dropdown, desktop pills */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Mobile dropdown */}
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="sm:hidden w-full px-4 py-2.5 rounded-xl border border-teal/20 bg-white text-sm text-teal focus:border-gold focus:ring-1 focus:ring-gold outline-none"
            >
              <option value="All">All Products ({items.length})</option>
              <optgroup label="Categories">
                {CATEGORY_TREE.flatMap((n) => [n.name, ...(n.children?.map((c) => c.name) ?? [])]).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </optgroup>
            </select>
            {/* Desktop pills */}
            <div className="hidden sm:flex flex-wrap gap-1.5 items-center w-full">
              <button
                onClick={() => setActiveCategory("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === "All" ? "bg-gold text-white" : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
                }`}
              >
                All
              </button>
              {activeCategory !== "All" && (
                <span className="text-xs text-teal/40 ml-2">
                  {activeCategory} ({filteredItems.length})
                </span>
              )}
            </div>
          </div>

          {/* Desktop category sections */}
          <div className="hidden sm:block space-y-3">
            <div>
              <button onClick={() => setShowBrands(!showBrands)}
                className="flex items-center gap-1 text-xs font-bold font-display text-teal mb-2 hover:text-gold transition-colors">
                {showBrands ? "−" : "+"} Categories
              </button>
              {showBrands && renderCategoryTree(CATEGORY_TREE)}
            </div>
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
            <button onClick={refresh} className="px-6 py-2.5 rounded-xl btn-tactile btn-teal-tactile">Retry</button>
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-teal/50">{search || activeCategory !== "All" ? "No products match your filters." : "No products available yet."}</p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <>
            <p className="text-xs text-teal/40 mb-4">
              Showing {filteredItems.length} of {items.length} products
              {activeCategory !== "All" ? ` in "${activeCategory}"` : ""}
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
