/* ─── SEO + keyword content contract ─────────────────────────────────
   The shape of the Firestore document that drives everything in
   src/lib/seo.ts. It is edited in Admin → SEO and read at BUILD time by
   scripts/fetch-seo-config.mjs, which snapshots it into
   src/lib/seo-content.generated.ts.

   Why build time: this site is a static export (`output: "export"`), so
   <title>, meta description, canonical, og:image and JSON-LD are baked into
   the HTML. Social scrapers (Facebook, iMessage, Slack) do not run JavaScript
   at all, so injecting SEO client-side would silently break every share
   preview. Editing here therefore requires the publish step (Admin → SEO →
   Publish, or `npm run publish`).

   Firestore doc: config/seo  (public read — it is public marketing copy;
   admin write via firestore.rules).
   ────────────────────────────────────────────────────────────────────── */

/** Per-page overrides. Any field left blank falls back to the committed default. */
export interface SeoPageOverride {
  title?: string;
  description?: string;
}

/**
 * A keyword landing page. One entry produces one real static page at
 * `/<slug>/`, listed in sitemap.xml and cross-linked from the /services/ hub.
 * Method: the Nown S.I.T.E.S compact-keywords convention — a bottom-of-funnel,
 * 3–6 word purchase-intent keyword as its own page, never a wall of variants.
 */
export interface KeywordPage {
  /** URL slug. The page lives at /`slug`/. Generated from the keyword if omitted. */
  slug: string;
  /** The exact keyword being targeted; also the H1 unless `headline` is set. */
  keyword: string;
  /** Optional metadata overrides; derived from headline/body when absent. */
  title?: string;
  description?: string;
  headline?: string;
  /** The body copy. Plain text; rendered as paragraphs split on blank lines. */
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Unpublished entries are kept in the CMS but emit no page. */
  published: boolean;
  /** Display order on the /services/ hub; falls back to the array order. */
  order?: number;
}

export interface SeoConfig {
  /** Keyed by route path exactly as it appears in PAGE_SEO, e.g. "/shop/". */
  pages?: Record<string, SeoPageOverride>;
  keywords?: KeywordPage[];
  updatedAt?: string;
  updatedBy?: string;
}

/** Firestore doc id under the `config` collection. */
export const SEO_CONFIG_DOC = "seo";

export const EMPTY_SEO_CONFIG: SeoConfig = { pages: {}, keywords: [] };

/** Length limits that `metadataFor()` and the admin UI both enforce. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/**
 * Turn a keyword into a URL-safe slug: lowercase, alphanumeric runs joined by
 * a single hyphen. Kept identical to the admin UI's live slug preview so what
 * the editor shows is exactly what the build emits.
 */
export function slugifyKeyword(keyword: string): string {
  return String(keyword)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Top-level paths owned by real routes, plus build artifacts and public assets.
 *
 * A keyword whose slug matches one of these would be SHADOWED by the static
 * route: Next resolves a real route ahead of the dynamic /[keyword] segment, so
 * the CMS page would silently never render — while still being listed in
 * sitemap.xml, producing a duplicate entry for a page the editor does not
 * actually control. Reject these rather than shipping a page that cannot exist.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin", "about", "account", "biscuit-hockey", "checkout", "contact", "custom",
  "customizer", "faq", "fundraising", "im-ok-r-u", "order-confirmation", "privacy",
  "product", "search", "services", "shop", "terms",
  "_next", "404", "robots.txt", "sitemap.xml", "favicon.ico", "manifest.json",
  "og-image.png", "logo.png", "index",
]);

/** True when a keyword slug would collide with an existing route or asset. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(String(slug).toLowerCase());
}

/** Normalize a raw Firestore/JSON value into a safe SeoConfig. */
export function normalizeSeoConfig(raw: unknown): SeoConfig {
  const out: SeoConfig = { pages: {}, keywords: [] };
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;

  if (src.pages && typeof src.pages === "object") {
    for (const [path, value] of Object.entries(src.pages as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const entry: SeoPageOverride = {};
      if (typeof v.title === "string" && v.title.trim()) entry.title = v.title.trim();
      if (typeof v.description === "string" && v.description.trim()) {
        entry.description = v.description.trim();
      }
      if (Object.keys(entry).length > 0) out.pages![path] = entry;
    }
  }

  if (Array.isArray(src.keywords)) {
    const seen = new Set<string>();
    for (const item of src.keywords) {
      if (!item || typeof item !== "object") continue;
      const k = item as Record<string, unknown>;
      const keyword = typeof k.keyword === "string" ? k.keyword.trim() : "";
      if (!keyword) continue;
      const slug =
        (typeof k.slug === "string" && k.slug.trim() ? slugifyKeyword(k.slug) : "") ||
        slugifyKeyword(keyword);
      // A duplicate slug would generate two pages at the same URL, and a
      // reserved one would be shadowed by a real route (see RESERVED_SLUGS).
      if (!slug || seen.has(slug) || isReservedSlug(slug)) continue;
      seen.add(slug);
      out.keywords!.push({
        slug,
        keyword,
        title: typeof k.title === "string" ? k.title.trim() : undefined,
        description: typeof k.description === "string" ? k.description.trim() : undefined,
        headline: typeof k.headline === "string" ? k.headline.trim() : undefined,
        body: typeof k.body === "string" ? k.body : "",
        ctaLabel: typeof k.ctaLabel === "string" ? k.ctaLabel.trim() : undefined,
        ctaHref: typeof k.ctaHref === "string" ? k.ctaHref.trim() : undefined,
        published: k.published !== false,
        order: typeof k.order === "number" ? k.order : undefined,
      });
    }
  }

  if (typeof src.updatedAt === "string") out.updatedAt = src.updatedAt;
  if (typeof src.updatedBy === "string") out.updatedBy = src.updatedBy;
  return out;
}
