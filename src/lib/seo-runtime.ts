/* ─── Runtime SEO overrides ───────────────────────────────────────────
   The static export bakes <title>/<meta> into the HTML at build time from the
   snapshot in src/lib/seo-content.generated.ts. That makes the REPO
   authoritative for SEO until someone runs Publish — the opposite of how the
   rest of the site works, where config/site is read live so theme and copy
   edits appear with no rebuild.

   This module restores the "deployed page as default, Firebase as truth"
   behaviour for the parts of <head> JavaScript can still change:
   document.title and the description / og / twitter meta tags. The build-time
   value stays the fallback, so a blank or missing document behaves exactly as
   shipped — and social scrapers, which do not run JavaScript at all, still get
   the baked tags.

   Deliberately NOT handled here: <link rel="canonical"> and the JSON-LD graph.
   Canonicals are structural (one URL per document, query-string aware), and the
   @graph belongs in the server-rendered HTML where a crawler expects it.
   ────────────────────────────────────────────────────────────────────── */

import {
  DESCRIPTION_MAX,
  PAGE_SEO,
  SITE_NAME,
  clip,
  pageTitle,
  type PageSeo,
} from "@/lib/seo";
import { slugifyKeyword, type SeoConfig } from "@/lib/seo-config";

/**
 * Canonical route form used as the PAGE_SEO / config.seo key: a leading slash
 * and — matching `trailingSlash: true` — a trailing slash on everything but the
 * root. `usePathname()` returns "/shop/" in a static export, but normalising
 * here keeps the lookup correct if that ever changes.
 */
export function normalizeSeoPath(pathname: string): string {
  const bare = String(pathname || "/").split(/[?#]/)[0];
  const lead = bare.startsWith("/") ? bare : `/${bare}`;
  if (lead === "/") return "/";
  return lead.endsWith("/") ? lead : `${lead}/`;
}

/** PAGE_SEO lookup that returns undefined instead of throwing (see pageSeo). */
export function findPageSeo(path: string): PageSeo | undefined {
  return PAGE_SEO.find((p) => p.path === path);
}

export interface RuntimeHead {
  /** Full, brand-suffixed and clamped title — already through pageTitle(). */
  title: string;
  description: string;
}

/** A CMS value counts only when it has visible content; blank falls through. */
function override(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolve the <head> values for a route from the LIVE config/seo document.
 *
 * Returns null when nothing owns the path (an unknown URL, or a route with no
 * SEO entry) — the caller then leaves the build-time tags alone rather than
 * blanking them. A blank override falls back to the committed default, so an
 * empty document reproduces exactly what is already in the HTML.
 */
export function runtimeHeadFor(pathname: string, config: SeoConfig): RuntimeHead | null {
  const path = normalizeSeoPath(pathname);

  const page = findPageSeo(path);
  if (page) {
    const title = override(config.pages?.[path]?.title) || page.title;
    const description = override(config.pages?.[path]?.description) || page.description;
    return { title: pageTitle(title), description: clip(description, DESCRIPTION_MAX) };
  }

  // Keyword landing pages are generated at build time, so a NEW keyword still
  // needs a build — but an existing one can have its copy corrected live.
  const slug = path.replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) return null;
  const kw = (config.keywords ?? []).find(
    (k) => k.published && slugifyKeyword(k.slug || k.keyword) === slug
  );
  if (!kw) return null;

  const headline = override(kw.headline) || kw.keyword;
  const title = override(kw.title) || headline;
  const description =
    override(kw.description) ||
    clip(kw.body, DESCRIPTION_MAX) ||
    `${headline} from ${SITE_NAME}.`;
  return { title: pageTitle(title), description: clip(description, DESCRIPTION_MAX) };
}

function setMeta(key: string, content: string, attr: "name" | "property"): void {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    const created = document.createElement("meta");
    created.setAttribute(attr, key);
    created.setAttribute("content", content);
    document.head.appendChild(created);
    return;
  }
  // Only touch the DOM when the value actually differs, so a re-render that
  // resolves the same copy does not churn the head on every navigation.
  if (el.getAttribute("content") !== content) el.setAttribute("content", content);
}

/** Write a resolved head into the live document. No-op outside the browser. */
export function applyRuntimeHead(head: RuntimeHead | null): void {
  if (typeof document === "undefined" || !head) return;
  if (document.title !== head.title) document.title = head.title;
  setMeta("description", head.description, "name");
  setMeta("og:title", head.title, "property");
  setMeta("og:description", head.description, "property");
  setMeta("twitter:title", head.title, "name");
  setMeta("twitter:description", head.description, "name");
}
