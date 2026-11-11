/* ─── SEO single source of truth ──────────────────────────────────────
   Conventions ported from the Nown S.I.T.E.S framework
   (docs/SEO.md §4–5, tools/seo.mjs), adapted to a Next.js static export:

     • ONE registry drives both the per-route <head> and sitemap.xml, so the
       two can never drift (the hand-maintained public/sitemap.xml had already
       drifted: it listed /search and omitted /privacy).
     • Titles and descriptions are clamped on a WORD boundary to the lengths
       search engines actually render (60 / 155) instead of being truncated
       mid-word by the SERP.
     • Site structured data is a single JSON-LD @graph with stable @id
       references, not several unrelated flat nodes.
     • Anything we do not actually know about the business (street address,
       postal code, geo, opening hours) is OMITTED rather than invented —
       invalid schema is worse than absent schema.
   ────────────────────────────────────────────────────────────────────── */

import { SITE } from "@/lib/content";
import { normalizeSeoConfig, type KeywordPage } from "@/lib/seo-config";
import { SEO_CONTENT } from "@/lib/seo-content.generated";

/**
 * CMS overrides, snapshotted from Firestore config/seo at build time by
 * scripts/fetch-seo-config.mjs. Everything below stays authoritative as the
 * DEFAULT: a blank field in the admin means "use the committed copy", so the
 * site can never end up with an empty <title> because someone cleared a box.
 */
const CMS = normalizeSeoConfig(SEO_CONTENT);

export const SITE_URL = "https://www.animasreflections.com";
export const SITE_NAME = SITE.name;

/** Google renders roughly these widths; longer text is cut mid-word. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** Collapse whitespace and clamp to `max` on a word boundary. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Only break on a space if it is not so early that we lose most of the text.
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:!?\u2014-]+$/, "") + "\u2026";
}

/** "<Page> | <Site>", unless the page title already names the site. */
export function pageTitle(title: string): string {
  return title.toLowerCase().includes(SITE_NAME.toLowerCase())
    ? title
    : clip(`${title} | ${SITE_NAME}`, TITLE_MAX);
}

export interface PageSeo {
  /** Route path with a trailing slash, matching `trailingSlash: true`. */
  path: string;
  title: string;
  description: string;
  /** false = utility page: omitted from sitemap.xml and marked noindex. */
  indexable: boolean;
  /** List in sitemap.xml. Defaults to `indexable`. */
  inSitemap?: boolean;
  /**
   * Emit `<link rel="canonical">`. Defaults to true. Disable for routes whose
   * real URLs carry query parameters: a single canonical for /product/ would
   * tell a crawler that every ?id= page is the same document and collapse the
   * whole product catalog into one indexed page.
   */
  canonical?: boolean;
}

