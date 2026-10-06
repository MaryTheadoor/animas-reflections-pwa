import { describe, it, expect } from "@jest/globals";
import { parseCsv, csvToProducts, mapCatalogRow } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("handles quoted fields with commas and escaped quotes", () => {
    const text = 'name,desc\nTee,"Hello, world"\n"Say, ""hi""",x';
    expect(parseCsv(text)).toEqual([
      ["name", "desc"],
      ["Tee", "Hello, world"],
      ['Say, "hi"', "x"],
    ]);
  });
  it("skips fully blank rows", () => {
    expect(parseCsv("a,b\n1,2\n\n\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
});

describe("mapCatalogRow", () => {
  it("maps documented template columns", () => {
    const r = mapCatalogRow(["Name", "Variant", "Price", "SKU", "Inventory", "Colors", "Active"], ["Tee", "L / Navy", "25.00", "TEE-L-NAVY", "10", "Navy;White", "true"]);
    expect("name" in r && r.name).toBe("Tee");
    if ("name" in r) {
      expect(r.variant).toBe("L / Navy");
      expect(r.price).toBe(25);
      expect(r.sku).toBe("TEE-L-NAVY");
      expect(r.inventory).toBe(10);
      expect(r.colors).toEqual(["Navy", "White"]);
      expect(r.active).toBe(true);
    }
  });
  it("maps Square export aliases (item_name / variation_name / item_price / item_sku)", () => {
    const r = mapCatalogRow(["Item Name", "Variation Name", "Item Price", "Item SKU"], ["Tee", "Medium", "15.50", "TEE-M"]);
    expect("name" in r && r.name).toBe("Tee");
    if ("name" in r) { expect(r.variant).toBe("Medium"); expect(r.price).toBe(15.5); expect(r.sku).toBe("TEE-M"); }
  });
  it("flags a row missing a product name", () => {
    const r = mapCatalogRow(["name", "price"], ["", "5"]);
    expect("error" in r).toBe(true);
  });
});

describe("csvToProducts", () => {
  const csv = [
    "name,variant,price,sku,inventory,colors,category,active",
    "Tee,L,20.00,TEE-L,5,Black;White,Apparel,true",
    "Tee,M,20.00,TEE-M,3,Black,Apparel,true",
    "Hat,One Size,15.00,HAT-1,0,Red,Accessory,true",
  ].join("\n");

  it("groups variants into products", () => {
    const { products, errors } = csvToProducts(csv);
    expect(errors).toEqual([]);
    expect(products).toHaveLength(2);
    const tee = products.find((p) => p.name === "Tee")!;
    expect(tee.variants).toHaveLength(2);
    expect(tee.colors).toEqual(["black", "white"]);
    const hat = products.find((p) => p.name === "Hat")!;
    expect(hat.variants[0].inventory).toBe(0);
  });
  it("records a missing price as an error", () => {
    const bad = "name,variant,sku\nTee,L,TEE-L";
    const { errors } = csvToProducts(bad);
    expect(errors.some((e) => e.includes("missing a price"))).toBe(true);
  });

  it("derives a deterministic product id so a re-import updates in place", () => {
    const first = csvToProducts(csv).products;
    const second = csvToProducts(csv).products;
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
    // and ids are stable slugs of the name, not random uuids
    expect(first.find((p) => p.name === "Tee")!.id).toBe("tee");
  });

  it("resolves sheet categories against existing ones", () => {
    const categoryMap = new Map([["apparel", "cat-apparel"]]);
    const { products, warnings } = csvToProducts(csv, { categoryMap });
    expect(products.find((p) => p.name === "Tee")!.categoryId).toBe("cat-apparel");
    // "Accessory" is not in the map, so it is reported rather than invented
    expect(products.find((p) => p.name === "Hat")!.categoryId).toBe("");
    expect(warnings.some((w) => w.includes("Accessory"))).toBe(true);
  });

  it("reports columns that map to nothing", () => {
    const withJunk = "name,price,internal_notes\nTee,20.00,ignore me";
    const { unmappedColumns, warnings } = csvToProducts(withJunk);
    expect(unmappedColumns).toEqual(["internal_notes"]);
    expect(warnings.some((w) => w.includes("internal_notes"))).toBe(true);
  });

  it("warns and coerces an unknown productType instead of inventing a union member", () => {
    const odd = "name,price,productType\nThing,5.00,spaceship";
    const { products, warnings, errors } = csvToProducts(odd);
    expect(errors).toEqual([]);
    expect(products[0].productType).toBe("other");
    expect(warnings.some((w) => w.includes("spaceship"))).toBe(true);
  });
});
