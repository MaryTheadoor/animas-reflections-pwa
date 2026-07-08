# Animas Reflections PWA — Full Current Project Status Report
**Date:** 2026-06-30  
**Prepared by:** Automated project analysis

---

## 1. EXECUTIVE SUMMARY

Custom headless e-commerce PWA for Animas Reflections (Durango, CO) — replacing a Square Online template with a Next.js + Firebase + Square stack.

**Live URL:** https://animas-reflections-pwa.web.app  
**GitHub:** https://github.com/MaryTheadoor/animas-reflections-pwa  
**Firebase Project:** `animas-reflections-pwa` (ID: 508402195460)  
**Client:** Cindy (Owner-Operator) — custom screen printing, embroidery, sublimation  
**Sub-brands:** Biscuit Hockey (hockey apparel), I'M OK R U (mental health positivity)

---

## 2. CLI INTEGRATION STATUS

### Firebase CLI — ✅ INTEGRATED
| Check | Status |
|-------|--------|
| Version | **v15.16.0** |
| Logged In | ✅ Yes |
| Active Project | `animas-reflections-pwa` (default) |
| Deploy Capability | ✅ Hosting, Functions, Firestore Rules, Storage Rules |
| Emulators | Configured (Auth:9099, Functions:5001, Firestore:8080, Hosting:5000) |
| Other Projects Accessible | 18 Firebase projects linked to this account |

### GitHub CLI — ✅ INTEGRATED
| Check | Status |
|-------|--------|
| Version | **gh 2.72.0** (2025-04-30) |
| Logged In | ✅ `MaryTheadoor` (keyring) |
| Protocol | HTTPS |
| Token Scopes | `gist`, `read:org`, `repo` |
| Remote Origin | `https://github.com/MaryTheadoor/animas-reflections-pwa.git` |

---

## 3. GIT REPOSITORY STATUS

| Check | Status |
|-------|--------|
| Branch | `master` (single branch, no others) |
| Remote | `origin` → `MaryTheadoor/animas-reflections-pwa` |
| Upstream | ✅ Up to date |
| Working Tree | Clean (no uncommitted changes) |
| Last Commit | `e27c306` — *"chore: remove all Genkit/AI integration, fix Square env to production"* |
| Total Commits | 8 (Sessions 1–5, June 16 2026) |
| .gitignore | Properly configured (node_modules, .next, out, functions/lib, .env*, _backups, .firebase caches) |

### Recent Commit History
| Hash | Message |
|------|---------|
| `e27c306` | chore: remove all Genkit/AI integration, fix Square env to production |
| `ac62eb8` | fix: empty variant guards, .env.local config, test type updates |
| `a4de783` | feat: font picker, color picker, shipping auto-detect, admin order tracking |
| `ad978f3` | chore: add .firebase cache files to gitignore |
| `2c9e8ab` | docs: devlog Session 5 — functions deployed, admin sync feedback enhanced |

---

## 4. REPOSITORY STRUCTURE (Indexed)

### Root Level (20 files + 10 dirs)
```
📄 .env.example          — Environment variable template (Firebase + Square config)
📄 .env.local            — Actual env vars (gitignored, present locally)
📄 .firebaserc           — Firebase project alias (default: animas-reflections-pwa)
📄 .gitignore
📄 AGENTS.md             — AI agent instructions
📄 CLAUDE.md             — Claude-specific context
📄 PROJECT_CONTEXT.md    — Full recovery blueprint (201 lines, 13 sections)
📄 README.md             — Project overview + quick start
📄 eslint.config.mjs     — ESLint flat config (Next.js preset)
📄 firebase.json         — Hosting + Functions + Firestore + Storage + Emulators config
📄 firestore.indexes.json— Empty (no custom indexes yet)
📄 firestore.rules       — Public read, auth write, Functions-only for orders
📄 jest.config.ts        — ts-jest preset, 4 test suites
📄 next-env.d.ts         — Next.js type declarations (auto-generated)
📄 next.config.ts        — output: "export", trailingSlash, images unoptimized
📄 package.json          — Next.js 16.2.7, React 19.2.4, Firebase 12.14.0, Tailwind v4
📄 package-lock.json
📄 postcss.config.mjs    — Tailwind v4 PostCSS config
📄 storage.rules         — Public read, authenticated upload
📄 tsconfig.json         — Excludes functions/ dir to avoid type conflicts
```

### `src/` — Frontend Source (Heart of the Application)

