import type { MetadataRoute } from "next";
import { PAGE_SEO, SITE_URL } from "@/lib/seo";

// Generated from the PAGE_SEO registry in src/lib/seo.ts so the sitemap and the
// per-route <head> metadata can never drift — the previous hand-maintained
// public/sitemap.xml had already fallen out of step with the real routes.
// `changefreq` and `priority` are deliberately omitted: search engines ignore
// both (Nown S.I.T.E.S docs/SEO.md §5).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGE_SEO.filter((page) => page.indexable && page.inSitemap !== false).map(
    (page) => ({ url: SITE_URL + page.path })
  );
}
