# Front-End / Crawler / Agent Audit — animas-reflections-pwa.web.app

**Audited:** 2026-11-19 · **Deploy:** hosting `Last-Modified 2026-11-18 23:29 UTC`
**Method:** three lenses over the live site —
1. **Rendered front end** — real Chrome via the browser bridge (admin session, dark mode, viewport 1440×900 and 390×844),
2. **Crawler view** — raw HTTP with a Googlebot user agent, no JavaScript, 28 URLs (sitemap 18 + 10 noindex/probe routes),
3. **Agent view** — the accessibility tree / DOM semantics a non-visual agent perceives, plus the AI-crawler surface (`robots.txt`, `llms.txt`, structured data).

**Status:** `OPEN` reproducible now · `FIXED` verified fixed · `DATA` needs a Firestore/CMS decision, not code · `INFO` no action required

Earlier defects are cross-referenced, not re-reported: `AR-nn` = `docs/LIVE_SITE_AUDIT.md`, `U-nn` = `docs/USER_FACING_REVIEW.md`, `F-n` = `docs/SECURITY_AUDIT.md`.

---

## 0. Executive summary

- **The rendered storefront is in good shape** — content pages are semantic and accessible, checkout's card form initialises, and nothing overflows at 390px. The two real front-end gaps are unnamed form controls on the two revenue pages (checkout, customizer).
- **The crawler view is much weaker than the rendered view.** `/shop/`, `/product/`, `/customizer/`, `/search/`, `/account/`, `/order-confirmation/` and `/admin/` are client-only shells with no product data in the raw HTML, and the Open Graph tags default to the homepage on every route (`og:url` is wrong even after JavaScript runs).
- **The agent view is mostly healthy** — one `<h1>` per page, landmarks, a skip link, zero missing-alt images — with the same two gaps as the front end plus an optional `llms.txt`.
- **The shop catalog has regressed to 231 products (17 with images)** — the 2026-11-18 readiness unlisting (16 active) is no longer in effect. That is a data change, not a code change, and needs a deliberate decision.

---

## 1. Rendered front end (real Chrome, admin session, dark mode)

> The auditing browser was signed in as admin (nav shows **Admin**) and carried a leftover test cart item (**Cart 1**) — the screenshots reflect that.

### FE-1 · HIGH (DATA) — the shop is 231 products again, 17 with images · `OPEN`

`/shop/` renders **"Browse 231 products"**, 231 product links, and only **17 `<img>`** elements — the 2026-11-18 state was 16 active / 358 inactive (`USER_FACING_REVIEW` §10). The readiness unlisting has been undone in Firestore. The homepage's Featured Products section also still surfaces the internal SKU *"Full 1 Side Full Color Screen Print 50 - 100 Unit Price"* (AR-06).

Action: confirm whether the re-listing was deliberate. If not, re-apply the readiness unlisting; if yes, the shop is back to being "332 photographs away from 348 sellable products" and the AR-03 card redesign matters more, not less.

### FE-2 · MEDIUM — checkout form inputs have no accessible names · `OPEN`

All 9 customer inputs (First Name … ZIP Code) show a **placeholder** and have a nearby `<label>` in the DOM, but the labels are **not programmatically associated** (`el.labels` is empty for every input), so screen readers announce nothing. This is the single highest-value accessibility fix on the revenue page.

Fix: `htmlFor`/`id` pairs (or wrap each input in its label).

### FE-3 · MEDIUM — customizer still has 2 unnamed controls · `OPEN`

One text input (placeholder "e.g. SMITH 42") and one `<select>` have no accessible name — the same `select-name`/`label` class LIVE_SITE_AUDIT reported on 2026-11-18. One `aria-label` each closes it.

### FE-4 · LOW — imageless cards dominate the shop grid · `OPEN` (AR-03 persists)

With 231 cards and 17 images, the first screens of `/shop/` are mostly large blank placeholder squares. The AR-03 card redesign (type icon + product name) is still the right mitigation while photography catches up.

