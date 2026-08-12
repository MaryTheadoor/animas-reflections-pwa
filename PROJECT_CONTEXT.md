# Animas Reflections PWA — Project Context & Recovery Blueprint
## Session: June 5, 2026 | Build Instance Context File

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

## 4. ALL ROUTES (19 total)

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

## 6. FIREBASE FUNCTIONS (23 deployed, us-central1, Node 22 Gen2)

| Function | Purpose |
|---|---|
| fetchSquareCatalog | Fetches Square catalog (ecom_visibility=VISIBLE), returns categoryIds arrays |
| createSquareOrderAndPay | Creates Square order + processes payment; mirrors order + design files to Firestore |
| createSquareProduct | Push Firestore product → Square (batchUpsert) |
| fetchRecentOrders | Recent Square orders for admin dashboard |
| fetchCustomerOrders | Orders matching a customer email (account page) |
| updateOrderTracking | Set tracking URL/number on an order |
| fetchInventoryCounts | Batch inventory sync |
| fetchSiteConfig / saveSiteConfig | Site config CRUD |
| saveAdminEmails | Admin email list management |
| fetchSyncStatus | Sync status doc read |
| syncProducts / importProducts / runPipeline / fetchPipelineStatus | Square→Firestore sync + pipeline |
| clearProducts | Batch delete products/categories/designs |
| scheduledSync | Daily 4 AM auto-sync (PubSub) |
| getCustomerAddresses / saveCustomerAddress / deleteCustomerAddress | Address CRUD |
| getCustomerProfile / saveCustomerProfile | Profile CRUD |
| health | Status check |

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

1. **Square SDK v42 BigInt issue:** priceMoney.amount is BigInt, must convert with Number() before arithmetic. Fixed in fetchSquareCatalog.
2. **Square items have NO categoryId:** Categories are in itemData.categories[] array. Fixed — returns categoryIds[] per item.
3. **ecom_visibility filter:** Only "VISIBLE" items shown. 405 website products vs 74 POS-only filtered.
4. **Nav dock stability:** DO NOT use position:fixed on nav-dock directly. Use a SINGLE fixed wrapper div containing both announcement banner and nav-dock. The nav-dock itself should NOT be position:fixed — let the parent wrapper handle positioning.
5. **Mobile nav:** Use CSS Grid `grid-template-columns: repeat(4, 1fr)` for 2-row layout on mobile. Desktop: centered pill with `max-width: fit-content; margin: 0 auto`.
6. **Hero overlap:** Add `pt-12 sm:pt-16` to hero section to push content below fixed header.
7. **Synthetic data:** Currently USE_SYNTHETIC=false. Products load from Firestore (manual admin-built catalog — Square sync de-prioritized).
8. **Images:** Product images uploaded via Admin (not just Square). All fallbacks use PlaceholderImage / initial-letter placeholder.
9. **Cart button:** Only the nav dock cart icon (CartNavButton). No floating button. Removed.
10. **Firestore rejects `undefined`:** The Web SDK throws "Unsupported field value: undefined". ALWAYS wrap writes in `stripUndefined()` (src/lib/firestore-utils.ts) — root cause of product-save + design-upload failures.
11. **ContentEditable description:** Must NOT clobber innerHTML while the user is focused (track `descFocused` ref); sync only when not focused.
12. **`multiply` color tint:** Works best on light/white or transparent-PNG base mockups. A black mockup won't lighten. Real per-color photos in `mockupImagesByColor` bypass the tint.
13. **Absolute-positioned badges:** Must live inside a `position:relative` container (product card stock badges were rendering off-location until fixed).
14. **Functions deploy flaky timeout:** `firebase deploy` occasionally fails at "User code failed to load... Timeout after 10000" during function analysis. Just retry — it's transient, not a code error.
15. **Browse mode was dead state:** Shop "By Design/Type" toggle set state that was never read. Any new filter state MUST be wired into the filter useMemo (deps included).
16. **Mixed-case cwd breaks Windows builds:** `npm run build` from a lowercase-cased path (`C:\Users\AmosA\projects\...`) fails with `InvariantError: Expected workStore to be initialized` on `/_global-error`. Always work from `C:\Users\AmosA\Projects\animas-reflections-pwa` (capital P).
17. **backup-commit.ps1 unreliable:** `$ErrorActionPreference="Stop"` + `2>&1` makes git's CRLF stderr warning fatal. Use plain `git add/commit/push` until patched. `backup-file.ps1` takes space-separated file args (commas silently skip files).
18. **Color system:** `DEFAULT_COLOR_TINTS` in src/lib/constants.ts maps standard color names to hex. Colors with no tint and no per-color photo show a neutral `#cccccc` swatch (expected, not a bug). Tints only persist to Firestore on product save — pre-existing products lack stored tints until re-saved. `mockupImagesByColor` photos take precedence over tint overlays.
19. **Rich text descriptions:** Short descriptions render sanitized HTML via src/lib/html-utils.ts (sanitizeHTML); cards/search excerpts use stripTags. Never render raw description HTML without sanitizing.

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

---

## 11. NEXT INSTANCE — START HERE

1. Read `docs/DEVLOG.md` for last session state + pending items
2. Read `docs/GAP_ANALYSIS.md` for current gaps (refreshed 2026-08-06)
3. Check `USE_SYNTHETIC` flag in `src/hooks/useCatalog.ts`
4. Run `npm run dev` to test locally
5. Run `npm run build && firebase deploy` to deploy (retry once if the functions-analysis step times out)
6. **Branching:** work on `development`; merge to `master` only when verified; see docs/DEVELOPMENT.md "Branching & Rollback"
7. Every deploy MUST pass: lint (0 errors), build (19 routes), tests (85/85), visual check
8. Do NOT modify nav-dock position — it's inside a fixed wrapper
9. Do NOT add bottom navigation bars — only top dock
10. Use backup framework: `backup:file` before edits, `backup:commit` after
11. Write Firestore data through `stripUndefined()` (see Known Issues #10)

---

## 12. SYNTHETIC DATA TOGGLE

```typescript
// src/hooks/useCatalog.ts
const USE_SYNTHETIC = false; // false = real Firestore data (current production setting)
```

When restoring Square: set to false, deploy both functions and hosting.

---

## 13. FIREBASE CONSOLE LINKS

- Project: https://console.firebase.google.com/project/animas-reflections-pwa
- Hosting: https://animas-reflections-pwa.web.app
- Authentication: Enable Email/Password + Google providers

---
END OF CONTEXT FILE
