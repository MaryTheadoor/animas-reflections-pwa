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
    name: "Sub Brands",
    children: [
      { id: "BISCUIT_HOCKEY", name: "Biscuit Hockey" },
      { id: "I_M_OK_R_U", name: "I'M OK R U" },
    ],
  },
  {
    name: "Teams & Sports",
    children: [
      { id: "Durango_Lacrosse", name: "Durango Lacrosse" },
      { id: "Durango_Hockey", name: "Durango Hockey" },
      { id: "Durango_High_School_Alpine_Ski_Team", name: "Alpine Ski Team" },
      { id: "Durango_Roller_Girls", name: "Roller Girls" },
    ],
  },
  {
    name: "Bands & Music",
    children: [
      { id: "LITTLE_STRANGER", name: "LITTLE STRANGER" },
      { id: "Jordan_Branch_Music", name: "Jordan Branch Music" },
      { id: "GREEN_BUDDHA", name: "GREEN BUDDHA" },
      { id: "Dunphy_Stock_FAM", name: "Dunphy Stock FAM" },
      { id: "ET_Art", name: "ET Art" },
      { id: "Fly_High_AA_Fundraiser", name: "Fly High AA" },
      { id: "Women_In_Aviation", name: "Women In Aviation" },
    ],
  },
  {
    name: "Accessories & More",
    children: [
      { id: "Jewelry", name: "Jewelry" },
      { id: "Wood_Signs", name: "Wood Signs" },
      { id: "Ornaments", name: "Ornaments" },
      { id: "Glass_Cutting_Boards", name: "Glass Cutting Boards" },
      { id: "Neoprene_Drink_Hugger", name: "Drink Huggers" },
      { id: "Custom_Slaps", name: "Custom Slaps" },
      { id: "Pet_Scarf", name: "Pet Scarves" },
      { id: "Hat", name: "Hats" },
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
        const isSyntheticId = categories.some((c) => c.id === activeCategory);
        if (isSyntheticId) {
          result = result.filter((i) => i.categoryIds.includes(activeCategory));
        } else {
          const q = activeCategory.toLowerCase();
          result = result.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              (i.description && i.description.toLowerCase().includes(q))
          );
        }
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
  }, [items, activeCategory, search, sortMode, getCategoryId, categories]);

  const CategoryPill = ({ name, catId, isParent }: { name: string; catId?: string; isParent?: boolean }) => (
    <button
      onClick={() => setActiveCategory(catId ?? name)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        activeCategory === (catId ?? name)
          ? "bg-primary text-white"
          : isParent
            ? "bg-warm-sand text-primary font-bold"
            : "bg-warm-sand/50 text-primary/60 hover:bg-warm-sand"
      }`}
    >
      {name}
    </button>
  );

  const renderCategoryTree = (nodes: CategoryNode[], isChild = false) => (
    <div className={`flex flex-wrap gap-1.5 ${isChild ? "ml-4" : ""}`}>
      {nodes.map((node) => (
        <div key={node.name} className="flex flex-wrap items-center gap-1.5">
          <CategoryPill name={node.name} catId={node.id} isParent={!isChild && !!node.children} />
          {node.children && renderCategoryTree(node.children, true)}
        </div>
      ))}
    </div>
  );

  const getActiveLabel = () => {
    if (activeCategory === "All") return "All Products";
    const findNode = (nodes: CategoryNode[]): string | null => {
      for (const n of nodes) {
        if ((n.id ?? n.name) === activeCategory) return n.name;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(CATEGORY_TREE) ?? activeCategory;
  };

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display mb-3">Shop All Products</h1>
          <p className="text-primary/60 max-w-xl mx-auto">
            Browse {items.length} customizable products. Click any item to view details, choose options, and design your own.
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

        {/* Categories */}
        <div className="space-y-3 mb-8">
          {/* All + clear — mobile dropdown, desktop pills */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Mobile dropdown */}
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="sm:hidden w-full px-4 py-2.5 rounded-xl border border-primary/20 bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
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
                  activeCategory === "All" ? "bg-gold text-white" : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                }`}
              >
                All
              </button>
              {activeCategory !== "All" && (
                <span className="text-xs text-primary/40 ml-2">
                  {getActiveLabel()} ({filteredItems.length})
                </span>
              )}
            </div>
          </div>

          {/* Desktop category sections */}
          <div className="hidden sm:block space-y-3">
            <div>
              <button onClick={() => setShowBrands(!showBrands)}
                className="flex items-center gap-1 text-xs font-bold font-display text-primary mb-2 hover:text-gold transition-colors">
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
              {activeCategory !== "All" ? ` in "${getActiveLabel()}"` : ""}
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
