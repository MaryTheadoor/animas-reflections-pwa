import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { csvToProducts } from "@/lib/csv";
import type { ManagedCategory, ManagedProduct } from "@/types";

export interface ImportReport {
  created: number;
  updated: number;
  /** Rows matched to a product that already existed, so they updated in place. */
  matchedExisting: number;
  /** Row-level failures: the row could not be turned into a product. */
  errors: string[];
  /** Non-fatal notes: unmatched categories, unmapped columns, coerced values. */
  warnings: string[];
  /** Headers present in the file that map to nothing. */
  unmappedColumns: string[];
}

/** Minimal shape the importer needs to match an incoming row to a product already stored. */
export interface ExistingProductRef {
  id: string;
  name: string;
}

/**
 * For an existing product we send a **patch**, not a replacement: never reset `createdAt`,
 * and never blank a field the sheet did not supply. Without this, importing a sheet that
 * omits (say) descriptions or images would wipe curation done in the admin.
 */
function patchForExisting(p: ManagedProduct): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p as unknown as Record<string, unknown>)) {
    if (key === "createdAt") continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    patch[key] = value;
  }
  return stripUndefined(patch);
}

/**
 * Parse + write a CSV catalog to Firestore (admin-gated by rules).
 *
 * Identity, in order of authority: the sheet's own id, then an existing product with the
 * same name (so re-importing updates in place rather than duplicating), then a slug of the
 * name. Pass `existingProducts` so the name match can happen — without it, imported rows
 * can only be recognised by the id they were written with.
 *
 * Category names are matched against the `categories` passed in, trying each level of a
 * "Level > Level > Leaf" hierarchy. Unmatched names are reported and left uncategorised —
 * never created — so a messy export cannot invent categories.
 */
export async function importCatalogCsv(
  text: string,
  categories: ManagedCategory[] = [],
  existingProducts: ExistingProductRef[] = [],
): Promise<ImportReport> {
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.name.trim().toLowerCase(), c.id);
  }

  // Name → id. Duplicate names are ambiguous, so they are excluded and reported rather
  // than silently resolving to whichever happened to be last.
  const existingByName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const p of existingProducts) {
    const key = p.name.trim().toLowerCase();
    if (!key) continue;
    if (existingByName.has(key)) {
      ambiguous.add(p.name.trim());
      existingByName.delete(key);
    } else if (!ambiguous.has(p.name.trim())) {
      existingByName.set(key, p.id);
    }
  }

  const { products, errors, warnings, unmappedColumns } = csvToProducts(text, {
    categoryMap,
    existingByName,
  });

  let created = 0;
  let matchedExisting = 0;
  for (const p of products) {
    const ref = doc(db, "products", p.id);
    // exists() is a METHOD. The recovered code read it as a property, so the value was the
    // function itself — always truthy — and `created` could never increment, making a
    // first-ever import report "0 created".
    const exists = (await getDoc(ref)).exists();
    if (exists) {
      matchedExisting++;
      await setDoc(ref, patchForExisting(p), { merge: true });
    } else {
      created++;
      // merge:true so a later import can add fields without wiping others.
      await setDoc(ref, stripUndefined(p), { merge: true });
    }
  }

  if (ambiguous.size > 0) {
    warnings.push(
      `More than one existing product shares these names, so incoming rows for them created new products instead of updating: ${[...ambiguous].join(", ")}. Rename the duplicates and re-import to consolidate.`,
    );
  }
  if (matchedExisting > 0) {
    warnings.push(
      `${matchedExisting} product${matchedExisting === 1 ? "" : "s"} already existed and ${matchedExisting === 1 ? "was" : "were"} updated in place. Note that a matched product's variants are replaced by the sheet's, so any inventory you set by hand on those variants is overwritten.`,
    );
  }

  return {
    created,
    updated: products.length - created,
    matchedExisting,
    errors,
    warnings,
    unmappedColumns,
  };
}
