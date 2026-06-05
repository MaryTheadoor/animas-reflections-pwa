/* ─── Product & Customizer Types ─────────────────────────────────── */

export interface PrintZone {
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
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
  variations: SquareVariation[];
  colors?: string[];
  tags?: string[];
}

export interface SquareVariation {
  id: string;
  name: string;
  price: number;
  sku?: string;
}
