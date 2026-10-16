#!/usr/bin/env node
/**
 * SEO gate for the static export — ported from the Nown S.I.T.E.S framework's
 * tools/check-site.mjs, adapted to a Next.js export.
 *
 * Run it after `next build` (wired as `postbuild`). It reads ONLY the emitted
 * artifacts in out/, so it validates what a crawler actually receives rather
 * than what the source intended. Every rule below corresponds to a defect that
 * has actually shipped on this site:
 *
 *   - a share card declared via summary_large_image with NO og:image at all
 *   - a hand-maintained sitemap.xml that had drifted from the real routes
 *   - a per-route title that doubled the brand via the root title.template
 *     ("Our Story | Animas Reflections | Animas Reflections")
 *   - a canonical inherited from the root layout, which pointed /product/ and
 *     every ?id= product URL at the home page
 *
 * Unlike the framework's own scan, the directory walk here is RECURSIVE: this
 * app emits out/<route>/index.html, and a non-recursive readdir would silently
 * check only the home page.
 *
 * Usage: node scripts/check-seo.mjs [outDir]
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ORIGIN = "https://www.animasreflections.com";
const BRAND = "Animas Reflections";
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const OUT = process.argv[2] || "out";

// Indexable pages that are deliberately absent from sitemap.xml and carry no
// canonical. /product/ serves every product from one static URL via ?id=, so a
// single canonical would tell a crawler the whole catalog is one document, and
// there is nothing useful to list without enumerating the catalog.
const INTENTIONALLY_UNLISTED = new Set(["/product/"]);

const errors = [];
const warnings = [];
const fail = (route, msg) => errors.push(route + ": " + msg);

function walk(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaTags(html) {
  const out = [];
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const key = tag.match(/\b(?:name|property)\s*=\s*"([^"]*)"/i);
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (key) out.push({ key: key[1].toLowerCase(), content: content ? decodeEntities(content[1]) : "" });
  }
  return out;
}

function attr(html, re) {
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : "";
}

const routeOf = (rel) => (rel === "index.html" ? "/" : "/" + rel.replace(/\\/g, "/").replace(/index\.html$/, ""));

if (!existsSync(OUT)) {
  console.error("check-seo: '" + OUT + "' not found — run \"npm run build\" first.");
  process.exit(1);
}

const files = walk(OUT, []);
const pages = files.filter((f) => f.endsWith("index.html"));
const titles = new Map();

// ── Sitemap ────────────────────────────────────────────────────────────────
const sitemapPath = join(OUT, "sitemap.xml");
const sitemapLocs = [];
if (!existsSync(sitemapPath)) {
  errors.push("sitemap.xml: missing from " + OUT + "/ — src/app/sitemap.ts did not emit");
} else {
  const xml = readFileSync(sitemapPath, "utf8");
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) sitemapLocs.push(m[1]);
  if (sitemapLocs.length === 0) errors.push("sitemap.xml: contains no <loc> entries");
  // Two entries for one URL means two sources generated the same page — e.g. a
  // keyword slug colliding with a real route.
  const duplicates = sitemapLocs.filter((loc, i) => sitemapLocs.indexOf(loc) !== i);
  for (const dup of new Set(duplicates)) {
    errors.push("sitemap.xml: duplicate entry for " + dup);
  }
}
const sitemapSet = new Set(sitemapLocs.map((l) => l.replace(ORIGIN, "") || "/"));

// ── robots.txt ─────────────────────────────────────────────────────────────
const robotsPath = join(OUT, "robots.txt");
if (!existsSync(robotsPath)) {
  errors.push("robots.txt: missing from " + OUT + "/ — src/app/robots.ts did not emit");
} else {
  const txt = readFileSync(robotsPath, "utf8");
  if (!txt.includes("Sitemap: " + ORIGIN + "/sitemap.xml")) {
    errors.push("robots.txt: does not point at " + ORIGIN + "/sitemap.xml");
  }
}

// ── Pages ──────────────────────────────────────────────────────────────────
for (const file of pages) {
  const route = routeOf(relative(OUT, file));
  const html = readFileSync(file, "utf8");
  const metas = metaTags(html);
  const meta = (key) => {
    const hit = metas.find((x) => x.key === key);
    return hit ? hit.content : "";
  };

  // A crawler will not index a noindex page, so a repeated title there is not a
  // defect — and Next renders the built-in error page three times (404.html,
  // 404/ and _not-found/), which would otherwise self-collide.
  const noindex = /noindex/i.test(meta("robots"));
  const canonical = attr(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);

  const title = decodeEntities(attr(html, /<title>([\s\S]*?)<\/title>/i)).trim();
  if (!title) fail(route, "no <title>");
  else {
    if (title.length > TITLE_MAX) fail(route, "title is " + title.length + " chars (max " + TITLE_MAX + "): " + title);
    const brandHits = title.split(BRAND).length - 1;
    if (brandHits > 1) fail(route, "brand appears " + brandHits + "x in title (root title.template double-applied?): " + title);
    if (!noindex) {
      if (titles.has(title)) fail(route, "title duplicates the indexable page " + titles.get(title) + ": " + title);
      else titles.set(title, route);
    }
  }

  const description = meta("description").trim();
  if (!description) fail(route, "no meta description");
  else if (description.length > DESCRIPTION_MAX) {
    fail(route, "description is " + description.length + " chars (max " + DESCRIPTION_MAX + ")");
  }

  const ogImage = meta("og:image");
  if (!ogImage) fail(route, "no og:image — shares render as a bare text card");
  else if (!/^https:\/\//.test(ogImage)) fail(route, "og:image is not an absolute URL: " + ogImage);

  if (!meta("twitter:image") && meta("twitter:card") !== "summary_large_image") {
    fail(route, "no twitter:image and twitter:card is not summary_large_image");
  }

  if (!noindex && !INTENTIONALLY_UNLISTED.has(route)) {
    if (!canonical) fail(route, "no canonical (every indexable page needs one)");
    else if (canonical !== ORIGIN + route) {
      fail(route, "canonical is " + canonical + " but this page is " + ORIGIN + route);
    }
  }

  if (noindex && sitemapSet.has(route)) {
    fail(route, "is noindex but is listed in sitemap.xml");
  }
  if (!noindex && !INTENTIONALLY_UNLISTED.has(route) && !sitemapSet.has(route)) {
    fail(route, "is indexable but is missing from sitemap.xml");
  }

  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let block;
  let ldCount = 0;
  while ((block = ld.exec(html)) !== null) {
    ldCount++;
    try {
      JSON.parse(block[1]);
    } catch (e) {
      fail(route, "JSON-LD block " + ldCount + " does not parse: " + e.message);
    }
  }
  if (route === "/") {
    if (ldCount === 0) fail(route, "no JSON-LD at all");
    else if (!html.includes('"@graph"')) warnings.push(route + ": site JSON-LD is not a @graph");
  }
}

// ── Sitemap entries must resolve to a real page ────────────────────────────
for (const loc of sitemapLocs) {
  if (!loc.startsWith(ORIGIN)) {
    errors.push("sitemap.xml: " + loc + " is not on " + ORIGIN);
    continue;
  }
  const rel = loc.slice(ORIGIN.length).replace(/^\//, "");
  const target = rel === "" ? join(OUT, "index.html") : join(OUT, rel, "index.html");
  if (!existsSync(target)) errors.push("sitemap.xml: " + loc + " has no page at " + relative(OUT, target));
}

// ── The share card itself ──────────────────────────────────────────────────
// Every page declares og:image and twitter:image, and every one of those tags is
// checked above for being present and absolute. The FILE behind them was never
// checked, so a missing or truncated og-image.png passed every gate and shipped
// a broken card into every share preview. A tag pointing at nothing is not a
// passing gate.
const ogFile = join(OUT, "og-image.png");
if (!existsSync(ogFile)) {
  errors.push("og-image.png: missing from the export, so every share preview shows a broken card");
} else {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const head = readFileSync(ogFile).subarray(0, PNG_SIGNATURE.length);
  if (!PNG_SIGNATURE.every((byte, i) => head[i] === byte)) {
    errors.push("og-image.png: exists but is not a PNG (wrong file or a truncated write)");
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn("  warn  " + w);
if (errors.length > 0) {
  console.error("");
  for (const e of errors) console.error("  FAIL  " + e);
  console.error("");
  console.error("check-seo: " + errors.length + " problem(s) across " + pages.length + " pages.");
  process.exit(1);
}
console.log("check-seo: OK — " + pages.length + " pages, " + sitemapLocs.length + " sitemap URLs, all gates pass.");
