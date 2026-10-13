# Animas Reflections PWA — Project Context & Recovery Blueprint
## Session: 2026-08-21 | Build Instance Context File

---

## 1. PROJECT OVERVIEW

**Client:** Cindy, Animas Reflections (Durango, CO)
**Business:** Custom screen printing, embroidery, sublimation apparel and merchandise
**Current Live Sites:**
- https://www.animasreflections.com (Square Online — existing site)
- https://animas-reflections-pwa.web.app (Firebase Hosting — NEW PWA)

**Goal:** Replace restrictive Square/Shopify template with a custom headless PWA using Square as backend API.

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.7 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Hosting | Firebase Hosting |
| Backend | Firebase Cloud Functions (Node.js 22, TypeScript) |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Auth | Firebase Authentication (Google + Email/Password) |
| Payments | Square Web Payments SDK + Square API v42.3.0 |
| AI/ML | Genkit + Gemini SDK (installed but not active) |
| Version Control | GitHub: https://github.com/MaryTheadoor/animas-reflections-pwa |

---

## 3. DEPLOYMENT MODE

**Static Export:** `output: "export"` in next.config.ts
- Build: `npm run build` → generates `out/` directory (164 files)
- Deploy: `firebase deploy --only hosting`
- Functions: `firebase deploy --only functions`

---

## 4. ALL ROUTES (20 total)

| Route | File | Purpose |
|---|---|---|
| `/` | src/app/page.tsx | Homepage with hero, featured products, our story |
| `/about` | src/app/about/page.tsx | Our Story |
| `/account` | src/app/account/page.tsx | Customer account (orders, addresses, profile) |
| `/shop` | src/app/shop/page.tsx | Product catalog — By Design/Brand or By Product Type, search, sort, tile density |
| `/product` | src/app/product/page.tsx | Product detail page (query param ?id=) |
| `/customizer` | src/app/customizer/page.tsx | Interactive design customizer (color selector, mockups, designs, add-ons) |
| `/checkout` | src/app/checkout/page.tsx | Cart + Square payment form + customer info |
| `/order-confirmation` | src/app/order-confirmation/page.tsx | Post-purchase success display |
| `/search` | src/app/search/page.tsx | Fuzzy search with filters + tile density |
| `/admin` | src/app/admin/page.tsx | CMS Dashboard (products, categories, designs, images, settings, orders, users, admins) |
| `/admin/login` | src/app/admin/login/page.tsx | Admin auth page |
| `/contact` | src/app/contact/page.tsx | Contact info |
| `/custom` | src/app/custom/page.tsx | Design Your Own info |
| `/faq` | src/app/faq/page.tsx | FAQ (with FAQPage JSON-LD) |
| `/fundraising` | src/app/fundraising/page.tsx | Fundraising program |
| `/terms` | src/app/terms/page.tsx | Terms of Sale |
| `/privacy` | src/app/privacy/page.tsx | Privacy Policy |
| `/biscuit-hockey` | src/app/biscuit-hockey/page.tsx | Sub-brand page |
| `/im-ok-r-u` | src/app/im-ok-r-u/page.tsx | Sub-brand page |
| `/_not-found` | | 404 |

---

## 5. KEY FILES

