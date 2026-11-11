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

/**
 * Lowest sellable variant price, or null when the product has none.
 *
 * A variant priced 0 (or blank) is rejected at checkout as "no price
 * configured", so it is not sellable and must not be quoted or sorted as if it
 * cost $0.00. Both the shop and search pages sort with this one rule so the
 * same sort mode cannot order the same catalog two different ways.
 */
export function lowestVariantPrice(product: ManagedProduct): number | null {
  const prices = (product.variants ?? [])
    .map((v) => v.price)
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Sort comparator on lowestVariantPrice. Products with no price are always
 *  last, whichever direction the customer picked — an unpriced product is
 *  "unknown", not "cheapest". */
export function compareByPrice(
  a: ManagedProduct,
  b: ManagedProduct,
  direction: "asc" | "desc"
): number {
  const pa = lowestVariantPrice(a);
  const pb = lowestVariantPrice(b);
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return direction === "asc" ? pa - pb : pb - pa;
}

// Fuzzy text matching with weighted scoring:
// - Exact match: 100, prefix match: 80, contains: 60, word prefix: 40, partial: 20
// - Product name matches are weighted 3x (most relevant)
// - Tag and design name matches are weighted 2x
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

    if (filters.colors.length > 0) {
      const productColors = (product.colors ?? []).map((c) => c.toLowerCase());
      // OR semantics: a product matching ANY selected color qualifies
      // (ticking Black and White shouldn't require a product to be both).
      if (filters.colors.some((c) => productColors.includes(c.toLowerCase()))) {
        score += 30;
      }
    }

    return { product, score };
  });

  if (q) {
    scored = scored.filter((s) => s.score > 0);
  }

  // Hard category filter (AND): picking a category while searching narrows the
  // results to that category. It must not be softened by the relevance score —
  // a name match alone scores 150+, which used to let products from other
  // categories through.
  if (filters.categoryId) {
    const catId = filters.categoryId;
    scored = scored.filter((s) => s.product.categoryId === catId);
  }

  if (filters.colors.length > 0) {
    scored = scored.filter((s) => {
      const productColors = (s.product.colors ?? []).map((c) => c.toLowerCase());
      return filters.colors.some((c) => productColors.includes(c.toLowerCase()));
    });
  }

  if (filters.minPrice !== null) {
    scored = scored.filter((s) => {
      const price = lowestVariantPrice(s.product);
      if (price === null) return false;
      return price >= filters.minPrice!;
    });
  }
  if (filters.maxPrice !== null) {
    scored = scored.filter((s) => {
      const price = lowestVariantPrice(s.product);
      if (price === null) return false;
      return price <= filters.maxPrice!;
    });
  }

  if (sort === "price-asc") {
    scored.sort((a, b) => compareByPrice(a.product, b.product, "asc"));
  } else if (sort === "price-desc") {
    scored.sort((a, b) => compareByPrice(a.product, b.product, "desc"));
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
