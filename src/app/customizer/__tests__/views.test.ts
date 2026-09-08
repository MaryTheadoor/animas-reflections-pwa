/**
 * Tests for getPrintZone and getProductViews — customizer layout logic.
 * Inlined from src/app/customizer/page.tsx to avoid importing the Firebase-wired page.
 * Keep these inline copies in sync with the page's getPrintZone / getProductViews.
 */
import { describe, it, expect } from "@jest/globals";
import type { PrintZone, PrintZoneTemplate, ManagedProduct } from "@/types";

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
const DEFAULT_SIDE_PRINT_ZONE: PrintZone = {
  x_percent: 5, y_percent: 15, width_percent: 30, height_percent: 40,
};

interface ProductViewConfig {
  key: string;
  label: string;
  baseImage: string;
  printZone: PrintZone;
}

// --- Inlined functions from customizer ---

/** Mirrors getProductImageUrl in src/hooks/useCatalog.ts (inlined to avoid Firebase import). */
function getProductImageUrl(product: ManagedProduct): string {
  return Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : "";
}

function getPrintZone(zones: PrintZoneTemplate | undefined, view: string): PrintZone {
  if (!zones) {
    switch (view) {
      case "back": return DEFAULT_BACK_PRINT_ZONE;
      case "sleeve": return DEFAULT_SLEEVE_PRINT_ZONE;
      case "sideL": case "sideR": return DEFAULT_SIDE_PRINT_ZONE;
      default: return DEFAULT_PRINT_ZONE;
    }
  }
  if (view === "back" && zones.back) return zones.back;
  if (view === "sleeve" && zones.sleeve) return zones.sleeve;
  if (view === "sideL" && zones.sideL) return zones.sideL;
  if (view === "sideR" && zones.sideR) return zones.sideR;
  return zones.front ?? DEFAULT_PRINT_ZONE;
}

function getProductViews(product: ManagedProduct | null): ProductViewConfig[] {
  const mockups = product?.mockupImages;
  const fallback = product
    ? (getProductImageUrl(product) || product.images?.[0] || "/hero-bg.jpg")
    : "/hero-bg.jpg";
  const frontImage = mockups?.front ?? fallback;
  const backImage = mockups?.back ?? fallback;
  const sleeveImage = mockups?.sleeve ?? fallback;
  const sideLImage = mockups?.sideL ?? fallback;
  const sideRImage = mockups?.sideR ?? fallback;
  const zones = product?.printZones;
  const pType = product?.productType ?? "other";
  const isApparel = pType === "apparel";

  const views: ProductViewConfig[] = [
    { key: "front", label: "Front", baseImage: frontImage, printZone: getPrintZone(zones, "front") },
  ];
  if (isApparel || zones?.back) {
    views.push({ key: "back", label: "Back", baseImage: backImage, printZone: getPrintZone(zones, "back") });
  }
  if (isApparel || zones?.sleeve) {
    views.push({ key: "sleeve", label: "Sleeve", baseImage: sleeveImage, printZone: getPrintZone(zones, "sleeve") });
  }
  if (zones?.sideL) {
    views.push({ key: "sideL", label: "Left Side", baseImage: sideLImage, printZone: getPrintZone(zones, "sideL") });
  }
  if (zones?.sideR) {
    views.push({ key: "sideR", label: "Right Side", baseImage: sideRImage, printZone: getPrintZone(zones, "sideR") });
  }
  return views;
}

// --- Test data ---
function makeProduct(overrides: Partial<ManagedProduct> = {}): ManagedProduct {
  return {
    id: "prod_1",
    name: "Test Tee",
    description: "A test garment",
    categoryId: "cat_apparel",
    productType: "apparel",
    colors: [],
    tags: [],
    images: ["https://storage.example.com/img1.jpg"],
    variants: [{ id: "v1", name: "Standard", price: 25, sku: "STD" }],
    active: true,
    featured: false,
    createdAt: "",
    updatedAt: "",
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

  it("returns side default when no zones and view is sideL/sideR", () => {
    const left = getPrintZone(undefined, "sideL");
    const right = getPrintZone(undefined, "sideR");
    expect(left.x_percent).toBe(5);
    expect(right.y_percent).toBe(15);
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
    expect(result.x_percent).toBe(50);
  });
});

