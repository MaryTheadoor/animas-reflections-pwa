"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "@/lib/firebase";
import { SYNTHETIC_PRODUCTS, SYNTHETIC_CATEGORIES } from "@/lib/synthetic-data";
import type { SquareCatalogItem, CompositeProduct, SyncStatus } from "@/types";

export const USE_SYNTHETIC = true;

const DATA_SOURCE: "synthetic" | "firestore" | "square" = USE_SYNTHETIC
  ? "synthetic"
  : "firestore";

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
  syncStatus: SyncStatus | null;
}

function compositeToCatalogItem(cp: CompositeProduct): SquareCatalogItem {
  const flatVariations = cp.variantGroups.flatMap((group) =>
    group.options.map((opt) => ({
      id: opt.squareVariationId,
      name: group.name === "Size" || group.name === "Option"
        ? opt.label
        : `${group.name}: ${opt.label}`,
      price: opt.price,
      sku: opt.sku,
    }))
  );

  return {
    id: cp.id,
    name: cp.name,
    description: cp.description,
    categoryIds: cp.categoryIds,
    image_url: cp.images[0] ?? "",
    variations: flatVariations,
    colors: cp.colors,
    tags: [...cp.tags, cp.brand],
  };
}

export function useCatalog(): UseCatalogResult {
  const [items, setItems] = useState<SquareCatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (DATA_SOURCE === "synthetic") {
      await new Promise((r) => setTimeout(r, 400));
      setItems(SYNTHETIC_PRODUCTS);
      setCategories(SYNTHETIC_CATEGORIES);
      setLoading(false);
      return;
    }

    if (DATA_SOURCE === "firestore") {
      try {
        const productsSnap = await getDocs(collection(db, "products"));
        const compositeProducts: CompositeProduct[] = [];
        productsSnap.forEach((doc) => {
          const data = doc.data() as CompositeProduct;
          if (data.name) compositeProducts.push(data);
        });

        if (compositeProducts.length > 0) {
          const catalogItems = compositeProducts.map(compositeToCatalogItem);
          setItems(catalogItems);

          const catsSnap = await getDocs(collection(db, "categories"));
          const cats: CatalogCategory[] = [];
          catsSnap.forEach((doc) => {
            const data = doc.data() as { name: string };
            cats.push({ id: doc.id, name: data.name });
          });
          setCategories(cats);

          const statusSnap = await getDocs(collection(db, "config"));
          const statusDoc = statusSnap.docs.find((d) => d.id === "sync_status");
          if (statusDoc) {
            setSyncStatus(statusDoc.data() as SyncStatus);
          }

          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Firestore read failed, falling back to Square API", err);
      }
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

  return { items, categories, loading, error, refresh: fetchCatalog, syncStatus };
}

export function getProductImageUrl(item: SquareCatalogItem): string {
  return item.image_url ?? "";
}
