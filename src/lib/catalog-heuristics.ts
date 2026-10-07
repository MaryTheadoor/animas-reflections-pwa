/**
 * Catalog heuristics for the CSV import.
 *
 * Recovered from the Square sync that was removed in `e7e1100` — specifically
 * `functions/src/sync.ts` as it existed at `e7e1100^`, where this mapping knowledge had
 * been tuned against *this* catalog (its brand patterns line up with the live category
 * names). Nothing of that file's sync behaviour is revived: these are pure data-in /
 * data-out helpers used by the importer.
 *
 * Two jobs:
 *  1. Decompose a flat variant label ("L / Navy") into structured option values, so an
 *     imported product arrives with real dimensions instead of one opaque name string.
 *  2. Infer brand / tags / productType when the sheet does not state them.
 */

import type { ProductType } from "@/types";

/**
 * Size patterns, most specific first. Order is load-bearing: `extractSize` returns the
 * first match, and the base words appear *inside* the extended forms ("X-Large" contains
 * "Large", "XXL" contains "L"). The recovered original tested Large before XL, so it
 * resolved "X-Large" to "L" — corrected here.
 *
 * Bare single letters are safe despite being case-insensitive: a word boundary is required
 * on both sides, so `\bL\b` cannot match inside "Large", and the words that would
 * otherwise collide ("Small", "Medium", "Standard", "Size") are matched earlier.
 */
const SIZE_PATTERNS: [RegExp, string][] = [
  [/\b(?:4 ?X-?L(?:arge)?|XXXXL)\b/i, "4XL"],
  [/\b(?:3 ?X-?L(?:arge)?|XXXL)\b/i, "3XL"],
  [/\b(?:2 ?X-?L(?:arge)?|XXL)\b/i, "2XL"],
  [/\bXXS\b/i, "XXS"],
  [/\b(?:Youth )?(?:X-?Small|XS)\b/i, "XS"],
  [/\b(?:X-?Large|XL)\b/i, "XL"],
  [/\bSmall\b/i, "S"],
  [/\bMedium\b/i, "M"],
  [/\bLarge\b/i, "L"],
  [/\bOne Size\b/i, "One Size"],
  [/\bStandard\b/i, "Standard"],
  [/\bTall\b/i, "Tall"],
  [/\bShort\b/i, "Short"],
  [/\bYouth\b/i, "Youth"],
  // Bare sizes last; the empty label means "use the matched text itself".
  [/\b(XS|S|M|L|XL|XXL)\b/i, ""],
];

