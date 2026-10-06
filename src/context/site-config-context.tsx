"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogOptions, AddonDefaults, CustomerField } from "@/types";

export interface SiteConfig {
  // Announcement
  announcement_text: string;
  announcement_active: boolean;

  // ── Brand Colors ──
  primary_color: string;
  accent_color: string;
  background_color: string;
  gold_color: string;
  plum_color: string;
  cream_color: string;
  warm_sand_color: string;
  text_color: string;

  // ── Typography ──
  heading_font: string;
  body_font: string;

  // ── Shipping ──
  shipping_tier_stickers: number;
  shipping_tier_apparel: number;
  free_shipping_threshold: number;

  // ── Pricing ──
  addon_price: number;

  // ── Website Copy ──
  hero_heading: string;
  hero_subheading: string;
  about_heading: string;
  about_body: string;
  fundraising_heading: string;
  fundraising_subheading: string;
  footer_tagline: string;

  // ── Catalog Options (admin-managed) ──
  catalog_options: CatalogOptions;
  addon_defaults: AddonDefaults;
  customer_fields: CustomerField[];
}

const FALLBACK: SiteConfig = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,

  primary_color: "#1E4D4F",
  accent_color: "#D97706",
  background_color: "#FAF6F0",
  gold_color: "#D97706",
  plum_color: "#935B8A",
  cream_color: "#FAF6F0",
  warm_sand_color: "#F5EBE6",
  text_color: "#111827",

  heading_font: "Georgia, 'Times New Roman', serif",
  body_font: "system-ui, -apple-system, sans-serif",

  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,

  hero_heading: "Custom Designs On An Array Of Products",
  hero_subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  about_heading: "From Our Family To Yours",
  about_body: "At Animas Reflections, we are a family-owned and operated design & print operation based in Durango, CO.",
  fundraising_heading: "Fundraising Made Easy",
  fundraising_subheading: "Raise money for your team, school, or cause with custom merchandise.",
  footer_tagline: "Family owned and operated design & print operation based in Durango, CO, creating unique custom designs.",

  catalog_options: {
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Navy", hex: "#1E3A5F" },
      { name: "Heather Grey", hex: "#9CA3AF" },
      { name: "Charcoal", hex: "#4B5563" },
      { name: "Royal Blue", hex: "#2563EB" },
      { name: "Red", hex: "#DC2626" },
      { name: "Forest Green", hex: "#166534" },
      { name: "Maroon", hex: "#7F1D1D" },
      { name: "Sand", hex: "#D4A574" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    productTypes: [
      { value: "apparel", label: "Apparel" },
      { value: "sticker", label: "Sticker / Slap" },
      { value: "sign", label: "Wood Sign" },
      { value: "jewelry", label: "Jewelry" },
      { value: "accessory", label: "Accessory" },
      { value: "other", label: "Other" },
    ],
    customOptionNames: [],
  },

  addon_defaults: {
    defaultPriceType: "fixed",
    defaultPrice: 5.0,
    standardAddons: [
      { id: "back_print", name: "Back Print", priceType: "fixed", price: 5.0 },
      { id: "sleeve_print", name: "Sleeve Print", priceType: "fixed", price: 5.0 },
      { id: "personalization", name: "Name/Number", priceType: "fixed", price: 5.0 },
    ],
  },

  customer_fields: [
    { id: "firstName", label: "First Name", type: "text", required: true, squareMapping: "firstName" },
    { id: "lastName", label: "Last Name", type: "text", required: false, squareMapping: "lastName" },
    { id: "email", label: "Email", type: "email", required: true, squareMapping: "email" },
    { id: "phone", label: "Phone", type: "tel", required: false, squareMapping: "phone" },
    { id: "address", label: "Street Address", type: "text", required: true, squareMapping: "address.addressLine1" },
    { id: "city", label: "City", type: "text", required: true, squareMapping: "address.locality" },
    { id: "state", label: "State", type: "text", required: false, squareMapping: "address.administrativeDistrictLevel1" },
    { id: "zip", label: "ZIP Code", type: "text", required: true, squareMapping: "address.postalCode" },
  ],
};

