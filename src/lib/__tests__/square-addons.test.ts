import { describe, it, expect } from "@jest/globals";
import { buildModifiersForProduct, type SquareModifierList } from "@/lib/square-addons";

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
];

describe("buildModifiersForProduct", () => {
  it("turns each Square choice into a toggle, grouped by the list name", () => {
    const { modifiers, matchedSets } = buildModifiersForProduct(["Choose Size"], lists);
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
    const { modifiers } = buildModifiersForProduct(["Add Name"], lists);
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0]).toMatchObject({
      inputType: "text",
      inputLabel: "Add Name",
      group: "Add Name",
      price: 0,
    });
  });

  it("skips choices Square hides online", () => {
    const { modifiers } = buildModifiersForProduct(["Extras"], lists);
    expect(modifiers.map((m) => m.name)).toEqual(["Gift wrap"]);
  });

  it("matches set names case- and whitespace-insensitively", () => {
    const { matchedSets } = buildModifiersForProduct(["  choose   SIZE "], lists);
    expect(matchedSets).toEqual(["Choose Size"]);
  });

  it("reports set names Square did not return", () => {
    const { missingSets, matchedSets } = buildModifiersForProduct(["Choose Size", "Gone List"], lists);
    expect(matchedSets).toEqual(["Choose Size"]);
    expect(missingSets).toEqual(["Gone List"]);
  });

  it("flags a single-choice list, which our flat model cannot express", () => {
    expect(buildModifiersForProduct(["Choose Size"], lists).hasSelectOne).toBe(true);
    expect(buildModifiersForProduct(["Extras"], lists).hasSelectOne).toBe(false);
  });

  it("returns nothing for a product with no sets", () => {
    const { modifiers, matchedSets, missingSets } = buildModifiersForProduct([], lists);
    expect(modifiers).toEqual([]);
    expect(matchedSets).toEqual([]);
    expect(missingSets).toEqual([]);
  });
});
