"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ProductPhoto } from "@/types";

/** Collection holding the reusable blank-product photo library. */
export const PRODUCT_PHOTOS_COLLECTION = "product_photos";

/**
 * Broadcast after any product-photo mutation so the picker and the manager see
 * the current library without a reload. Mirrors `admin-categories-changed`
 * (src/components/admin/category-manager.tsx).
 */
export function notifyProductPhotosChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("admin-product-photos-changed"));
  }
}

export interface UseProductPhotosResult {
  photos: ProductPhoto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the product photo library.
 *
 * A hook rather than a provider on purpose: this library is only read by the
 * admin (the picker and the Product Photos tab). A provider would be mounted in
 * the app shell and cost every storefront visitor a Firestore read for a
 * collection no customer surface uses.
 */
export function useProductPhotos(): UseProductPhotosResult {
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Deduplicates overlapping loads (a mutation event landing mid-fetch).
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const snap = await getDocs(collection(db, PRODUCT_PHOTOS_COLLECTION));
      const list: ProductPhoto[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as ProductPhoto;
        // A row without an id or an image cannot be selected, so it is noise.
        if (!data?.image_url) return;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      // A library is browsed by name ("Gildan 18500 — front"), so sort by it;
      // the picker's search box handles finding rather than recency.
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setPhotos(list);
      setError(null);
    } catch (err) {
      console.warn("Firestore product_photos read failed", err);
      setError(err instanceof Error ? err.message : "Failed to load product photos");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred through setTimeout (the pattern the dashboard config load uses)
    // so the fetch does not set state synchronously inside the effect body.
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const onChanged = () => {
      void load();
    };
    window.addEventListener("admin-product-photos-changed", onChanged);
    return () => window.removeEventListener("admin-product-photos-changed", onChanged);
  }, [load]);

  return { photos, loading, error, refresh: load };
}
