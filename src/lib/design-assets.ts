/* ─── Design library labels and filtering ─────────────────────────────
   97 of the 123 design docs in Firestore share `name: "Little Stranger
   Logos"`; the distinguishing text sits in `description` ("Shrooming
   Stranger", "Biscuit Crossing"…). Rendering `name` alone produced 97
   identically labelled tiles and 97 identical `alt` strings. The label rule
   and the filter that makes the list navigable live here so both grids use
   the same one.
   ────────────────────────────────────────────────────────────────────── */

import type { DesignAsset } from "@/types";

/** Anything with the two fields the label rule reads. */
type DesignLabelSource = Pick<DesignAsset, "name"> & Partial<Pick<DesignAsset, "description">>;

const UNTITLED = "Untitled design";

/** The tile's label: `description` when it carries text, otherwise `name`.
 *  Both are trimmed, so a whitespace-only description falls back to the name. */
export function designAssetLabel(asset: DesignLabelSource | null | undefined): string {
  const description = (asset?.description ?? "").trim();
  if (description) return description;
  const name = (asset?.name ?? "").trim();
  return name || UNTITLED;
}

/** Narrow designs to those whose label, name or category contains every
 *  whitespace-separated query token (case-insensitive). An empty query keeps
 *  the list as-is. */
export function filterDesignAssets<T extends DesignLabelSource & Partial<Pick<DesignAsset, "category">>>(
  assets: readonly T[],
  query: string,
): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...assets];
  return assets.filter((asset) => {
    const haystack = [
      designAssetLabel(asset),
      (asset.name ?? "").trim(),
      (asset.category ?? "").trim(),
    ]
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