describe("getProductViews", () => {
  it("always includes front view", () => {
    const views = getProductViews(makeProduct());
    expect(views.some((v) => v.key === "front")).toBe(true);
  });

  it("includes back and sleeve views for apparel products", () => {
    const views = getProductViews(makeProduct());
    expect(views.some((v) => v.key === "back")).toBe(true);
    expect(views.some((v) => v.key === "sleeve")).toBe(true);
  });

  it("includes back view for non-apparel products with explicit back print zone", () => {
    const views = getProductViews(makeProduct({
      productType: "sticker",
      printZones: {
        front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
        back: { x_percent: 25, y_percent: 15, width_percent: 50, height_percent: 35 },
      },
    }));
    expect(views.some((v) => v.key === "back")).toBe(true);
    expect(views.some((v) => v.key === "sleeve")).toBe(false);
  });

  it("includes sleeve view only when sleeve zone exists for non-apparel", () => {
    const viewsNoSleeve = getProductViews(makeProduct({ productType: "sticker" }));
    expect(viewsNoSleeve.some((v) => v.key === "sleeve")).toBe(false);

    const viewsWithSleeve = getProductViews(makeProduct({
      productType: "sticker",
      printZones: {
        front: { x_percent: 30, y_percent: 22, width_percent: 40, height_percent: 48 },
        sleeve: { x_percent: 70, y_percent: 25, width_percent: 20, height_percent: 50 },
      },
    }));
    expect(viewsWithSleeve.some((v) => v.key === "sleeve")).toBe(true);
  });

  it("includes sideL/sideR views only when their zones exist", () => {
    const withoutSides = getProductViews(makeProduct());
    expect(withoutSides.some((v) => v.key === "sideL")).toBe(false);
    expect(withoutSides.some((v) => v.key === "sideR")).toBe(false);

    const withSides = getProductViews(makeProduct({
      printZones: {
        front: DEFAULT_PRINT_ZONE,
        sideL: { x_percent: 5, y_percent: 15, width_percent: 30, height_percent: 40 },
        sideR: { x_percent: 60, y_percent: 15, width_percent: 30, height_percent: 40 },
      },
    }));
    expect(withSides.some((v) => v.key === "sideL")).toBe(true);
    expect(withSides.some((v) => v.key === "sideR")).toBe(true);
  });

  it("uses mockupImages when available", () => {
    const views = getProductViews(makeProduct({
      mockupImages: { front: "https://mock.front.jpg", back: "https://mock.back.jpg" },
    }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("https://mock.front.jpg");
    expect(views.find((v) => v.key === "back")!.baseImage).toBe("https://mock.back.jpg");
  });

  it("falls back to images[0] when no mockups", () => {
    const views = getProductViews(makeProduct({ mockupImages: undefined }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("https://storage.example.com/img1.jpg");
  });

  it("falls back to hero-bg.jpg when no images at all", () => {
    const views = getProductViews(makeProduct({
      images: [],
      mockupImages: undefined,
    }));
    expect(views.find((v) => v.key === "front")!.baseImage).toBe("/hero-bg.jpg");
  });

  it("null product returns only the front view with fallback image", () => {
    const views = getProductViews(null);
    expect(views).toHaveLength(1);
    expect(views[0].key).toBe("front");
    expect(views[0].baseImage).toBe("/hero-bg.jpg");
  });

  it("front view count is always 1", () => {
    const views = getProductViews(makeProduct());
    expect(views.filter((v) => v.key === "front").length).toBe(1);
  });
});
