/**
 * What an admin product save actually requires.
 *
 * Extracted so the rule is testable and so the editor can EXPLAIN a refusal.
 * The old guard was `if (!name || !categoryId || !variants.length) return;`
 * behind a disabled button — two thirds of the live catalog has no category, so
 * those products were uneditable and clicking the greyed button said nothing.
 *
 * Category is deliberately NOT required: `categoryId` is optional in the data
 * model, the shop renders uncategorised products under "All", and 254 of 377
 * live products already have none. Requiring it blocked edits to real products.
 */

export interface SaveCandidate {
  name?: string;
  variants?: unknown[];
}

/** Human-readable list of what is missing, e.g. ["a product name"]. */
export function productSaveIssues(product: SaveCandidate): string[] {
  const issues: string[] = [];
  if (!(product.name ?? "").trim()) issues.push("a product name");
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    issues.push("at least one variant");
  }
  return issues;
}

/** A single sentence for the error banner, or null when the product is saveable. */
export function productSaveIssueMessage(product: SaveCandidate): string | null {
  const issues = productSaveIssues(product);
  if (issues.length === 0) return null;
  return `Cannot save yet — add ${issues.join(" and ")}.`;
}

/**
 * A save is only real if the SERVER has it. The Firestore Web SDK resolves a
 * write from its local cache when it believes it is offline, queueing it for
 * later — or never. The editor then shows the change, and the next session reads
 * the server and sees the old document. That is the "saved but not in a new
 * session" bug; comparing the echoed `updatedAt` catches it.
 */
export function saveConfirmedByServer(
  serverUpdatedAt: unknown,
  expectedUpdatedAt: string,
): boolean {
  return typeof serverUpdatedAt === "string" && serverUpdatedAt === expectedUpdatedAt;
}
