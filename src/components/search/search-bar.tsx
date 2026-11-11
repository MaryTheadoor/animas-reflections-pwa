"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
import type { SearchFilters, SortMode } from "@/hooks/useSearch";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface SearchBarProps {
  categories: { id: string; name: string }[];
  /** The applied filters. The page owns them so they can live in the URL. */
  filters: SearchFilters;
  sort: SortMode;
  onSearch: (filters: SearchFilters, sort: SortMode) => void;
}

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "relevance", label: "Relevance" },
  { mode: "price-asc", label: "Price: Low → High" },
  { mode: "price-desc", label: "Price: High → Low" },
  { mode: "name-asc", label: "Name: A → Z" },
];

export default function SearchBar({
  categories,
  filters,
  sort,
  onSearch,
}: SearchBarProps) {
  const siteConfig = useSiteConfig();
  // The box keeps a draft so typing does not fire a search per keystroke, but
  // it FOLLOWS the applied query: /search?q=a → ?q=b used to keep showing "a"
  // because the old initialQuery prop was read exactly once.
  const [query, setQuery] = useState(filters.query);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow an applied query that changed underneath (deep link, back button, submitted search)
    setQuery(filters.query);
  }, [filters.query]);

  const apply = useCallback(
    (next: Partial<SearchFilters>, nextSort: SortMode = sort) => {
      onSearch({ ...filters, ...next }, nextSort);
    },
    [filters, sort, onSearch]
  );

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      apply({ query });
    },
    [apply, query]
  );

  // Filter and sort changes apply immediately. Setting local state and waiting
  // for the Search button made every one of these controls look dead.
  const toggleColor = (color: string) => {
    const colors = filters.colors.includes(color)
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    apply({ query, colors });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/70"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-primary/20 bg-white focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none text-sm transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-sm shrink-0"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showFilters ? "bg-primary text-white" : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
          }`}
        >
          {showFilters ? "Hide Filters" : "Filters"}
        </button>

        <select
          value={sort}
          onChange={(e) => apply({ query }, e.target.value as SortMode)}
          aria-label="Sort results"
          className="px-3 py-1.5 rounded-full border border-primary/20 bg-white text-xs text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.mode} value={opt.mode}>{opt.label}</option>
          ))}
        </select>
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 bg-white/80 rounded-2xl border border-warm-sand">
          <div>
            <span className="block text-xs font-medium text-primary mb-2">Category</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => apply({ query, categoryId: null })}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !filters.categoryId ? "bg-gold-deep text-white" : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    apply({ query, categoryId: filters.categoryId === cat.id ? null : cat.id })
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.categoryId === cat.id
                      ? "bg-primary text-white"
                      : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-primary mb-2">
              Colors
              {filters.colors.length > 0 && ` (${filters.colors.length} selected)`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(siteConfig.catalog_options?.colors ?? []).map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => toggleColor(color.name.toLowerCase())}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    filters.colors.includes(color.name.toLowerCase())
                      ? "bg-primary text-white"
                      : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                  }`}
                >
                  {color.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
