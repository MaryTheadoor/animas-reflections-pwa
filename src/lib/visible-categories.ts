/* ─── Which categories to advertise ───────────────────────────────────
   The `categories` collection does not know how many products are listed,
   so a filter built from it advertises every category ever created. With the
   catalogue unlisted for launch that left the shop offering a dozen categories
   that resolve to an empty page — a shopper picks "Hats" and the shop looks
   broken.

   A category is offered only while a listed product carries it. The currently
   selected one is kept so a filter never disappears from under the shopper who
   selected it.
   ──────────────────────────────────────────────────────────────────── */

type CategoryLike = { id: string };
type ProductLike = { categoryId?: string };

/**
 * `categories`, narrowed to those with at least one listed product.
 *
 * @param keepId a category to keep regardless — normally the active filter.
 */
export function categoriesWithProducts<C extends CategoryLike>(
  categories: readonly C[],
  products: readonly ProductLike[],
  keepId?: string,
): C[] {
  const counted = new Set<string>();
  for (const product of products) {
    const id = (product.categoryId ?? "").trim();
    if (id) counted.add(id);
  }
  return categories.filter((cat) => counted.has(cat.id) || cat.id === keepId);
}
