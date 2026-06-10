/**
 * Tests for getPrintZone and getProductViews — customizer layout logic.
 * Controls where designs appear on garment mockups.
 */
import { describe, it, expect } from "@jest/globals";
import type { PrintZone, PrintZoneTemplate, SquareCatalogItem } from "@/types";

// --- Constants matching the customizer page ---
const DEFAULT_PRINT_ZONE: PrintZone = {
  x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48,
};
const DEFAULT_BACK_PRINT_ZONE: PrintZone = {
  x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35,
};
const DEFAULT_SLEEVE_PRINT_ZONE: PrintZone = {
  x_percent: 65, y_percent: 20, width_percent: 25, height_percent: 55,
};

// --- Inlined functions from customizer ---

function getPrintZone(zones: PrintZoneTemplate | undefined, view: string): PrintZone {
  if (!zones) return view === "back" ? DEFAULT_BACK_PRINT_ZONE : view === "sleeve" ? DEFAULT_SLEEVE_PRINT_ZONE : DEFAULT_PRINT_ZONE;
  if (view === "back" && zones.back) return zones.back;
  if (view === "sleeve" && zones.sleeve) return zones.sleeve;
  return zones.front ?? DEFAULT_PRINT_ZONE;
}

function getProductViews(product: SquareCatalogItem | null) {
  const mockups = product?.mockupImages;
  const fallback = product?.image_url ?? product?.images?.[0] ?? "/hero-bg.jpg";
  const frontImage = mockups?.front ?? fallback;
  const backImage = mockups?.back ?? fallback;
  const sleeveImage = mockups?.sleeve ?? fallback;
  const zones = product?.printZones;
  const views = [
    { key: "front", label: "Front", baseImage: frontImage, printZone: getPrintZone(zones, "front") },
  ];
  if (zones?.back || product?.productType === "apparel" || !product) {
    views.push({ key: "back", label: "Back", baseImage: backImage, printZone: getPrintZone(zones, "back") });
  }
  if (zones?.sleeve) {
    views.push({ key: "sleeve", label: "Sleeve", baseImage: sleeveImage, printZone: getPrintZone(zones, "sleeve") });
  }
  return views;
}

// --- Test data ---
function makeProduct(overrides: Partial<SquareCatalogItem> = {}): SquareCatalogItem {
  return {
    id: "prod_1",
    name: "Test Tee",
    description: "A test garment",
    categoryIds: ["cat_apparel"],
    image_url: "https://storage.example.com/square_img.jpg",
    images: ["https://storage.example.com/img1.jpg"],
    variations: [{ id: "v1", name: "Standard", price: 25 }],
    colors: [],
    tags: [],
    productType: "apparel",
    ...overrides,
  };
}

describe("getPrintZone", () => {
  it("returns front default when no zones provided", () => {
    const result = getPrintZone(undefined, "front");
    expect(result.x_percent).toBe(30);
    expect(result.y_percent).toBe(22);
  });

  it("returns back default when no zones and view is back", () => {
    const result = getPrintZone(undefined, "back");
    expect(result.x_percent).toBe(25);
    expect(result.y_percent).toBe(15);
  });

  it("returns sleeve default when no zones and view is sleeve", () => {
    const result = getPrintZone(undefined, "sleeve");
    expect(result.x_percent).toBe(65);
  });

  it("returns custom front zone from product", () => {
    const zones: PrintZoneTemplate = {
      front: { x_percent: 40, y_percent: 30, width_percent: 20, height_percent: 30 },
    };
    const result = getPrintZone(zones, "front");
    expect(result.x_percent).toBe(40);
  });

  it("returns custom back zone from product", () => {
    const zones: PrintZoneTemplate = {
      front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
      back: { x_percent: 10, y_percent: 5, width_percent: 80, height_percent: 90 },
    };
    const result = getPrintZone(zones, "back");
    expect(result.x_percent).toBe(10);
    expect(result.y_percent).toBe(5);
  });

  it("returns custom sleeve zone from product", () => {
    const zones: PrintZoneTemplate = {
      front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
      sleeve: { x_percent: 70, y_percent: 25, width_percent: 20, height_percent: 50 },
    };
    const result = getPrintZone(zones, "sleeve");
    expect(result.x_percent).toBe(70);
  });

  it("falls back to front zone when back view requested but no back zone", () => {
    const zones: PrintZoneTemplate = {
      front: { x_percent: 50, y_percent: 50, width_percent: 30, height_percent: 30 },
    };
    const result = getPrintZone(zones, "back");
    // Falls back to front because zones.back is undefined
    expect(result.x_percent).toBe(50);
  });
});

describe("getProductViews", () => {
  it("always includes front view", () => {
    const views = getProductViews(makeProduct());
    expect(views.some((v) => v.key === "front")).toBe(true);
  });

  it("includes back view for apparel products", () => {
    const views = getProductViews(makeProduct({ productType: "apparel" }));
    expect(views.some((v) => v.key === "back")).toBe(true);
  });

  it("includes back view for products with explicit back print zone", () => {
    const views = getProductViews(makeProduct({
      productType: "sticker",
      printZones: {
        front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
        back: { x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35 },
      },
    }));
    expect(views.some((v) => v.key === "back")).toBe(true);
  });

  it("includes sleeve view only when sleeve zone exists", () => {
    const viewsNoSleeve = getProductViews(makeProduct());
    expect(viewsNoSleeve.some((v) => v.key === "sleeve")).toBe(false);

    const viewsWithSleeve = getProductViews(makeProduct({
      printZones: {
        front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
        sleeve: { x_percent: 70, y_percent: 25, width_percent: 20, height_percent: 50 },
      },
    }));
    expect(viewsWithSleeve.some((v) => v.key === "sleeve")).toBe(true);
  });

  it("uses mockupImages when available", () => {
    const views = getProductViews(makeProduct({
      mockupImages: { front: "https://mock.front.jpg", back: "https://mock.back.jpg" },
    }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("https://mock.front.jpg");
    expect(views.find((v) => v.key === "back")!.baseImage).toBe("https://mock.back.jpg");
  });

  it("falls back to image_url when no mockups", () => {
    const views = getProductViews(makeProduct({ mockupImages: undefined }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("https://storage.example.com/square_img.jpg");
  });

  it("falls back to hero-bg.jpg when no images at all", () => {
    const views = getProductViews(makeProduct({
      image_url: undefined,
      images: [],
      mockupImages: undefined,
    }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("/hero-bg.jpg");
  });

  it("null product returns front + back views with fallback image", () => {
    const views = getProductViews(null);
    expect(views).toHaveLength(2);
    expect(views[0].key).toBe("front");
    expect(views[1].key).toBe("back");
    expect(views[0].baseImage).toBe("/hero-bg.jpg");
  });

  it("front view count is always 1", () => {
    const views = getProductViews(makeProduct());
    expect(views.filter((v) => v.key === "front").length).toBe(1);
  });
});
