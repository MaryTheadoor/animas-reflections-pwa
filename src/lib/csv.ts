import type { ManagedProduct, ProductType } from "@/types";
import {
  deriveOptionValues,
  detectBrand,
  detectProductType,
  extractTags,
} from "@/lib/catalog-heuristics";

/**
 * CSV catalog import — one row per product variant; rows are grouped into one
 * product by `name` (or `id` when given). Designed to be tolerant of both the
 * documented template and Square's item-export columns (item_name / variation_name
 * / item_price / item_sku / item_description).
 */

export interface CatalogCsvRow {
  id?: string;
  name: string;
  variant?: string;
  /** Square variation id (the export's `Token` column) — a stable per-variant identity. */
  squareVariationId?: string;
  /** Structured options from explicit `Option Name n` / `Option Value n` columns. */
  optionValues?: Record<string, string>;
  price?: number;
  sku?: string;
  inventory?: number;
  colors: string[];
  category?: string;
  productType?: string;
  description?: string;
  active?: boolean;
  featured?: boolean;
  images: string[];
  weightOz?: number;
  seoTitle?: string;
  seoDescription?: string;
}

/** Robust RFC4180-ish CSV parser (quoted fields, escaped quotes, embedded commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

function toBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  if (["true", "1", "yes", "y", "active", "enabled"].includes(s)) return true;
  if (["false", "0", "no", "n", "inactive", "disabled"].includes(s)) return false;
  return undefined;
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function splitList(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Canonical field → accepted header aliases. Single source of truth: `mapCatalogRow`
 * reads through this, and `csvToProducts` uses it to report headers it did not
 * recognise, so the two cannot drift apart.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  id: ["id", "productid", "itemid"],
  name: ["name", "itemname", "productname", "product"],
  variant: ["variant", "variation", "variationname", "variantname", "option", "options"],
  // Square's item export carries a per-variation `Token` — a stable identity we keep so
  // variants stay linked to Square across re-imports.
  variationId: ["token", "variationid", "squarevariationid"],
  // Explicit structured options, which beat parsing the variation label.
  optionName1: ["optionname1"], optionValue1: ["optionvalue1"],
  optionName2: ["optionname2"], optionValue2: ["optionvalue2"],
  optionName3: ["optionname3"], optionValue3: ["optionvalue3"],
  price: ["price", "itemprice", "baseprice", "variantprice", "onlinesaleprice"],
  sku: ["sku", "itemsku", "variantsku"],
  inventory: ["inventory", "stock", "quantity", "itemstock"],
  colors: ["colors", "colour", "color", "colornames"],
  // Square exports the category as a " > "-separated hierarchy under `Categories`.
  category: ["category", "categoryname", "itemcategory", "categories", "reportingcategory"],
  productType: ["producttype", "type", "itemtype"],
  description: ["description", "itemdescription", "desc"],
  // `Square Online Item Visibility` and `Archived` both bear on whether we show an item.
  active: ["active", "visible", "isenabled", "squareonlineitemvisibility"],
  archived: ["archived"],
  featured: ["featured", "isfeatured"],
  image: ["image", "imageurl", "images", "image1"],
  image2: ["image2"],
  image3: ["image3"],
  weight: ["weightlb", "weightoz", "weight"],
  seoTitle: ["seotitle", "metatitle"],
  seoDescription: ["seodescription", "metadescription"],
};

/**
 * Header prefixes that mean the same field whatever the site-specific suffix. Square
 * names the stock column after the location, e.g.
 * "Current Quantity Animas Reflections LLC", so an exact alias would not survive.
 */
const FIELD_PREFIXES: Record<string, string> = {
  currentquantity: "inventory",
  quantity: "inventory",
  // Square's per-item modifier-set association columns. We recognise them so they are
  // not reported as unmapped noise, but they are not imported yet — see the report line.
  modifierset: "__modifierSet",
};

/**
 * Normalize a header for comparison: lowercase and drop everything that is not a letter
 * or digit. Square's export contains parentheses, dots and ampersands — "Weight (lb)",
 * "Tax - Colorado (8.4%)" — which must not defeat a match.
 */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve a header to the canonical field it names, or null.
 * Exact aliases win; then a prefix rule (for location-suffixed columns).
 */
