"use client";

import { useMemo } from "react";
import type { SquareCatalogItem } from "@/types";

export type SortMode = "relevance" | "price-asc" | "price-desc" | "name-asc";

export interface SearchFilters {
  query: string;
  categoryId: string | null;
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

function fuzzyScore(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 60;
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(q)) return 40;
  }
  if (lower.includes(q.slice(0, Math.ceil(q.length * 0.6)))) return 20;
  return 0;
}

export function searchProducts(
  items: SquareCatalogItem[],
  filters: SearchFilters,
  sort: SortMode = "relevance"
): SquareCatalogItem[] {
  const q = filters.query.trim().toLowerCase();

  let scored = items.map((item) => {
    let score = 0;

    if (q) {
      score += fuzzyScore(item.name, q) * 3;
      score += fuzzyScore(item.description, q);
      const tags = item.tags ?? [];
      for (const tag of tags) {
        score += fuzzyScore(tag, q) * 2;
      }
    }

    if (filters.categoryId && item.categoryIds.includes(filters.categoryId)) {
      score += 50;
    }

    if (filters.colors.length > 0) {
      const itemColors = (item.colors ?? []).map((c) => c.toLowerCase());
      if (filters.colors.every((c) => itemColors.includes(c.toLowerCase()))) {
        score += 30;
      }
    }

    return { item, score };
  });

  if (q) {
    scored = scored.filter((s) => s.score > 0);
  }

  if (filters.categoryId) {
    const catId = filters.categoryId;
    scored = scored.filter((s) => s.item.categoryIds.includes(catId) || s.score >= 50);
  }

  if (filters.colors.length > 0) {
    scored = scored.filter((s) => {
      const itemColors = (s.item.colors ?? []).map((c) => c.toLowerCase());
      return filters.colors.every((c) => itemColors.includes(c.toLowerCase()));
    });
  }

  if (filters.minPrice !== null) {
    scored = scored.filter((s) =>
      Math.min(...s.item.variations.map((v) => v.price)) >= filters.minPrice!
    );
  }
  if (filters.maxPrice !== null) {
    scored = scored.filter((s) =>
      Math.min(...s.item.variations.map((v) => v.price)) <= filters.maxPrice!
    );
  }

  if (sort === "price-asc") {
    scored.sort((a, b) => {
      const pa = Math.min(...(a.item.variations ?? []).map((v) => v.price ?? 0).concat(0));
      const pb = Math.min(...(b.item.variations ?? []).map((v) => v.price ?? 0).concat(0));
      return pa - pb;
    });
  } else if (sort === "price-desc") {
    scored.sort((a, b) => {
      const pa = Math.min(...(a.item.variations ?? []).map((v) => v.price ?? 0).concat(0));
      const pb = Math.min(...(b.item.variations ?? []).map((v) => v.price ?? 0).concat(0));
      return pb - pa;
    });
  } else if (sort === "name-asc") {
    scored.sort((a, b) => (a.item.name ?? "").localeCompare(b.item.name ?? ""));
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  return scored.map((s) => s.item);
}

export function useProductSearch(
  items: SquareCatalogItem[],
  filters: SearchFilters,
  sort: SortMode = "relevance"
) {
  return useMemo(() => searchProducts(items, filters, sort), [items, filters, sort]);
}

export const AVAILABLE_COLORS = [
  "black", "white", "gray", "navy", "blue", "red", "green",
  "sage", "cream", "heather", "ash", "charcoal",
] as const;
