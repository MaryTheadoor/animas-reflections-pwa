import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { csvToProducts } from "@/lib/csv";

/** Parse + write a CSV catalog to Firestore (admin-gated by rules). Returns counts/errors. */
export async function importCatalogCsv(text: string): Promise<{ created: number; updated: number; errors: string[] }> {
  const { products, errors } = csvToProducts(text);
  let created = 0;
  for (const p of products) {
    const ref = doc(db, "products", p.id);
    // merge:true so a re-import updates existing fields without wiping others.
    // Count as "updated" (upsert); "created" tracks first-time writes via a pre-read.
    const existing = (await getDoc(ref)).exists;
    await setDoc(ref, stripUndefined(p), { merge: true });
    if (!existing) created++;
  }
  return { created, updated: products.length - created, errors };
}
