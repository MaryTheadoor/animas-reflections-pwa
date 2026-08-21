"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ManagedProduct, ManagedCategory } from "@/types";

// Toggle synthetic (mock) data for UI development. Set to false in production
// to use real Firestore data. (Square is payment-only since Phase 1 — the
// catalog lives in Firestore and is edited via the admin dashboard.)
export const USE_SYNTHETIC = false;

const DATA_SOURCE: "synthetic" | "firestore" = USE_SYNTHETIC ? "synthetic" : "firestore";

export interface CatalogCategory {
  id: string;
  name: string;
}

export interface CatalogContextValue {
  /** Canonical managed products — use these directly in components */
  products: ManagedProduct[];
  categories: CatalogCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/**
 * Shared catalog state. Mounted once in the app shell, so Home → Shop →
 * Product → Back performs ONE Firestore read for the whole session instead
 * of one per page mount. Also gives every consumer one consistent error/
 * loading state.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Deduplicates concurrent fetches (e.g. a refresh while the initial load
  // is still in flight).
  const inFlight = useRef<Promise<void> | null>(null);

  const fetchCatalog = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setLoading(true);
      setError(null);

      if (DATA_SOURCE === "synthetic") {
        const { SYNTHETIC_PRODUCTS, SYNTHETIC_CATEGORIES } = await import("@/lib/synthetic-data");
        await new Promise((r) => setTimeout(r, 300));
        // Synthetic data is in SquareCatalogItem format — convert to ManagedProduct.
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
          // Categories read failed — continue with products only.
        }

        setLoading(false);
      } catch (err) {
        console.warn("Firestore products read failed", err);
        setError(err instanceof Error ? err.message : "Failed to load catalog");
        setLoading(false);
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const value = useMemo<CatalogContextValue>(
    () => ({ products, categories, loading, error, refresh: fetchCatalog }),
    [products, categories, loading, error, fetchCatalog],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/** Shared catalog hook — backed by CatalogProvider (same signature as before). */
export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