### FE-5 · INFO (verified good) — checkout card form initialises · `FIXED`

The Square iframe is attached (`web.squarecdn.com/1.87.2/main-iframe.html?applicationId=sq0idp-QAzYFz…`), the customer form renders, and **Pay $47.50** is enabled. The P0 from LIVE_SITE_AUDIT stays fixed on this deploy.

### FE-6 · INFO — `/login/` in a signed-in session lands on `/account/`

Title becomes "Your Account"; the sign-in page itself could not be audited from this session. A session artifact, not a defect claim.

### FE-7 · INFO (verified good) — layout and chrome

No horizontal overflow at 390px on any audited page; mobile nav is one 45px row; `nav`/`main`/`footer` landmarks and the skip link are present on content pages.

---

## 2. Crawler view (raw HTTP, Googlebot UA, no JavaScript)

### Raw vs rendered content — the headline table

| Route | Raw words (body) | Rendered words (main) | Raw `<h1>` | Rendered `<h1>` | Product JSON-LD raw → rendered |
|---|---|---|---|---|---|
| `/` | 492 | 516 | 1 | 1 | — |
| `/shop/` | **120** | **5,521** | **0** | 1 | — |
| `/product/?id=07db885e…` | **120** | **277** | **0** | 1 | **absent → Product/Offer/Brand** |
| `/customizer/` | **0** | 115 | 0 | 1 | — |
| `/search/?q=hoodie` | 120 | 2,071 | 0 | 1 | — |
| `/account/`, `/admin/`, `/order-confirmation/` | 0–120 | — | 0 | — | — |

### CW-1 · HIGH — catalog pages are client-only shells · `OPEN`

`/shop/`, `/product/`, `/customizer/`, `/search/`, `/account/`, `/order-confirmation/` and `/admin/` ship almost no body content: raw `/shop/` is 120 words (nav + footer) against **5,521 rendered**; the product page carries no product data and **no Product JSON-LD** until JavaScript runs. Google renders JavaScript; social cards, most AI crawlers and simpler bots do not — to them the shop is an empty shell.

Fix: prerender/server-render the catalog pages, or emit the product snapshot statically (the build already snapshots `config/seo` the same way).

### CW-2 · HIGH — Open Graph tags default to the homepage on every route · `OPEN`

In the **raw** HTML every route carries the homepage's `og:title`, `og:description`, `og:url` and `og:image`. After JavaScript, runtime SEO fixes `og:title` per route — but **`og:url` stays the homepage everywhere**, including rendered:

| Route | Raw `og:title` | Rendered `og:title` | `og:url` (both) |
|---|---|---|---|
| `/shop/` | "Animas Reflections \| Custom Apparel & Merchandise" | "Shop Custom Apparel & Merchandise \| Animas Reflections" | **homepage** |
| `/product/?id=07db885e…` | "Animas Reflections \| Custom Apparel & Merchandise" | "Product Details \| Animas Reflections" | **homepage** |

So a crawler without JS gets the wrong preview on every page, and even a rendered share of `/shop/` points back at `/`. Fix: per-route OG metadata (title, url, description, image) in the static export.

### CW-3 · HIGH — product pages: no canonical, generic title · `OPEN`

Every product URL emits the same title — **"Product Details | Animas Reflections"** — raw *and* rendered, has **no canonical link**, and declares `robots: index, follow`. With 231 products that is 231 indexable URLs sharing one title and no self-reference. Fix: canonical + per-product `<title>`/description/OG (the product name is already in the `<h1>`).

### CW-4 · MEDIUM — HTML cache-control `max-age=3600` · `OPEN` (security F-3)

Every HTML page, including `/`, is served `cache-control: max-age=3600`, so a deploy (up to and including an emergency unlisting) can lag an hour for returning visitors. The `firebase.json` glob still misses the extension-less homepage URL.

### CW-5 · LOW — soft 404 on unknown product ids · `OPEN` (AR-16)

