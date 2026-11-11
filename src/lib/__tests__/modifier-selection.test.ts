/**
 * Tests for the product page's modifier-selection rules.
 *
 * The defect these cover: 157 products keep their real sizes in `modifiers`
 * while their `variants` are five identical "Regular" rows. If
 * `hasGenericVariants` says "not generic" for one of those, the product page
 * silently goes back to showing five indistinguishable buttons.
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildModifierAddons,
  captureModifierInputs,
  formatModifierDelta,
  groupModifiers,
  hasGenericVariants,
  isPlaceholderVariantName,
  modifierSelectedOptions,
  modifierTotal,
} from "@/lib/modifier-selection";
import type { ProductModifier } from "@/types";

/** A Bella + Canvas tee as the catalog stores it: placeholder variants, real
 *  sizes and colours in modifier groups. */
const PLACEHOLDER_VARIANTS = [
  { name: "Regular" },
  { name: "Regular" },
  { name: "Regular" },
  { name: "Regular" },
  { name: "Regular" },
];

const MODIFIERS: ProductModifier[] = [
  { id: "size-xl", name: "X-Large", priceType: "fixed", price: 0, inputType: "toggle", group: "Adult Size" },
  { id: "size-xxl", name: "XX-Large", priceType: "fixed", price: 3, inputType: "toggle", group: "Adult Size" },
  { id: "colour-black", name: "Black", priceType: "fixed", price: 0, inputType: "toggle", group: "Colour" },
  { id: "gift", name: "Gift wrap", priceType: "fixed", price: 5, inputType: "toggle" },
  { id: "name", name: "Name / Number", priceType: "fixed", price: 7, inputType: "text", group: "Personalization" },
  { id: "pct", name: "Rush", priceType: "percentage", price: 10, inputType: "toggle", group: "Extras" },
  { id: "art", name: "Artwork", priceType: "fixed", price: 0, inputType: "file", group: "Extras" },
];

describe("hasGenericVariants", () => {
  it("treats five identical 'Regular' variants as placeholders", () => {
    expect(hasGenericVariants({ variants: PLACEHOLDER_VARIANTS })).toBe(true);
  });

  it("treats product 07db885e's shapes — 'Price', 'One Size', 'Default', blank — as placeholders", () => {
    for (const name of ["Price", "One Size", "Default", "", "  Regular  "]) {
      expect(hasGenericVariants({ variants: [{ name }, { name }] })).toBe(true);
    }
  });

  it("treats a product with no variants as generic", () => {
    expect(hasGenericVariants({ variants: [] })).toBe(true);
    expect(hasGenericVariants(null)).toBe(true);
    expect(hasGenericVariants(undefined)).toBe(true);
  });

  it("keeps the variant picker when the names are real and distinct", () => {
    expect(hasGenericVariants({ variants: [{ name: "Small" }, { name: "Medium" }, { name: "Large" }] })).toBe(false);
    expect(hasGenericVariants({ variants: [{ name: "Black" }, { name: "White" }] })).toBe(false);
  });

  it("is generic when the one real name repeats — a single option is not a choice", () => {
    expect(hasGenericVariants({ variants: [{ name: "Large" }, { name: "Large" }] })).toBe(true);
    expect(hasGenericVariants({ variants: [{ name: "Large" }] })).toBe(true);
  });

  it("is generic for a single variant, whatever it is called", () => {
    expect(hasGenericVariants({ variants: [{ name: "Coffee Cup 15 oz" }] })).toBe(true);
  });

  it("does not let casing or extra whitespace make a placeholder look real", () => {
    expect(hasGenericVariants({ variants: [{ name: " REGULAR " }, { name: "Regular" }] })).toBe(true);
  });
});

describe("isPlaceholderVariantName", () => {
  it("flags the catalog's placeholder names", () => {
    for (const name of ["Regular", "price", "One Size", "Default", "", "   "]) {
      expect(isPlaceholderVariantName(name)).toBe(true);
    }
  });

  it("keeps a real variant name", () => {
    expect(isPlaceholderVariantName("15 oz")).toBe(false);
    expect(isPlaceholderVariantName("Regular fit hoodie")).toBe(false);
  });

  it("tolerates null and undefined", () => {
    expect(isPlaceholderVariantName(null)).toBe(true);
    expect(isPlaceholderVariantName(undefined)).toBe(true);
  });
});