#### `src/app/` — Next.js App Router Pages (18 routes)
| File | Route | Status |
|------|-------|--------|
| `layout.tsx` | Root | Built — Metadata, Viewport, JSON-LD, Vesper Libre font |
| `page.tsx` | `/` Home | Built — Hero, featured products, fundraising, about |
| `not-found.tsx` | `/_not-found` 404 | Built |
| `globals.css` | — | Built — Brand theme, dark mode, S.I.T.E.S protocol (1500+ lines) |
| `about/page.tsx` | `/about` | Built |
| `account/page.tsx` | `/account` | Built (auth-gated, orders/addresses/settings tabs) |
| `admin/page.tsx` | `/admin` | Built (CMS dashboard, RequiresAdmin) |
| `admin/login/page.tsx` | `/admin/login` | Built |
| `biscuit-hockey/page.tsx` | `/biscuit-hockey` | Built |
| `checkout/page.tsx` | `/checkout` | Built (Square Web Payments SDK integration) |
| `contact/page.tsx` | `/contact` | Built |
| `custom/page.tsx` | `/custom` | Built |
| `customizer/page.tsx` | `/customizer` | Built (Pseudo-3D canvas with view tabs) |
| `faq/page.tsx` | `/faq` | Built |
| `fundraising/page.tsx` | `/fundraising` | Built |
| `im-ok-r-u/page.tsx` | `/im-ok-r-u` | Built |
| `order-confirmation/page.tsx` | `/order-confirmation` | Built |
| `product/page.tsx` | `/product` | Built (detail with variant picker, uses `?id=`) |
| `search/page.tsx` | `/search` | Built (fuzzyScore search) |
| `shop/page.tsx` | `/shop` | Built (catalog with filters/sort) |
| `terms/page.tsx` | `/terms` | Built |

#### `src/components/` — 17 Component Files
| Component | File | Purpose |
|-----------|------|---------|
| **Admin** | | |
| | `admin/product-manager.tsx` | Product CRUD, sync, push to Square (781 lines) |
| | `admin/category-manager.tsx` | Category CRUD with reorder (229 lines) |
| | `admin/image-manager.tsx` | Gallery upload, mockup assignment (378 lines) |
| | `admin/variant-matrix-editor.tsx` | Bulk variant creation matrix |
| **Cart** | | |
| | `cart/cart-drawer.tsx` | Slide-in cart panel with items/subtotal/shipping |
| | `cart/cart-nav-button.tsx` | Cart icon badge in nav dock |
| **Customizer** | | |
| | `customizer/customizer.tsx` | Canvas with drag/resize/rotate, pointer events, touch support |
| | `customizer/file-upload.tsx` | Design file upload to Firebase Storage |
| **Home** | | |
| | `home/featured-products.tsx` | Featured products grid |
| | `home/band-merch-teaser.tsx` | Band merch section |
| | `home/fundraising-teaser.tsx` | Fundraising program teaser |
| | `home/faq-teaser.tsx` | FAQ section teaser |
| **Layout** | | |
| | `layout/client-layout.tsx` | Provider wrapper (Auth, Cart, Theme, SiteConfig) |
| | `layout/header-bar.tsx` | Fixed nav dock (glassmorphism, pill-shaped) |
| | `layout/nav-auth.tsx` | Login/Admin button in nav |
| | `layout/json-ld.tsx` | JSON-LD structured data components |
| | `layout/page-layout.tsx` | Shared page wrapper |
| **Product** | | |
| | `product/product-card.tsx` | Product card component |
| | `product/product-detail.tsx` | Modal detail (legacy, replaced by /product page) |
| **Search** | | |
| | `search/search-bar.tsx` | Search bar component |
| **UI** | | |
| | `ui/placeholder-image.tsx` | SVG placeholder fallback |
| | `ui/debug-panel.tsx` | Debug panel for development |

#### `src/context/` — 4 Context Providers
| File | Purpose |
|------|---------|
| `auth-context.tsx` | Firebase Auth (login, loginWithGoogle, logout, isAdmin) |
| `cart-context.tsx` | Cart state reducer (+ drawer open) |
| `theme-context.tsx` | Dark/light mode toggle |
| `site-config-context.tsx` | Site config (colors, banner, shipping rates) |

#### `src/hooks/` — 3 Custom Hooks
| File | Purpose |
|------|---------|
| `useCatalog.ts` | Returns ManagedProduct[] from Firestore (or Square API fallback) |
| `useSearch.ts` | Programmatic fuzzyScore text search |
| `useSiteConfig.ts` | Site config read from Firestore |

#### `src/lib/` — 4 Library Modules
| File | Purpose |
|------|---------|
| `firebase.ts` | Firebase client init (db, storage, auth, functions) |
| `constants.ts` | SHIPPING tiers, ADDON_PRICE, SQUARE config |
| `content.ts` | Centralized site copy (hero, about, FAQ, policies) |
| `synthetic-data.ts` | 24 test products + 21 categories for dev |