| File | Purpose |
|---|---|
| src/lib/content.ts | Centralized site copy (SITE, HERO, OUR_STORY, FAQ, NAVIGATION, etc.) |
| src/lib/constants.ts | SHIPPING tiers, ADDON_PRICE, SQUARE config, colors/sizes |
| src/lib/firebase.ts | Firebase client init (db, storage, auth, functions) |
| src/lib/html-utils.ts | sanitizeHTML / stripTags for rich-text descriptions |
| src/lib/firestore-utils.ts | stripUndefined — strips undefined values before Firestore writes |
| src/lib/synthetic-data.ts | Test data (USE_SYNTHETIC=false in production) |
| src/types/index.ts | All TypeScript interfaces (ManagedProduct, CartItem, ProductAddon, ProductAttributes, ...) |
| src/hooks/useCatalog.ts | Catalog hook — returns ManagedProduct[] (canonical type) |
| src/hooks/useSearch.ts | Fuzzy search scoring |
| src/hooks/useSiteConfig.ts | Site config hook (re-exports context) |
| src/context/cart-context.tsx | Cart state (reducer), shipping calc, per-product rate support |
| src/context/auth-context.tsx | Firebase Auth (login, loginWithGoogle, logout, isAdmin), user doc sync |
| src/context/theme-context.tsx | Dark/light mode toggle |
| src/context/site-config-context.tsx | Site-wide config (colors, shipping, addon price) |
| src/components/layout/client-layout.tsx | Providers: SiteConfig → Theme → Auth → Cart |
| src/components/layout/header-bar.tsx | Fixed nav dock (announcement, offline banner, nav, auth, cart) |
| src/components/layout/json-ld.tsx | Organization/WebSite/FAQPage/Breadcrumb JSON-LD helpers |
| src/components/product/product-card.tsx | Product card (price, image fallback, stock badges) |
| src/components/product/density-picker.tsx | Shared tile-density control (2–5 per row) |
| src/components/customizer/customizer.tsx | Design canvas (drag/resize/rotate, tint overlay, text tool) |
| src/components/customizer/file-upload.tsx | Upload designs to `uploads/{uid}/` |
| src/components/admin/product-manager.tsx | Product CRUD, add-ons editor, color tints, attributes |
| src/components/admin/category-manager.tsx | Category CRUD + reorder |
| src/components/admin/image-manager.tsx | Product image upload + mockup assignment |
| src/components/admin/variant-matrix-editor.tsx | Variant matrix generator |
| functions/src/index.ts | ALL backend functions |
| firebase.json | Hosting + Firestore + Functions + Storage config |
| firestore.rules | Public read, auth write; orders read-by-auth, functions-only write |
| storage.rules | Public read, admin-only write (custom claim OR bootstrap founder list — see Known Issue #31) |
| src/lib/seo.ts | SEO single source of truth: PAGE_SEO registry, metadataFor(), clip(), JSON-LD @graph builders |
| src/app/sitemap.ts / robots.ts | Generated from PAGE_SEO (replaced hand-maintained public/ files) |
| scripts/generate-og.mjs | Dependency-free 1200×630 og:image generator (runs on npm prebuild) |
| src/lib/seo-config.ts | CMS data contract: SeoConfig, KeywordPage, normalizeSeoConfig(), slugifyKeyword(), RESERVED_SLUGS |
| src/lib/seo-content.generated.ts | Committed snapshot of Firestore config/seo (regenerated on every build) |
| scripts/fetch-seo-config.mjs | Build-time fetch of config/seo → the generated snapshot |
| src/app/[keyword]/page.tsx | CMS keyword landing pages (generateStaticParams, one page per published keyword) |
| src/app/services/page.tsx | Hub listing every keyword page so none are orphans |
| src/components/admin/seo-manager.tsx | Admin → SEO: page metadata, keyword manager, Publish button |
| .github/workflows/rebuild.yml | Publish workflow: rebuild + deploy hosting on workflow_dispatch |
| firestore.indexes.json | orders composite index (customerEmail + createdAt) |

---

## 6. FIREBASE FUNCTIONS (18 deployed, us-central1, Node 22 Gen2)

**Square is PAYMENT-ONLY since the catalog architecture overhaul (2026-08). Firestore is the master catalog — all Square sync functions were deleted.**

| Function | Purpose |
|---|---|
| createSquareOrderAndPay | Creates Square order + processes payment; mirrors order + design files to Firestore |
| createSquareProduct | Optional push Firestore product → Square POS (batchUpsert) |
| fetchRecentOrders | Recent Square orders for admin dashboard |
| fetchCustomerOrders | Orders matching a customer email (account page) |
| updateOrderTracking | Set tracking URL/number on an order |
| fetchSiteConfig / saveSiteConfig | Site config CRUD |
| saveAdminEmails | Admin email list management; re-syncs the `admin` custom claim after saving |
| syncAdminClaims | Admin-only backfill: re-sync every user's `admin` claim with config/admin |
| syncMyAdminClaim | Self-service: grants the caller `admin` only if their own email is already an admin |
| savePublishToken | Admin-only: stores the GitHub PAT in the client-unreadable `secrets/githubPublish` |
| publishSite | Admin-only: dispatches the rebuild workflow; returns a clear not-configured message instead of throwing |
| getCustomerAddresses / saveCustomerAddress / deleteCustomerAddress | Address CRUD |
| getCustomerProfile / saveCustomerProfile | Profile CRUD |
| health | Status check |

**DELETED (Phase 1, 2026-08-19):** fetchSquareCatalog, syncProducts, importProducts, runPipeline, scheduledSync, fetchSyncStatus, fetchPipelineStatus, fetchInventoryCounts, clearProducts. Also deleted: functions/src/sync.ts, functions/src/product-pipeline.ts.

---

## 7. CREDENTIALS LOCATION

| Credential | File |
|---|---|
| Square Access Token + Location ID | `animasreflections square API info.txt` on Desktop |
| Gemini API Key | `animas gemini key.txt` in Downloads |
| Firebase Config | Already in .env.local |
| All .env files | .env.local (gitignored), .env.example (committed) |

---

## 8. KNOWN ISSUES — DO NOT REPEAT

1. ~~**Square SDK v42 BigInt issue**~~ — OBSOLETE: Square sync removed (2026-08). Only createSquareOrderAndPay touches Square now; it uses BigInt Math.round for cents.
2. ~~**Square items have NO categoryId**~~ — OBSOLETE: sync removed. Firestore is the master catalog.
3. ~~**ecom_visibility filter**~~ — OBSOLETE: sync removed.
4. **Nav dock stability:** DO NOT use position:fixed on nav-dock directly. Use a SINGLE fixed wrapper div containing both announcement banner and nav-dock. The nav-dock itself should NOT be position:fixed — let the parent wrapper handle positioning.
5. **Mobile nav:** Use CSS Grid `grid-template-columns: repeat(4, 1fr)` for 2-row layout on mobile. Desktop: centered pill with `max-width: fit-content; margin: 0 auto`.
6. **Hero overlap:** Add `pt-12 sm:pt-16` to hero section to push content below fixed header.
7. **Synthetic data:** Currently USE_SYNTHETIC=false. Products load from Firestore (manual admin-built catalog — Square sync de-prioritized).
8. **Images:** Product images uploaded via Admin (not just Square). All fallbacks use PlaceholderImage / initial-letter placeholder.
9. **Cart button:** Only the nav dock cart icon (CartNavButton). No floating button. Removed.
10. **Firestore rejects `undefined`:** The Web SDK throws "Unsupported field value: undefined". ALWAYS wrap writes in `stripUndefined()` (src/lib/firestore-utils.ts) — root cause of product-save + design-upload failures.
11. **ContentEditable description:** Must NOT clobber innerHTML while the user is focused (track `descFocused` ref); sync only when not focused.
12. **`multiply` color tint (customizer only):** The customizer still applies colorTints as a multiply overlay when no per-color photo exists. Works best on light/white base mockups. NOTE: the admin tint PREVIEW overlay was removed (2026-08-21) — admin assigns per-color photos via the "Color Images" section; the product page shows `mockupImagesByColor[color].front` when a color is selected.
13. **Absolute-positioned badges:** Must live inside a `position:relative` container (product card stock badges were rendering off-location until fixed).
14. **Functions deploy flaky timeout:** `firebase deploy` occasionally fails at "User code failed to load... Timeout after 10000" during function analysis. Just retry — it's transient, not a code error.
15. **Browse mode was dead state:** Shop "By Design/Type" toggle set state that was never read. Any new filter state MUST be wired into the filter useMemo (deps included).
16. **Mixed-case cwd breaks Windows builds:** `npm run build` from a lowercase-cased path (`C:\Users\AmosA\projects\...`) fails with `InvariantError: Expected workStore to be initialized` on `/_global-error`. Always work from `C:\Users\AmosA\Projects\animas-reflections-pwa` (capital P).
17. **backup-commit.ps1 unreliable:** `$ErrorActionPreference="Stop"` + `2>&1` makes git's CRLF stderr warning fatal. Use plain `git add/commit/push` until patched. `backup-file.ps1` takes space-separated file args (commas silently skip files).
18. **Color system (revised 2026-08-21):** Admin assigns per-color photos in "Color Images" section (`mockupImagesByColor[color].front` etc.). Product page image priority: `mockupImagesByColor[color].front` → `colorThumbnails[color]` (legacy) → `mockupImages.front` → `images[0]`. The tint overlay preview in admin was REMOVED — no multiply-blend thumbnail tinting. `colorTints` hex still drives the swatch dot + customizer fallback overlay only.
19. **Rich text descriptions:** Short descriptions render sanitized HTML via src/lib/html-utils.ts (sanitizeHTML); cards/search excerpts use stripTags. Never render raw description HTML without sanitizing.
20. **Dark-mode `--color-white` remap:** `html.dark body` remaps `--color-white` to slate-800, so `text-white` renders dark in dark mode. The announcement banner compensates via `.announcement-banner` + `html.dark .announcement-banner { background-color: #D97706 }` — do not swap that class or the dark-mode text fails contrast.
21. **A11y conventions:** `--color-gold-deep` (#B45309) is the AA-passing gold for text on cream — use it for headings/subheadings; keep `text-gold` for icons/accents. Customizer design overlay is focusable (arrow keys reposition, Shift = 5% steps). Cart drawer owns dialog semantics, Escape, and a Tab focus trap — preserve all three.
22. **Firestore is the master catalog (since Phase 1, 2026-08-19):** Square is payment-only. Do NOT reintroduce Square catalog sync. Product CRUD happens in the admin dashboard. `createSquareProduct` is an optional one-way push for POS linkage.
23. **Catalog config lives in Firestore `config/site`:** catalog_options (colors/sizes/productTypes/customOptionNames), addon_defaults (standardAddons with priceType fixed|percentage), customer_fields (checkout form). Admin edits via Settings tab. `src/lib/constants.ts` PRODUCT_SIZES/COLORS/DEFAULT_COLOR_TINTS are FALLBACKS ONLY.
24. **Modifiers (Phase 3):** `ManagedProduct.modifiers: ProductModifier[]` (id, name, priceType, price, inputType toggle|text|file) takes precedence over legacy `productAddons`. Percentage add-ons resolve against base price via `resolveAddonPrice()` in src/types/index.ts — the cart is the single source of truth.
25. **Checkout customer fields are dynamic:** driven by `siteConfig.customer_fields` with `squareMapping` paths into the backend customer object (firstName, email, address.addressLine1, etc.). Fallback `FALLBACK_CUSTOMER_FIELDS` in checkout/page.tsx mirrors the old hardcoded form.
26. **Branch state:** `master` is 17 commits behind `development` (as of 2026-08-21) — merge only when the user explicitly approves (see §11.6).
27. **WebBridge verification:** the checkout page requires a cart item to render customer fields — cart state is in React memory only, lost on navigation. To verify checkout, add a product to cart first in the same tab.
28. **Session-log discipline:** DEVLOG.md is the session record (Sessions 1–21). PROJECT_CONTEXT.md is the recovery blueprint — update both at session end, commit + push, and run `npm run backup:snapshot` before closing a session.
29. **Batch 1 security (2026-08-21):** `requireAdmin()` guards all 5 admin callables (functions/src/index.ts); `createSquareOrderAndPay` re-derives ALL prices/add-ons/shipping from Firestore via `functions/src/pricing.ts` and rejects orders whose client `expectedTotal` diverges >2¢ — client amounts are never charged. Checkout must send `product_id`/`addon_id`/`priceType`/`expectedTotal`. `config/admin` is private-read in firestore.rules; storage.rules restricts product/design writes to admins and uploads reads to owner/admin. `saveAdminEmails` normalizes emails to lowercase. Deploy with `firebase deploy --only functions,firestore,storage` after any changes to these.
30. **Cloud Storage rules CANNOT read Firestore in this project (2026-09-16):** cross-service `firestore.exists()`/`firestore.get()` inside `storage.rules` returns **false for EVERY path** — verified against the live bucket, including public-read docs (`config/site`, `products/{id}`) and an absent control doc. The previous `isAdmin()` (firestore.exists(config/admin) + `.data.emails.hasAny([...])`) therefore evaluated to false for genuine admins and **every admin image upload failed with `storage/unauthorized`** — even though `firestore.rules`' logically-identical check returned 200 for the very same token. **DO NOT put `firestore.*` back into `storage.rules`.** Admin writes are now authorized by the `admin` **custom claim** (`syncAdminClaims` / `syncMyAdminClaim`, re-synced by `saveAdminEmails`) OR the bootstrap founder list in `storage.rules`. Adding an admin via Admin → Admins needs no rules redeploy; only a founder-email change does. `config/admin` remains the source of truth for admins. Client side: `auth-context.tsx` mints the claim on sign-in and calls `getIdToken(true)` once per user per session (ref-guarded so the refresh cannot loop).
31. **SEO artifacts come from ONE registry (2026-09-16):** `src/lib/seo.ts` `PAGE_SEO` drives both per-route `<head>` metadata (`metadataFor(path)`) and the generated `src/app/sitemap.ts` / `robots.ts`. `public/sitemap.xml` and `public/robots.txt` were **deleted** — do not recreate them (they had drifted, and they would conflict with the generated routes). `public/og-image.png` is generated by `scripts/generate-og.mjs` on `npm prebuild` (`npm run og` to regenerate alone). The site emits **one** JSON-LD `@graph` (WebSite + LocalBusiness, `@id`-linked) via `<SiteJsonLd />` in the root layout — do not add a second site-level JSON-LD block. Adding a route means adding its copy to `PAGE_SEO` once; `metadataFor()` throws at build time on an unregistered path.
   **The gate:** `scripts/check-seo.mjs` runs as `postbuild` (and standalone via `npm run check:seo`) against the emitted `out/` — the walk is **recursive**, because Next emits `out/<route>/index.html` and the framework's own non-recursive scan would silently check only the home page. It enforces: title present and ≤60 chars with the brand appearing at most once (catches the `title.template` double-suffix), description ≤155, absolute `og:image`, canonical equal to the page's own URL, noindex pages absent from the sitemap, every sitemap `<loc>` resolving to a real file, `robots.txt` pointing at the sitemap, and every JSON-LD block parsing. Its one documented exception is the `INTENTIONALLY_UNLISTED` set at the top of the script (`/product/`). All four rules were negative-tested against deliberately broken output.
   **`/` lives in the route group `src/app/(home)/`** so it can carry its own metadata — it is a client component and cannot export metadata directly. Do **NOT** add `alternates.canonical` to `src/app/layout.tsx`: the root layout wraps every route, so a canonical there is inherited by any page that declares none (it once pointed `/product/` and every `?id=` product URL at the home page).
32. **Batches 2–4 conventions (2026-08-21):** the catalog loads ONCE per session via `CatalogProvider` (`src/context/catalog-context.tsx`) — `useCatalog` is a context hook now; don't add independent Firestore catalog reads. Shop/search filter state lives in the URL (`?category=&type=&q=&sort=&density=`, `mode=` on shop) — any new filter state must read/write the query string. `sanitizeHTML` = DOMPurify in the browser, regex fallback elsewhere; never bypass it. New orders store `customerEmailLower` — order lookups must match on it (legacy exact-case query is the fallback). Category delete is blocked while subcategories/products remain; category parent selectors must exclude the whole descendant subtree. Admin editors stay MOUNTED across tab switches (hidden via CSS) — never conditionally unmount them. Product deletes must skip Storage files still referenced by another product (`deleteProductStorage`). Deploy order after checkout/function changes: hosting BEFORE functions.
33. **`config/admin` was anonymously readable (found + fixed 2026-09-16):** the rule `match /config/{document=**}` with `allow read: if true` ALSO matched `config/admin`, and Firestore **ORs every matching rule**, so the public wildcard silently overrode the admin-only rule and the admin email list was fetchable with no credentials (verified: unauthenticated GET returned HTTP 200). It is now a single-segment `match /config/{docId}` with `allow read: if docId != 'admin'`. `config/site` and `config/seo` stay public by design (the build fetches `config/seo` unauthenticated). **Do not widen this back to `{document=**}`**, and remember the general trap: a broad `allow read: if true` on a wildcard path overrides a narrower rule on a specific document.
34. **Static export had NO working 404 (found + fixed 2026-09-16):** `firebase.json` had a catch-all `"rewrites": [{ "source": "**", "destination": "/index.html" }]`, so **every unknown URL returned HTTP 200 serving the home page** — soft 404s, and any typo looked like a real page. `out/404.html` was emitted but never served because the rewrite took precedence. The rewrites array is now empty, so Firebase Hosting serves `out/404.html` with a real 404 status. Every route in this app is statically generated and has its own `index.html`, so nothing depended on the rewrite. **Do not re-add a catch-all rewrite.** This also made live verification lie: a keyword page that had not been deployed still answered 200, because the catch-all served the home page — always check the `<title>`, not just the status code.
35. **SEO + keywords are CMS-managed (2026-09-16):** the Firestore doc `config/seo` is the source of truth for per-page metadata overrides and keyword landing pages; it is edited in **Admin → SEO** and read at BUILD time by `scripts/fetch-seo-config.mjs` (runs on `prebuild`), which snapshots it into the committed `src/lib/seo-content.generated.ts`. `src/lib/seo.ts` merges those overrides over the committed `PAGE_SEO` defaults — **a blank field always means "use the default"**, so a cleared box can never publish an empty `<title>`. Published keywords emit one real page each at `/<slug>/` via `generateStaticParams` (see `src/app/[keyword]/page.tsx`), are listed in `sitemap.xml`, and are cross-linked from `/services/` so they are never orphans. **Slugs colliding with a real route are rejected** (`RESERVED_SLUGS` in src/lib/seo-config.ts) because the static route shadows the dynamic one — the page would silently never render while still appearing in the sitemap. **Because this is a static export, editing SEO requires a rebuild:** Admin → SEO → Publish calls the `publishSite` function, which dispatches `.github/workflows/rebuild.yml`; `npm run publish` is the local equivalent. The GitHub PAT lives in the admin-only, client-unreadable doc `secrets/githubPublish` (stored there rather than in Secret Manager because functions v2's `defineSecret()` FAILS THE DEPLOY when the secret does not exist yet).
36. **Never touch non-ASCII content with PowerShell (learned the hard way, 2026-09-16):** writing `config/seo` through `Invoke-RestMethod` (JSON body sent without `charset=utf-8`) silently converted **every em dash (U+2014) and en dash (U+2013) in the CMS keyword copy to an ASCII hyphen**, and the damage reached the deployed site ("hoodie - and end with", "5-10 business days"). `ConvertTo-Json` is NOT the culprit — a character-code round-trip through it preserves both codepoints, so the loss is in the HTTP body encoding. Then the *verification* lied in the same direction: `Get-Content -Raw` reads a UTF-8 file as ANSI, so counting `[char]0x2014` in PowerShell reported **0 even after the file was correct**. **Rule: do every read and write of non-ASCII content with Node (`fetch` + `readFileSync`), and verify by counting character codes in Node.** Never trust a PowerShell character check, and never eyeball rendered text — 'a - b' and 'a — b' look identical in a console that mangles both.
37. **Do not trust a Firestore REST GET made from a browser page (learned the hard way, 2026-09-16):** while verifying the CMS, an in-page `fetch()` to the Firestore REST API returned a **stale, cached** document, producing a convincing but entirely false "the CMS deleted all keyword pages" alarm. SDK reads, Node reads (the build script) and CLI-token reads all showed the data intact. For ground truth, read Firestore with the CLI token from a shell (`Invoke-RestMethod` with `Authorization: Bearer <tokens.access_token>` from `%USERPROFILE%\.config\configstore\firebase-tools.json`), or pass `{cache:'no-store'}` **and** a cache-busting query. The same trap applies to live-site checks: Hosting serves JS as `immutable`, so a reused browser tab can render a stale bundle — cache-bust the URL before concluding a deploy did not land.
38. **A CSV re-import must CONVERGE, never refuse (learned the hard way, 2026-10-07):** `importCatalogCsv` originally excluded names shared by more than one existing product from its name→id index, so it would not pick a keeper arbitrarily. The effect was the opposite of safe: those rows fell through to a fresh slug id and created a **third** copy, taking the catalog from 408 → **600 products with 259 redundant copies**. It now targets the lowest id deterministically and **reports** the collision (`Find duplicate products` is the tool to collapse them). General rule: when an import cannot decide, choose defensively and say so — never skip and let the row mint a new record.
39. **`DocumentSnapshot.exists` is a METHOD, not a property (found 2026-10-07):** the recovered importer wrote `const existing = (await getDoc(ref)).exists`, which captures the function itself — always truthy — so `created` could never increment and a first-ever import reported "0 created · N updated". TypeScript only caught it once the value was used in a condition. Write `.exists()`. The same file also used `crypto.randomUUID()` for the product id, which made every re-import a duplicate.
40. **Header normalisation must strip ALL non-alphanumerics (found 2026-10-07):** the importer lowercased and removed spaces/underscores/hyphens only, so Square's `Weight (lb)` normalised to `weight(lb)` and matched nothing — the weight column was silently ignored. Strip every non `[a-z0-9]` character. Where a column name is site-specific (`Current Quantity Animas Reflections LLC`), match by **prefix** rather than an exact alias.
41. **Square's SDK returns `BigInt`, and it will not cross a callable boundary (2026-10-07):** `Money.amount` **and** `CatalogModifierList.min/maxSelectedModifiers` are `bigint`. Serialising one in a Cloud Function response throws; convert with `Number()` first. Known Issue #1's BigInt note applies to far more fields than money.
42. **Square lets two modifier lists share a name, and the item export only disambiguates with an id (2026-10-07):** the `Modifier Set - <name> - <ID>` column suffix is authoritative. 12 set names in this catalog are shared by 2–8 lists, and **163 of the 183** products that use add-ons touch a colliding name. Match by the recorded id first; accept a name only when exactly **one** list carries it, and otherwise report the set as ambiguous rather than attaching a plausible-but-wrong one.
43. **An imported product that already exists gets a PATCH, not a replacement (2026-10-07):** `patchForExisting()` never resets `createdAt` and never writes a blank value, so importing a sheet that omits descriptions or images cannot wipe curation done in the admin. Consequence to remember: a matched product's `variants` **are** replaced wholesale, so hand-set inventory on those variants is overwritten — the import report says so when it happens.
44. **A dry run only counts if it goes through the REAL write path (learned the hard way, 2026-10-07):** the ambiguity bug in #38 was missed because the verification exercised the pure `csvToProducts` with a hand-built map and never ran the branch living in `importCatalogCsv` — it reported "366 of 366 would update" while the real run was creating copies. Verify against the same function the button calls, not a convenient subset of it.
45. **A control that writes to Firestore but is read by nothing is a DEAD CONTROL, and it looks identical to a working one (2026-08-10-08):** the Settings tab exposed brand colours, fonts, announcement text and hero/about/footer copy; all of it was write-only, because the storefront reads copy through `useSiteContent()` and colours through `mergeTheme`. Worse, the live `config/site` sets every `theme.light` token, so the flat colour fields were shadowed even in the merge path. Before shipping an editor, grep for the CONSUMER of the field, not just its writer. (Same class as `fundraising_heading`, and as `metaTitle`/`metaDescription`/`ogImage`, which were one page's metadata applied site-wide.)
46. **Two mechanisms writing the same CSS custom properties means the more specific one silently wins (2026-08-10-08):** `themeToCss` emits `html.dark {}` (0,1,0) while `globals.css` had an `html.dark body {}` block (0,1,1) — so dark-mode edits in the theme editor were overridden by the stylesheet for every token the block declared. Do not keep a "defaults" copy of a token in CSS AND in the data-driven path: the CSS block was deleted and its values moved into `DARK_THEME`.
47. **Firebase-as-truth needs a floor for anything accessibility-critical (2026-08-10-08):** the live document shipped `theme.dark.goldDeep = #B45309`, which is 3.5:1 on the dark navy; the stylesheet it replaced had used 6.8:1. Making the document authoritative without a guard would have published the regression. `enforceContrast()` now measures the guarded pairs on every render of the theme CSS and falls back to the shipped value, reporting the substitution in the editor. An admin's colour is respected exactly when it is readable.
48. **A page can need BOTH baked metadata and runtime-editable copy, and that forces a server/client split (2026-08-10-08):** `export const metadata` requires a server component; `useSiteContent()` requires a client one. The route's `page.tsx` keeps `metadataFor(path)` and renders a `*-view.tsx` client child that holds the copy. Verified the split still server-renders the copy into the static HTML (16 `<details>` on /faq, sections on /terms) — otherwise the split would have traded SEO for editability.
49. **A mid-tone accent needs a text variant AND a label variant; the bare token fails both ways (2026-10-12):** `text-plum` on a `bg-plum/20` tint measured **4.19:1 light / 3.5:1 dark**, and `bg-plum text-white` measured **2.86:1 in dark** — because `--color-white` REMAPS to a dark slate there, which is exactly how the 37 `bg-gold text-white` buttons were broken before `--color-on-gold` existed. The gold family is now the template: `gold`/`goldLight`/`goldDeep` for surfaces and borders, `goldInk` for text on a gold tint, `onGold` for a label on a gold face — and plum mirrors it with `plumInk`/`onPlum`. Do not reach for a bare accent token for either job, and do not use `text-white` on a coloured face at all.
50. **A mid-tone surface cannot carry accent text, and no label colour fixes it (2026-10-12):** the live `config/site.theme.dark.warmSand` is `#4f6c9d`, a mid blue. On it, `goldDeep` reaches **2.02:1** and `goldInk` **2.99:1** — while `foreground` gets 4.84:1. Any surface in that lightness band is unusable behind the accent golds. The contrast floor cannot repair this by swapping the text (both the shipped and the admin's golds fail), so the surface itself has to move; the shipped `#1E293B` gives `goldDeep` 5.57:1 and `foreground` 13.35:1. Left as a client decision rather than changed unilaterally — it is a visible brand surface.
51. **Verify contrast on rendered pixels, not on `getComputedStyle` (2026-10-12):** a scripted audit that toggled `html.dark` and read computed styles reported ~20 failures on /shop/ and the nav dock, every one of them contradicted by a screenshot at native resolution showing readable text — `getComputedStyle(el).color` returned the LIGHT value for elements whose parent reported the dark one, while the paint was correct. Changing the theme class outside the React provider is the likely trigger. Trust (a) a screenshot, and (b) arithmetic over the palette tokens; treat any computed-style reading taken after a scripted theme change as suspect.
52. **Node v24.15.0 on this machine crashes V8 when compiling large modules (2026-10-13) — `npm run build` cannot complete until Node is changed:** `require("typescript")` alone dies with `Fatal error ... unreachable code` (the stack shows `v8::ScriptCompiler::CompileFunction`). It hits tsc, eslint, jest and next build, and it began part-way through a session on a machine where the same commands had just succeeded, so it is NOT caused by the repo. What works: `node --no-opt <script>` and `node --jitless <script>`. What does not: `--no-opt` in `NODE_OPTIONS` (Next converts its workers' execArgv into NODE_OPTIONS and rejects it: `ERR_WORKER_INVALID_EXEC_ARGV`), and `--jitless` (no WebAssembly, so Turbopack dies). Practical consequences: verify with `node --no-opt node_modules/typescript/lib/tsc.js --noEmit`, `node --no-opt node_modules/eslint/bin/eslint.js` and `node --no-opt node_modules/jest/bin/jest.js`, and treat a green build as unavailable here until Node 22 LTS (what CI uses) or a patched 24.x is installed. Do not "fix" it by committing flags into the build scripts.

---

## 9. DESIGN SYSTEM — DO NOT BREAK

**Brand Colors (from roadmap):**
- Cream: #FAF6F0, Warm Sand: #F5EBE6
- Teal: #1E4D4F (primary text), Teal Light: #2A6B6E
- Gold: #D97706 (CTAs/buttons), Gold Light: #E68A00
- Plum: #935B8A (highlights/badges)

**Dark Mode:** html.dark body — switches to midnight slate (#0F172A)

**S.I.T.E.S Protocol (from Nown.digital):**
- Tactile buttons (.btn-tactile): solid depth with bottom-border simulating height
- Glassmorphism cards (.glass-card): backdrop-blur, translucent white
- Self-aware tile grid (.tile-grid-sites): auto-fit, minmax(280px, 1fr)
- Floating dock nav (.nav-dock): pill-shaped, glassmorphism

---

## 10. MASTER ROADMAP REFERENCE

Location: `animas_reflections_scope_roadmap.md` in Downloads

- Phase 1: Workspace & Init (DONE)
- Phase 2: Square API Gateway (DONE)
- Phase 3: Customizer Component (DONE — drag/resize/rotate, colors, designs, add-ons)
- Phase 4: Order Assembly & Checkout (DONE — needs live checkout test, G2)
- Phase 5: Admin CMS Dashboard (DONE — products/categories/designs/images/settings/orders/users/admins)
- Phase 6: PWA Optimization & Launch (PARTIAL — manifest, service worker, JSON-LD done; needs Lighthouse, DNS cutover, analytics, cross-browser)

### Catalog Architecture Overhaul (2026-08, complete)

Full plan: `docs/PRODUCT_MODIFIER_AUDIT.md`. Session log: `docs/DEVLOG.md` Sessions 16–21.

- **Phase 1 — Square removed as catalog master** (Square = payment only; Firestore = master; 9 sync functions deleted; rules hardened to isAdmin writes)
- **Phase 2 — Config-driven catalog** (colors/sizes/productTypes/add-ons/customer-fields editable in admin Settings, stored in `config/site`)
- **Phase 3 — Dynamic product options + modifiers** (`ProductOption`/`ProductModifier` types; N-dimension variant matrix; text/file modifier inputs; captures `selectedOptions` + `modifierInputs`)
- **Phase 4 — Percentage add-on pricing** (`resolveAddonPrice` helper; cart resolves percentage against base price; end-to-end through checkout)
- **Phase 5 — Dynamic customer fields** (checkout renders from `customer_fields`; squareMapping paths build the backend payload)
- **Phase 6 — Admin polish** (print zone editor; visual per-color photo picker; category hierarchy with `parentId`)
- **Color-image rework (2026-08-21)** — product page shows `mockupImagesByColor[color].front` when a color is selected; admin tint overlay preview removed
- **Data-linkage audit (2026-08-21)** — seoTitle/seoDescription/weightOz wired to admin UI; baseProductId removed; variant customFields key/value editor fixed; description stripping unified on stripTags; dead Square fallback removed from useCatalog
- **Security batch 1 (2026-08-21)** — server-side price/add-on/shipping derivation in createSquareOrderAndPay (client totals verified, never trusted); requireAdmin on all admin callables; config/admin + storage rules hardened; add-ons now actually charged and mirrored with real subtotal
- **Batches 2–4 (2026-08-21)** — URL-synced shop/search filters; CatalogProvider single-read; DOMPurify sanitization; order email normalization; admin data-safety fixes (keep-mounted editors, category cycle/orphan guards, variant matrix 3+ dims, safe duplicate deletes); bounded admin Orders read

**Open questions for Cindy:** "Biscuit Hockey" — brand or category? (blocks brand/taxonomy work)

---

## 11. NEXT INSTANCE — START HERE

1. Read `docs/DEVLOG.md` for last session state + pending items (latest: Session 23, 2026-08-21)
2. Read this file §10 "Catalog Architecture Overhaul" for the architecture summary
3. Check `USE_SYNTHETIC` flag in `src/hooks/useCatalog.ts` (false = real Firestore)
4. Run `npm run dev` to test locally
5. Run `npm run build && firebase deploy` to deploy (retry once if the functions-analysis step times out)
6. **Branching:** work on `development`; merge to `master` only when verified + user-approved (master is 17 commits behind as of 2026-08-21)
7. Every deploy MUST pass: lint (0 errors), build (22 routes), tests (109/109), visual check
8. Do NOT modify nav-dock position — it's inside a fixed wrapper
9. Do NOT add bottom navigation bars — only top dock
10. Use backup framework: `backup:file` before edits, `backup:snapshot` at session end (backup-commit.ps1 is unreliable — use plain git)
11. Write Firestore data through `stripUndefined()` (see Known Issues #10)
12. Firestore is the master catalog — do NOT reintroduce Square sync (Known Issues #22)
13. Admin catalog config lives in `config/site` Firestore doc (Known Issues #23)

---

## 12. SYNTHETIC DATA TOGGLE

```typescript
// src/hooks/useCatalog.ts
const USE_SYNTHETIC = false; // false = real Firestore data (current production setting)
```

Synthetic data is for UI development only. Production always reads Firestore — there is no Square fallback anymore (removed with Square sync, 2026-08).

---

## 13. FIREBASE CONSOLE LINKS

- Project: https://console.firebase.google.com/project/animas-reflections-pwa
- Hosting: https://animas-reflections-pwa.web.app
- Authentication: Enable Email/Password + Google providers

---

## 14. CONTENT & THEME EDITOR (reconciled into `development` 2026-10-08)

- **Phase 1 (done):** editable **light + dark** theme + fonts, data-driven via
  `config/site.theme` — see `docs/THEME_EDITOR.md`. Dark tokens used to be hardcoded in the
  `html.dark body` block of `globals.css`; they now live in `DARK_THEME` so the editor can
  actually change them. That block held the accessibility values (`goldDeep`/`goldInk`
  #E68A00, `danger` #f87171, `onGold` deliberately unchanged), which moved into `DARK_THEME`
  with it.
- **Phase 2 (done):** page-by-page **copy editor** (`config/site.content` overrides over
  `src/lib/content.ts`), wired to home, about, contact, custom, biscuit-hockey, im-ok-r-u,
  faq, terms, privacy, fundraising, `navigation.footer` and the announcement bar.
- **Phase 2b (done):** **structured list content** — FAQ items (q/a), Terms/Privacy
  sections (title/body), fundraising How-it-works steps editable via repeatable rows.
- **Phase 3 (done):** per-field Reset and the "?" help button (→ Help tab).
- **Contrast floor (new):** `enforceContrast()` in `src/lib/site-defaults.ts` measures the
  guarded pairs on every `themeToCss()` and substitutes the shipped default when a saved
  colour fails WCAG AA, reporting what moved in the editor. It exists because the live
  document really does carry `theme.dark.goldDeep = #B45309` — 3.5:1, where the default is
  6.8:1. Keep its pair list in step with `_webbridge/contrast.py`.
- **Removed as dead controls:** the Settings tab's brand colours, fonts, announcement text
  and hero/about/footer copy inputs. They wrote `config/site` fields the storefront no
  longer reads (the live document sets every `theme.light` token, so even the colours were
  shadowed), and `metaTitle`/`metaDescription`/`ogImage` in the copy editor are gone too —
  per-page SEO lives in the SEO tab.
- **Known limitations:** the top nav dock uses fixed links/icons; footer
  `RETURN_POLICY`/`PAYMENT_METHODS` and the `/services/` hero copy are still static.

---
END OF CONTEXT FILE
