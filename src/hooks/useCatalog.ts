"use client";

// The catalog hook now lives in a shared provider (one Firestore read per
// session, consistent error/loading state). This module keeps the original
// import path working and carries the converter/image helpers.
export { useCatalog, USE_SYNTHETIC } from "@/context/catalog-context";
export type { CatalogCategory } from "@/context/catalog-context";

import type { SquareCatalogItem, ManagedProduct } from "@/types";

/** Convert ManagedProduct → SquareCatalogItem (internal bridge, used only for
 *  Square API fallback compatibility and the search hook. Components should use
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