#### `src/types/` — Type Definitions
| File | Purpose |
|------|---------|
| `index.ts` | 26+ TypeScript interfaces (ManagedProduct, CartItem, SiteConfig, PrintZone, etc.) |

#### `src/__tests__/` — 4 Test Suites (48 tests)
| File | Tests | Status |
|------|-------|--------|
| `hooks/__tests__/catalog.test.ts` | Catalog hook | ✅ Passing |
| `context/__tests__/cart.test.ts` | Cart context | ✅ Passing |
| `app/customizer/__tests__/views.test.ts` | Customizer views | ✅ Passing |
| `lib/__tests__/search.test.ts` | Search fuzzyScore | ✅ Passing |

### `functions/` — Backend (3 source modules, ~2,166 LOC)
| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 1,061 | 18 Cloud Functions (catalog, orders, sync, search, config, admin, scheduling) |
| `src/sync.ts` | 745 | Square → Firestore sync: brand detection, type classification, ManagedProduct builder |
| `src/product-pipeline.ts` | 361 | Product classification pipeline (135+ garment patterns, known designs) |
| `tsconfig.json` | — | TypeScript config for Node 22 ESM |
| `package.json` | — | firebase-admin 13, firebase-functions 6, square 42 |

### Deployed Cloud Functions (18 total)
| Function | Type | Purpose |
|----------|------|---------|
| `fetchSquareCatalog` | Callable | Fetch items + categories from Square (ecom_visibility=VISIBLE) |
| `syncProducts` | Callable/HTTPS | Square → Firestore sync (timeout: 300s) |
| `importProducts` | Callable | Alt sync by category (timeout: 600s) |
| `createSquareProduct` | Callable | Push Firestore product → Square catalog |
| `createSquareOrderAndPay` | Callable | Build Square order + process payment |
| `fetchRecentOrders` | Callable | Last 50 Square orders |
| `fetchCustomerOrders` | Callable | Orders for authenticated user |
| `fetchInventoryCounts` | Callable | Square inventory per variant (timeout: 300s) |
| `fetchSyncStatus` | Callable | Last sync status |
| `fetchPipelineStatus` | Callable | Pipeline processing status |
| `runPipeline` | Callable | Run product classification pipeline (timeout: 600s) |
| `clearProducts` | Callable | Wipe all Firestore products/categories |
| `scheduledSync` | PubSub | Daily auto-sync (4:00 AM) |
| `health` | HTTPS | Status check endpoint |
| `fetchSiteConfig` / `saveSiteConfig` | Callable | Site config CRUD |
| `saveAdminEmails` | Callable | Admin email management |
| `getCustomerAddresses` / `saveCustomerAddress` / `deleteCustomerAddress` | Callable | Address CRUD |
| `getCustomerProfile` / `saveCustomerProfile` | Callable | Profile CRUD |
| `updateOrderTracking` | Callable | Update carrier tracking URL |

### `docs/` — Documentation (5 files)
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System diagrams, data flows, component tree |
| `DEVELOPMENT.md` | Commands, conventions, troubleshooting |
| `DEVLOG.md` | Chronological dev log (Sessions 1–5) with full state tracking |
| `SCOPE.md` | Master scope document v1.0 (618 lines, 12 sections) |
| `SCHEMA.md` | Firestore collections, types, storage structure |
| `PROJECT_STATUS_REPORT.md` | **This file** |

### `scripts/` — Backup Framework (4 PowerShell scripts)
| File | Purpose |
|------|---------|
| `backup-file.ps1` | Pre-edit file snapshot to `_backups/` + redundant disk |
| `backup-commit.ps1` | Git add → commit → push → redundant local copy |
| `snapshot-full.ps1` | Full project snapshot (excludes node_modules/.next/out) |
| `restore.ps1` | Browse + restore from any backup point |

### `public/` — Static Assets
| File | Purpose |
|------|---------|
| `manifest.json` | Web App Manifest (standalone display, icons) |
| `sw.js` | Service Worker (cache-first, v2) |
| `sitemap.xml` | All 18 routes |
| `robots.txt` | Crawl allowed, admin/checkout disallowed |
| `logo.png`, `logo-bw.webp` | Brand logos |
| `hero-bg.jpg` | Homepage hero background |
| `icons/` | PWA icons (192px, 512px, maskable variants) |
| `favicon.ico` | Browser favicon |

