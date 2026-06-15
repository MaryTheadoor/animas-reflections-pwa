/* ─── Product & Customizer Types ─────────────────────────────────── */

export interface PrintZone {
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
}

export interface PrintZoneTemplate {
  front: PrintZone;
  back?: PrintZone;
  sleeve?: PrintZone;
}

export interface ProductView {
  base_image: string;
  print_zone: PrintZone;
}

export interface ProductTemplate {
  product_id: string;
  views: {
    front: ProductView;
    back?: ProductView;
    sleeve?: ProductView;
  };
}

export interface DesignAsset {
  id: string;
  name: string;
  category: string;
  image_url: string;
  created_at: string;
}

/* ─── Product Type Enum ──────────────────────────────────────────── */

export type ProductType =
  | "apparel"
  | "sticker"
  | "sign"
  | "jewelry"
  | "accessory"
  | "other";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  apparel: "Apparel",
  sticker: "Sticker / Slap",
  sign: "Wood Sign",
  jewelry: "Jewelry",
  accessory: "Accessory",
  other: "Other",
};

/* ─── CMS Managed Product ────────────────────────────────────────── */

export interface ManagedVariant {
  id: string;
  name: string;
  price: number;
  sku: string;
  squareItemId?: string;
  squareVariationId?: string;
  inventory?: number;
  /** ISO timestamp of last Square inventory sync */
  inventoryUpdatedAt?: string;
}

export interface ManagedProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  productType: ProductType;
  colors: string[];
  tags: string[];
  images: string[];
  variants: ManagedVariant[];
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  squareItemIds?: string[];
  /** Custom SEO title — falls back to name if unset */
  seoTitle?: string;
  /** Custom SEO meta description — falls back to description if unset */
  seoDescription?: string;
  /** Per-view print zone coordinates for the customizer */
  printZones?: PrintZoneTemplate;
  /** Per-view mockup image URLs (blank garment photos for customizer base layer) */
  mockupImages?: {
    front?: string;
    back?: string;
    sleeve?: string;
  };
  /** Weight in ounces for calculated shipping */
  weightOz?: number;
  /** Parent product ID — groups same-design variants across garment types */
  baseProductId?: string;
}

export interface ManagedCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatus {
  lastSync: string | null;
  productCount: number;
  categoryCount: number;
  itemCount: number;
  errors: string[];
}

/* ─── Cart & Order Types ────────────────────────────────────────── */

export type AddonType = "back_print" | "sleeve_print" | "personalization";

export interface CartAddon {
  type: AddonType;
  label: string;
  price: number;
  modifier_id?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  variation_id: string;
  name: string;
  base_price: number;
  quantity: number;
  selected_view: "front" | "back" | "sleeve";
  design_url?: string;
  design_text?: string;
  addons: CartAddon[];
  isSynthetic?: boolean;
}

export interface ShippingTier {
  label: string;
  rate: number;
}

/* ─── CMS / Config Types ────────────────────────────────────────── */

export interface SiteConfig {
  announcement_text: string;
  announcement_active: boolean;
  primary_color: string;
  accent_color: string;
  highlight_color: string;
  background_color: string;
  updated_at: string;
}

/* ─── API Response Types ────────────────────────────────────────── */

export interface SquareCatalogItem {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  image_url?: string;
  images?: string[];
  variations: SquareVariation[];
  colors?: string[];
  tags?: string[];
  productType?: string;
  printZones?: PrintZoneTemplate;
  mockupImages?: {
    front?: string;
    back?: string;
    sleeve?: string;
  };
}

export interface SquareVariation {
  id: string;
  name: string;
  price: number;
  sku?: string;
  inventory?: number;
  inventoryUpdatedAt?: string;
}
/bin/bash: line 5: C:/Users/AmosA/.hermes/cache/terminal/hermes-snap-a45f2e12a6da.sh: No such file or directory
/bin/bash: line 6: C:/Users/AmosA/.hermes/cache/terminal/hermes-cwd-a45f2e12a6da.txt: No such file or directory
/bin/bash: line 5: C:/Users/AmosA/.hermes/cache/terminal/hermes-snap-a45f2e12a6da.sh: No such file or directory
/bin/bash: line 6: C:/Users/AmosA/.hermes/cache/terminal/hermes-cwd-a45f2e12a6da.txt: No such file or directory
