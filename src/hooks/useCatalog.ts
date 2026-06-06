"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SquareCatalogItem, ManagedProduct, ManagedCategory } from "@/types";

export const USE_SYNTHETIC = true;

const DATA_SOURCE: "synthetic" | "firestore" = USE_SYNTHETIC ? "synthetic" : "firestore";

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

function managedToCatalogItem(p: ManagedProduct): SquareCatalogItem {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryIds: [p.categoryId],
    image_url: p.images[0] ?? "",
    variations: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      sku: v.sku,
    })),
    colors: p.colors,
    tags: p.tags,
  };
}

export function useCatalog(): UseCatalogResult {
  const [items, setItems] = useState<SquareCatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (DATA_SOURCE === "synthetic") {
      const { SYNTHETIC_PRODUCTS, SYNTHETIC_CATEGORIES } = await import("@/lib/synthetic-data");
      await new Promise((r) => setTimeout(r, 300));
      setItems(SYNTHETIC_PRODUCTS);
      setCategories(SYNTHETIC_CATEGORIES);
      setLoading(false);
      return;
    }

    try {
      const productsSnap = await getDocs(collection(db, "products"));
      const products: SquareCatalogItem[] = [];
      productsSnap.forEach((doc) => {
        const data = doc.data() as ManagedProduct;
        if (data.active !== false) {
          products.push(managedToCatalogItem(data));
        }
      });

      const catsSnap = await getDocs(collection(db, "categories"));
      const cats: CatalogCategory[] = [];
      catsSnap.forEach((doc) => {
        const data = doc.data() as ManagedCategory;
        cats.push({ id: data.id, name: data.name });
      });
      cats.sort((a, b) => a.name.localeCompare(b.name));

      setItems(products);
      setCategories(cats);
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
