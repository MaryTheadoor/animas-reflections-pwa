"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SquareCatalogItem, ManagedProduct, ManagedCategory } from "@/types";

// Toggle synthetic (mock) data for UI development. Set to false in production
// to use real Firestore data synced from Square. The admin "Sync from Square"
// populates Firestore with ManagedProduct docs.
export const USE_SYNTHETIC = false;

const DATA_SOURCE: "synthetic" | "firestore" = USE_SYNTHETIC ? "synthetic" : "firestore";

interface CatalogCategory {
  id: string;
  name: string;
}

interface UseCatalogResult {
  /** Canonical managed products — use these directly in components */
  products: ManagedProduct[];
  categories: CatalogCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Convert ManagedProduct → SquareCatalogItem (internal bridge, used only for
 *  Square API fallback compatibility and search hook. Components should use
 *  ManagedProduct directly.) */
export function managedToCatalogItem(p: ManagedProduct): SquareCatalogItem {
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

/** Get the primary image URL for a managed product */
export function getProductImageUrl(product: ManagedProduct): string {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  return "";
}

/** Get the primary image URL from a SquareCatalogItem (legacy) */
export function getCatalogItemImageUrl(item: SquareCatalogItem): string {
  return item.image_url ?? "";
}

export function useCatalog(): UseCatalogResult {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (DATA_SOURCE === "synthetic") {
      const { SYNTHETIC_PRODUCTS, SYNTHETIC_CATEGORIES } = await import("@/lib/synthetic-data");
      await new Promise((r) => setTimeout(r, 300));
      // Synthetic data is in SquareCatalogItem format — convert to ManagedProduct
      const managed: ManagedProduct[] = SYNTHETIC_PRODUCTS.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        categoryId: item.categoryIds?.[0] ?? "",
        productType: (item.productType as ManagedProduct["productType"]) ?? "other",
        colors: item.colors ?? [],
        tags: item.tags ?? [],
        images: item.images ?? (item.image_url ? [item.image_url] : []),
        variants: item.variations.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          sku: v.sku ?? "",
          inventory: v.inventory,
          inventoryUpdatedAt: v.inventoryUpdatedAt,
        })),
        active: true,
        featured: false,
        createdAt: "",
        updatedAt: "",
        printZones: item.printZones,
        mockupImages: item.mockupImages,
      }));
      setProducts(managed);
      setCategories(SYNTHETIC_CATEGORIES);
      setLoading(false);
      return;
    }

    try {
      const productsSnap = await getDocs(collection(db, "products"));
      const productsList: ManagedProduct[] = [];
      productsSnap.forEach((doc) => {
        const data = doc.data() as ManagedProduct;
        if (data.active !== false) {
          productsList.push(data);
        }
      });

      if (productsList.length > 0) {
        setProducts(productsList);

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
        // If Firestore is empty (first deploy, sync never run), fall back to
        // fetching the Square catalog directly via the Cloud Function.
        console.warn("Firestore read failed, falling back to Square API", err);
      }

      // Fallback: fetch from Square via Cloud Function
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

      // Convert SquareCatalogItem → ManagedProduct for the Square API fallback path
      const managedProducts: ManagedProduct[] = catalogItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        categoryId: item.categoryIds?.[0] ?? "",
        productType: (item.productType as ManagedProduct["productType"]) ?? "other",
        colors: item.colors ?? [],
        tags: item.tags ?? [],
        images: item.images ?? (item.image_url ? [item.image_url] : []),
        variants: item.variations.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          sku: v.sku ?? "",
          squareVariationId: v.id,
          inventory: v.inventory,
          inventoryUpdatedAt: v.inventoryUpdatedAt,
        })),
        active: true,
        featured: false,
        createdAt: "",
        updatedAt: "",
        printZones: item.printZones,
        mockupImages: item.mockupImages,
      }));
      setProducts(managedProducts);
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

  return { products, categories, loading, error, refresh: fetchCatalog };
}
