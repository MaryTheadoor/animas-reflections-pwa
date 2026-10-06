import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { csvToProducts } from "@/lib/csv";
import type { ManagedCategory } from "@/types";

export interface ImportReport {
  created: number;
  updated: number;
  /** Row-level failures: the row could not be turned into a product. */
  errors: string[];
  /** Non-fatal notes: unmatched categories, unmapped columns, coerced values. */
  warnings: string[];
  /** Headers present in the file that map to nothing. */
  unmappedColumns: string[];
}

/**
 * Parse + write a CSV catalog to Firestore (admin-gated by rules).
 *
 * Product ids are deterministic (`csvToProducts` slugs the name when the sheet has no
 * `id`), so re-importing a corrected sheet updates the same documents rather than
 * duplicating the catalog.
 *
 * Category names are matched against the `categories` passed in. Unmatched names are
 * reported and left uncategorised — never created — so a messy export cannot invent
 * categories. Create the category (or fix the sheet) and re-import to place them.
 */
export async function importCatalogCsv(
  text: string,
  categories: ManagedCategory[] = [],
): Promise<ImportReport> {
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.name.trim().toLowerCase(), c.id);
  }

  const { products, errors, warnings, unmappedColumns } = csvToProducts(text, { categoryMap });

  let created = 0;
  for (const p of products) {
    const ref = doc(db, "products", p.id);
    // merge:true so a re-import updates existing fields without wiping others.
    // Count as "updated" (upsert); "created" tracks first-time writes via a pre-read.
    const existing = (await getDoc(ref)).exists;
    await setDoc(ref, stripUndefined(p), { merge: true });
    if (!existing) created++;
  }

  return { created, updated: products.length - created, errors, warnings, unmappedColumns };
}
