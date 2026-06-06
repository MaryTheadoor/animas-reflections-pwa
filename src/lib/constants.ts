export const SITE_NAME = "Animas Reflections";

export const SHIPPING = {
  TIER_STICKERS: Number(process.env.NEXT_PUBLIC_SHIPPING_TIER_STICKERS) || 3.0,
  TIER_APPAREL: Number(process.env.NEXT_PUBLIC_SHIPPING_TIER_APPAREL) || 7.5,
  FREE_THRESHOLD: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD) || 100.0,
} as const;

export const ADDON_PRICE = 5.0;

export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "mary.theadoor.doctor@gmail.com";

export const SQUARE_ENV: "sandbox" | "production" =
  (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT as "sandbox" | "production") || "sandbox";

export const SQUARE_APP_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID || "sq0idp-QAzYzFHiOcHrBmGfmdfGTQ";
export const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "L6VCX130RHYQR";

export const FIREBASE_FUNCTIONS_REGION = "us-central1";
