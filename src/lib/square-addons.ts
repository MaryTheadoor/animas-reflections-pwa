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
 * **Resolution order matters.** Square lets two lists share a name; when it does, the item
 * export suffixes the column with the list id (`… - 4YXGF6OQDCYL7YJAUCKEZED3`). So a
 * recorded `squareListId` is matched first and is authoritative. A name is only trusted
 * when exactly one list carries it — if several do, the set is reported as ambiguous rather
 * than guessed at, because attaching the wrong list is worse than attaching none.
 *
 * **Known semantic gap:** Square's `selectionType` (SINGLE/MULTIPLE) and its min/max rules
 * are not representable in our model, which allows any combination. A single-choice list
 * therefore arrives as a group of individually toggleable add-ons rather than a radio group.
 * Flagged in the result rather than silently lost.
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

/** A set a product uses, as recorded from the item export. */
export interface SquareModifierRef {
  name: string;
  squareListId?: string;
}

export interface AddonBuildResult {
  modifiers: ProductModifier[];
  /** Sets matched to a Square list (by id, or by an unambiguous name). */
  matchedSets: string[];
  /** Sets Square did not return at all. */
  missingSets: string[];
  /** Sets whose name matched more than one Square list and carried no id — skipped. */
  ambiguousSets: string[];
  /** True when a matched list is a single-choice list (see the module note). */
  hasSelectOne: boolean;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build a product's add-ons from the Square modifier-set references the export recorded. */
export function buildModifiersForProduct(
  refs: SquareModifierRef[],
  lists: SquareModifierList[],
): AddonBuildResult {
  const byId = new Map(lists.map((l) => [l.id, l]));
  const byName = new Map<string, SquareModifierList[]>();
  for (const l of lists) {
    const key = normalize(l.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(l);
  }

  const modifiers: ProductModifier[] = [];
  const matchedSets: string[] = [];
  const missingSets: string[] = [];
  const ambiguousSets: string[] = [];
  let hasSelectOne = false;

  for (const ref of refs) {
    let list: SquareModifierList | undefined;
    if (ref.squareListId) {
      list = byId.get(ref.squareListId);
    }
    if (!list) {
      const candidates = byName.get(normalize(ref.name)) ?? [];
      if (candidates.length === 1) {
        list = candidates[0];
      } else if (candidates.length > 1) {
        // Never guess between same-named sets.
        ambiguousSets.push(ref.name);
        continue;
      }
    }
    if (!list) {
      missingSets.push(ref.name);
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

  return { modifiers, matchedSets, missingSets, ambiguousSets, hasSelectOne };
}
