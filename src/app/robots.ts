import type { MetadataRoute } from "next";
import { PAGE_SEO, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // Utility pages are excluded from crawling here AND marked noindex by their
  // own metadata (metadataFor() in src/lib/seo.ts). Keeping the two in step is
  // deliberate: a Disallow-only rule hides the noindex tag from the crawler, so
  // a disallowed URL can still be indexed from links (Nown S.I.T.E.S docs/SEO.md §5).
  const disallow = PAGE_SEO.filter((page) => !page.indexable).map((page) => page.path);

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