### `_backups/` — Backup Log
- 6 backup entries logged (3 snapshots, 1 pre-edit, 2 more snapshots)
- Pre-edit backup: `src/hooks/useCatalog.ts` from 20260616-183345

---

## 5. BUILD & TEST STATUS

| Check | Result |
|-------|--------|
| **Lint** | ✅ **0 errors** (ESLint flat config, clean) |
| **Tests** | ✅ **48/48 pass**, 4 suites green |
| **Build (Next.js)** | ✅ 18 routes generated, static export to `out/` |
| **Build (Functions)** | ✅ Compiles clean (TypeScript → lib/) |

### Test Breakdown
| Suite | Tests | Result |
|-------|-------|--------|
| `hooks/__tests__/catalog.test.ts` | Catalog hook | ✅ All pass |
| `context/__tests__/cart.test.ts` | Cart context | ✅ All pass |
| `app/customizer/__tests__/views.test.ts` | Customizer views | ✅ All pass |
| `lib/__tests__/search.test.ts` | Search fuzzyScore | ✅ All pass |

---

## 6. DATA SYNTHETIC TOGGLE

`const USE_SYNTHETIC = false;` in `src/hooks/useCatalog.ts` line 8  
**Currently:** Real Firestore data path is active (not synthetic data)

---

## 7. FIREBASE CONFIGURATION

### Firestore Rules
- `config/*` — Public read, auth write
- `designs/*` — Public read, auth write
- `products/*` — Public read, auth write
- `categories/*` — Public read, auth write
- `users/{userId}` — Own read/write only
- `orders/*` — Auth read, Functions-only write
- `customers/{userId}` — Own read/write (including subcollection addresses)
- Default: Deny all

### Storage Rules
- Public read
- Authenticated upload

### Firestore Indexes
- Currently empty (no custom composite indexes needed yet)

---

## 8. ENVIRONMENT & CREDENTIALS

### Present Locally
- ✅ `.env.local` — Firebase config (public keys committed in `.env.example`)
- ✅ `functions/.env` — Square sandbox credentials

### Missing from Repo (External)
- Square Production Access Token (in `Desktop\animasreflections square API info.txt`)
- Gemini API Key (in `Downloads\animas gemini key.txt`)

---

## 9. DEPLOYMENT STATUS

### Firebase Hosting
| Detail | Value |
|--------|-------|
| Live URL | https://animas-reflections-pwa.web.app |
| Static Files | 213 files deployed (Session 5) |
| Cache Policy | Static assets: 1 year immutable; HTML: no cache, revalidate |
| Rewrites | All routes → `/index.html` (SPA fallback for static export) |

### Cloud Functions
| Detail | Value |
|--------|-------|
| Deployed | ✅ 18 functions |
| Runtime | Node.js 22 (Gen 2) |
| Region | `us-central1` |
| Timeouts | Most 60s, sync: 300s, import/pipeline: 600s |
| Schedule | Daily sync at 4:00 AM UTC |

---

## 10. PHASED COMPLETION STATUS

| Phase | Status | Progress |
|-------|--------|----------|
| **Phase 1:** Workspace & Init | ✅ COMPLETE | 100% |
| **Phase 2:** Square API Gateway | ✅ COMPLETE | 100% (18 functions, ~2,166 LOC backend) |
| **Phase 3:** Customizer Component | 🟡 IN PROGRESS | ~70% |
| **Phase 4:** Order Assembly & Checkout | ✅ COMPLETE (needs testing) | 95% |
| **Phase 5:** Admin CMS Dashboard | 🟡 IN PROGRESS | ~85% |
| **Phase 6:** PWA Optimization & Launch | 🟡 PARTIAL | ~50% |

### Phase 3 — Customizer (70% complete)
- ✅ Canvas with view tabs (front/back/sleeve)
- ✅ Image overlay with drag/resize/rotate (pointer events, touch, bounds clamping)
- ✅ Print zone metadata type system + view generation logic
- ✅ Design file upload to Firebase Storage
- ✅ Product selector and add-on toggle pricing
- ❌ **Text tool** (font picker, color, sizing on canvas)
- ❌ **Design library browser** (Firestore designs/ collection)
- ❌ **iOS Safari touch compatibility** — may need further testing
- ❌ **Simple distortion** to conform design to fabric
- ❌ **Upload-to-canvas pipeline** end-to-end
- ❌ **Mobile responsive canvas** (viewport-aware sizing)

### Phase 4 — Checkout (95% complete)
- ✅ Cart context with reducer
- ✅ Cart drawer with items/subtotal/shipping/total
- ✅ Checkout page with Square card input + shipping form
- ✅ Order confirmation page
- ❌ **End-to-end sandbox purchase test** — NOT YET DONE
- ❌ **Error recovery** for payment failures
- ❌ **Shipping tier auto-detection** per product type verified

