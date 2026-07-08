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
  /** Managed addon ID (provider-agnostic) */
  addon_id?: string;
  /** Square modifier ID — set during Square sync, used by Square checkout path */
  squareModifierId?: string;
}

export interface CartItem {
  /** Unique cart line item ID (generated client-side via crypto.randomUUID) */
  id: string;
  /** Managed product ID (provider-agnostic) */
  product_id: string;
  /** Managed variant ID (provider-agnostic) */
  variant_id: string;
  /** Square variation ID — set during Square sync, used by Square checkout path */
  squareVariationId?: string;
  /** Product display name */
  name: string;
  /** Variant display name (e.g. "Large / Navy") */
  variant_name: string;
  /** Base price of the selected variant */
  base_price: number;
  /** Product type — used for shipping tier auto-detection */
  productType: ProductType;
  quantity: number;
  selected_view: "front" | "back" | "sleeve";
  design_url?: string;
  design_text?: string;
  /** Customizer design position/scale/rotation — preserved for order fulfillment */
  design_x?: number;
  design_y?: number;
  design_scale?: number;
  design_rotation?: number;
  addons: CartAddon[];
}

/** Payment-provider-agnostic checkout line item */
export interface CheckoutLineItem {
  /** Managed variant ID */
  variant_id: string;
  /** Cached Square variation ID (if synced) — enables Square checkout */
  squareVariationId?: string;
  quantity: number;
  note?: string;
  addons?: CheckoutAddon[];
}

export interface CheckoutAddon {
  addon_id?: string;
  squareModifierId?: string;
  label: string;
  price: number;
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

/* ─── API Response Types (Bridge / Internal) ────────────────────── */

/** Bridge type used ONLY for Square API responses and legacy compatibility.
 *  Components should consume ManagedProduct directly. */
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

/** Bridge type used ONLY for Square API responses and legacy compatibility. */
export interface SquareVariation {
  id: string;
  name: string;
  price: number;
  sku?: string;
  inventory?: number;
  inventoryUpdatedAt?: string;
}
/* ─── Customer & Account Types ─────────────────────────────────── */

export interface CustomerAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  updatedAt: string;
}

export interface CustomerOrder {
  id: string;
  squareOrderId: string;
  status: OrderStatus;
  items: OrderLineItem[];
  shipping?: OrderShipping;
  totals: OrderTotals;
  trackingUrl?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderLineItem {
  name: string;
  quantity: number;
  price: number;
  variationName?: string;
}

export interface OrderShipping {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  grandTotal: number;
}

