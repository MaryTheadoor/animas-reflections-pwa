/**
 * Mapping Square modifier lists onto our add-on model.
 *
 * Square's shape: a **list** of **choices**, each choice carrying a price — e.g. the list
 * "Choose Size" holding S/M/L. It also allows a TEXT-type list, which is a free-text field
 * with no choices at all.
 *
 * Our shape (`ProductModifier`) is a flat set of toggleable add-ons that can be grouped
 * visually, so the translation is:
 *
 *   Square list name   → `group`   (our customizer already renders headings per group)
 *   Square choice      → one `ProductModifier` (inputType "toggle", priceType "fixed")
 *   Square TEXT list   → one `ProductModifier` with inputType "text"
 *
 * **Known semantic gap:** Square's `selectionType` (SINGLE/MULTIPLE) and its
 * min/max-selection rules are not represented in our model, which permits any combination.
 * A single-choice list therefore arrives as a group of individually toggleable add-ons
 * rather than a radio group. Noted in the import report rather than silently lost.
 */

import type { ProductModifier } from "@/types";

export interface SquareModifierChoice {
  id: string;
  name: string;
  price: number;
  onByDefault: boolean;
  hiddenOnline: boolean;
}

export interface SquareModifierList {
  id: string;
  name: string;
  modifierType: string;
  minSelected: number | null;
  maxSelected: number | null;
  modifiers: SquareModifierChoice[];
}

export interface AddonBuildResult {
  modifiers: ProductModifier[];
  /** Set names that matched a Square list. */
  matchedSets: string[];
  /** Set names the export referenced but Square did not return. */
  missingSets: string[];
  /** True when at least one matched list is a single-choice list (see the module note). */
  hasSelectOne: boolean;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build a product's add-ons from the Square modifier-set names the export recorded. */
export function buildModifiersForProduct(
  setNames: string[],
  lists: SquareModifierList[],
): AddonBuildResult {
  const byName = new Map(lists.map((l) => [normalize(l.name), l]));
  const modifiers: ProductModifier[] = [];
  const matchedSets: string[] = [];
  const missingSets: string[] = [];
  let hasSelectOne = false;

  for (const setName of setNames) {
    const list = byName.get(normalize(setName));
    if (!list) {
      missingSets.push(setName);
      continue;
    }
    matchedSets.push(list.name);

    if (list.modifierType === "TEXT") {
      modifiers.push({
        id: `sq_${list.id}`,
        name: list.name,
        priceType: "fixed",
        price: 0,
        inputType: "text",
        inputLabel: list.name,
        group: list.name,
      });
      continue;
    }

    if (list.minSelected === 1 && list.maxSelected === 1) hasSelectOne = true;

    for (const choice of list.modifiers) {
      // Square hides some choices online; importing them would offer something the
      // customer could not have selected on the old site either.
      if (choice.hiddenOnline) continue;
      modifiers.push({
        id: `sq_${choice.id}`,
        name: choice.name,
        priceType: "fixed",
        price: choice.price,
        inputType: "toggle",
        group: list.name,
      });
    }
  }

  return { modifiers, matchedSets, missingSets, hasSelectOne };
}
