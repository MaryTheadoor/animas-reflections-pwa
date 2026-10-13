/* ─── Variant matrix combinations ─────────────────────────────────────
   Clicking every cell is the slowest part of building a product: a hoodie with
   8 sizes and 10 colours is 80 clicks, and a third dimension multiplies it. The
   grid already knows every combination it can represent, so the arithmetic lives
   here as pure functions and the component just applies the result.
   ────────────────────────────────────────────────────────────────────── */

export interface MatrixDimension {
  name: string;
  values: string[];
}

/** The key a combination is stored under, matching the component's indexing. */
export function combinationKey(values: readonly string[]): string {
  return values.join("|");
}

/** Cartesian product of the given dimensions, in dimension order. */
export function matrixCombinations(dimensions: readonly MatrixDimension[]): string[][] {
  const usable = dimensions.filter((d) => d.values.length > 0);
  if (usable.length === 0) return [];
  let out: string[][] = [[]];
  for (const dimension of usable) {
    const next: string[][] = [];
    for (const partial of out) {
      for (const value of dimension.values) next.push([...partial, value]);
    }
    out = next;
  }
  return out;
}

/**
 * The combinations the on-screen grid covers.
 *
 * The grid shows the first two dimensions in full; any further dimensions are
 * pinned by dropdown, one value at a time. `pinned[i]` is the chosen value for
 * extra dimension `i` (defaulting to its first value, matching the component).
 */
export function visibleGridCombinations(
  dimensions: readonly MatrixDimension[],
  pinned: Record<number, string> = {},
): string[][] {
  const usable = dimensions.filter((d) => d.values.length > 0);
  if (usable.length === 0) return [];
  if (usable.length === 1) return usable[0].values.map((value) => [value]);

  const [d1, d2, ...rest] = usable;
  const extra = rest.map((d, i) => pinned[i] ?? d.values[0]);
  const out: string[][] = [];
  for (const row of d1.values) {
    for (const col of d2.values) {
      out.push([row, col, ...extra]);
    }
  }
  return out;
}

/** Combinations not yet present, by key. */
export function missingCombinations(
  combinations: readonly string[][],
  existingKeys: ReadonlySet<string>,
): string[][] {
  return combinations.filter((values) => !existingKeys.has(combinationKey(values)));
}

/** A SKU for one combination, matching the component's existing scheme. */
export function variantSku(values: readonly string[], prefix: string): string {
  const clean = prefix.trim();
  if (!clean) return "";
  return clean + "-" + values.map((v) => v.substring(0, 3).toUpperCase()).join("-");
}

/**
 * How many variants a fill would create, so the UI can confirm before writing a
 * large batch rather than after.
 */
export function fillSize(combinations: readonly string[][], existingKeys: ReadonlySet<string>): number {
  return missingCombinations(combinations, existingKeys).length;
}
