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

/** Normalize a header label: lowercase, strip spaces/underscores/hyphens. */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-]+/g, "");
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
  price: ["price", "itemprice", "baseprice", "variantprice"],
  sku: ["sku", "itemsku", "variantsku"],
  inventory: ["inventory", "stock", "quantity", "itemstock"],
  colors: ["colors", "colour", "color", "colornames"],
  category: ["category", "categoryname", "itemcategory"],
  productType: ["producttype", "type", "itemtype"],
  description: ["description", "itemdescription", "desc"],
  active: ["active", "visible", "isenabled"],
  featured: ["featured", "isfeatured"],
  image: ["image", "imageurl", "images", "image1"],
  image2: ["image2"],
  image3: ["image3"],
  seoTitle: ["seotitle", "metatitle"],
  seoDescription: ["seodescription", "metadescription"],
};

/** Every header string any field accepts, normalised — used to report unmapped columns. */
const RECOGNISED_HEADERS = new Set(
  Object.values(FIELD_ALIASES).flat().map((a) => a.toLowerCase().replace(/[\s_\-]+/g, "")),
);

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
}

/**
 * Map one CSV row (using the normalized header → value header map) to a CatalogCsvRow.
 * Returns { error } when required fields are missing/invalid.
 */
export function mapCatalogRow(headers: string[], cells: string[]): CatalogCsvRow | { error: string } {
  const h = headers.map(normHeader);
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const idx = h.indexOf(normHeader(key));
      if (idx >= 0 && cells[idx] !== undefined) return cells[idx];
    }
    return undefined;
  };
  const name = get(...FIELD_ALIASES.name);
  if (!name || !name.trim()) return { error: "Missing product name" };

  const price = toNum(get(...FIELD_ALIASES.price));
  const variant = get(...FIELD_ALIASES.variant);

  return {
    id: get(...FIELD_ALIASES.id) || undefined,
    name: name.trim(),
    variant: variant && variant.trim() ? variant.trim() : undefined,
    price,
    sku: get(...FIELD_ALIASES.sku) || undefined,
    inventory: toNum(get(...FIELD_ALIASES.inventory)),
    colors: splitList(get(...FIELD_ALIASES.colors)),
    category: get(...FIELD_ALIASES.category) || undefined,
    productType: get(...FIELD_ALIASES.productType) || undefined,
    description: get(...FIELD_ALIASES.description) || undefined,
    active: toBool(get(...FIELD_ALIASES.active)),
    featured: toBool(get(...FIELD_ALIASES.featured)),
    images: splitList(get(...FIELD_ALIASES.image))
      .concat(splitList(get(...FIELD_ALIASES.image2)))
      .concat(splitList(get(...FIELD_ALIASES.image3))),
    seoTitle: get(...FIELD_ALIASES.seoTitle) || undefined,
    seoDescription: get(...FIELD_ALIASES.seoDescription) || undefined,
  };
}

const VALID_PRODUCT_TYPES: ProductType[] = ["apparel", "sticker", "sign", "jewelry", "accessory", "other"];

/** Resolve a sheet category name to an existing category id, recording misses. */
function resolveCategory(
  name: string | undefined,
  opts: ImportOptions,
  unresolved: Set<string>,
): string {
  if (!name || !name.trim()) return "";
  const key = name.trim().toLowerCase();
  const id = opts.categoryMap?.get(key);
  if (id) return id;
  unresolved.add(name.trim());
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
      product = {
        id: row.id || slugifyKey(row.name),
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
        createdAt: now,
        updatedAt: now,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      };
      byKey.set(key, product);
    }

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
      // Decompose the flat label into whatever dimensions it actually implies, so the
      // variant matrix can round-trip the product instead of seeing one opaque name.
      const { size, colors } = deriveOptionValues(variantName);
      const variantOptions: Record<string, string> = {};
      if (size) variantOptions.Size = size;
      if (colors.length > 0) variantOptions.Color = colors[0];

      product.variants.push({
        id: crypto.randomUUID(),
        name: variantName,
        price: row.price ?? 0,
        sku: row.sku ?? "",
        inventory: row.inventory,
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
    if (dimensions.size > 0) {
      product.options = [...dimensions.entries()].map(([name, d]) => ({
        id: name.toLowerCase(),
        name,
        type: d.type,
        values: [...d.values],
        required: true,
      }));
    } else if (product.variants.length > 1) {
      noOptions.push(product.name);
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
  const unmappedColumns = headers.filter((h) => h.trim() && !RECOGNISED_HEADERS.has(normHeader(h)));
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
  return {
    products: grouped.products,
    errors: [...errors, ...grouped.errors],
    warnings,
    unmappedColumns,
  };
}
