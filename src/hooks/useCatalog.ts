"use client";

import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { SquareCatalogItem } from "@/types";

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
    try {
      const callable = httpsCallable<object, { items: SquareCatalogItem[] }>(
        functions,
        "fetchSquareCatalog"
      );
      const result = await callable({});
      const catalogItems = result.data.items ?? [];

      // Extract unique categories from items
      const categoryMap = new Map<string, CatalogCategory>();
      catalogItems.forEach((item) => {
        if (item.categoryId) {
          categoryMap.set(item.categoryId, {
            id: item.categoryId,
            name: item.categoryId.replace(/_/g, " "),
          });
        }
      });
      setCategories(Array.from(categoryMap.values()));
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
  return item.image_url ?? "/hero-bg.jpg";
}