export function resolveField(header: string): string | null {
  const norm = normHeader(header);
  for (const [field, aliasList] of Object.entries(FIELD_ALIASES)) {
    if (aliasList.some((a) => normHeader(a) === norm)) return field;
  }
  for (const [prefix, field] of Object.entries(FIELD_PREFIXES)) {
    if (norm.startsWith(prefix)) return field;
  }
  return null;
}

/** Headers the import does not understand at all — reported so nothing is silently lost. */
export function unmappedHeaders(headers: string[]): string[] {
  return headers.filter((h) => h.trim() && resolveField(h) === null);
}

/**
 * Stable, id-safe key derived from a product name. Used as the Firestore document id
 * when the sheet supplies no explicit id, which is what makes re-importing the same
 * sheet update the same documents instead of creating a second copy of the catalog.
 */
export function slugifyKey(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "product"
  );
}

/** Lets the import resolve references against data that already exists. */
export interface ImportOptions {
  /** Lowercased category name → category id. Unmatched names are reported, never created. */
  categoryMap?: Map<string, string>;
  /**
   * Lowercased product name → **existing** product id. When a sheet row names a product
   * that already exists, the import targets that document instead of minting a new id, so
   * re-importing updates in place however the product was originally created (admin-made
   * UUID ids as well as earlier imports).
   */
  existingByName?: Map<string, string>;
}

/** Index every header by the canonical field it resolves to (a field may have several). */
function buildFieldIndex(headers: string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  headers.forEach((header, i) => {
    const field = resolveField(header);
    if (!field) return;
    if (!index.has(field)) index.set(field, []);
    index.get(field)!.push(i);
  });
  return index;
}

/**
 * Map one CSV row to a CatalogCsvRow. Returns { error } when required fields are missing.
 *
 * Resolution goes through `resolveField`, so a header is understood wherever it appears
 * (exact alias, or a prefix rule for location-suffixed columns).
 */
export function mapCatalogRow(headers: string[], cells: string[]): CatalogCsvRow | { error: string } {
  const index = buildFieldIndex(headers);
  const entry = (field: string): { value: string; header: string } | undefined => {
    for (const i of index.get(field) ?? []) {
      const v = cells[i];
      if (v !== undefined && v.trim() !== "") return { value: v, header: headers[i] ?? "" };
    }
    return undefined;
  };
  const get = (field: string): string | undefined => entry(field)?.value;

  const name = get("name");
  if (!name || !name.trim()) return { error: "Missing product name" };

  const variant = get("variant");

  // Explicit Option Name/Value columns are authoritative when present — far more reliable
  // than inferring from the variation label.
  const optionValues: Record<string, string> = {};
  for (const n of ["1", "2", "3"]) {
    const optName = get(`optionName${n}`);
    const optValue = get(`optionValue${n}`);
    if (optName?.trim() && optValue?.trim()) optionValues[optName.trim()] = optValue.trim();
  }

  // Square states both visibility and archived-ness; archived always wins.
  const visibility = get("active")?.trim().toLowerCase();
  const archived = toBool(get("archived"));
  let active: boolean | undefined;
  if (visibility !== undefined) {
    if (["visible", "true", "y", "yes", "1", "enabled"].includes(visibility)) active = true;
    else if (["hidden", "false", "n", "no", "0", "disabled", "unavailable", "notvisible"].includes(visibility)) active = false;
  }
  if (archived === true) active = false;
  else if (archived === false && active === undefined) active = true;

  // Weight: Square exports pounds, our schema stores ounces.
  const weightEntry = entry("weight");
  let weightOz: number | undefined;
  if (weightEntry) {
    const n = toNum(weightEntry.value);
    if (n !== undefined) weightOz = /lb|pound/i.test(weightEntry.header) ? Math.round(n * 16 * 100) / 100 : n;
  }

  // Square's `Item Type` is a generic descriptor ("Physical good", "Service") that has no
  // equivalent in our closed productType union. Treat it as "not stated" so the name-based
  // inference applies, instead of warning per product about a value that never could map.
  const rawType = get("productType");
  const productType =
    rawType && SQUARE_ITEM_TYPES.has(normHeader(rawType)) ? undefined : rawType;

  return {
    id: get("id") || undefined,
    name: name.trim(),
    variant: variant && variant.trim() ? variant.trim() : undefined,
    squareVariationId: get("variationId")?.trim() || undefined,
    optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined,
    price: toNum(get("price")),
    sku: get("sku") || undefined,
    inventory: toNum(get("inventory")),
    colors: splitList(get("colors")),
    category: get("category") || undefined,
    productType,
    description: get("description") || undefined,
    active,
    featured: toBool(get("featured")),
    images: splitList(get("image"))
      .concat(splitList(get("image2")))
      .concat(splitList(get("image3"))),
    weightOz,
    seoTitle: get("seoTitle") || undefined,
    seoDescription: get("seoDescription") || undefined,
  };
}

