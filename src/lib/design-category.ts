/* ─── Which designs belong to which category ──────────────────────────
   The design library is the source of truth for printable artwork. Two
   behaviours hang off a design's category:

     1. selecting a category on a NEW product pins every matching design
        automatically (they can still be deselected by hand), and
     2. editing a design in the library updates the products that pinned it.

   Products store design SNAPSHOTS (ManagedProduct.designAssets) rather than
   ids, so both behaviours are expressed here as pure functions over the
   snapshot list — testable without Firestore, and the only place the matching
   rule is written down.
   ────────────────────────────────────────────────────────────────────── */

import type { DesignAsset, ManagedCategory } from "@/types";

/** Cap on pinned designs, matching the product editor's picker. */
export const DESIGN_PIN_LIMIT = 25;

/**
 * Fold a name to a comparable key: lowercase, every non-alphanumeric removed.
 *
 * Design categories are free text and real category names have accumulated
 * punctuation and hierarchy ("Durango High School Alpine Team, Teams",
 * "Teams > Durango Lacrosse"), so an exact string compare silently matches
 * nothing — the same failure mode as Known Issue #40, where a header
 * normaliser kept parentheses and matched no column.
 */
export function categoryKey(value: string | undefined | null): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Does this design belong to this category?
 *
 *  - `categoryIds` PRESENT  → authoritative; an empty array means "no category",
 *    and the legacy text fields must NOT rescue it. That empty array is how an
 *    admin opts a design out of automatic pinning.
 *  - `categoryIds` ABSENT   → fall back to the free-text `category` and to
 *    `tags`, either of which may name the category. This is what makes every
 *    design created before the field existed keep working, and it is the
 *    "category tag" behaviour.
 */
export function designMatchesCategory(
  design: DesignAsset,
  category: ManagedCategory | undefined | null,
): boolean {
  if (!category) return false;

  if (design.categoryIds) return design.categoryIds.includes(category.id);

  const keys = [...new Set([categoryKey(category.name), categoryKey(category.slug)].filter(Boolean))];
  if (keys.length === 0) return false;
  if (keys.includes(categoryKey(design.category))) return true;

  // Tags are free text an operator types onto an image, so they rarely equal the
  // category name: the live library tags 97 designs "little stranger logos" under
  // the "Little Stranger" category, which an exact compare silently missed. Accept
  // a tag that CONTAINS a category key, but only for keys long enough not to match
  // everything ("art" must not swallow "cartoon").
  const tagKeys = (design.tags ?? []).map(categoryKey).filter(Boolean);
  return tagKeys.some((tagKey) =>
    keys.some((key) => tagKey === key || (key.length >= 5 && tagKey.includes(key))),
  );
}

/** Every design in the library that belongs to `category`. */
export function designsForCategory(
  designs: readonly DesignAsset[],
  category: ManagedCategory | undefined | null,
): DesignAsset[] {
  if (!category) return [];
  return designs.filter((design) => designMatchesCategory(design, category));
}

export interface AutoFillInput {
  /** Designs currently pinned on the form. */
  pinned: readonly DesignAsset[];
  /** Result of designsForCategory() for the category just chosen. */
  matching: readonly DesignAsset[];
  /**
   * Ids a PREVIOUS pass added automatically. Component state, never persisted.
   * Anything in here is fair game to remove; anything not is a manual choice.
   */
  autoIds: ReadonlySet<string>;
  limit?: number;
}

export interface AutoFillResult {
  designAssets: DesignAsset[];
  /** Ids this pass added, to be remembered as auto-added. */
  addedIds: string[];
  /** Ids this pass removed because they had been auto-added and no longer match. */
  removedIds: string[];
  /** Matching designs that did not fit under the limit. */
  overflow: number;
}

/**
 * Reconcile an automatic pin pass with what the admin has chosen by hand.
 *
 * The rule that keeps this from surprising anyone: this function only ever
 * touches designs THAT IT ADDED ITSELF (the ids in `autoIds`). A design the
 * admin picked manually is never removed, and a design they manually
 * deselected was dropped from `autoIds` by the caller, so it is not
 * resurrected either.
 */
export function autoFillDesignsForCategory(input: AutoFillInput): AutoFillResult {
  const limit = input.limit ?? DESIGN_PIN_LIMIT;
  const matchingIds = new Set(input.matching.map((design) => design.id));

  // 1. Drop auto-added designs that no longer match the chosen category.
  const kept = input.pinned.filter(
    (design) => !(input.autoIds.has(design.id) && !matchingIds.has(design.id)),
  );
  const keptIds = new Set(kept.map((design) => design.id));
  const removedIds = input.pinned.filter((d) => !keptIds.has(d.id)).map((d) => d.id);

  // 2. Add the matches that are not pinned yet, in the order given.
  const designAssets = [...kept];
  const addedIds: string[] = [];
  let overflow = 0;
  for (const design of input.matching) {
    if (keptIds.has(design.id)) continue;
    if (designAssets.length >= limit) {
      overflow += 1;
      continue;
    }
    designAssets.push(design);
    keptIds.add(design.id);
    addedIds.push(design.id);
  }

  return { designAssets, addedIds, removedIds, overflow };
}

/** True when two snapshots of the same design would render identically. */
function samePinnedPayload(a: DesignAsset, b: DesignAsset): boolean {
  return (
    a.name === b.name &&
    a.image_url === b.image_url &&
    (a.category ?? "") === (b.category ?? "") &&
    (a.description ?? "") === (b.description ?? "") &&
    JSON.stringify(a.tags ?? []) === JSON.stringify(b.tags ?? []) &&
    JSON.stringify(a.categoryIds ?? []) === JSON.stringify(b.categoryIds ?? [])
  );
}

/**
 * Re-resolve pinned designs against the library.
 *
 * Products hold design SNAPSHOTS, so renaming a design or replacing its image
 * in the Designs tab does NOT reach a product that already pinned it. Running
 * this on save keeps the snapshot honest without a migration to design ids.
 * A design deleted from the library keeps its stored snapshot — the product
 * still renders, and the admin can see and remove it.
 */
export function refreshPinnedDesigns(
  pinned: readonly DesignAsset[],
  library: readonly DesignAsset[],
): { designAssets: DesignAsset[]; updatedIds: string[] } {
  const byId = new Map(library.map((design) => [design.id, design]));
  const updatedIds: string[] = [];
  const designAssets = pinned.map((design) => {
    const current = byId.get(design.id);
    if (!current || samePinnedPayload(design, current)) return design;
    updatedIds.push(design.id);
    return current;
  });
  return { designAssets, updatedIds };
}
