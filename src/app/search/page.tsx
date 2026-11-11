"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCatalog } from "@/hooks/useCatalog";
import { useProductSearch, type SearchFilters, type SortMode } from "@/hooks/useSearch";
import SearchBar from "@/components/search/search-bar";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";
import DensityPicker, { DENSITY_CLASSES, type Density } from "@/components/product/density-picker";

const SORT_MODES: SortMode[] = ["relevance", "price-asc", "price-desc", "name-asc"];

/** Query-string keys this page owns; anything else (utm_*, ref, …) is preserved. */
const SYNCED_PARAMS = ["q", "category", "colors", "sort", "density"];

function readColors(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function SearchContent() {
  const { products, categories, loading: catalogLoading, error, refresh } = useCatalog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const densityParam = Number(searchParams.get("density"));

  // Filter state lives in the URL — the same rule /shop follows, so a filtered
  // view is shareable and the back button works. A query arriving via ?q= (e.g.
  // from the WebSite SearchAction JSON-LD) seeds the search and runs at once.
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get("q") ?? "",
    categoryId: searchParams.get("category"),
    colors: readColors(searchParams.get("colors")),
    minPrice: null,
    maxPrice: null,
  });
  const [sort, setSort] = useState<SortMode>(() => {
    const s = searchParams.get("sort");
    return s && SORT_MODES.includes(s as SortMode) ? (s as SortMode) : "relevance";
  });
  const [density, setDensity] = useState<Density>(
    densityParam >= 2 && densityParam <= 5 ? (densityParam as Density) : 3,
  );
  const [hasSearched, setHasSearched] = useState(() =>
    filters.query.length > 0 || filters.categoryId !== null || filters.colors.length > 0,
  );

  const results = useProductSearch(products, filters, sort);

  const handleSearch = useCallback(
    (newFilters: SearchFilters, newSort: SortMode) => {
      setFilters(newFilters);
      setSort(newSort);
      setHasSearched(true);
    },
    []
  );

  // Keep the URL in sync with the filter state (debounced so typing doesn't
  // spam history entries). The existing query string is mutated, not replaced,
  // so params this page does not own survive.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      for (const key of SYNCED_PARAMS) params.delete(key);
      if (filters.query.trim()) params.set("q", filters.query.trim());
      if (filters.categoryId) params.set("category", filters.categoryId);
      if (filters.colors.length > 0) params.set("colors", filters.colors.join(","));
      if (sort !== "relevance") params.set("sort", sort);
      if (density !== 3) params.set("density", String(density));
      const qs = params.toString();
      // Router.replace re-renders; skipping when the URL already says this is
      // what keeps the effect from looping.
      if (qs === window.location.search.replace(/^\?/, "")) return;
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [filters, sort, density, router]);

  const loading = catalogLoading;

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center mb-8 pt-8 sm:pt-12">
          <h1 className="text-4xl font-bold font-display mb-3">Search Products</h1>
          <p className="text-foreground max-w-xl mx-auto">
            Find exactly what you&apos;re looking for. Filter by category, color, or sort by price.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <SearchBar
            categories={categories}
            filters={filters}
            sort={sort}
            onSearch={handleSearch}
          />
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

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-danger mb-4">Couldn&apos;t load the catalog.</p>
            <button onClick={refresh} className="px-6 py-2.5 rounded-xl btn-tactile btn-primary-tactile">Retry</button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center py-20">
            <p className="text-foreground text-lg mb-2">No products found</p>
            <p className="text-foreground/80 text-sm">Try different keywords or browse the catalog.</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-foreground/80">
                {results.length} result{results.length !== 1 ? "s" : ""}
                {filters.query ? ` for "${filters.query}"` : ""}
              </p>
              <DensityPicker value={density} onChange={setDensity} />
            </div>
            <div className={`grid gap-4 sm:gap-6 grid-cols-1 ${DENSITY_CLASSES[density]}`}>
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </main>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex gap-3">
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
          </div>
        </div>
      </PageLayout>
    }>
      <SearchContent />
    </Suspense>
  );
}
