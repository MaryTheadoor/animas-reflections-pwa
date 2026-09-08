import type { ManagedProduct, ProductType } from "@/types";

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
  const name = get("name", "itemname", "productname", "product");
  if (!name || !name.trim()) return { error: "Missing product name" };

  const price = toNum(get("price", "itemprice", "baseprice", "variantprice"));
  const variant = get("variant", "variation", "variationname", "variantname", "option", "options");

  return {
    id: get("id", "productid", "itemid") || undefined,
    name: name.trim(),
    variant: variant && variant.trim() ? variant.trim() : undefined,
    price,
    sku: get("sku", "itemsku", "variantsku") || undefined,
    inventory: toNum(get("inventory", "stock", "quantity", "itemstock")),
    colors: splitList(get("colors", "colour", "color", "colornames")),
    category: get("category", "categoryname", "itemcategory") || undefined,
    productType: get("producttype", "type", "itemtype") || undefined,
    description: get("description", "itemdescription", "desc") || undefined,
    active: toBool(get("active", "visible", "isenabled")),
    featured: toBool(get("featured", "isfeatured")),
    images: splitList(get("image", "imageurl", "images", "image1"))
      .concat(splitList(get("image2")))
      .concat(splitList(get("image3"))),
    seoTitle: get("seotitle", "metatitle") || undefined,
    seoDescription: get("seodescription", "metadescription") || undefined,
  };
}

const VALID_PRODUCT_TYPES: ProductType[] = ["apparel", "sticker", "sign", "jewelry", "accessory", "other"];

/**
 * Group mapped rows into products (one product per unique id/name, with all its variants).
 */
export function rowsToProducts(rows: CatalogCsvRow[]) {
  const errors: string[] = [];
  const byKey = new Map<string, ManagedProduct>();
  let order = 0;

  for (const row of rows) {
    const key = row.id || row.name.toLowerCase();
    let product = byKey.get(key);
    const now = new Date().toISOString();

    if (!product) {
      const type = (row.productType || "other").toLowerCase() as ProductType;
      product = {
        id: row.id || crypto.randomUUID(),
        name: row.name,
        description: row.description ?? "",
        categoryId: "",
        productType: VALID_PRODUCT_TYPES.includes(type) ? type : "other",
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
      order++;
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
      product.variants.push({
        id: crypto.randomUUID(),
        name: variantName,
        price: row.price ?? 0,
        sku: row.sku ?? "",
        inventory: row.inventory,
        options: row.variant ? {} : undefined,
      });
    } else {
      errors.push(`Row for "${row.name}" has no variant data (variant/price/sku/inventory)`);
    }
  }

  return { products: [...byKey.values()], errors };
}

/** Parse + map a full CSV string into products, grouped by product. */
export function csvToProducts(text: string, onError?: (msg: string) => void) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { products: [], errors: ["CSV must have a header row and at least one data row"] };
  const headers = rows[0];
  const mapped: CatalogCsvRow[] = [];
  const errors: string[] = [];
  for (const dataRow of rows.slice(1)) {
    const r = mapCatalogRow(headers, dataRow);
    if ("error" in r) errors.push(`Row "${dataRow.join(", ")}": ${r.error}`);
    else mapped.push(r);
    if (onError) onError(errors[errors.length - 1] ?? "");
  }
  const grouped = rowsToProducts(mapped);
  return { products: grouped.products, errors: [...errors, ...grouped.errors] };
}
