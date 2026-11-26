/**
 * Is a product fit to show to the public?
 *
 * The launch decision this supports: only fully configured products should be
 * visible; everything else stays unlisted (active: false) until its data is
 * fixed. The rules are here, pure and testable, so the shop, the admin preview
 * and the report script all agree on what "ready" means.
 *
 * Two severities:
 *   - BLOCKER: the product would look broken, or would take money for something
 *     it cannot fulfil. These are what "unlist not-ready products" hides.
 *   - WARNING: worth fixing, but not a reason to hide it (e.g. no category —
 *     the product still appears under All).
 */
import type { ManagedProduct, ManagedVariant } from "@/types";

export type ReadinessIssue =
  | "inactive"
  | "no-price"
  | "no-image"
  | "thin-description"
  | "design-record-price"
  | "low-default-price"
  | "duplicate-name"
  | "out-of-stock"
  | "price-anomaly"
  | "no-category"
  | "no-variants";

export interface ReadinessResult {
  ready: boolean;
  /** Reasons the product must stay unlisted. */
  blockers: ReadinessIssue[];
  /** Worth fixing, not blocking. */
  warnings: ReadinessIssue[];
  /** Highest sellable variant price, or 0 when nothing is sellable. */
  maxPrice: number;
}

const SHORT_DESCRIPTION = 20;
/** A "product" priced at or below this is a design record, not merchandise. */
const DESIGN_RECORD_CEILING = 1.01;
/** A size option worth more than this is almost certainly a data error. */
const SIZE_SURCHARGE_CEILING = 10;
const SIZE_NAMES = /^(extra small|small|medium|large|extra large|xxl|xxxl|xxxxl|2xl|3xl|4xl)$/i;

function sellableVariants(product: ManagedProduct): ManagedVariant[] {
  return (product.variants ?? []).filter((v) => Number.isFinite(v.price) && v.price > 0);
}

/** Any photograph at all — gallery, front mockup, or a per-colour front. */
export function hasAnyImage(product: ManagedProduct): boolean {
  if ((product.images ?? []).some(Boolean)) return true;
  if (product.mockupImages?.front) return true;
  const byColor = product.mockupImagesByColor ?? {};
  return Object.values(byColor).some((views) => Boolean(views?.front));
}

function looksDuplicated(name: string): boolean {
  return /\(\d+\)|copy of|\btest\b/i.test(name ?? "");
}

function sizeSurchargeMax(product: ManagedProduct): number {
  const prices = (product.modifiers ?? [])
    .filter((m) => SIZE_NAMES.test((m.name ?? "").trim()))
    .map((m) => (Number.isFinite(m.price) ? m.price : 0));
  return prices.length ? Math.max(...prices) : 0;
}

export function assessProduct(product: ManagedProduct): ReadinessResult {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const variants = product.variants ?? [];
  const sellable = sellableVariants(product);
  const maxPrice = sellable.length ? Math.max(...sellable.map((v) => v.price)) : 0;

  if (product.active === false) warnings.push("inactive");

  if (variants.length === 0) blockers.push("no-variants");
  else if (sellable.length === 0) blockers.push("no-price");

  if (!hasAnyImage(product)) blockers.push("no-image");

  if ((product.description ?? "").trim().length < SHORT_DESCRIPTION) blockers.push("thin-description");

  if (maxPrice > 0 && maxPrice <= DESIGN_RECORD_CEILING) blockers.push("design-record-price");

  /**
   * The variant the page will PRESELECT is priced like a design record while the product
   * carries real prices.
   *
   * `design-record-price` above compares the product's highest price, so it cannot see this:
   * LITTLE STRANGER has four unnamed variants at $1 / $5 / $15 / $25, its max is a real $25,
   * and the page preselects the first — so the shop button offered **$1** for a $25 product.
   * Deliberately only the first variant: a bulk sheet whose unit price is under $1.01 is
   * legitimate (4 Inch Slaps), and its default variant is not the cheap one.
   */
  const defaultVariant = variants[0];
  if (
    defaultVariant &&
    Number.isFinite(defaultVariant.price) &&
    defaultVariant.price > 0 &&
    defaultVariant.price <= DESIGN_RECORD_CEILING &&
    maxPrice > DESIGN_RECORD_CEILING
  ) {
    blockers.push("low-default-price");
  }

  if (looksDuplicated(product.name ?? "")) blockers.push("duplicate-name");

  const tracked = variants.filter((v) => typeof v.inventory === "number");
  const inStock = tracked.length === 0 || tracked.some((v) => (v.inventory ?? 0) > 0);
  if (!inStock) blockers.push("out-of-stock");

  if (!(product.categoryId ?? "").trim()) warnings.push("no-category");

  if (sizeSurchargeMax(product) > SIZE_SURCHARGE_CEILING) warnings.push("price-anomaly");

  return { ready: blockers.length === 0, blockers, warnings, maxPrice };
}

/** The two policies the admin offers. */
export type ReadinessMode = "strict" | "blocking-only";

/**
 * `strict` is the launch default: everything a shopper would notice (photo,
 * description) must be present. `blocking-only` keeps products that merely lack
 * a photo or copy, which is how a thin catalogue stays browsable while photos
 * are still being uploaded.
 */
export function blockersFor(result: ReadinessResult, mode: ReadinessMode): ReadinessIssue[] {
  if (mode === "strict") return result.blockers;
  const soft: ReadinessIssue[] = ["no-image", "thin-description"];
  return result.blockers.filter((b) => !soft.includes(b));
}

export function isReadyUnder(product: ManagedProduct, mode: ReadinessMode): boolean {
  return product.active !== false && blockersFor(assessProduct(product), mode).length === 0;
}

export interface ReadinessSummary {
  total: number;
  active: number;
  ready: number;
  toUnlist: number;
  byIssue: Record<string, number>;
}

export function summarise(products: readonly ManagedProduct[], mode: ReadinessMode): ReadinessSummary {
  const byIssue: Record<string, number> = {};
  let active = 0;
  let ready = 0;
  let toUnlist = 0;
  for (const product of products) {
    const result = assessProduct(product);
    for (const issue of [...result.blockers, ...result.warnings]) {
      byIssue[issue] = (byIssue[issue] ?? 0) + 1;
    }
    if (product.active === false) continue;
    active++;
    if (blockersFor(result, mode).length === 0) ready++;
    else toUnlist++;
  }
  return { total: products.length, active, ready, toUnlist, byIssue };
}
