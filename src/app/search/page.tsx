"use client";

import { useState, useCallback } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { useProductSearch, type SearchFilters, type SortMode } from "@/hooks/useSearch";
import SearchBar from "@/components/search/search-bar";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";
import DensityPicker, { DENSITY_CLASSES, type Density } from "@/components/product/density-picker";

export default function SearchPage() {
  const { products, categories, loading: catalogLoading } = useCatalog();
  const [density, setDensity] = useState<Density>(3);
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    categoryId: null,
    colors: [],
    minPrice: null,
    maxPrice: null,
  });
  const [sort, setSort] = useState<SortMode>("relevance");
  const [hasSearched, setHasSearched] = useState(false);

  const results = useProductSearch(products, filters, sort);

  const handleSearch = useCallback(
    (newFilters: SearchFilters, newSort: SortMode) => {
      setFilters(newFilters);
      setSort(newSort);
      setHasSearched(true);
    },
    []
  );

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

        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-20">
            <p className="text-foreground text-lg mb-2">No products found</p>
            <p className="text-foreground/80 text-sm">Try different keywords or browse the catalog.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
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
