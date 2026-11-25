import { describe, it, expect } from "@jest/globals";
import { categoriesWithProducts } from "@/lib/visible-categories";

const cats = [{ id: "hats" }, { id: "ornaments" }, { id: "shirts" }, { id: "empty" }];

describe("categoriesWithProducts", () => {
  it("keeps only categories a listed product carries", () => {
    const products = [{ categoryId: "hats" }, { categoryId: "shirts" }];
    expect(categoriesWithProducts(cats, products).map((c) => c.id)).toEqual(["hats", "shirts"]);
  });

  it("drops every category when nothing is listed", () => {
    expect(categoriesWithProducts(cats, [])).toEqual([]);
  });

  it("keeps the selected category even when it holds nothing", () => {
    // Otherwise a shopper sitting on an emptied category loses the filter that
    // explains why the results are empty.
    expect(categoriesWithProducts(cats, [], "ornaments").map((c) => c.id)).toEqual(["ornaments"]);
  });

  it("ignores products with no category or a blank one", () => {
    const products = [{}, { categoryId: "" }, { categoryId: "  " }, { categoryId: "shirts" }];
    expect(categoriesWithProducts(cats, products).map((c) => c.id)).toEqual(["shirts"]);
  });

  it("preserves the order of the categories it was given", () => {
    const products = [{ categoryId: "shirts" }, { categoryId: "hats" }];
    expect(categoriesWithProducts(cats, products).map((c) => c.id)).toEqual(["hats", "shirts"]);
  });
});
