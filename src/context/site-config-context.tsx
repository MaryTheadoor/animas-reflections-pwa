"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SiteConfig {
  // Announcement
  announcement_text: string;
  announcement_active: boolean;

  // Brand colors
  primary_color: string;
  accent_color: string;
  background_color: string;

  // Shipping
  shipping_tier_stickers: number;
  shipping_tier_apparel: number;
  free_shipping_threshold: number;

  // Pricing
  addon_price: number;

  // Content
  hero_heading: string;
  hero_subheading: string;
  about_body: string;
}

const FALLBACK: SiteConfig = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,
  primary_color: "#1E4D4F",
  accent_color: "#D97706",
  background_color: "#FAF6F0",
  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,
  hero_heading: "Custom Designs On An Array Of Products",
  hero_subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  about_body: "",
};

const SiteConfigContext = createContext<{
  config: SiteConfig;
  loading: boolean;
}>({
  config: FALLBACK,
  loading: true,
});

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "config", "site"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const merged: SiteConfig = {
            announcement_text: String(data.announcement_text ?? FALLBACK.announcement_text),
            announcement_active: data.announcement_active !== false,
            primary_color: String(data.primary_color || FALLBACK.primary_color),
            accent_color: String(data.accent_color || FALLBACK.accent_color),
            background_color: String(data.background_color || FALLBACK.background_color),
            shipping_tier_stickers: Number(data.shipping_tier_stickers ?? FALLBACK.shipping_tier_stickers),
            shipping_tier_apparel: Number(data.shipping_tier_apparel ?? FALLBACK.shipping_tier_apparel),
            free_shipping_threshold: Number(data.free_shipping_threshold ?? FALLBACK.free_shipping_threshold),
            addon_price: Number(data.addon_price ?? FALLBACK.addon_price),
            hero_heading: String(data.hero_heading || FALLBACK.hero_heading),
            hero_subheading: String(data.hero_subheading || FALLBACK.hero_subheading),
            about_body: String(data.about_body || FALLBACK.about_body),
          };
          setConfig(merged);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Apply CSS variables to :root for brand colors
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", config.primary_color);
    root.style.setProperty("--color-accent", config.accent_color);
    root.style.setProperty("--color-background", config.background_color);
    // Also set the nav-dock/theme accent
    root.style.setProperty("--nav-dock-active-color", config.accent_color);
  }, [config.primary_color, config.accent_color, config.background_color]);

  return (
    <SiteConfigContext.Provider value={{ config, loading }}>
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
