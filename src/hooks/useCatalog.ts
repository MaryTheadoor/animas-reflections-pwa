"use client";

import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { SYNTHETIC_PRODUCTS, SYNTHETIC_CATEGORIES } from "@/lib/synthetic-data";
import type { SquareCatalogItem } from "@/types";

const USE_SYNTHETIC = true;

interface CatalogCategory {
  id: string;
  name: string;
}

interface UseCatalogResult {
  items: SquareCatalogItem[];
  categories: CatalogCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCatalog(): UseCatalogResult {
  const [items, setItems] = useState<SquareCatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (USE_SYNTHETIC) {
      // Simulate network delay for realistic loading state
      await new Promise((r) => setTimeout(r, 400));
      setItems(SYNTHETIC_PRODUCTS);
      setCategories(SYNTHETIC_CATEGORIES);
      setLoading(false);
      return;
    }

    try {
      const callable = httpsCallable<object, { items: SquareCatalogItem[]; categories?: CatalogCategory[] }>(
        functions,
        "fetchSquareCatalog"
      );
      const result = await callable({});
      const catalogItems = result.data.items ?? [];
      const catalogCategories = result.data.categories ?? [];

      if (catalogCategories.length > 0) {
        setCategories(catalogCategories);
      } else {
        const categoryMap = new Map<string, CatalogCategory>();
        catalogItems.forEach((item) => {
          item.categoryIds.forEach((cid) => {
            if (!categoryMap.has(cid)) {
              categoryMap.set(cid, { id: cid, name: cid });
            }
          });
        });
        setCategories(Array.from(categoryMap.values()));
      }
      setItems(catalogItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCatalog();
  }, [fetchCatalog]);

  return { items, categories, loading, error, refresh: fetchCatalog };
}

export function getProductImageUrl(item: SquareCatalogItem): string {
  return item.image_url ?? "";
}
