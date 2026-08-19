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
  sideL?: PrintZone;
  sideR?: PrintZone;
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
    sideL?: ProductView;
    sideR?: ProductView;
  };
}

export interface DesignAsset {
  id: string;
  name: string;
  description?: string;
  category: string;
  image_url: string;
  tags?: string[];
  created_at: string;
  /** Optional product association for per-product designs */
  productId?: string;
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

/* ─── Catalog Config Types (admin-managed, stored in config/site) ── */

/** A color option with its display name and tint hex for mockup preview. */
export interface CatalogColor {
  name: string;
  hex: string;
}

/** A product type with its machine value and human label. */
export interface CatalogProductType {
  value: string;
  label: string;
}

/** Add-on pricing model — fixed dollar amount or percentage of base price. */
export type AddonPriceType = "fixed" | "percentage";

/** A standard add-on definition stored in site config. */
export interface StandardAddon {
  id: string;
  name: string;
  priceType: AddonPriceType;
  price: number;
}

/** A customer information field definition for checkout. */
export interface CustomerField {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
  /** Maps this field to a Square fulfillment recipient field. */
  squareMapping?: string;
}

/** Catalog-wide option definitions — replaces hardcoded constants. */
export interface CatalogOptions {
  colors: CatalogColor[];
  sizes: string[];
  productTypes: CatalogProductType[];
  customOptionNames: string[];
}

/** Default add-on configuration stored in site config. */
export interface AddonDefaults {
  defaultPriceType: AddonPriceType;
  defaultPrice: number;
  standardAddons: StandardAddon[];
}

/* ─── Dynamic Product Options & Modifiers ───────────────────────── */

/** A product option dimension that defines variants (SKUs).
 *  Standard examples: "Size", "Color". Admin can add any dimension
 *  (e.g. "Material", "Finish", "Grommet Count") per product. */
export interface ProductOption {
  id: string;
  /** Human-readable dimension name, e.g. "Size", "Color", "Material" */
  name: string;
  /** select = pick from a fixed value list; color = like select but rendered as swatches;
   *  text = free-text entry (captured at order time, not part of the variant SKU). */
  type: "select" | "color" | "text";
  /** Available values for select/color options. Ignored for text options. */
  values: string[];
  /** Required options must have a value chosen before the item can be added to cart. */
  required: boolean;
}

/** A per-product modifier (add-on). Replaces ProductAddon with pricing model + input type.
 *  - toggle: simple checkbox that adjusts price (back print, sleeve print)
 *  - text: checkbox + text input captured for fulfillment (name/number, engraving)
 *  - file: checkbox + file upload captured for fulfillment (custom artwork) */
export interface ProductModifier {
  id: string;
  name: string;
  priceType: AddonPriceType;
  /** For "fixed": dollar amount. For "percentage": percent of base price (e.g. 10 = 10%). */
  price: number;
  inputType?: "toggle" | "text" | "file";
  /** Label for the text/file input, e.g. "Enter name/number" */
  inputLabel?: string;
}

/** A customer's choice for one product option, captured on the cart line. */
export interface SelectedOption {
  optionId: string;
  /** The option dimension name, denormalized for order fulfillment display */
  optionName: string;
  value: string;
}

/** A customer's input for one modifier, captured on the cart line. */
export interface ModifierInput {
  modifierId: string;
  /** The modifier name, denormalized for order fulfillment display */
  modifierName: string;
  /** Text value for "text" modifiers, or Storage URL for "file" modifiers */
  value?: string;
}

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
  /** Custom key-value attributes (e.g. grommets: '4', material: 'cotton') */
  customFields?: { key: string; value: string }[];
  /** Structured option values that define this variant (e.g. {Size: "L", Color: "Navy"}).
   *  When present, variant name is generated from these values. Falls back to parsing
   *  the name string for legacy products. */
  options?: Record<string, string>;
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
    sideL?: string;
    sideR?: string;
  };
  /** Weight in ounces for calculated shipping */
  weightOz?: number;
  /** Parent product ID — groups same-design variants across garment types */
  baseProductId?: string;
  /** Optional per-product flat shipping rate. When set, the cart uses the higher
   *  of this rate or the global shipping tier. If unset, the global tier applies. */
  shippingRate?: number;
  /** Per-product pre-loaded design assets (PNG graphics available for this product) */
  designAssets?: DesignAsset[];
  /** Per-product customizable add-ons (admin-defined toggles that adjust price).
   *  Three-state meaning:
   *    undefined = not configured → storefront shows the site-standard add-ons
   *    []        = explicitly none → storefront shows no add-ons
   *    [...]     = exactly these add-ons
   *  @deprecated Prefer `modifiers` (supports pricing model + text/file inputs).
   *  Kept for backward compatibility with existing products. */
  productAddons?: ProductAddon[];
  /** Per-product option dimensions that define variants (SKUs). When set,
   *  the variant matrix editor builds from these dimensions instead of the
   *  hardcoded size/color grid. When unset, falls back to site-standard
   *  sizes/colors for backward compatibility. */
  options?: ProductOption[];
  /** Per-product modifiers (add-ons with pricing model + optional text/file input).
   *  Three-state meaning (same as productAddons):
   *    undefined = not configured → storefront shows the site-standard add-ons
   *    []        = explicitly none → storefront shows no modifiers
   *    [...]     = exactly these modifiers
   *  Takes precedence over productAddons when both are present. */
  modifiers?: ProductModifier[];
  /** When true, the customizer restricts the customer to a single design
   *  (one image; the text tool is hidden). Only one design prints per item. */
  singleDesign?: boolean;
  /** Whether this product can be customized (shows the "Customize This" button on
   *  the product page). Defaults to true for backward compatibility. */
  customizable?: boolean;
  /** Optional per-product visual attributes — background tint, design patch shape,
   *  border style, and arbitrary custom key-value pairs. Shown on the product page. */
  attributes?: ProductAttributes;
  /** Per-color mockup tint (color name → hex). Applied as a blend overlay on the
   *  single base mockup so every product can preview color variants without needing
   *  a photo per color. Upgrade path: mockupImagesByColor replaces the tint with a
   *  real per-color photo when available. */
  colorTints?: Record<string, string>;
  /** Optional per-color mockup photos. When a color has a real photo it takes
   *  precedence over the colorTints overlay. */
  mockupImagesByColor?: Record<string, { front?: string; back?: string; sleeve?: string; sideL?: string; sideR?: string }>;
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