const VALID_PRODUCT_TYPES: ProductType[] = ["apparel", "sticker", "sign", "jewelry", "accessory", "other"];

/**
 * Square's generic item types, which carry no product-category meaning for us. Normalised,
 * because the export writes them as "Physical good".
 */
const SQUARE_ITEM_TYPES = new Set(["physicalgood", "service", "digitalgood", "donation", "giftcard"]);

/**
 * Resolve a sheet category to an existing category id, recording misses.
 *
 * Square's export is messier than a single path. One cell can hold several entries
 * separated by commas, each of which may itself be a " > " hierarchy, and an entry can
 * carry a trailing "(SOMEID)" — e.g.
 *   "Custom Designs, Custom Designs > Custom Slaps, Custom Slaps"
 *   "Animas Reflections (SKSTT53S4M7JQOO5WXR2D4L4), Jewelry"
 * So every entry is tried, deepest level first, with and without the parenthetical suffix.
 * Nothing is created — an unmatched name is reported.
 */
function resolveCategory(
  name: string | undefined,
  opts: ImportOptions,
  unresolved: Set<string>,
): string {
  if (!name || !name.trim()) return "";
  const cleaned = name.trim();

  const candidates: string[] = [];
  for (const group of cleaned.split(",")) {
    const parts = group.split(">").map((p) => p.trim()).filter(Boolean);
    // deepest level first, then the whole path
    candidates.push(...[...parts].reverse(), group.trim());
  }

  for (const candidate of candidates) {
    const withoutId = candidate.replace(/\s*\([^)]*\)\s*$/, "").trim();
    for (const variant of [candidate, withoutId]) {
      if (!variant) continue;
      const id = opts.categoryMap?.get(variant.toLowerCase());
      if (id) return id;
    }
  }

  unresolved.add(cleaned);
  return "";
}

/**
 * Group mapped rows into products (one product per unique id/name, with all its variants).
 *
 * The product id is **deterministic** — the sheet's `id` when present, otherwise a slug
 * of the name — so re-importing a corrected sheet updates the same documents instead of
 * creating a second copy of the catalog.
 */
