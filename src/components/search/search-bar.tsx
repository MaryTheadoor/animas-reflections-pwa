"use client";

import { useState, useCallback, type FormEvent } from "react";
import type { SearchFilters, SortMode } from "@/hooks/useSearch";
import { AVAILABLE_COLORS } from "@/hooks/useSearch";

interface SearchBarProps {
  categories: { id: string; name: string }[];
  onSearch: (filters: SearchFilters, sort: SortMode) => void;
  onAiSearch?: (query: string) => void;
  aiLoading?: boolean;
  initialQuery?: string;
}

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "relevance", label: "Relevance" },
  { mode: "price-asc", label: "Price: Low → High" },
  { mode: "price-desc", label: "Price: High → Low" },
  { mode: "name-asc", label: "Name: A → Z" },
];

export default function SearchBar({
  categories,
  onSearch,
  onAiSearch,
  aiLoading,
  initialQuery = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("relevance");
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      onSearch(
        {
          query,
          categoryId,
          colors: selectedColors,
          minPrice: null,
          maxPrice: null,
        },
        sort
      );
    },
    [query, categoryId, selectedColors, sort, onSearch]
  );

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleAiSearch = () => {
    if (onAiSearch && query.trim()) {
      onAiSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-teal/30"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search products... or try "red hoodies under $50"'
            aria-label="Search products"
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-teal/20 bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none text-sm transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-sm shrink-0"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showFilters ? "bg-teal text-white" : "bg-warm-sand/50 text-teal/60 hover:bg-warm-sand"
          }`}
        >
          {showFilters ? "Hide Filters" : "Filters"}
        </button>

        <select
          value={sort}
          onChange={(e) => {
            const newSort = e.target.value as SortMode;
            setSort(newSort);
          }}
          aria-label="Sort results"
          className="px-3 py-1.5 rounded-full border border-teal/20 bg-white text-xs text-teal focus:border-gold focus:ring-1 focus:ring-gold outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.mode} value={opt.mode}>{opt.label}</option>
          ))}
        </select>

        {onAiSearch && query.trim() && (
          <button
            type="button"
            onClick={handleAiSearch}
            disabled={aiLoading}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {aiLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Thinking...
              </>
            ) : (
              <>AI Search</>
            )}
          </button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 bg-white/80 rounded-2xl border border-warm-sand">
          <div>
            <span className="block text-xs font-medium text-teal mb-2">Category</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !categoryId ? "bg-gold text-white" : "bg-warm-sand/50 text-teal/60 hover:bg-warm-sand"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryId === cat.id
                      ? "bg-teal text-white"
                      : "bg-warm-sand/50 text-teal/60 hover:bg-warm-sand"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-teal mb-2">
              Colors
              {selectedColors.length > 0 && ` (${selectedColors.length} selected)`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleColor(color)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    selectedColors.includes(color)
                      ? "bg-teal text-white"
                      : "bg-warm-sand/50 text-teal/60 hover:bg-warm-sand"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
