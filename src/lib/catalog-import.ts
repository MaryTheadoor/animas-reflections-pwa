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
  createCategories = false,
): Promise<ImportReport> {
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.name.trim().toLowerCase(), c.id);
  }

  // Name → id. When several existing products share a name we still pick one — the
  // lowest id, so the choice is deterministic — because refusing to match would make a
  // re-import create *another* copy instead of converging. The collision is reported so
  // the admin can clear it with the duplicate merge.
  const existingByName = new Map<string, string>();
  const collisions = new Map<string, string[]>();
  for (const p of [...existingProducts].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = p.name.trim().toLowerCase();
    if (!key) continue;
    const first = existingByName.get(key);
    if (first === undefined) {
      existingByName.set(key, p.id);
    } else {
      const list = collisions.get(key) ?? [first];
      list.push(p.id);
      collisions.set(key, list);
    }
  }

  const { products, errors, warnings, unmappedColumns, unresolvedCategories } = csvToProducts(text, {
    categoryMap,
    existingByName,
    createCategories,
  });

  // Create categories the sheet references but we do not have, when the operator asked for
  // it. The id is `cat_<slug>` so a later import of the same sheet resolves to the same doc.
  const createdCategoryNames: string[] = [];
  if (createCategories) {
    const idByName = new Map(categoryMap);
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const { productId, name } of unresolvedCategories) {
      const key = name.trim().toLowerCase();
      let id = idByName.get(key);
      if (!id) {
        id = `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed"}`;
        const now = new Date().toISOString();
        await setDoc(doc(db, "categories", id), {
          id,
          name: name.trim(),
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          order: 0,
          parentId: null,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });
        idByName.set(key, id);
        createdCategoryNames.push(name.trim());
      }
      const product = productById.get(productId);
      if (product) product.categoryId = id;
    }
    if (createdCategoryNames.length > 0) {
      warnings.push(
        `Created ${createdCategoryNames.length} categor${createdCategoryNames.length === 1 ? "y" : "ies"} that did not exist: ${createdCategoryNames.join(", ")}.`,
      );
    }
  }

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

  if (collisions.size > 0) {
    warnings.push(
      `${collisions.size} name${collisions.size === 1 ? "" : "s"} already had more than one product (${[...collisions.keys()].slice(0, 5).join(", ")}${collisions.size > 5 ? ", …" : ""}). Each incoming row updated one of them and left the others untouched — run “Find duplicate products” to collapse them.`,
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
