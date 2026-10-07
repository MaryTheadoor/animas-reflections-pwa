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

describe("csvToProducts — heuristics", () => {
  const brandCsv = [
    "name,variant,price",
    "Biscuit Hockey Tee,L,20.00",
    "Biscuit Hockey Tee,X-Large,21.00",
    "Biscuit Hockey Tee,M,20.00",
  ].join("\n");

  it("derives structured variant options from flat labels", () => {
    const { products } = csvToProducts(brandCsv);
    const tee = products[0];
    const size = tee.options?.find((o) => o.name === "Size");
    expect(size).toBeDefined();
    expect(size!.type).toBe("select");
    expect(size!.values).toEqual(["L", "XL", "M"]);
    expect(tee.variants.map((v) => v.options?.Size)).toEqual(["L", "XL", "M"]);
  });

  it("declares a Color dimension, typed as a swatch, when labels carry colours", () => {
    const colourCsv = "name,variant,price\nCap,Navy,15.00\nCap,Red,15.00";
    const { products } = csvToProducts(colourCsv);
    const colour = products[0].options?.find((o) => o.name === "Color");
    expect(colour).toBeDefined();
    expect(colour!.type).toBe("color");
    expect(colour!.values).toEqual(["navy", "red"]);
  });

  it("uses a detected brand as the category when the sheet omits one", () => {
    const categoryMap = new Map([["biscuit hockey", "cat-bh"]]);
    const { products } = csvToProducts(brandCsv, { categoryMap });
    expect(products[0].categoryId).toBe("cat-bh");
  });

  it("reports a detected brand whose category does not exist, rather than inventing it", () => {
    const { products, warnings } = csvToProducts(brandCsv);
    expect(products[0].categoryId).toBe("");
    expect(warnings.some((w) => w.includes("Biscuit Hockey"))).toBe(true);
  });

  it("infers the product type when the sheet is silent", () => {
    const { products, warnings } = csvToProducts(brandCsv);
    expect(products[0].productType).toBe("apparel");
    expect(warnings.some((w) => w.includes("inferred"))).toBe(true);
  });

  it("warns when multi-variant labels reveal no dimensions to build from", () => {
    const opaque = "name,variant,price\nWidget,Alpha,5.00\nWidget,Beta,6.00";
    const { products, warnings } = csvToProducts(opaque);
    expect(products[0].options).toBeUndefined();
    expect(warnings.some((w) => w.includes("no option dimensions were set"))).toBe(true);
  });

  it("keeps dimensions with real choice and strips the single-valued ones", () => {
    // Both variants are "One Size", so Size is not a choice; the colour is.
    const csv = "name,variant,price\nCap,One Size Navy,15.00\nCap,One Size Red,15.00";
    const { products } = csvToProducts(csv);
    const cap = products[0];
    expect(cap.options?.map((o) => o.name)).toEqual(["Color"]);
    expect(cap.variants.map((v) => v.options)).toEqual([{ Color: "navy" }, { Color: "red" }]);
  });

  it("drops a single-valued dimension rather than adding a one-option selector", () => {
    const single = "name,variant,price\nMug,One Size,12.00";
    const { products } = csvToProducts(single);
    expect(products[0].options).toBeUndefined();
    expect(products[0].variants[0].options).toBeUndefined();
  });
});

