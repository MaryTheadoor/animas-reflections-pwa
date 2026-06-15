"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SquareCatalogItem, ManagedProduct, ManagedCategory } from "@/types";

export const USE_SYNTHETIC = false;

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
  const images = Array.isArray(p.images) ? p.images : [];
  const variants = Array.isArray(p.variants) ? p.variants : [];
  return {
    id: p.id ?? "",
    name: p.name ?? "",
    description: p.description ?? "",
    categoryIds: p.categoryId ? [p.categoryId] : [],
    image_url: images[0] ?? "",
    images,
    variations: variants.map((v) => ({
      id: v.id ?? "",
      name: v.name ?? "",
      price: typeof v.price === "number" ? v.price : 0,
      sku: v.sku ?? "",
      inventory: v.inventory,
      inventoryUpdatedAt: v.inventoryUpdatedAt,
    })),
    colors: Array.isArray(p.colors) ? p.colors : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    productType: p.productType,
    printZones: p.printZones,
    mockupImages: p.mockupImages,
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

      if (products.length > 0) {
        setItems(products);

        try {
          const catsSnap = await getDocs(collection(db, "categories"));
          const cats: CatalogCategory[] = [];
          catsSnap.forEach((doc) => {
            const data = doc.data() as ManagedCategory;
            cats.push({ id: data.id, name: data.name });
          });
          cats.sort((a, b) => a.name.localeCompare(b.name));
          setCategories(cats);
        } catch {
          // Categories read failed — continue with products only
        }

        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Firestore read failed, falling back to Square API", err);
    }

    try {
      const { httpsCallable } = await import("firebase/functions");
      const { functions } = await import("@/lib/firebase");
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
            if (!categoryMap.has(cid)) categoryMap.set(cid, { id: cid, name: cid });
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
/bin/bash: line 5: C:/Users/AmosA/.hermes/cache/terminal/hermes-snap-a45f2e12a6da.sh: No such file or directory
/bin/bash: line 6: C:/Users/AmosA/.hermes/cache/terminal/hermes-cwd-a45f2e12a6da.txt: No such file or directory