export function rowsToProducts(rows: CatalogCsvRow[], opts: ImportOptions = {}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byKey = new Map<string, ManagedProduct>();
  const unresolvedCategories = new Set<string>();
  let inferredTypeCount = 0;
  const noOptions: string[] = [];

  for (const row of rows) {
    const key = row.id || row.name.toLowerCase();
    let product = byKey.get(key);
    const now = new Date().toISOString();

    if (!product) {
      const stated = (row.productType || "").toLowerCase() as ProductType;
      if (row.productType && !VALID_PRODUCT_TYPES.includes(stated)) {
        warnings.push(`Unknown productType "${row.productType}" on "${row.name}" → imported as "other"`);
      }
      // No brand fallback here: deriveTags needs the resolved category, which we do not
      // have yet. Both are filled in the post-pass below.
      // Identity, in order of authority: the sheet's own id, then an existing product of
      // the same name (so a re-import updates in place instead of duplicating), then a
      // slug of the name.
      const existingId = opts.existingByName?.get(row.name.trim().toLowerCase());
      product = {
        id: row.id || existingId || slugifyKey(row.name),
        name: row.name,
        description: row.description ?? "",
        categoryId: resolveCategory(row.category, opts, unresolvedCategories),
        productType: VALID_PRODUCT_TYPES.includes(stated) ? stated : "other",
        colors: row.colors.map((c) => c.toLowerCase()).filter((c, i, a) => a.indexOf(c) === i),
        tags: [],
        images: row.images.filter(Boolean),
        variants: [],
        active: row.active ?? true,
        featured: row.featured ?? false,
        weightOz: row.weightOz,
        createdAt: now,
        updatedAt: now,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      };
      byKey.set(key, product);
    }

    // A later row can carry the weight even when the first did not.
    if (product.weightOz === undefined && row.weightOz !== undefined) product.weightOz = row.weightOz;

    product.name = product.name || row.name;
    product.description = product.description || (row.description ?? "");
    for (const c of row.colors) {
      const low = c.toLowerCase();
      if (!product.colors.includes(low)) product.colors.push(low);
    }
    for (const img of row.images) {
      if (img && !product.images.includes(img)) product.images.push(img);
    }

    const variantName = row.variant || (row.variant === undefined ? "One Size" : "");
    if (row.variant !== undefined || row.price !== undefined || row.sku !== undefined || row.inventory !== undefined) {
      if (row.price === undefined) {
        errors.push(`Row for "${row.name}"${row.variant ? ` (${row.variant})` : ""} is missing a price`);
      }
      // Options: explicit Option Name/Value columns are authoritative; otherwise decompose
      // the flat label into whatever dimensions it implies, so the variant matrix can
      // round-trip the product instead of seeing one opaque name.
      let variantOptions: Record<string, string> = {};
      if (row.optionValues && Object.keys(row.optionValues).length > 0) {
        variantOptions = { ...row.optionValues };
      } else {
        const { size, colors } = deriveOptionValues(variantName);
        if (size) variantOptions.Size = size;
        if (colors.length > 0) variantOptions.Color = colors[0];
      }

      product.variants.push({
        id: crypto.randomUUID(),
        name: variantName,
        price: row.price ?? 0,
        sku: row.sku ?? "",
        inventory: row.inventory,
        squareVariationId: row.squareVariationId,
        options: Object.keys(variantOptions).length > 0 ? variantOptions : undefined,
      });
    } else {
      errors.push(`Row for "${row.name}" has no variant data (variant/price/sku/inventory)`);
    }
  }

  // ── Post-pass: fill what can only be known once the whole product is grouped ──
  for (const product of byKey.values()) {
    // 1. Brand → category, but only when the sheet did not name one. The brand patterns
    //    mirror the live category names, so this resolves through the same map and a miss
    //    is reported rather than created.
    if (!product.categoryId) {
      const brand = detectBrand(product.name);
      if (brand) {
        const id = opts.categoryMap?.get(brand.toLowerCase());
        if (id) product.categoryId = id;
        else unresolvedCategories.add(brand);
      }
    }

    // 2. Product type: infer it when the sheet was silent rather than defaulting to "other".
    if (product.productType === "other") {
      const inferred = detectProductType([product.name, product.description]);
      if (inferred !== "other") {
        product.productType = inferred;
        inferredTypeCount++;
      }
    }

    // 3. Tags for search.
    const categoryName = product.categoryId
      ? [...(opts.categoryMap?.entries() ?? [])].find(([, id]) => id === product.categoryId)?.[0]
      : undefined;
    product.tags = extractTags(product.name, product.description, categoryName ? [categoryName] : []);

    // 4. Declare the option dimensions the variants actually vary across.
    const dimensions = new Map<string, { type: "select" | "color"; values: Set<string> }>();
    for (const v of product.variants) {
      for (const [name, value] of Object.entries(v.options ?? {})) {
        if (!dimensions.has(name)) {
          dimensions.set(name, { type: name === "Color" ? "color" : "select", values: new Set() });
        }
        dimensions.get(name)!.values.add(value);
      }
    }
    // Only dimensions with more than one value are real choices. A single-valued one
    // (the very common "One Size", or a colour every variant shares) would put a
    // pointless one-option selector on the storefront, so it is dropped and stripped
    // from the variants to keep the declaration and the variants consistent.
    const usable = [...dimensions.entries()].filter(([, d]) => d.values.size > 1);
    if (usable.length > 0) {
      const kept = new Set(usable.map(([name]) => name));
      product.options = usable.map(([name, d]) => ({
        id: name.toLowerCase(),
        name,
        type: d.type,
        values: [...d.values],
        required: true,
      }));
      for (const v of product.variants) {
        if (!v.options) continue;
        const filtered = Object.fromEntries(
          Object.entries(v.options).filter(([name]) => kept.has(name)),
        );
        v.options = Object.keys(filtered).length > 0 ? filtered : undefined;
      }
    } else {
      for (const v of product.variants) v.options = undefined;
      if (product.variants.length > 1) noOptions.push(product.name);
    }
  }

  for (const c of unresolvedCategories) {
    warnings.push(
      `Category "${c}" does not exist, so those products were imported without one. Create the category (or correct the sheet) and re-import — they will update in place.`,
    );
  }
  if (inferredTypeCount > 0) {
    warnings.push(
      `Product type was inferred (not stated in the sheet) for ${inferredTypeCount} product${inferredTypeCount === 1 ? "" : "s"}.`,
    );
  }
  if (noOptions.length > 0) {
    warnings.push(
      `These products have more than one variant but their variant labels did not reveal a size or colour, so no option dimensions were set: ${noOptions.slice(0, 10).join(", ")}${noOptions.length > 10 ? ` (+${noOptions.length - 10} more)` : ""}. Set their options in the product editor.`,
    );
  }

  return { products: [...byKey.values()], errors, warnings };
}

