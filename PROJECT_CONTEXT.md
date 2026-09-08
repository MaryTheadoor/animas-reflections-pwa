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
| storage.rules | Public read, authenticated upload |
| firestore.indexes.json | orders composite index (customerEmail + createdAt) |

---

## 6. FIREBASE FUNCTIONS (14 deployed, us-central1, Node 22 Gen2)

**Square is PAYMENT-ONLY since the catalog architecture overhaul (2026-08). Firestore is the master catalog — all Square sync functions were deleted.**

| Function | Purpose |
|---|---|
| createSquareOrderAndPay | Creates Square order + processes payment; mirrors order + design files to Firestore |
| createSquareProduct | Optional push Firestore product → Square POS (batchUpsert) |
| fetchRecentOrders | Recent Square orders for admin dashboard |
| fetchCustomerOrders | Orders matching a customer email (account page) |
| updateOrderTracking | Set tracking URL/number on an order |
| fetchSiteConfig / saveSiteConfig | Site config CRUD |
| saveAdminEmails | Admin email list management |
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
30. **Batches 2–4 conventions (2026-08-21):** the catalog loads ONCE per session via `CatalogProvider` (`src/context/catalog-context.tsx`) — `useCatalog` is a context hook now; don't add independent Firestore catalog reads. Shop/search filter state lives in the URL (`?category=&type=&q=&sort=&density=`, `mode=` on shop) — any new filter state must read/write the query string. `sanitizeHTML` = DOMPurify in the browser, regex fallback elsewhere; never bypass it. New orders store `customerEmailLower` — order lookups must match on it (legacy exact-case query is the fallback). Category delete is blocked while subcategories/products remain; category parent selectors must exclude the whole descendant subtree. Admin editors stay MOUNTED across tab switches (hidden via CSS) — never conditionally unmount them. Product deletes must skip Storage files still referenced by another product (`deleteProductStorage`). Deploy order after checkout/function changes: hosting BEFORE functions.

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

## 14. CONTENT & THEME EDITOR (in progress)

- **Phase 1 (done):** editable **light + dark** theme + fonts. Data-driven via
  `config/site.theme` (see `docs/THEME_EDITOR.md`). Editor in Admin → **Content & Theme** tab.
- **Phase 2 (done):** page-by-page **copy editor** (`config/site.content` overrides over
  `src/lib/content.ts`), with per-page wireframe diagrams. Wired to /about, /contact,
  /custom, /biscuit-hockey, /im-ok-r-u, home hero+about, announcement.
- **Phase 2b (done):** **structured list content** — FAQ items (q/a), Terms/Privacy
  sections (title/body) editable via repeatable rows; wired /faq, /terms, /privacy.
  Remaining structured: nav/footer links (dock uses fixed links) + fundraising steps.
- **Phase 3 (next):** per-field reset, help links, SEO/OG text.

---
END OF CONTEXT FILE
