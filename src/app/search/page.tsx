"use client";

import { useState, useCallback } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { useProductSearch, type SearchFilters, type SortMode } from "@/hooks/useSearch";
import SearchBar from "@/components/search/search-bar";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export default function SearchPage() {
  const { products, categories, loading: catalogLoading } = useCatalog();
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    categoryId: null,
    colors: [],
    minPrice: null,
    maxPrice: null,
  });
  const [sort, setSort] = useState<SortMode>("relevance");
  const [aiResults, setAiResults] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const results = useProductSearch(products, filters, sort);

  const handleSearch = useCallback(
    (newFilters: SearchFilters, newSort: SortMode) => {
      setFilters(newFilters);
      setSort(newSort);
      setAiResults(null);
      setHasSearched(true);
    },
    []
  );

  const handleAiSearch = useCallback(
    async (query: string) => {
      setAiLoading(true);
      setAiResults(null);
      try {
        const callable = httpsCallable<{ query: string }, { matchedIds: string[]; explanation: string }>(
          functions,
          "aiSearch"
        );
        const result = await callable({ query });
        const data = result.data;
        setAiResults(data.explanation);
        if (data.matchedIds.length > 0) {
          setFilters((prev) => ({ ...prev, query }));
        }
        setHasSearched(true);
      } catch (err) {
        setAiResults(
          err instanceof Error ? `AI search failed: ${err.message}` : "AI search unavailable"
        );
      } finally {
        setAiLoading(false);
      }
    },
    []
  );

  const loading = catalogLoading;

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center mb-8 pt-8 sm:pt-12">
          <h1 className="text-4xl font-bold font-display mb-3">Search Products</h1>
          <p className="text-primary/60 max-w-xl mx-auto">
            Find exactly what you&apos;re looking for. Try natural language like &quot;blue hockey hoodie&quot; or click AI Search for help.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <SearchBar
            categories={categories}
            onSearch={handleSearch}
            onAiSearch={handleAiSearch}
            aiLoading={aiLoading}
          />
        </div>

        {aiResults && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-purple-50 border border-purple-200 rounded-2xl text-sm text-purple-800">
            {aiResults}
          </div>
        )}

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
            <p className="text-primary/50 text-lg mb-2">No products found</p>
            <p className="text-primary/30 text-sm">Try different keywords, or use AI Search for help.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-xs text-primary/40 mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""}
              {filters.query ? ` for "${filters.query}"` : ""}
            </p>
            <div className="tile-grid-sites">
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