/** Ornament / coaster diameters, e.g. 3" or 3.5". Handled separately: it carries its own value. */
const DIAMETER_PATTERN = /(\d+(?:\.\d+)?)\s*["\u201D]/;

const COLOR_PATTERNS: [RegExp, string][] = [
  [/\bBlack\b/i, "black"],
  [/\bWhite\b/i, "white"],
  [/\bGray|Grey\b/i, "gray"],
  [/\bNavy\b/i, "navy"],
  [/\bBlue\b/i, "blue"],
  [/\bRed\b/i, "red"],
  [/\bGreen\b/i, "green"],
  [/\bSage\b/i, "sage"],
  [/\bPurple\b/i, "purple"],
  [/\bPink\b/i, "pink"],
  [/\bOrange\b/i, "orange"],
  [/\bYellow\b/i, "yellow"],
  [/\bBrown\b/i, "brown"],
  [/\bTan\b/i, "tan"],
  [/\bCream\b/i, "cream"],
  [/\bHeather\b/i, "heather"],
  [/\bCharcoal\b/i, "charcoal"],
  [/\bAsh\b/i, "ash"],
  [/\bMaroon\b/i, "maroon"],
  [/\bTeal\b/i, "teal"],
  [/\bBurgundy\b/i, "burgundy"],
  [/\bRoyal\b/i, "royal"],
  [/\bNeon\b/i, "neon"],
];

/**
 * Brand/collection patterns. These deliberately mirror the category names already in the
 * catalog, because a detected brand is used to *look up* an existing category — the import
 * never creates one.
 */
const BRAND_PATTERNS: [RegExp, string][] = [
  [/\bbiscuit hockey\b/i, "Biscuit Hockey"],
  [/\bi.?m ok r u\b/i, "I'M OK R U"],
  [/\bdurango lacrosse\b/i, "Durango Lacrosse"],
  [/\bdurango hockey\b/i, "Durango Hockey"],
  [/\bdurango high school alpine ski\b/i, "Durango Alpine Ski"],
  [/\bdurango roller girls\b/i, "Durango Roller Girls"],
  [/\bdunphy\b/i, "Dunphy Stock FAM"],
  [/\bgreen buddh?a\b/i, "GREEN BUDDHA"],
  [/\blittle stranger\b/i, "LITTLE STRANGER"],
  [/\bjordan branch\b/i, "Jordan Branch Music"],
  [/\bet art\b/i, "ET Art"],
  [/\bwomen in aviation\b/i, "Women In Aviation"],
  [/\bfly high\b/i, "Fly High AA"],
  [/\bcustom slap\b/i, "Custom Slaps"],
  [/\bwood sign|chromaluxe wood\b/i, "Wood Signs"],
  [/\bpet scarf\b/i, "Pet Scarves"],
  [/\bornament\b/i, "Ornaments"],
  [/\bglass cutting board\b/i, "Glass Cutting Boards"],
  [/\bdrink hugger|neoprene\b/i, "Drink Huggers"],
  [/\bhat\b/i, "Hats"],
];

const TYPE_PATTERNS: [RegExp, ProductType][] = [
  [/\bsticker|slap|decal\b/i, "sticker"],
  [/\bsign|wood|plaque\b/i, "sign"],
  [/\bjewelry|pendant|necklace|bracelet|earring\b/i, "jewelry"],
  [/\bhat|bag|tote|scarf|drink|koozie|hugger|can cooler|ornament|coaster|cutting board|pet\b/i, "accessory"],
  [/\btee|t-shirt|t shirt|shirt|hoodie|hooded|sweat|tank|apparel|long.?sleeve|crewneck\b/i, "apparel"],
];

/** Colour names found in a label, canonicalised and de-duplicated. */
export function extractColors(label: string): string[] {
  const found: string[] = [];
  for (const [pattern, name] of COLOR_PATTERNS) {
    if (pattern.test(label) && !found.includes(name)) found.push(name);
  }
  return found;
}

/** Canonical size found in a label, or null. */
export function extractSize(label: string): string | null {
  const diameter = label.match(DIAMETER_PATTERN);
  if (diameter) return `${diameter[1]}"`;
  for (const [pattern, canonical] of SIZE_PATTERNS) {
    const m = label.match(pattern);
    if (!m) continue;
    // Empty canonical means the matched text is itself the value (bare sizes).
    return canonical === "" ? (m[1] ?? m[0].trim()) : canonical;
  }
  return null;
}

/**
 * A brand/collection implied by the product name, or null when nothing matches.
 *
 * Returns null rather than a generic fallback on purpose: the old sync defaulted every
 * product to "Animas Reflections", which would file generic items under a brand category
 * they do not belong to.
 */
export function detectBrand(name: string): string | null {
  for (const [pattern, brand] of BRAND_PATTERNS) {
    if (pattern.test(name)) return brand;
  }
  return null;
}

/**
 * Search tags derived from the name, description and resolved category.
 *
 * Deliberately narrower than the old sync's version, which also added every 3+ letter word
 * of the product name as a tag — that produced noise tags like "classic" and "tee" on
 * nearly every product, and our tags feed search.
 */
export function extractTags(name: string, description: string, categories: string[]): string[] {
  const combined = `${name} ${description} ${categories.join(" ")}`.toLowerCase();
  const tags = new Set<string>();
  for (const [pattern, tag] of TYPE_PATTERNS) {
    if (pattern.test(combined)) tags.add(tag);
  }
  return [...tags];
}

/** Best-guess product type from the brand and tags; "other" when nothing is recognisable. */
export function detectProductType(haystack: string[]): ProductType {
  const text = haystack.join(" ");
  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return "other";
}

export interface DerivedOptionValues {
  size: string | null;
  colors: string[];
}

/** Break a flat variant label into the option values it implies. */
export function deriveOptionValues(label: string): DerivedOptionValues {
  return { size: extractSize(label), colors: extractColors(label) };
}
