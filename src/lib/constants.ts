export const SITE_NAME = "Animas Reflections";

// Flat-rate shipping model (FOB Origin — Durango, CO). Stickers ship cheap via USPS
// envelopes; apparel/parcels are heavier. Orders over the threshold ship free.
// Rates and threshold are overridable via env vars and the admin Settings tab.
export const SHIPPING = {
  TIER_STICKERS: Number(process.env.NEXT_PUBLIC_SHIPPING_TIER_STICKERS) || 3.0,
  TIER_APPAREL: Number(process.env.NEXT_PUBLIC_SHIPPING_TIER_APPAREL) || 7.5,
  FREE_THRESHOLD: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD) || 100.0,
} as const;

// Default per-addon price (back print, sleeve print, personalization).
// $5 unless overridden in admin Settings or per-product add-ons.
export const ADDON_PRICE = 5.0;

// Hardcoded admin fallback. Override with NEXT_PUBLIC_ADMIN_EMAIL in .env.local.
// Additional admin emails are stored in Firestore config/admin and managed via the Admin UI.
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "mary.theadoor.doctor@gmail.com";

// Square environment toggle. "sandbox" = test cards, "production" = real charges.
// Functions .env must also be switched for the backend.
export const SQUARE_ENV: "sandbox" | "production" =
  (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT as "sandbox" | "production") || "sandbox";

// Square sandbox defaults — overridden by env vars for production. These are the
// public (publishable) credentials; the secret access token lives in functions/.env.
export const SQUARE_APP_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID || "sq0idp-QAzYzFHiOcHrBmGfmdfGTQ";
export const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "L6VCX130RHYQR";

// All Cloud Functions are deployed to us-central1. Must match firebase.json region.
export const FIREBASE_FUNCTIONS_REGION = "us-central1";

/**
 * FALLBACK DEFAULTS ONLY — authoritative source is SiteConfig.catalog_options.
 * These constants are kept for backward compatibility and as fallbacks when
 * SiteConfig hasn't loaded yet. The admin UI reads/writes to Firestore config/site.
 */

/** Standard apparel sizes for the variant matrix editor (fallback) */
export const PRODUCT_SIZES = [
  "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL",
] as const;

/** Available product colors for the variant matrix editor (fallback) */
export const PRODUCT_COLORS = [
  "Black", "White", "Navy", "Heather Grey", "Charcoal",
  "Royal Blue", "Red", "Forest Green", "Maroon", "Sand",
] as const;

/** Default tint hexes for standard product colors (fallback).
 *  Prefilled in the admin color editor when a standard color is toggled on,
 *  so the customizer mockup preview reflects the color without manual work.
 *  Admin can override per product. */
export const DEFAULT_COLOR_TINTS: Record<string, string> = {
  black: "#2f2f2f",
  white: "#f7f6f2",
  gray: "#a8a8a8",
  navy: "#1f2a44",
  "royal blue": "#2b5fd9",
  red: "#c23b2e",
  "forest green": "#2f6b3f",
  cream: "#f3e9d3",
  charcoal: "#4a4a4a",
  maroon: "#6d1f2c",
  blue: "#3b6fc4",
  green: "#4d8b52",
  sage: "#a9b49a",
  heather: "#b9b9b9",
  ash: "#8e8e8e",
};
