"use client";

/**
 * The design library, loaded ONCE per page load and shared by every consumer.
 *
 * The product page needs it to show a thumbnail beside each modifier option, and
 * the customizer already had its own copy of this fetch. A module-level promise
 * cache means navigating between products does not re-read the collection; the
 * library is 100-odd public documents and changes rarely within a session.
 */
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DesignAsset } from "@/types";

let cached: DesignAsset[] | null = null;
let inflight: Promise<DesignAsset[]> | null = null;

async function loadDesigns(): Promise<DesignAsset[]> {
  if (cached) return cached;
  if (!inflight) {
    inflight = getDocs(collection(db, "designs"))
      .then((snap) => {
        const items: DesignAsset[] = [];
        snap.forEach((d) => {
          const data = d.data() as DesignAsset;
          if (!data.image_url) return;
          items.push({ ...data, id: data.id || d.id });
        });
        cached = items;
        return items;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
  }
  return inflight;
}

export function useDesignLibrary(): { designs: DesignAsset[]; loading: boolean } {
  // Initialised from the module cache when it is already warm, so a second page
  // never has to set state inside the effect (which the lint rule bans).
  const [designs, setDesigns] = useState<DesignAsset[]>(() => cached ?? []);
  const [loading, setLoading] = useState(() => !cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    loadDesigns().then((items) => {
      if (!alive) return;
      setDesigns(items);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { designs, loading };
}
