/* ─── Bulk apply across existing products ─────────────────────────────
   The library and the matrix make ONE product fast to build. This is the other
   half: forty hoodies that all need the same blank's mockups, or a price change
   across a category.

   Planning is separate from writing on purpose. Every bulk operation is shown as
   a plan first (what changes, on which products, what cannot be done and why),
   and the component applies only what the plan lists — the same discipline the
   CSV importer follows, and the reason a bulk write here cannot surprise anyone.
   ────────────────────────────────────────────────────────────────────── */

import { PRODUCT_PHOTO_VIEWS, type ManagedProduct, type ProductPhotoView, type ProductType } from "@/types";
import type { BlankPhotoSet, MockupImages } from "@/lib/product-photos";

export interface BulkFilters {
  /** Only products in this category. */
  categoryId?: string;
  /** Only products of this type; "all" or absent means any. */
  productType?: ProductType | "all";
}

/** Products the filters select. */
export function selectTargets(
  products: readonly ManagedProduct[],
  filters: BulkFilters = {},
): ManagedProduct[] {
  return products.filter((product) => {
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (filters.productType && filters.productType !== "all" && product.productType !== filters.productType) {
      return false;
    }
    return true;
  });
}

export interface BlankApplyPlan {
  productId: string;
  productName: string;
  /** Views this product would gain, with the URL that would be written. */
  fill: MockupImages;
  /** Colour-keyed views this product would gain. */
  fillByColor: Record<string, MockupImages>;
  /** Views the blank itself has no photo for, so nothing can be filled. */
  unavailable: ProductPhotoView[];
}

/**
 * What applying a blank set would change, per product.
 *
 * A product that already has every one of the blank's photos is OMITTED rather
 * than listed with an empty change: a plan that says "3 products unaffected"
 * invites the operator to apply it anyway and wonder what happened.
 */
export function planBlankApply(
  products: readonly ManagedProduct[],
  set: BlankPhotoSet,
  filters: BulkFilters = {},
): BlankApplyPlan[] {
  const plans: BlankApplyPlan[] = [];

  for (const product of selectTargets(products, filters)) {
    const fill: MockupImages = {};
    for (const view of PRODUCT_PHOTO_VIEWS) {
      const url = set.byView[view];
      if (!url) continue;
      if (product.mockupImages?.[view] === url) continue; // already this photo
      fill[view] = url;
    }

    const fillByColor: Record<string, MockupImages> = {};
    for (const [color, views] of Object.entries(set.byColorView)) {
      const forColor: MockupImages = {};
      for (const view of PRODUCT_PHOTO_VIEWS) {
        const url = views[view];
        if (!url) continue;
        if (product.mockupImagesByColor?.[color]?.[view] === url) continue;
        forColor[view] = url;
      }
      if (Object.keys(forColor).length > 0) fillByColor[color] = forColor;
    }

    if (Object.keys(fill).length === 0 && Object.keys(fillByColor).length === 0) continue;

    plans.push({
      productId: product.id,
      productName: product.name,
      fill,
      fillByColor,
      unavailable: PRODUCT_PHOTO_VIEWS.filter((view) => !set.byView[view] && !hasColorView(set, view)),
    });
  }

  return plans;
}

function hasColorView(set: BlankPhotoSet, view: ProductPhotoView): boolean {
  return Object.values(set.byColorView).some((views) => Boolean(views[view]));
}

export interface PriceApplyPlan {
  productId: string;
  productName: string;
  /** Variants whose price would change, and their current prices. */
  changes: { variantId: string; variantName: string; from: number }[];
  /** The single new price. */
  to: number;
}

/**
 * What setting a price would change, per product.
 *
 * Variants already at the new price are left out, so applying the same price
 * twice is a no-op the second time rather than a report full of fake changes.
 */
export function planPriceApply(
  products: readonly ManagedProduct[],
  price: number,
  filters: BulkFilters = {},
): PriceApplyPlan[] {
  if (!Number.isFinite(price) || price < 0) return [];
  const plans: PriceApplyPlan[] = [];

  for (const product of selectTargets(products, filters)) {
    const changes = product.variants
      .filter((variant) => variant.price !== price)
      .map((variant) => ({ variantId: variant.id, variantName: variant.name, from: variant.price }));
    if (changes.length === 0) continue;
    plans.push({ productId: product.id, productName: product.name, changes, to: price });
  }

  return plans;
}

/** One line per plan, for the preview the operator reads before applying. */
export function describeBlankPlan(plan: BlankApplyPlan): string {
  const general = Object.keys(plan.fill).length;
  const byColor = Object.values(plan.fillByColor).reduce((n, views) => n + Object.keys(views).length, 0);
  const parts: string[] = [];
  if (general > 0) parts.push(`${general} view${general === 1 ? "" : "s"}`);
  if (byColor > 0) parts.push(`${byColor} colour view${byColor === 1 ? "" : "s"}`);
  return parts.join(" + ") || "nothing";
}

/** Totals across a plan set, so the button can say what it will do. */
export function summarizeBlankPlans(plans: readonly BlankApplyPlan[]): {
  products: number;
  views: number;
} {
  return {
    products: plans.length,
    views: plans.reduce(
      (n, plan) =>
        n +
        Object.keys(plan.fill).length +
        Object.values(plan.fillByColor).reduce((m, views) => m + Object.keys(views).length, 0),
      0,
    ),
  };
}

export function summarizePricePlans(plans: readonly PriceApplyPlan[]): {
  products: number;
  variants: number;
} {
  return {
    products: plans.length,
    variants: plans.reduce((n, plan) => n + plan.changes.length, 0),
  };
}