/* ─── Product Add-Ons ─────────────────────────────────────────── */

/** Admin-defined per-product add-on (e.g. "Left Sleeve Print" for $7.50) */
export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

/* ─── Modular Product Attributes ──────────────────────────────── */

/** Optional per-product visual attributes shown on the product page and used
 *  by the mockup generator. All fields are optional — a product without them
 *  simply shows nothing extra. */
export interface ProductAttributes {
  backgroundColor?: string;
  patchShape?: "circle" | "square" | "rounded" | "oval";
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  customFields?: { key: string; value: string }[];
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
  /** Managed product ID (provider-agnostic). Resolved to squareItemId at checkout. */
  product_id: string;
  /** Managed variant ID (provider-agnostic). Mapped to squareVariationId at checkout. */
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
  selected_view: "front" | "back" | "sleeve" | "sideL" | "sideR";
  /** Selected garment color (for color-variant mockups and order fulfillment) */
  selected_color?: string;
  design_url?: string;
  design_text?: string;
  /** Customizer design position/scale/rotation — preserved for order fulfillment */
  design_x?: number;
  design_y?: number;
  design_scale?: number;
  design_rotation?: number;
  addons: CartAddon[];
  /** Customer's choices for the product's option dimensions (e.g. {Size: "L", Color: "Navy"}).
   *  Captured at add-to-cart time and preserved for order fulfillment display. */
  selectedOptions?: SelectedOption[];
  /** Customer's inputs for modifiers with text/file input types.
   *  Captured at add-to-cart time and preserved for order fulfillment. */
  modifierInputs?: ModifierInput[];
  /** Per-product flat shipping rate, if set on the product. Used by the cart to
   *  override the global shipping tier for this item. */
  shipping_rate?: number;
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
 *  All components consume ManagedProduct directly via useCatalog().
 *  managedToCatalogItem() converts ManagedProduct → SquareCatalogItem when
 *  Square API fallback compatibility is needed (useSearch, square payloads).
 *  @deprecated Prefer ManagedProduct for all new code. */
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
    sideL?: string;
    sideR?: string;
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

