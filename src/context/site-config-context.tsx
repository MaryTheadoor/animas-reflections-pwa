"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogOptions, AddonDefaults, CustomerField } from "@/types";
import { mergeTheme, themeToCss, type SiteTheme, type MergeThemeInput } from "@/lib/site-defaults";
import { mergeContent, type SiteContent } from "@/lib/content-schema";

export interface SiteConfig {
  // ── Shipping ──
  shipping_tier_stickers: number;
  shipping_tier_apparel: number;
  free_shipping_threshold: number;

  // ── Pricing ──
  addon_price: number;

  /** How many designs a product may pin as its "Printable Designs". */
  design_pin_limit: number;

  // ── Catalog Options (admin-managed) ──
  catalog_options: CatalogOptions;
  addon_defaults: AddonDefaults;
  customer_fields: CustomerField[];

  // ── Editable Theme (light + dark + fonts) ──
  theme: SiteTheme;

  // ── Editable Site Copy (per page/section, overrides over content.ts) ──
  content: SiteContent;
}

/*
 * There is deliberately no announcement/hero/about/footer copy, nor any flat
 * colour or font field, on this type any more. Those used to live here, but the
 * storefront now reads copy through useSiteContent() and colours/fonts through
 * the theme above — so the flat versions were write-only. mergeTheme() still
 * HONOURS the legacy flat names (primary_color, heading_font, …) when it reads
 * the raw document, which is what keeps a pre-theme-editor document rendering
 * as it always did.
 */

const FALLBACK: SiteConfig = {
  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,

  design_pin_limit: 25,

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

  theme: mergeTheme({}),
  content: mergeContent({}),
};

const SiteConfigContext = createContext<{
  config: SiteConfig;
  loading: boolean;
  /** Re-reads config/site. Use after an admin action writes it directly. */
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
          shipping_tier_stickers: Number(data.shipping_tier_stickers ?? FALLBACK.shipping_tier_stickers),
          shipping_tier_apparel: Number(data.shipping_tier_apparel ?? FALLBACK.shipping_tier_apparel),
          free_shipping_threshold: Number(data.free_shipping_threshold ?? FALLBACK.free_shipping_threshold),
          addon_price: Number(data.addon_price ?? FALLBACK.addon_price),
          design_pin_limit: Number(data.design_pin_limit ?? FALLBACK.design_pin_limit),
          catalog_options: (data.catalog_options as CatalogOptions) || FALLBACK.catalog_options,
          addon_defaults: (data.addon_defaults as AddonDefaults) || FALLBACK.addon_defaults,
          customer_fields: (data.customer_fields as CustomerField[]) || FALLBACK.customer_fields,
          // mergeTheme folds the legacy flat *_color / *_font fields in, so a
          // document that predates the theme editor still reproduces its look.
          theme: mergeTheme(data as unknown as MergeThemeInput),
          content: mergeContent(data.content as unknown as Partial<SiteContent>),
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

  /*
   * Theme tokens are applied as a single injected stylesheet rather than inline
   * style properties. Two reasons:
   *
   *  1. ONE source. The theme editor writes config/site.theme, and themeToCss()
   *     emits the light palette on :root and the dark palette under html.dark —
   *     so editing a token in either mode actually changes both the editor
   *     preview and the live site. Nothing else may write these custom
   *     properties, or one mechanism would silently win over the other.
   *  2. Unlayered rules beat Tailwind's @theme. @theme emits :root inside a
   *     cascade layer, and unlayered declarations win over layered ones
   *     regardless of specificity — so these values override the shipped
   *     palette in globals.css.
   */
  useEffect(() => {
    const css = themeToCss(config.theme);
    let el = document.getElementById("dsh-theme") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "dsh-theme";
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }, [config.theme]);

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

/** Merged site copy (config/site.content overrides over content.ts defaults). */
export function useSiteContent(): SiteContent {
  return useContext(SiteConfigContext).config.content;
}

export function useSiteConfigLoading(): boolean {
  const { loading } = useContext(SiteConfigContext);
  return loading;
}

/** Re-reads config/site. Use after an admin action writes it directly. */
export function useSiteConfigRefresh(): () => Promise<void> {
  return useContext(SiteConfigContext).refresh;
}
