"use client";

// The catalog hook now lives in a shared provider (one Firestore read per
// session, consistent error/loading state). This module keeps the original
// import path working and carries the image helper.
export { useCatalog, USE_SYNTHETIC } from "@/context/catalog-context";
export type { CatalogCategory } from "@/context/catalog-context";

import type { ManagedProduct } from "@/types";

/** Get the primary image URL for a managed product.
 *
 * Order matters and is shared by every card, the customizer and the product
 * page's default: the front mockup is the curated product shot, the gallery is
 * uploads. They are not always the same file — `Coffee Cup 15 oz` had a
 * gallery photo and a different front mockup, so the homepage card and the
 * product page showed two different cups. Preferring the mockup here makes the
 * surfaces agree by default.
 */
export function getProductImageUrl(product: ManagedProduct): string {
  const front = product.mockupImages?.front;
  if (front) return front;
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  return "";
}
