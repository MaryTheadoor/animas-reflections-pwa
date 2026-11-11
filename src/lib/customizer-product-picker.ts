/* ─── Customizer product picker ───────────────────────────────────────
   The customizer used to render one native <select> of the whole catalog:
   235 options, no search, no grouping, and `$0.00` rows mixed in with the
   real ones. These pure helpers build the grouped, searchable option list
   the combobox renders, so the rules — what is orderable, what the label
   and secondary line say, and how a query narrows the list — are visible
   and testable instead of buried in JSX.
   ────────────────────────────────────────────────────────────────────── */

import type { ManagedProduct, ProductType } from "@/types";
import { PRODUCT_TYPE_LABELS } from "@/types";

/** One selectable product in the combobox. */
export interface ProductPickerOption {
  id: string;
  /** Product name — the option's first line. */
  label: string;
  /** Category name — the option's secondary line. Blank when the product's
   *  category has no name (or no category). */
  detail: string;
  /** Cheapest sellable variant price in dollars; always a real price because
   *  unpriced products never reach the list. */
  price: number;
  /** Lowercased haystack the query is matched against (name + category). */
  searchText: string;
}

export interface ProductPickerGroup {
  /** Catalog `productType` value, used as the React key and the sort key. */
  value: string;
  /** Human label for the group header. */
  label: string;
  options: ProductPickerOption[];
}

/** Order groups follow the catalog's own type enum so the list is stable
 *  between renders and matches the admin's type order. */
const TYPE_ORDER: readonly string[] = Object.keys(PRODUCT_TYPE_LABELS);

function hasOwn(map: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

/** Human label for a `productType` value. Unknown values (the catalog can
 *  carry admin-defined types) are capitalised rather than dropped. */
export function productTypeLabel(value: string | null | undefined): string {
  const key = (value ?? "").trim();
  if (!key) return PRODUCT_TYPE_LABELS.other;
  if (hasOwn(PRODUCT_TYPE_LABELS, key)) {
    return PRODUCT_TYPE_LABELS[key as ProductType];
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** The cheapest variant price a customer can actually be charged, or
 *  `undefined` when no variant carries a positive price. Checkout rejects a
 *  variant with no price, so a product with none is not orderable at all. */
export function lowestSellablePrice(
  product: Pick<ManagedProduct, "variants"> | null | undefined,
): number | undefined {
  const prices = (product?.variants ?? [])
    .map((v) => v?.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);
  if (prices.length === 0) return undefined;
  return Math.min(...prices);
}

/** True when the product can be added to a cart at all: active, and with at
 *  least one positively priced variant. */
export function isSellableProduct(
  product: Pick<ManagedProduct, "variants" | "active"> | null | undefined,
): boolean {
  if (!product) return false;
  if (product.active === false) return false;
  return lowestSellablePrice(product) !== undefined;
}

function categoryNameFor(
  product: ManagedProduct,
  categoryNames: Map<string, string>,
): string {
  const id = product.categoryId?.trim();
  if (!id) return "";
  return (categoryNames.get(id) ?? "").trim();
}

function compareGroups(a: ProductPickerGroup, b: ProductPickerGroup): number {
  const ai = TYPE_ORDER.indexOf(a.value);
  const bi = TYPE_ORDER.indexOf(b.value);
  if (ai !== bi) {
    // Known types keep catalog order; unknown types sort after all of them.
    if (ai === -1) return bi === -1 ? a.label.localeCompare(b.label) : 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  return a.label.localeCompare(b.label);
}

/** Group the orderable part of the catalog by `productType`.
 *
 *  Excluded: products marked inactive, and products whose every variant is
 *  unpriced (the `$0.00` rows). Groups are ordered by the catalog type enum;
 *  options are alphabetical inside a group. */
export function buildProductPickerGroups(
  products: readonly ManagedProduct[] | null | undefined,
  categories: readonly { id: string; name: string }[] | null | undefined,
): ProductPickerGroup[] {
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name ?? ""]));
  const groups = new Map<string, ProductPickerGroup>();

  const sorted = [...(products ?? [])].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  );

  for (const product of sorted) {
    if (!isSellableProduct(product)) continue;
    const price = lowestSellablePrice(product);
    if (price === undefined) continue;

    const value = (product.productType ?? "").trim() || "other";
    let group = groups.get(value);
    if (!group) {
      group = { value, label: productTypeLabel(value), options: [] };
      groups.set(value, group);
    }

    const detail = categoryNameFor(product, categoryNames);
    const label = (product.name ?? "").trim();
    group.options.push({
      id: product.id,
      label,
      detail,
      price,
      searchText: `${label} ${detail}`.toLowerCase(),
    });
  }

  return [...groups.values()].sort(compareGroups);
}

/** Every whitespace-separated token must appear somewhere in the haystack, so
 *  "tee black" narrows to black tees. Case-insensitive. */
export function matchesProductQuery(searchText: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => searchText.includes(token));
}

/** Narrow the grouped list to the query. The group label (product type) is
 *  matched too, so "apparel" keeps the Apparel group. Groups with no surviving
 *  option are dropped, not rendered empty. */
export function filterProductPickerGroups(
  groups: readonly ProductPickerGroup[],
  query: string,
): ProductPickerGroup[] {
  if (query.trim() === "") return [...groups];
  const withType = (group: ProductPickerGroup) => group.label.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) =>
        matchesProductQuery(`${option.searchText} ${withType(group)}`, query),
      ),
    }))
    .filter((group) => group.options.length > 0);
}

/** Flat option list in render order — the order ArrowUp/ArrowDown walk. */
export function flattenProductPickerOptions(
  groups: readonly ProductPickerGroup[],
): ProductPickerOption[] {
  return groups.flatMap((group) => group.options);
}

/** A group annotated with its first option's index in the flat list, so the
 *  renderer can give each option a stable `id`/`aria-activedescendant` target
 *  without re-walking the list per option. */
export interface IndexedProductPickerGroup extends ProductPickerGroup {
  start: number;
}

export function indexProductPickerGroups(
  groups: readonly ProductPickerGroup[],
): IndexedProductPickerGroup[] {
  return groups.reduce<IndexedProductPickerGroup[]>((acc, group, i) => {
    const previous = acc[i - 1];
    const start = previous ? previous.start + previous.options.length : 0;
    return [...acc, { ...group, start }];
  }, []);
}

/** Index of the option carrying `id`, or -1. Used to park the active option on
 *  the current selection when the list opens. */
export function indexOfProductOption(
  options: readonly ProductPickerOption[],
  id: string | null | undefined,
): number {
  if (!id) return -1;
  return options.findIndex((option) => option.id === id);
}

/** Move the active option by `delta`, wrapping at both ends so ArrowDown from
 *  the last option returns to the first rather than doing nothing. */
export function moveActiveIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (((current + delta) % count) + count) % count;
}