const SiteConfigContext = createContext<{
  config: SiteConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}>({
  config: FALLBACK,
  loading: true,
  refresh: async () => {},
});

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  // Exposed as refresh() so an admin action that writes config/site (e.g. promoting a
  // custom colour into the site-wide library) can pull the new value without a reload.
  const load = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "config", "site"));
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const merged: SiteConfig = {
          announcement_text: String(data.announcement_text ?? FALLBACK.announcement_text),
          announcement_active: data.announcement_active !== false,
          primary_color: String(data.primary_color || FALLBACK.primary_color),
          accent_color: String(data.accent_color || FALLBACK.accent_color),
          background_color: String(data.background_color || FALLBACK.background_color),
          gold_color: String(data.gold_color || FALLBACK.gold_color),
          plum_color: String(data.plum_color || FALLBACK.plum_color),
          cream_color: String(data.cream_color || FALLBACK.cream_color),
          warm_sand_color: String(data.warm_sand_color || FALLBACK.warm_sand_color),
          text_color: String(data.text_color || FALLBACK.text_color),
          heading_font: String(data.heading_font || FALLBACK.heading_font),
          body_font: String(data.body_font || FALLBACK.body_font),
          shipping_tier_stickers: Number(data.shipping_tier_stickers ?? FALLBACK.shipping_tier_stickers),
          shipping_tier_apparel: Number(data.shipping_tier_apparel ?? FALLBACK.shipping_tier_apparel),
          free_shipping_threshold: Number(data.free_shipping_threshold ?? FALLBACK.free_shipping_threshold),
          addon_price: Number(data.addon_price ?? FALLBACK.addon_price),
          hero_heading: String(data.hero_heading || FALLBACK.hero_heading),
          hero_subheading: String(data.hero_subheading || FALLBACK.hero_subheading),
          about_heading: String(data.about_heading || FALLBACK.about_heading),
          about_body: String(data.about_body || FALLBACK.about_body),
          fundraising_heading: String(data.fundraising_heading || FALLBACK.fundraising_heading),
          fundraising_subheading: String(data.fundraising_subheading || FALLBACK.fundraising_subheading),
          footer_tagline: String(data.footer_tagline || FALLBACK.footer_tagline),
          catalog_options: (data.catalog_options as CatalogOptions) || FALLBACK.catalog_options,
          addon_defaults: (data.addon_defaults as AddonDefaults) || FALLBACK.addon_defaults,
          customer_fields: (data.customer_fields as CustomerField[]) || FALLBACK.customer_fields,
        };
        setConfig(merged);
      }
    } catch {
      // Leave the fallback config in place; the storefront degrades rather than breaks.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() only calls setState after awaiting the Firestore read, so nothing is set
    // synchronously during the effect; the rule cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Apply CSS variables to :root for all theme settings.
  // setIfChanged avoids unnecessary style recalculations when the value matches.
  useEffect(() => {
    const root = document.documentElement;
    const setIfChanged = (prop: string, value: string) => {
      if (root.style.getPropertyValue(prop) !== value) root.style.setProperty(prop, value);
    };
    setIfChanged("--color-primary", config.primary_color);
    setIfChanged("--color-accent", config.accent_color);
    setIfChanged("--color-background", config.background_color);
    setIfChanged("--color-gold", config.gold_color);
    setIfChanged("--color-plum", config.plum_color);
    setIfChanged("--color-cream", config.cream_color);
    setIfChanged("--color-warm-sand", config.warm_sand_color);
    setIfChanged("--color-text", config.text_color);
    setIfChanged("--font-heading", config.heading_font);
    setIfChanged("--font-body", config.body_font);
  }, [config]);

  return (
    <SiteConfigContext.Provider value={{ config, loading, refresh: load }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig(): SiteConfig {
  const { config } = useContext(SiteConfigContext);
  return config;
}

export function useSiteConfigLoading(): boolean {
  const { loading } = useContext(SiteConfigContext);
  return loading;
}

/** Re-reads config/site. Use after an admin action writes it directly. */
export function useSiteConfigRefresh(): () => Promise<void> {
  const { refresh } = useContext(SiteConfigContext);
  return refresh;
}
