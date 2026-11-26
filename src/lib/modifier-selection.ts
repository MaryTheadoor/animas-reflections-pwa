/* ─── Modifier selection on the product page ──────────────────────────
   157 of 234 active products keep their real size and colour choices in
   `modifiers`, and their `variants` are placeholders — five rows all named
   "Regular" at the same price. Rendering `variants.map` therefore showed five
   identical buttons and no way to pick a size.

   The rules that decide what the product page renders live here as pure
   functions so they are visible and testable rather than buried in JSX: which
   products express choice through variants, how modifier groups are ordered,
   and what a selection turns into on the cart line.
   ────────────────────────────────────────────────────────────────────── */

import type { CartAddon, ModifierInput, ProductModifier, SelectedOption } from "@/types";
import { resolveAddonPrice } from "@/types";
import { categoryKey } from "@/lib/design-category";

/** Variant names the catalog uses as a placeholder instead of a real option. */
const PLACEHOLDER_VARIANT_NAMES = new Set(["regular", "price", "one size", "default", ""]);

/** Name of the group modifiers fall into when the catalog sets none. */
export const DEFAULT_MODIFIER_GROUP = "Add-ons";

function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when a variant name carries no customer-facing meaning (`Regular`,
 *  `Price`, `One Size`, `Default`, or blank) — so the cart must not print it. */
export function isPlaceholderVariantName(name: string | null | undefined): boolean {
  return PLACEHOLDER_VARIANT_NAMES.has(normalizeName(name));
}

/** True when the product's variants are placeholders rather than real options.
 *
 *  Variants are "meaningful" only when at least one name is not a placeholder
 *  AND there is more than one distinct name (five identical `Regular` rows are
 *  not a choice). Everything else — no variants, all placeholders, or several
 *  identical names — is generic, and the product's modifiers carry the real
 *  choice instead. */
export function hasGenericVariants(
  product: { variants?: readonly { name?: string | null }[] } | null | undefined,
): boolean {
  const variants = product?.variants ?? [];
  if (variants.length === 0) return true;
  const names = variants.map((v) => normalizeName(v.name));
  const hasMeaningfulName = names.some((name) => !PLACEHOLDER_VARIANT_NAMES.has(name));
  return !(hasMeaningfulName && new Set(names).size > 1);
}

export interface ModifierGroup {
  name: string;
  modifiers: ProductModifier[];
  /**
   * Whether the customer may pick more than one option from this group.
   *
   * Square encodes this per modifier list (`selection_type: SINGLE | MULTIPLE`) but the
   * import never carried it, so every group rendered as a checkbox and a shopper could
   * order "Please Select Color: Black, Red". A choice of colour, size, design or shape is
   * one choice; an add-on group is not. `singleSelectByName` decides the default, and an
   * explicit `selectionType` on the group wins.
   */
  selectionType: "single" | "multiple";
}

/**
 * Group names that mean "choose one".
 *
 * Deliberately name-based: the data has no flag to read (see `ModifierGroup.selectionType`),
 * and the live groups are named for the reader — "Please Select Color", "Adult Size",
 * "Logo Options", "Please Select Design". Anything not recognised stays multiple, which is
 * the existing behaviour, so this can only narrow a choice, never widen one.
 */
const SINGLE_SELECT_HINTS = [
  "size",
  "color",
  "colour",
  "design",
  "logo",
  "shape",
  "style",
  "placement",
  "option below",
  "background",
  "patch",
  "fit",
  "material",
  "length",
];

export function singleSelectByName(name: string): boolean {
  const n = (name ?? "").toLowerCase();
  if (!n.trim()) return false;
  return SINGLE_SELECT_HINTS.some((hint) => n.includes(hint));
}

/** Group modifiers by `mod.group` (default `Add-ons`), preserving catalog order
 *  both between groups and inside them — the same order the customizer shows. */
export function groupModifiers(
  modifiers: readonly ProductModifier[] | null | undefined,
): ModifierGroup[] {
  const groups: ModifierGroup[] = [];
  const byName = new Map<string, ModifierGroup>();
  for (const mod of modifiers ?? []) {
    const name = (mod.group ?? "").trim() || DEFAULT_MODIFIER_GROUP;
    let group = byName.get(name);
    if (!group) {
      group = { name, modifiers: [], selectionType: singleSelectByName(name) ? "single" : "multiple" };
      byName.set(name, group);
      groups.push(group);
    }
    group.modifiers.push(mod);
  }
  return groups;
}

/**
 * Toggle one option and return the next selection, honouring the group's rule.
 *
 * In a single-select group, choosing a second option **replaces** the first rather than
 * adding to it — that is what stops "Color: Black, Red". Deselecting always removes.
 */
