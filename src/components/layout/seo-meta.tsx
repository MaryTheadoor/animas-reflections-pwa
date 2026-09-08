"use client";

import { useEffect } from "react";
import { useSiteContent } from "@/hooks/useSiteConfig";

/** Applies the editable global SEO fields (title + description + og:image) to the
 *  document head on mount/change. The static metadata in the app shell remains the
 *  crawlable fallback; this keeps the browser tab + share preview in sync. */
export default function SeoMeta() {
  const c = useSiteContent();
  const { metaTitle, metaDescription, ogImage } = c.global;

  useEffect(() => {
    const setMeta = (key: string, content: string) => {
      const isProp = key.startsWith("og:");
      const sel = isProp ? `meta[property="${key}"]` : `meta[name="${key}"]`;
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProp ? "property" : "name", key);
        document.head.appendChild(el);
      }
      if (el.getAttribute("content") !== content) el.setAttribute("content", content);
    };
    if (metaTitle) document.title = metaTitle;
    if (metaDescription) setMeta("description", metaDescription);
    if (metaTitle) setMeta("og:title", metaTitle);
    if (metaDescription) setMeta("og:description", metaDescription);
    if (ogImage) setMeta("og:image", ogImage);
  }, [metaTitle, metaDescription, ogImage]);

  return null;
}