/** Every route that has static metadata. Order here is the sitemap order. */
export const PAGE_SEO: readonly PageSeo[] = [
  {
    path: "/",
    title: "Custom Apparel & Merchandise",
    description:
      "Family-owned custom print shop in Durango, CO. Put your own design on apparel, drinkware, wood, glass and metal — or design one online.",
    indexable: true,
  },
  {
    path: "/shop/",
    title: "Shop Custom Apparel & Merchandise",
    description:
      "Browse custom t-shirts, hoodies, hats, bags, coasters, ornaments and more. Free shipping on orders over $100.",
    indexable: true,
  },
  {
    path: "/customizer/",
    title: "Design Your Own Custom Apparel Online",
    description:
      "Pick a product and color, upload your artwork, add text and see a live mockup before you order. Designed and printed in Durango, Colorado.",
    indexable: true,
  },
  {
    path: "/services/",
    title: "Custom Printing Services",
    description: `Screen printing, embroidery and sublimation for teams, businesses and events in ${SITE.location}. See what we make and how to start.`,
    indexable: true,
  },
  {
    path: "/custom/",
    title: "Custom Printing From Your Own Image",
    description:
      "Email us your image and we will print it on clothing, glass, metal, wood, slate and more. Family-owned and operated in Durango, CO since 1999.",
    indexable: true,
  },
  {
    path: "/fundraising/",
    title: "Custom Merchandise Fundraising",
    description:
      "A done-for-you online fundraiser with custom apparel: 50/50 profit split, no upfront costs, no inventory and no minimum orders.",
    indexable: true,
  },
  {
    path: "/about/",
    title: "Our Story",
    description:
      "A family-owned design and print operation creating unique designs inspired by Southwest Colorado since 1999. Meet the family behind Animas Reflections.",
    indexable: true,
  },
  {
    path: "/contact/",
    title: "Contact Us",
    description: `Questions about a custom order, a quote or a fundraiser? Call ${SITE.phone} or email ${SITE.email}. Based in Durango, Colorado.`,
    indexable: true,
  },
  {
    path: "/faq/",
    title: "Frequently Asked Questions",
    description:
      "Print methods, production times, shipping, returns, file formats and order changes — answers to what customers ask us most.",
    indexable: true,
  },
  {
    path: "/biscuit-hockey/",
    title: "Biscuit Hockey Apparel",
    description:
      "Hockey apparel built on the language of the game, established 2021. A division of Animas Reflections. Pass that Biscuit and keep the game alive.",
    indexable: true,
  },
  {
    path: "/im-ok-r-u/",
    title: "I'M OK R U — Hidden Message Shirts",
    description:
      "Shirts carrying hidden messages of encouragement, born on the Spring Solstice of 2021. A subsidiary of Animas Reflections.",
    indexable: true,
  },
  {
    path: "/terms/",
    title: "Terms of Sale",
    description:
      "The standard terms of sale for orders placed with Animas Reflections: pricing, payment, production, shipping, returns and order cancellation.",
    indexable: true,
  },
  {
    path: "/privacy/",
    title: "Privacy Policy",
    description:
      "What personal information Animas Reflections collects, why we collect it, how long we keep it, and how to request access, correction or deletion.",
    indexable: true,
  },

  {
    path: "/product/",
    title: "Product Details",
    description:
      "Color, sizing, pricing and add-ons for this product, with live per-color mockups. Custom-printed in Durango, Colorado.",
    indexable: true,
    // One static URL serves every product via ?id=, so a single canonical
    // would collapse them all into one page, and there is nothing useful to
    // list in the sitemap without enumerating the catalog.
    canonical: false,
    inSitemap: false,
  },

  // ── Utility routes: real pages, but nothing a search engine should index ──
  { path: "/search/", title: "Search", description: "Search the Animas Reflections catalog.", indexable: false },
  { path: "/checkout/", title: "Checkout", description: "Complete your Animas Reflections order.", indexable: false },
  {
    path: "/login/",
    title: "Sign In",
    description:
      "Sign in to your Animas Reflections account to see your orders, saved addresses and profile, or reset your password.",
    indexable: false,
  },
  { path: "/account/", title: "Your Account", description: "Your Animas Reflections orders, addresses and profile.", indexable: false },
  { path: "/order-confirmation/", title: "Order Confirmed", description: "Your Animas Reflections order confirmation.", indexable: false },
  { path: "/admin/", title: "Admin", description: "Animas Reflections administration.", indexable: false },
  { path: "/admin/login/", title: "Admin Sign In", description: "Animas Reflections administration sign in.", indexable: false },
] as const;

/** Look a page up by route path; throws at build time on a typo'd path. */
export function pageSeo(path: string): PageSeo {
  const hit = PAGE_SEO.find((p) => p.path === path);
  if (!hit) throw new Error(`pageSeo(): no SEO entry for "${path}" — add it to PAGE_SEO in src/lib/seo.ts`);
  return hit;
}

/**
 * Metadata fragment for a route, ready to spread into `metadata`.
 *
 * The title is emitted as `absolute` on purpose: the root layout declares
 * `title.template: "%s | Animas Reflections"`, so returning a plain string here
 * would append the brand a second time ("Our Story | Animas Reflections |
 * Animas Reflections"). `pageTitle()` already builds and clamps the full title.
 */
export function metadataFor(path: string) {
  const page = pageSeo(path);
  // CMS override wins when present; otherwise the committed default above.
  const title = CMS.pages?.[path]?.title || page.title;
  const description = CMS.pages?.[path]?.description || page.description;
  return {
    title: { absolute: pageTitle(title) },
    description: clip(description, DESCRIPTION_MAX),
    ...(page.canonical === false
      ? {}
      : { alternates: { canonical: SITE_URL + page.path } }),
    ...(page.indexable ? {} : { robots: { index: false, follow: true } }),
  };
}

