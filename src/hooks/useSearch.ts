"use client";

import { useMemo } from "react";
import type { ManagedProduct } from "@/types";
import { stripTags } from "@/lib/html-utils";

export type SortMode = "relevance" | "price-asc" | "price-desc" | "name-asc";

export interface SearchFilters {
  query: string;
  categoryId: string | null;
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

// Fuzzy text matching with weighted scoring:
// - Exact match: 100, prefix match: 80, contains: 60, word prefix: 40, partial: 20
// - Product name matches are weighted 3x (most relevant)
// - Tag and design name matches are weighted 2x
// - Category match adds a flat +50 bonus
// - Color match adds a flat +30 bonus
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
  products: ManagedProduct[],
  filters: SearchFilters,
  sort: SortMode = "relevance"
): ManagedProduct[] {
  const q = filters.query.trim().toLowerCase();

  let scored = products.map((product) => {
    let score = 0;

    if (q) {
      score += fuzzyScore(product.name, q) * 3;
      score += fuzzyScore(stripTags(product.description), q);
      const tags = product.tags ?? [];
      for (const tag of tags) {
        score += fuzzyScore(tag, q) * 2;
      }
      // Index design asset names for design-based search
      const designAssets = product.designAssets ?? [];
      for (const asset of designAssets) {
        score += fuzzyScore(asset.name, q) * 2;
        score += fuzzyScore(asset.category, q);
      }
    }

    if (filters.categoryId && product.categoryId === filters.categoryId) {
      score += 50;
    }

    if (filters.colors.length > 0) {
      const productColors = (product.colors ?? []).map((c) => c.toLowerCase());
      if (filters.colors.every((c) => productColors.includes(c.toLowerCase()))) {
        score += 30;
      }
    }

    return { product, score };
  });

  if (q) {
    scored = scored.filter((s) => s.score > 0);
  }

  if (filters.categoryId) {
    const catId = filters.categoryId;
    scored = scored.filter((s) => s.product.categoryId === catId || s.score >= 50);
  }

  if (filters.colors.length > 0) {
    scored = scored.filter((s) => {
      const productColors = (s.product.colors ?? []).map((c) => c.toLowerCase());
      return filters.colors.every((c) => productColors.includes(c.toLowerCase()));
    });
  }

  if (filters.minPrice !== null) {
    scored = scored.filter((s) => {
      const prices = (s.product.variants ?? []).map((v) => v.price).filter((p) => p > 0);
      if (prices.length === 0) return false;
      return Math.min(...prices) >= filters.minPrice!;
    });
  }
  if (filters.maxPrice !== null) {
    scored = scored.filter((s) => {
      const prices = (s.product.variants ?? []).map((v) => v.price).filter((p) => p > 0);
      if (prices.length === 0) return false;
      return Math.min(...prices) <= filters.maxPrice!;
    });
  }

  if (sort === "price-asc") {
    scored.sort((a, b) => {
      const pricesA = (a.product.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0);
      const pa = pricesA.length > 0 ? Math.min(...pricesA) : 0;
      const pricesB = (b.product.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0);
      const pb = pricesB.length > 0 ? Math.min(...pricesB) : 0;
      return pa - pb;
    });
  } else if (sort === "price-desc") {
    scored.sort((a, b) => {
      const pricesA = (a.product.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0);
      const pa = pricesA.length > 0 ? Math.min(...pricesA) : 0;
      const pricesB = (b.product.variants ?? []).map((v) => v.price ?? 0).filter((p) => p > 0);
      const pb = pricesB.length > 0 ? Math.min(...pricesB) : 0;
      return pb - pa;
    });
  } else if (sort === "name-asc") {
    scored.sort((a, b) => (a.product.name ?? "").localeCompare(b.product.name ?? ""));
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  return scored.map((s) => s.product);
}

export function useProductSearch(
  products: ManagedProduct[],
  filters: SearchFilters,
  sort: SortMode = "relevance"
) {
  return useMemo(() => searchProducts(products, filters, sort), [products, filters, sort]);
}