describe("csvToProducts — Square export columns", () => {
  it("keeps the Square variation Token as the variant's squareVariationId", () => {
    const csv = "Token,Item Name,Variation Name,Price\nUVMBEKTJ5TCWTXR45MK6KLFS,Tee,L,20.00";
    const { products } = csvToProducts(csv);
    expect(products[0].variants[0].squareVariationId).toBe("UVMBEKTJ5TCWTXR45MK6KLFS");
  });

  it("prefers explicit Option Name/Value columns over parsing the label", () => {
    const csv = [
      "Item Name,Variation Name,Option Name 1,Option Value 1,Price",
      "Tee,Whatever,Size,Small,20.00",
      "Tee,Whatever,Size,Large,21.00",
    ].join("\n");
    const { products } = csvToProducts(csv);
    expect(products[0].variants.map((v) => v.options)).toEqual([
      { Size: "Small" },
      { Size: "Large" },
    ]);
    expect(products[0].options?.[0]).toMatchObject({ name: "Size", values: ["Small", "Large"] });
  });

  it("resolves a ' > ' category hierarchy against the leaf, then the parent", () => {
    const csv = "Item Name,Price,Categories\nTee,20.00,Bands > LITTLE STRANGER FAN BASED FUNDRAISING";
    const leaf = csvToProducts(csv, { categoryMap: new Map([["little stranger fan based fundraising", "cat-leaf"]]) });
    expect(leaf.products[0].categoryId).toBe("cat-leaf");
    const parent = csvToProducts(csv, { categoryMap: new Map([["bands", "cat-parent"]]) });
    expect(parent.products[0].categoryId).toBe("cat-parent");
  });

  it("treats an archived item as inactive, and archived beats visibility", () => {
    const archived = csvToProducts("Item Name,Price,Archived\nOld Tee,10.00,Y");
    expect(archived.products[0].active).toBe(false);
    const both = csvToProducts("Item Name,Price,Archived,Square Online Item Visibility\nTee,10.00,Y,visible");
    expect(both.products[0].active).toBe(false);
  });

  it("treats a non-visible online item as inactive", () => {
    const { products } = csvToProducts("Item Name,Price,Square Online Item Visibility\nTee,10.00,hidden");
    expect(products[0].active).toBe(false);
  });

  it("finds the location-suffixed stock column by prefix and records inventory", () => {
    const csv = "Item Name,Price,Current Quantity Animas Reflections LLC\nTee,20.00,7";
    const { products, unmappedColumns } = csvToProducts(csv);
    expect(products[0].variants[0].inventory).toBe(7);
    expect(unmappedColumns).toEqual([]);
  });

  it("converts weight from pounds to ounces", () => {
    const { products } = csvToProducts("Item Name,Price,Weight (lb)\nTee,20.00,0.5");
    expect(products[0].weightOz).toBe(8);
  });

  it("recognises modifier-set columns without treating them as unmapped noise", () => {
    const csv = [
      "Item Name,Price,Modifier Set - Choose Size",
      "Tee,20.00,Y",
    ].join("\n");
    const { unmappedColumns, warnings } = csvToProducts(csv);
    expect(unmappedColumns).toEqual([]);
    expect(warnings.some((w) => w.includes("modifier set"))).toBe(true);
  });

  it("reuses an existing product's id when the name matches, so a re-import updates it", () => {
    const csv = "Item Name,Price\nBella + Canvas Unisex Jersey T-Shirt,40.00";
    const existingByName = new Map([["bella + canvas unisex jersey t-shirt", "07db885e-799f-4899-bb65-f1f7b5a74bb0"]]);
    const { products } = csvToProducts(csv, { existingByName });
    // not a fresh slug id — this row targets the document that already exists
    expect(products[0].id).toBe("07db885e-799f-4899-bb65-f1f7b5a74bb0");
  });

  it("reports the preferred leaf name to create when createCategories is on", () => {
    const csv = "Item Name,Price,Categories\nTee,20.00,Bands > LITTLE STRANGER FAN BASED FUNDRAISING";
    const { products, unresolvedCategories, warnings } = csvToProducts(csv, { createCategories: true });
    expect(products[0].categoryId).toBe("");
    expect(unresolvedCategories).toEqual([
      { productId: "tee", name: "LITTLE STRANGER FAN BASED FUNDRAISING" },
    ]);
    expect(warnings.some((w) => w.includes("will be created"))).toBe(true);
  });

  it("strips a trailing id and picks the deepest leaf for a messy category", () => {
    const csv = "Item Name,Price,Categories\nHoodie,50.00,\"Durango High School Alpine Team, Teams, Teams > Durango High School Alpine Ski Team (ABC123)\"";
    const { unresolvedCategories } = csvToProducts(csv, { createCategories: true });
    expect(unresolvedCategories[0].name).toBe("Durango High School Alpine Ski Team");
  });
});
