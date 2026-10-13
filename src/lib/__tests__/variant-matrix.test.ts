/**
 * Tests for the variant matrix combination logic.
 *
 * The point of these functions is to remove the click-every-cell step, so the
 * cases that matter are the shapes an operator actually hits: one dimension,
 * the usual size × colour grid, and a third dimension that used to be pinned to
 * a single value by the dropdown.
 */
import { describe, it, expect } from "@jest/globals";
import {
  combinationKey,
  fillSize,
  matrixCombinations,
  missingCombinations,
  variantSku,
  visibleGridCombinations,
  type MatrixDimension,
} from "@/lib/variant-matrix";

const SIZES: MatrixDimension = { name: "Size", values: ["S", "M", "L"] };
const COLORS: MatrixDimension = { name: "Color", values: ["Black", "Sand"] };
const FITS: MatrixDimension = { name: "Fit", values: ["Regular", "Tall"] };

describe("matrixCombinations", () => {
  it("returns one combination per value for a single dimension", () => {
    expect(matrixCombinations([SIZES])).toEqual([["S"], ["M"], ["L"]]);
  });

  it("returns the full cartesian product for two dimensions", () => {
    expect(matrixCombinations([SIZES, COLORS])).toEqual([
      ["S", "Black"],
      ["S", "Sand"],
      ["M", "Black"],
      ["M", "Sand"],
      ["L", "Black"],
      ["L", "Sand"],
    ]);
  });

  it("multiplies a third dimension rather than pinning it", () => {
    expect(matrixCombinations([SIZES, COLORS, FITS])).toHaveLength(12);
    expect(matrixCombinations([SIZES, COLORS, FITS])[0]).toEqual(["S", "Black", "Regular"]);
  });

  it("ignores a dimension with no values", () => {
    expect(matrixCombinations([SIZES, { name: "Empty", values: [] }])).toEqual([["S"], ["M"], ["L"]]);
  });

  it("returns nothing when no dimension has values", () => {
    expect(matrixCombinations([{ name: "Empty", values: [] }])).toEqual([]);
    expect(matrixCombinations([])).toEqual([]);
  });
});

describe("visibleGridCombinations", () => {
  it("covers every cell of a two-dimension grid", () => {
    expect(visibleGridCombinations([SIZES, COLORS])).toHaveLength(6);
  });

  it("pins an extra dimension to the dropdown selection", () => {
    const out = visibleGridCombinations([SIZES, COLORS, FITS], { 0: "Tall" });
    expect(out).toHaveLength(6);
    expect(out.every((c) => c[2] === "Tall")).toBe(true);
  });

  it("defaults an extra dimension to its first value, matching the grid", () => {
    const out = visibleGridCombinations([SIZES, COLORS, FITS]);
    expect(out.every((c) => c[2] === "Regular")).toBe(true);
  });

  it("is just the value list for a single dimension", () => {
    expect(visibleGridCombinations([SIZES])).toEqual([["S"], ["M"], ["L"]]);
  });
});

describe("missingCombinations / fillSize", () => {
  const combinations = matrixCombinations([SIZES, COLORS]);

  it("reports only what is absent, so a fill is safe to repeat", () => {
    const existing = new Set([combinationKey(["S", "Black"]), combinationKey(["M", "Sand"])]);
    expect(fillSize(combinations, existing)).toBe(4);
    expect(missingCombinations(combinations, existing).map(combinationKey)).toEqual([
      "S|Sand",
      "M|Black",
      "L|Black",
      "L|Sand",
    ]);
  });

  it("is zero when the grid is already complete", () => {
    const existing = new Set(combinations.map(combinationKey));
    expect(fillSize(combinations, existing)).toBe(0);
    expect(missingCombinations(combinations, existing)).toEqual([]);
  });

  it("counts the whole grid when nothing exists", () => {
    expect(fillSize(combinations, new Set())).toBe(6);
  });
});

describe("variantSku", () => {
  it("prefixes the first three letters of each value", () => {
    expect(variantSku(["Sand", "Black"], "BH")).toBe("BH-SAN-BLA");
  });

  it("returns nothing without a prefix, rather than a dangling separator", () => {
    expect(variantSku(["S", "Black"], "  ")).toBe("");
  });
});
