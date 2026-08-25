"use client";

// The catalog hook now lives in a shared provider (one Firestore read per
// session, consistent error/loading state). This module keeps the original
// import path working and carries the image helper.
export { useCatalog, USE_SYNTHETIC } from "@/context/catalog-context";
export type { CatalogCategory } from "@/context/catalog-context";

import type { ManagedProduct } from "@/types";

/** Get the primary image URL for a managed product */
export function getProductImageUrl(product: ManagedProduct): string {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  return "";
}