`/product/?id=does-not-exist` returns 200 with the generic shell — every bogus id is an indexable duplicate of CW-3's page. Structural for query-param product routes; note it rather than chase it.

### CW-6 · INFO (fixed since 2026-11-18) — canonical/sitemap now self-host · `FIXED`

U-16's `www.animasreflections.com` canonicals are gone: every sitemap page self-canonicalises to `animas-reflections-pwa.web.app`, the sitemap's 18 URLs all return 200, `robots.txt` noindexes exactly the right paths (`/search/`, `/checkout/`, `/login/`, `/account/`, `/order-confirmation/`, `/admin/`), and an unknown URL returns a real **404** with `noindex`.

### CW-7 · INFO — AI-crawler surface

`llms.txt` is **404** and `robots.txt` carries a single `User-Agent: *` policy, so AI crawlers (GPTBot, CCBot, …) get the default allow. No action needed unless an explicit AI-agent policy matters to the client.

### CW-8 · INFO — JSON-LD

Site-level `WebSite` + `LocalBusiness` on every page (valid), `FAQPage` on `/faq/`, `BreadcrumbList` on the keyword pages. Product JSON-LD is correct but client-only — see CW-1.

---

## 3. Agent view (accessibility tree / DOM semantics)

### AG-1 · MEDIUM — 9 unnamed checkout inputs · `OPEN` (same as FE-2)

Every shipping input is invisible to assistive tech by name. The agent-view equivalent of FE-2 and the most impactful fix on the buy path.

### AG-2 · MEDIUM — 2 unnamed customizer controls · `OPEN` (same as FE-3)

The design-text input and the product/size `<select>`.

### AG-3 · INFO (fixed) — shop and search selects are named · `FIXED`

`/shop/`'s sort and category selects carry `aria-label`s ("Sort products", "Filter by category") and `/search/`'s is "Sort results" — the `select-name` finding from LIVE_SITE_AUDIT 2026-11-18 is fixed on this deploy. Zero unnamed interactive elements on `/`, `/shop/`, `/product/` and `/search/`.

### AG-4 · INFO — headings, landmarks, skip link

Exactly one `<h1>` per audited page (product page's is the product name); `nav`/`main`/`footer` landmarks and a first-in-tab-order skip link on content pages; shop uses one `<h3>` per product card (235 headings) and search 85 — good text density for an agent to reason over.

### AG-5 · INFO — images

No missing-`alt` images anywhere. Home's `hero-bg.jpg` uses `alt=""` (decorative, correct); the product page's design thumbnails use `alt=""` **plus** `aria-hidden="true"` (decorative, correct).

### AG-6 · INFO — agent tree sizes

`/shop/` 661 nodes, `/search/` 633, `/` 180, product 181, customizer 77 — the content pages are rich enough for an agent to act on; the customizer is compact but its two unnamed controls (AG-2) are the gap.

---

## 4. Suggested fix order

1. **FE-2 / AG-1** — associate the 9 checkout labels (one small PR, revenue path).
2. **CW-3** — product-page canonical + per-product title/OG (biggest crawler win per line of code).
3. **CW-2** — per-route OG metadata, including `og:url`.
4. **CW-1** — prerender or statically emit the catalog/product data so non-JS crawlers see the shop.
5. **FE-3 / AG-2** — the two customizer `aria-label`s.
6. **FE-1** — decide the 231-product re-listing (data), then either re-apply the readiness unlisting or ship the AR-03 card redesign.

---

## 5. Artifacts (session-only, not committed)

- Raw crawl (28 URLs, Googlebot UA): `.tmp-animas-audit/crawl-meta.json`
- Rendered DOM probe: `.tmp-animas-audit/render-audit.json`
- Agent view (a11y tree + controls): `.tmp-animas-audit/agent-view.json`
- Screenshots: `.tmp-animas-audit/shots/{home,shop,product,checkout}-{desktop,mobile}.png`
- Perf probe (resource counts; paint metrics unreliable from bfcache): `.tmp-animas-audit/perf.json`
