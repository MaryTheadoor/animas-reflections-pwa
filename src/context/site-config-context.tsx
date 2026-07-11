"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
          };
          setConfig(merged);
        }
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, []);

  // Apply CSS variables to :root for all theme settings
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