### Phase 5 — Admin CMS (85% complete)
- ✅ Products tab (CRUD, variant matrix, "Sync from Square" button, push button)
- ✅ Categories tab (CRUD, reorder)
- ✅ Images tab (gallery, upload, mockup assignment)
- ✅ Settings tab (color pickers, banner, shipping rates)
- ✅ Designs tab (upload/remove design assets)
- ✅ Orders tab (displays recent orders)
- ✅ Users tab (admin view)
- ✅ Admins tab (add/remove admin emails)
- ❌ **"Push to Square" end-to-end** with progress/error feedback
- ❌ **"Sync from Square"** with detailed status display
- ❌ **Inventory count display** per variant
- ❌ **Order tracking update** capability
- ❌ **Pagination/filtering** on Orders + Users tables

### Phase 6 — PWA/Launch (50% complete)
- ✅ Web App Manifest + icons
- ✅ Service Worker (cache-first)
- ✅ robots.txt + sitemap.xml
- ✅ JSON-LD on layout + product page
- ❌ Verify JSON-LD on all 18 routes
- ❌ Per-product structured data
- ❌ Lighthouse audit (target 90+)
- ❌ Cross-browser testing (Chrome, Firefox, Safari, mobile)
- ❌ iOS Safari PWA install test
- ❌ Android Chrome PWA install test
- ❌ Offline fallback test
- ❌ Domain DNS cutover from Square registrar
- ❌ Analytics integration (Firebase Analytics / GA4)
- ❌ Production .env (Square prod tokens)

---

## 11. BACKUP SYSTEM STATUS

| Layer | Location | Status |
|-------|----------|--------|
| **Git + GitHub** | `origin/master` | ✅ 8 commits pushed |
| **Local Full Snapshots** | `C:\Users\AmosA\Backups\animas-reflections-pwa\full-snapshots\` | ✅ Configured |
| **Pre-Edit File Backups** | `_backups/pre-edit/` | ✅ Active (1 backup recorded) |
| **Backup Log** | `_backups/backup-log.txt` | ✅ 6 entries |

### Available Backup Commands
```bash
npm run backup:file   -- <file>          # Pre-edit snapshot
npm run backup:commit -- -Message "..."  # Commit + push + redundant copy
npm run backup:snapshot                  # Full project snapshot
npm run backup:list                      # List available backups
npm run backup:restore                   # Restore from backup
```

---

## 12. REMAINING HIGH-PRIORITY WORK

### Critical Path
1. **End-to-end checkout test** with Square sandbox card data
2. **Wire "Push to Square"** in admin with progress feedback
3. **Wire "Sync from Square"** with detailed status display
4. **Customizer text tool** (font picker, color, sizing on canvas)
5. **Design library browser** (Firestore designs/)

### Pre-Launch Blockers
6. Lighthouse audit (target 90+ across all categories)
7. Cross-browser + mobile device testing
8. Domain DNS cutover
9. Production Square credentials (.env)
10. Offline fallback verification

---

## 13. KEY TECHNICAL GOTCHAS (Do Not Repeat)

| Issue | Detail |
|-------|--------|
| Square v42 BigInt | `priceMoney.amount` is BigInt — always `Number()` before arithmetic |
| Square categories | Items use `itemData.categories[]` array (not `categoryId` field) |
| ecom_visibility | Only filter items with `ecom_visibility === "VISIBLE"` (405 vs 74 POS) |
| Nav dock | Use fixed wrapper div, not `position: fixed` on nav-dock directly |
| Hydration mismatch | Use `useEffect(() ⇒ setMounted(true))` pattern for static export |
| batchUpsert | Method on `client.catalog`, not `client.catalog.batchUpsertCatalogObjects` |
| Functions/Next.js | `functions/` excluded from Next.js tsconfig to prevent type conflicts |
| Static export | No SSR/API routes — all dynamic data via client-side Firestore + callables |

---

## 14. TECHNOLOGY STACK SUMMARY

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16.2.7 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Hosting | Firebase Hosting | CDN |
| Backend | Firebase Cloud Functions | Node 22, Gen 2 |
| Database | Cloud Firestore | NoSQL |
| Storage | Firebase Storage | — |
| Auth | Firebase Auth | Email/Password + Google |
| Payments | Square API | v42.3.0 |
| PWA | Service Worker + Manifest | — |
| Testing | Jest + ts-jest | 30.x |
| Linting | ESLint | 9.x |

---

*Report generated 2026-06-30 by automated project analysis.*
