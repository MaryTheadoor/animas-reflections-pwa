"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  EMPTY_SEO_CONFIG,
  SEO_CONFIG_DOC,
  normalizeSeoConfig,
  type SeoConfig,
} from "@/lib/seo-config";

/**
 * Reads config/seo at RUNTIME. The same document is also snapshotted at build
 * time (scripts/fetch-seo-config.mjs → src/lib/seo-content.generated.ts), which
 * is what social scrapers and non-JS clients see. Here it is only a head
 * override — see src/lib/seo-runtime.ts for what is and is not applied.
 *
 * config/seo is client-readable per firestore.rules, so this needs no auth.
 */
const SeoConfigContext = createContext<{
  config: SeoConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}>({
  config: EMPTY_SEO_CONFIG,
  loading: true,
  refresh: async () => {},
});

export function SeoConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SeoConfig>(EMPTY_SEO_CONFIG);
  const [loading, setLoading] = useState(true);

  // Exposed as refresh() so the admin can pull an edit through without a reload.
  const load = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "config", SEO_CONFIG_DOC));
      setConfig(normalizeSeoConfig(snap.exists() ? snap.data() : null));
    } catch {
      // Keep the empty config: every lookup then falls back to the baked
      // defaults, which is exactly what the static HTML already contains.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() only sets state after awaiting the Firestore read, so nothing is
    // set synchronously in the effect body; the rule cannot see through the
    // async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <SeoConfigContext.Provider value={{ config, loading, refresh: load }}>
      {children}
    </SeoConfigContext.Provider>
  );
}

export function useSeoConfig(): SeoConfig {
  return useContext(SeoConfigContext).config;
}

export function useSeoConfigLoading(): boolean {
  return useContext(SeoConfigContext).loading;
}

/** Re-reads config/seo. Use after the admin writes it directly. */
export function useSeoConfigRefresh(): () => Promise<void> {
  return useContext(SeoConfigContext).refresh;
}