describe("groupModifiers", () => {
  it("groups by name in catalog order and defaults the ungrouped to Add-ons", () => {
    const groups = groupModifiers(MODIFIERS);
    expect(groups.map((g) => g.name)).toEqual(["Adult Size", "Colour", "Add-ons", "Personalization", "Extras"]);
    expect(groups[0].modifiers.map((m) => m.id)).toEqual(["size-xl", "size-xxl"]);
    expect(groups[2].modifiers.map((m) => m.id)).toEqual(["gift"]);
  });

  it("merges non-adjacent modifiers of the same group into one entry", () => {
    const groups = groupModifiers([
      { id: "a", name: "A", priceType: "fixed", price: 0, group: "Size" },
      { id: "b", name: "B", priceType: "fixed", price: 0, group: "Colour" },
      { id: "c", name: "C", priceType: "fixed", price: 0, group: "Size" },
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Size", "Colour"]);
    expect(groups[0].modifiers.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("handles no modifiers", () => {
    expect(groupModifiers(undefined)).toEqual([]);
    expect(groupModifiers([])).toEqual([]);
  });
});

describe("formatModifierDelta", () => {
  it("shows a dollar delta, a percent delta, and nothing for a free option", () => {
    expect(formatModifierDelta(MODIFIERS[1])).toBe("+$3.00");
    expect(formatModifierDelta(MODIFIERS[5])).toBe("+10%");
    expect(formatModifierDelta(MODIFIERS[0])).toBe("");
  });
});

describe("buildModifierAddons", () => {
  it("uses the modifier id as type and addon_id, keeping the catalog price and price type", () => {
    const addons = buildModifierAddons(MODIFIERS, ["size-xxl"]);
    expect(addons).toEqual([
      { type: "size-xxl", addon_id: "size-xxl", label: "XX-Large", price: 3, priceType: "fixed" },
    ]);
  });

  it("keeps a percentage modifier unresolved so the cart can resolve it once", () => {
    expect(buildModifierAddons(MODIFIERS, ["pct"])[0]).toMatchObject({ price: 10, priceType: "percentage" });
  });

  it("returns the selection in catalog order and ignores unknown ids", () => {
    const addons = buildModifierAddons(MODIFIERS, ["gift", "size-xxl", "missing"]);
    expect(addons.map((a) => a.addon_id)).toEqual(["size-xxl", "gift"]);
  });

  it("returns nothing when nothing is selected", () => {
    expect(buildModifierAddons(MODIFIERS, [])).toEqual([]);
  });
});

describe("modifierTotal", () => {
  it("sums fixed deltas against the selected variant's base price", () => {
    expect(modifierTotal(MODIFIERS, ["size-xxl", "gift"], 40)).toBe(8);
  });

  it("resolves a percentage modifier against the base price", () => {
    expect(modifierTotal(MODIFIERS, ["pct"], 40)).toBe(4);
    expect(modifierTotal(MODIFIERS, ["pct"], 21.5)).toBe(2.15);
  });

  it("rounds to whole cents", () => {
    expect(modifierTotal(MODIFIERS, ["pct"], 19.99)).toBe(2);
  });

  it("is zero for a free selection", () => {
    expect(modifierTotal(MODIFIERS, ["size-xl", "colour-black"], 40)).toBe(0);
    expect(modifierTotal(MODIFIERS, [], 40)).toBe(0);
  });
});

describe("modifierSelectedOptions", () => {
  it("reports a toggle as its group and its name, so the line reads 'Adult Size: XX-Large'", () => {
    expect(modifierSelectedOptions(MODIFIERS, ["size-xxl", "colour-black"])).toEqual([
      { optionId: "size-xxl", optionName: "Adult Size", value: "XX-Large" },
      { optionId: "colour-black", optionName: "Colour", value: "Black" },
    ]);
  });

  it("falls back to Add-ons for an ungrouped toggle", () => {
    expect(modifierSelectedOptions(MODIFIERS, ["gift"])).toEqual([
      { optionId: "gift", optionName: "Add-ons", value: "Gift wrap" },
    ]);
  });

  it("reports a text modifier's typed value and skips it while blank", () => {
    expect(modifierSelectedOptions(MODIFIERS, ["name"], { name: " SMITH 42 " })).toEqual([
      { optionId: "name", optionName: "Name / Number", value: "SMITH 42" },
    ]);
    expect(modifierSelectedOptions(MODIFIERS, ["name"], { name: "   " })).toEqual([]);
    expect(modifierSelectedOptions(MODIFIERS, ["name"], {})).toEqual([]);
  });

  it("reports a file modifier's uploaded URL once it exists", () => {
    expect(modifierSelectedOptions(MODIFIERS, ["art"], { art: "https://example.com/art.png" })).toEqual([
      { optionId: "art", optionName: "Artwork", value: "https://example.com/art.png" },
    ]);
    expect(modifierSelectedOptions(MODIFIERS, ["art"], {})).toEqual([]);
  });

  it("returns an empty list when nothing is selected", () => {
    expect(modifierSelectedOptions(MODIFIERS, [])).toEqual([]);
  });
});

describe("captureModifierInputs", () => {
  it("captures text and file values only", () => {
    expect(captureModifierInputs(MODIFIERS, ["size-xxl", "name", "art"], {
      name: "SMITH 42",
      art: "https://example.com/art.png",
    })).toEqual([
      { modifierId: "name", modifierName: "Name / Number", value: "SMITH 42" },
      { modifierId: "art", modifierName: "Artwork", value: "https://example.com/art.png" },
    ]);
  });

  it("skips a blank or unselected input", () => {
    expect(captureModifierInputs(MODIFIERS, ["name"], { name: "  " })).toEqual([]);
    expect(captureModifierInputs(MODIFIERS, [], { name: "SMITH 42" })).toEqual([]);
  });
});