export function toggleSelection(
  selectedIds: readonly string[],
  modifierId: string,
  groups: readonly ModifierGroup[],
): string[] {
  const group = groups.find((g) => g.modifiers.some((m) => m.id === modifierId));
  if (selectedIds.includes(modifierId)) {
    return selectedIds.filter((id) => id !== modifierId);
  }
  if (!group || group.selectionType === "multiple") {
    return [...selectedIds, modifierId];
  }
  const inGroup = new Set(group.modifiers.map((m) => m.id));
  return [...selectedIds.filter((id) => !inGroup.has(id)), modifierId];
}

/**
 * Drop groups whose every option is already a variant name.
 *
 * A product can legitimately have BOTH real variants and meaningful modifiers —
 * the Yupoong snapback has four colour variants plus "Patch Shape" and
 * "Background Color For Patch". The old rule rendered modifiers only when the
 * variants were placeholders, so those 17 patch options were invisible. Render
 * the groups, but suppress one that merely repeats the variant picker (a "Size"
 * modifier set on a product whose variants are S/M/L), so the shopper never sees
 * the same choice twice.
 */
export function withoutVariantDuplicates(
  groups: readonly ModifierGroup[],
  variants: readonly { name?: string }[] | null | undefined,
): ModifierGroup[] {
  const variantNames = new Set(
    (variants ?? []).map((v) => categoryKey(v.name)).filter(Boolean),
  );
  if (variantNames.size === 0) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      modifiers: group.modifiers.filter((m) => !variantNames.has(categoryKey(m.name))),
    }))
    .filter((group) => group.modifiers.length > 0);
}

/** The price delta to show beside a modifier: `+$3.00`, `+10%`, or `""` when
 *  the option costs nothing (a size chip reading "+$0.00" is just noise). */
export function formatModifierDelta(mod: ProductModifier): string {
  if (mod.priceType === "percentage") {
    return mod.price > 0 ? `+${mod.price}%` : "";
  }
  return mod.price > 0 ? `+$${mod.price.toFixed(2)}` : "";
}

/** The selected modifiers, in catalog order, as the cart's add-on shape.
 *
 *  `price` stays the catalog value with `priceType` beside it, exactly as the
 *  customizer writes it: the cart and checkout resolve percentage add-ons
 *  against the line's base price via `resolveAddonPrice`, so storing a resolved
 *  dollar amount next to `priceType: "percentage"` would apply the percentage
 *  twice. Use `modifierTotal` for the displayed dollars. */
export function buildModifierAddons(
  modifiers: readonly ProductModifier[] | null | undefined,
  selectedIds: readonly string[],
): CartAddon[] {
  return (modifiers ?? [])
    .filter((mod) => selectedIds.includes(mod.id))
    .map((mod) => ({
      type: mod.id,
      addon_id: mod.id,
      label: mod.name,
      price: mod.price,
      priceType: mod.priceType,
    }));
}

/** Dollars added by the selected modifiers for a variant of `basePrice`. */
export function modifierTotal(
  modifiers: readonly ProductModifier[] | null | undefined,
  selectedIds: readonly string[],
  basePrice: number,
): number {
  const sum = buildModifierAddons(modifiers, selectedIds).reduce(
    (total, addon) => total + resolveAddonPrice(addon, basePrice),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/** The chosen modifiers as cart options, so the line reads
 *  "Adult Size: Large" in the drawer and in the order note.
 *
 *  A toggle's value is its own name under the group it belongs to (the Square
 *  modifier-list shape); a text or file modifier reports its captured value and
 *  is skipped while that value is still blank. */
export function modifierSelectedOptions(
  modifiers: readonly ProductModifier[] | null | undefined,
  selectedIds: readonly string[],
  inputs: Record<string, string> = {},
): SelectedOption[] {
  const options: SelectedOption[] = [];
  for (const mod of modifiers ?? []) {
    if (!selectedIds.includes(mod.id)) continue;
    if (mod.inputType === "text" || mod.inputType === "file") {
      const value = (inputs[mod.id] ?? "").trim();
      if (!value) continue;
      options.push({ optionId: mod.id, optionName: mod.name, value });
      continue;
    }
    options.push({
      optionId: mod.id,
      optionName: (mod.group ?? "").trim() || DEFAULT_MODIFIER_GROUP,
      value: mod.name,
    });
  }
  return options;
}

/** Captured text/file values for the selected modifiers, for fulfilment. */
export function captureModifierInputs(
  modifiers: readonly ProductModifier[] | null | undefined,
  selectedIds: readonly string[],
  inputs: Record<string, string> = {},
): ModifierInput[] {
  const captured: ModifierInput[] = [];
  for (const mod of modifiers ?? []) {
    if (!selectedIds.includes(mod.id)) continue;
    if (mod.inputType !== "text" && mod.inputType !== "file") continue;
    const value = (inputs[mod.id] ?? "").trim();
    if (value) captured.push({ modifierId: mod.id, modifierName: mod.name, value });
  }
  return captured;
}