/** Parse + map a full CSV string into products, grouped by product. */
export function csvToProducts(text: string, opts: ImportOptions = {}, onError?: (msg: string) => void) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      products: [] as ManagedProduct[],
      errors: ["CSV must have a header row and at least one data row"],
      warnings: [] as string[],
      unmappedColumns: [] as string[],
    };
  }
  const headers = rows[0];
  const unmappedColumns = unmappedHeaders(headers);
  // Modifier-set columns are recognised but not imported — say so plainly rather than
  // letting them look like a successful mapping.
  const modifierColumns = headers.filter((h) => resolveField(h) === "__modifierSet");
  const mapped: CatalogCsvRow[] = [];
  const errors: string[] = [];
  for (const dataRow of rows.slice(1)) {
    const r = mapCatalogRow(headers, dataRow);
    if ("error" in r) errors.push(`Row "${dataRow.join(", ")}": ${r.error}`);
    else mapped.push(r);
    if (onError) onError(errors[errors.length - 1] ?? "");
  }
  const grouped = rowsToProducts(mapped, opts);
  const warnings = [...grouped.warnings];
  if (unmappedColumns.length) {
    warnings.push(
      `Column${unmappedColumns.length === 1 ? "" : "s"} in the file mapped to nothing and ${unmappedColumns.length === 1 ? "was" : "were"} ignored: ${unmappedColumns.join(", ")}`,
    );
  }
  if (modifierColumns.length > 0) {
    const applied = new Set<string>();
    const headerIdx = new Map(headers.map((h, i) => [h, i]));
    for (const row of rows.slice(1)) {
      for (const col of modifierColumns) {
        const i = headerIdx.get(col);
        if (i !== undefined && (row[i] ?? "").trim().toUpperCase() === "Y") applied.add(col);
      }
    }
    warnings.push(
      `The file references ${modifierColumns.length} Square modifier sets, and ${applied.size} of them are applied to at least one item, but modifier set CONTENTS (the choices and their prices) are not in the item export and were not imported. Add-ons are not migrated yet.`,
    );
  }
  return {
    products: grouped.products,
    errors: [...errors, ...grouped.errors],
    warnings,
    unmappedColumns,
  };
}
