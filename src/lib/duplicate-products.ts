/**
 * Duplicate-product detection and merging for the admin.
 *
 * Two products are treated as duplicates when they are **semantically identical**: the same
 * name *and* the same set of variants (each variant's name, price and SKU). Order is
 * irrelevant, so a product whose variants were entered in a different order still matches.
 *
 * Nothing here touches Firestore — it is pure comparison plus a merge plan, so it can be
 * unit-tested and so the admin UI decides when to write.
 */

import type { ManagedProduct } from "@/types";

/** Lowercase, collapse whitespace, trim. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** A variant's comparable signature. */
function variantKey(v: ManagedProduct["variants"][number]): string {
  return [
    (v.name ?? "").toLowerCase().trim(),
    v.price ?? 0,
    (v.sku ?? "").toLowerCase().trim(),
  ].join("|");
}

/**
 * Signature of a product's variation structure. Sorted, so variant order does not matter.
 */
export function variantSignature(product: ManagedProduct): string {
  return (product.variants ?? []).map(variantKey).sort().join(";");
}

/** Same name and same variation structure. */
export function fingerprint(product: ManagedProduct): string {
  return `${normalizeName(product.name)}::${variantSignature(product)}`;
}

/**
 * How much a product actually holds, used to choose which copy to keep and to decide which
 * non-empty value wins when merging.
 */
function richness(product: ManagedProduct): number {
  let score = 0;
  score += (product.description ?? "").length > 0 ? 2 : 0;
  score += (product.images ?? []).filter(Boolean).length;
  score += (product.colors ?? []).length;
  score += (product.tags ?? []).length;
  score += product.categoryId ? 2 : 0;
  score += product.seoTitle ? 1 : 0;
  score += product.seoDescription ? 1 : 0;
  score += (product.variants ?? []).filter((v) => v.sku).length;
  score += (product.variants ?? []).filter((v) => v.inventory !== undefined).length;
  score += Object.keys(product.printZones ?? {}).length;
  score += Object.keys(product.mockupImages ?? {}).length;
  score += Object.keys(product.mockupImagesByColor ?? {}).length;
  score += Object.keys(product.colorTints ?? {}).length;
  score += product.featured ? 1 : 0;
  return score;
}

export interface DuplicateGroup {
  /** Stable key for React lists and for re-scanning. */
  fingerprint: string;
  name: string;
  /** All copies, richest first. */
  members: ManagedProduct[];
  /** Recommended survivor — the richest copy, oldest as a tie-break for stability. */
  keeperId: string;
  /** True when every member's variant inventory agrees, so merging loses nothing. */
  inventoryConsistent: boolean;
}

/** Group products that are semantically identical. Single-member groups are omitted. */
export function findDuplicateGroups(products: ManagedProduct[]): DuplicateGroup[] {
  const byFingerprint = new Map<string, ManagedProduct[]>();
  for (const p of products) {
    const key = fingerprint(p);
    if (!byFingerprint.has(key)) byFingerprint.set(key, []);
    byFingerprint.get(key)!.push(p);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of byFingerprint) {
    if (members.length < 2) continue;

    const sorted = [...members].sort((a, b) => {
      const byRichness = richness(b) - richness(a);
      if (byRichness !== 0) return byRichness;
      // Stable tie-break: keep the oldest so repeated scans agree.
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

    groups.push({
      fingerprint: key,
      name: sorted[0].name,
      members: sorted,
      keeperId: sorted[0].id,
      inventoryConsistent: members.every(
        (m) => variantSignatureInventory(m) === variantSignatureInventory(members[0]),
      ),
    });
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

function variantSignatureInventory(product: ManagedProduct): string {
  return (product.variants ?? [])
    .map((v) => `${(v.name ?? "").toLowerCase().trim()}|${v.inventory ?? "none"}`)
    .sort()
    .join(";");
}

/** Union of several string arrays, preserving first-seen order. */
function union(...lists: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      if (item && !out.includes(item)) out.push(item);
    }
  }
  return out;
}

/** First non-empty value, in the order given. */
function firstFilled<T>(...values: (T | undefined | null | "")[]): T | undefined {
  for (const v of values) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return v as T;
  }
  return undefined;
}

/**
 * Build the merged product for a group: the keeper, enriched with anything only the other
 * copies had. Non-array fields prefer the keeper so its curation survives; arrays are
 * unioned; a variant's inventory takes the highest known figure so stock is not lost.
 */
export function mergeGroup(group: DuplicateGroup): ManagedProduct {
  const keeper = group.members.find((m) => m.id === group.keeperId) ?? group.members[0];
  const others = group.members.filter((m) => m.id !== keeper.id);

  const variants = (keeper.variants ?? []).map((v) => {
    const sameName = others
      .flatMap((o) => o.variants ?? [])
      .filter((ov) => variantKey(ov) === variantKey(v));
    const inventories = [v.inventory, ...sameName.map((s) => s.inventory)].filter(
      (n): n is number => n !== undefined,
    );
    const squareVariationId = firstFilled(v.squareVariationId, ...sameName.map((s) => s.squareVariationId));
    return {
      ...v,
      inventory: inventories.length > 0 ? Math.max(...inventories) : undefined,
      squareVariationId,
    };
  });

  return {
    ...keeper,
    description: firstFilled(keeper.description, ...others.map((o) => o.description)) ?? "",
    categoryId: firstFilled(keeper.categoryId, ...others.map((o) => o.categoryId)) ?? "",
    productType:
      keeper.productType !== "other"
        ? keeper.productType
        : firstFilled(...others.map((o) => o.productType)) ?? keeper.productType,
    colors: union(keeper.colors, ...others.map((o) => o.colors)),
    tags: union(keeper.tags, ...others.map((o) => o.tags)),
    images: union(keeper.images, ...others.map((o) => o.images)),
    variants,
    active: keeper.active || others.some((o) => o.active),
    featured: keeper.featured || others.some((o) => o.featured),
    squareItemIds: union(keeper.squareItemIds, ...others.map((o) => o.squareItemIds)),
    seoTitle: firstFilled(keeper.seoTitle, ...others.map((o) => o.seoTitle)),
    seoDescription: firstFilled(keeper.seoDescription, ...others.map((o) => o.seoDescription)),
    printZones: firstFilled(keeper.printZones, ...others.map((o) => o.printZones)),
    mockupImages: firstFilled(keeper.mockupImages, ...others.map((o) => o.mockupImages)),
    mockupImagesByColor: firstFilled(keeper.mockupImagesByColor, ...others.map((o) => o.mockupImagesByColor)),
    colorTints: firstFilled(keeper.colorTints, ...others.map((o) => o.colorTints)),
    // createdAt of the survivor is kept by the spread above.
    updatedAt: new Date().toISOString(),
  };
}
