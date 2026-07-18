/**
 * Tests for the shipping calculation logic extracted from cart-context.tsx.
 * Pure function — no React or Firebase required.
 */
import { describe, it, expect } from "@jest/globals";
import type { ProductType } from "@/types";

function computeShipping(
  items: { productType: ProductType }[],
  subtotal: number,
  freeThreshold: number,
  stickerRate: number,
  apparelRate: number,
): number {
  if (subtotal >= freeThreshold) return 0;
  if (items.length > 0 && items.every((i) => i.productType === "sticker")) return stickerRate;
  return apparelRate;
}

const stickerTier = 3.0;
const apparelTier = 7.5;
const freeThreshold = 100.0;

describe("computeShipping", () => {
  it("returns free when subtotal meets threshold", () => {
    expect(computeShipping([{ productType: "apparel" }], 100, freeThreshold, stickerTier, apparelTier)).toBe(0);
    expect(computeShipping([{ productType: "sticker" }], 150, freeThreshold, stickerTier, apparelTier)).toBe(0);
  });

  it("returns sticker rate when all items are stickers and under threshold", () => {
    const items = [{ productType: "sticker" as const }, { productType: "sticker" as const }];
    expect(computeShipping(items, 10, freeThreshold, stickerTier, apparelTier)).toBe(stickerTier);
  });

  it("returns sticker rate for a single sticker under threshold", () => {
    expect(computeShipping([{ productType: "sticker" }], 5, freeThreshold, stickerTier, apparelTier)).toBe(stickerTier);
  });

  it("returns apparel rate when all items are apparel and under threshold", () => {
    expect(computeShipping([{ productType: "apparel" }], 25, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
  });

  it("returns apparel rate for mixed sticker + apparel cart under threshold", () => {
    const items = [{ productType: "sticker" as const }, { productType: "apparel" as const }];
    expect(computeShipping(items, 30, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
  });

  it("returns apparel rate for other product types", () => {
    expect(computeShipping([{ productType: "jewelry" }], 50, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
    expect(computeShipping([{ productType: "sign" }], 35, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
    expect(computeShipping([{ productType: "accessory" }], 15, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
  });

  it("returns apparel rate for empty cart (defensive)", () => {
    expect(computeShipping([], 0, freeThreshold, stickerTier, apparelTier)).toBe(apparelTier);
  });
});