/* ─── Structured data ───────────────────────────────────────────────── */

/**
 * Business facts used by the LocalBusiness node. Only values we can verify are
 * present. Add `streetAddress`, `postalCode`, `geo` and `openingHours` here
 * (all four are supported — see the framework's tools/seo.mjs buildLocalBusiness)
 * once the client confirms them; inventing them would emit invalid schema.
 */
export const BUSINESS = {
  /** Schema.org subtype. LocalBusiness is the correct generic for a print shop. */
  type: "LocalBusiness",
  name: SITE_NAME,
  telephone: "+1-" + SITE.phone,
  email: SITE.email,
  priceRange: "$$",
  address: {
    addressLocality: "Durango",
    addressRegion: "CO",
    addressCountry: "US",
  },
  image: SITE_URL + "/og-image.png",
  sameAs: [SITE.socials.instagram],
} as const;

/** Drop undefined/empty values so a half-filled field never emits invalid schema. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v === undefined || v === null || v === "") return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.keys(v as object).length > 0;
      return true;
    })
  ) as T;
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": SITE_URL + "/#website",
    url: SITE_URL + "/",
    name: SITE_NAME,
    description: SITE.description,
    inLanguage: "en-US",
    publisher: { "@id": SITE_URL + "/#localbusiness" },
    potentialAction: {
      "@type": "SearchAction",
      target: SITE_URL + "/search/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
}

export function localBusinessNode() {
  return compact({
    "@type": BUSINESS.type,
    "@id": SITE_URL + "/#localbusiness",
    name: BUSINESS.name,
    url: SITE_URL + "/",
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    priceRange: BUSINESS.priceRange,
    image: BUSINESS.image,
    address: compact({ "@type": "PostalAddress", ...BUSINESS.address }),
    sameAs: [...BUSINESS.sameAs],
  });
}

/**
 * The site-wide graph. One script block with two @id-linked nodes, as the
 * framework's buildJsonLd() does — not several unrelated flat nodes.
 */
export function siteGraph() {
  return { "@context": "https://schema.org", "@graph": [websiteNode(), localBusinessNode()] };
}

/* ─── Keyword landing pages (CMS-managed) ───────────────────────────────
   Each published keyword produces one real static page at /<slug>/, listed in
   sitemap.xml and cross-linked from /services/. Method: the Nown S.I.T.E.S
   compact-keywords convention — one bottom-of-funnel keyword per page rather
   than a wall of near-duplicate variants, which is what Google penalises.
   ───────────────────────────────────────────────────────────────────── */

/** Published keyword pages, in hub display order. */
export function publishedKeywordPages(): KeywordPage[] {
  return (CMS.keywords ?? [])
    .filter((k) => k.published && k.slug)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function keywordPageBySlug(slug: string): KeywordPage | undefined {
  return publishedKeywordPages().find((k) => k.slug === slug);
}

/** Absolute URL for a keyword page. */
export function keywordPath(slug: string): string {
  return "/" + slug + "/";
}

/**
 * Metadata for a keyword page. Title and description are DERIVED when the
 * editor leaves them blank (the framework's seo.mjs derivation): the headline
 * becomes the title, and the body's opening is clipped to the description
 * limit — so a new keyword page never ships metadata-less.
 */
export function keywordMetadata(page: KeywordPage) {
  const headline = page.headline || page.keyword;
  const title = page.title || headline;
  // The derived description must NEVER be empty. A keyword published with no
  // body would otherwise emit a blank meta description, which fails the SEO
  // gate in scripts/check-seo.mjs at postbuild - so the build would go red
  // AFTER the admin was told their publish had started. Fall back to a
  // sentence built from copy we know is real.
  const derived = clip(page.body, DESCRIPTION_MAX);
  const description =
    page.description || derived || `${headline} from ${SITE_NAME} in ${SITE.location}.`;
  return {
    title: { absolute: pageTitle(title) },
    description: clip(description, DESCRIPTION_MAX),
    alternates: { canonical: SITE_URL + keywordPath(page.slug) },
  };
}

/** Split plain-text body copy into paragraphs on blank lines. */
export function keywordParagraphs(body: string): string[] {
  return String(body || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
