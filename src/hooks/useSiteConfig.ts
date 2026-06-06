"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SiteConfig {
  announcement_text: string;
  announcement_active: boolean;
}

const FALLBACK: SiteConfig = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,
};

export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>(FALLBACK);

  useEffect(() => {
    getDoc(doc(db, "config", "site"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setConfig({
            announcement_text: String(data.announcement_text || FALLBACK.announcement_text),
            announcement_active: data.announcement_active !== false,
          });
        }
      })
      .catch(() => {});
  }, []);

  return config;
}
