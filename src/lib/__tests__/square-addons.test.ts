import { describe, it, expect } from "@jest/globals";
import {
  buildModifiersForProduct,
  type SquareModifierList,
  type SquareModifierRef,
} from "@/lib/square-addons";

const lists: SquareModifierList[] = [
  {
    id: "L1",
    name: "Choose Size",
    modifierType: "LIST",
    minSelected: 1,
    maxSelected: 1,
    modifiers: [
      { id: "c1", name: "Small", price: 0, onByDefault: false, hiddenOnline: false },
      { id: "c2", name: "Large", price: 2, onByDefault: false, hiddenOnline: false },
    ],
  },
  {
    id: "L2",
    name: "Add Name",
    modifierType: "TEXT",
    minSelected: null,
    maxSelected: null,
    modifiers: [],
  },
  {
    id: "L3",
    name: "Extras",
    modifierType: "LIST",
    minSelected: null,
    maxSelected: null,
    modifiers: [
      { id: "c3", name: "Gift wrap", price: 3.5, onByDefault: false, hiddenOnline: false },
      { id: "c4", name: "Hidden thing", price: 1, onByDefault: false, hiddenOnline: true },
    ],
  },
  // Two different sets that SHARE a name — Square disambiguates them with an id.
  {
    id: "COLOR_A",
    name: "Please Select Color",
    modifierType: "LIST",
    minSelected: null,
    maxSelected: null,
    modifiers: [{ id: "a1", name: "Navy", price: 0, onByDefault: false, hiddenOnline: false }],
  },
  {
    id: "COLOR_B",
    name: "Please Select Color",
    modifierType: "LIST",
    minSelected: null,
    maxSelected: null,
    modifiers: [{ id: "b1", name: "Maroon", price: 0, onByDefault: false, hiddenOnline: false }],
  },
];

const ref = (name: string, squareListId?: string): SquareModifierRef =>
  squareListId ? { name, squareListId } : { name };

describe("buildModifiersForProduct", () => {
  it("turns each Square choice into a toggle, grouped by the list name", () => {
    const { modifiers, matchedSets } = buildModifiersForProduct([ref("Choose Size")], lists);
    expect(matchedSets).toEqual(["Choose Size"]);
    expect(modifiers).toHaveLength(2);
    expect(modifiers[0]).toMatchObject({
      id: "sq_c1",
      name: "Small",
      price: 0,
      priceType: "fixed",
      inputType: "toggle",
      group: "Choose Size",
    });
    expect(modifiers[1]).toMatchObject({ name: "Large", price: 2 });
  });

  it("maps a TEXT list to one text-input modifier", () => {
    const { modifiers } = buildModifiersForProduct([ref("Add Name")], lists);
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0]).toMatchObject({
      inputType: "text",
      inputLabel: "Add Name",
      group: "Add Name",
      price: 0,
    });
  });

  it("skips choices Square hides online", () => {
    const { modifiers } = buildModifiersForProduct([ref("Extras")], lists);
    expect(modifiers.map((m) => m.name)).toEqual(["Gift wrap"]);
  });

  it("matches a set name case- and whitespace-insensitively when it is unambiguous", () => {
    const { matchedSets } = buildModifiersForProduct([ref("  choose   SIZE ")], lists);
    expect(matchedSets).toEqual(["Choose Size"]);
  });

  it("reports set names Square did not return", () => {
    const { missingSets, matchedSets } = buildModifiersForProduct(
      [ref("Choose Size"), ref("Gone List")],
      lists,
    );
    expect(matchedSets).toEqual(["Choose Size"]);
    expect(missingSets).toEqual(["Gone List"]);
  });

  it("flags a single-choice list, which our flat model cannot express", () => {
    expect(buildModifiersForProduct([ref("Choose Size")], lists).hasSelectOne).toBe(true);
    expect(buildModifiersForProduct([ref("Extras")], lists).hasSelectOne).toBe(false);
  });

  it("resolves a duplicated set name by its Square id", () => {
    const a = buildModifiersForProduct([ref("Please Select Color", "COLOR_A")], lists);
    expect(a.modifiers.map((m) => m.name)).toEqual(["Navy"]);
    const b = buildModifiersForProduct([ref("Please Select Color", "COLOR_B")], lists);
    expect(b.modifiers.map((m) => m.name)).toEqual(["Maroon"]);
  });

  it("refuses to guess when a name is duplicated and no id was recorded", () => {
    const { modifiers, ambiguousSets, matchedSets } = buildModifiersForProduct(
      [ref("Please Select Color")],
      lists,
    );
    expect(matchedSets).toEqual([]);
    expect(ambiguousSets).toEqual(["Please Select Color"]);
    expect(modifiers).toEqual([]);
  });

  it("returns nothing for a product with no sets", () => {
    const { modifiers, matchedSets, missingSets, ambiguousSets } = buildModifiersForProduct([], lists);
    expect(modifiers).toEqual([]);
    expect(matchedSets).toEqual([]);
    expect(missingSets).toEqual([]);
    expect(ambiguousSets).toEqual([]);
  });
});
