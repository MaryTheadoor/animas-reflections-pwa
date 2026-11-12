/**
 * Match a modifier option to a design in the library, so a customer choosing
 * from a 52-option set sees the artwork instead of 52 identical chips.
 *
 * This is the READ-ONLY half of the "design-linked modifier images" plan
 * (PROJECT_CONTEXT §15.6 S1): nothing is written to Firestore. A modifier option
 * named "Shrooming Stranger" shows the design whose label is "Shrooming
 * Stranger"; an option that matches nothing simply has no thumbnail.
 *
 * Matching uses the same normalisation as category matching (lowercase, every
 * non-alphanumeric removed), so "Colosso, He's A Villian!" matches
 * "Colosso He's A Villian". Names are the only link available today; an explicit
 * option→design override is S2, which will take precedence.
 */
import type { DesignAsset, ProductModifier } from "@/types";
import { designAssetLabel } from "./design-assets";
import { categoryKey } from "./design-category";

export type DesignIndex = Map<string, DesignAsset>;

/**
 * Index designs by both their display label (description || name) and their raw
 * name. First writer wins: two designs sharing a name is a data problem the
 * admin reports separately, and a stable pick beats a flickering one.
 */
export function buildDesignIndex(designs: readonly DesignAsset[]): DesignIndex {
  const index: DesignIndex = new Map();
  for (const design of designs) {
    if (!design.image_url) continue;
    for (const raw of [designAssetLabel(design), design.name]) {
      const key = categoryKey(raw);
      if (key && !index.has(key)) index.set(key, design);
    }
  }
  return index;
}

/** The design a modifier option's NAME points at, if any. */
export function matchDesignForModifier(
  modifierName: string | undefined | null,
  index: DesignIndex,
): DesignAsset | undefined {
  const key = categoryKey(modifierName);
  return key ? index.get(key) : undefined;
}

/**
 * The thumbnail to show for one modifier option: an explicitly assigned
 * modifier background wins (that is what the admin's Modifier Images wrote),
 * otherwise the matched design's artwork.
 */
export function modifierThumbnail(
  modifier: Pick<ProductModifier, "name">,
  index: DesignIndex,
  assigned?: Record<string, { front?: string }> | null,
): string | undefined {
  const explicit = assigned?.[modifier.name]?.front;
  if (explicit) return explicit;
  return matchDesignForModifier(modifier.name, index)?.image_url;
}
