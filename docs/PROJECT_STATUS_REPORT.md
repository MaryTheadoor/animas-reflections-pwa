# Animas Reflections PWA — Comprehensive Project Status Report
**Date:** 2026-07-09 | **Build:** `6da33fe` — G1-G18 gap closure | **Session:** 7+

---

## 1. CURRENT HEALTH

| Check | Result |
|-------|--------|
| Lint | ✅ **0 errors** |
| Tests | ✅ **48/48 pass** (4 suites) |
| Build | ✅ **20 route dirs, 22 static HTML pages** (Turbopack, `output: "export"` to `out/`) |
| Functions Build | ✅ Compiles clean |
| Git | Clean on `master`, up to date with `origin/master` |

---

## 2. WHAT WAS FIXED THIS SESSION

| Issue | Fix |
|-------|-----|
| **Color mismatch** (`#8400FF` vs `#1E4D4F`) | `globals.css` `@theme` now uses `--color-primary: #1E4D4F`. `layout.tsx` `themeColor` is `#1E4D4F`. All brand elements consistently teal. |
| **`ProductTemplate` missing sideL/sideR** | Added `sideL?` and `sideR?` to `ProductTemplate.views` |
| **Customizer `selected_view` type assertion** | `CartItem.selected_view` now typed as `"front" | "back" | "sleeve" | "sideL" | "sideR"` |
| **`sync.ts` backend type drift** | `ManagedProduct` in `sync.ts` now includes `sideL`/`sideR` in `printZones` and `mockupImages`, plus `designAssets`, `weightOz` (file later removed in Phase 1, 2026-08) |
| **Designs stored in flat catalog doc** | Now individual docs in `designs/` collection with `name`, `description`, `category`, `image_url`, `tags[]`, `created_at`, `productId`. Migration tool in admin. |
| **No offline indicator** | Red "You're offline" banner added to `header-bar.tsx` |
| **No inventory sync button** | "Sync Inventory" button in product manager with result display |
| **Design upload missing metadata** | Upload form now includes description + tags fields |

---

## 3. REMAINING GAPS

### Operational (need action, not code)

| # | Gap | What to Do |
|---|-----|------------|
| G1 | ~~**Square sync never run**~~ — Square catalog sync was removed (Phase 1, 2026-08); Firestore is now the master catalog | Add/edit products directly in the admin dashboard |
| G2 | **Checkout never tested** end-to-end | Run a $1 test purchase with Square production card |
| G3 | **Functions `.env` uses sandbox token** | Swap `functions/.env` `SQUARE_ACCESS_TOKEN` from sandbox to production |
| G4 | **Products have no images** | Upload via Admin → Images tab (you mentioned doing this manually) |
| G5 | **No mockup images for customizer** | Upload blank product shots via Admin → Image Manager |
| G6 | **Missing Firestore composite index** | In Firebase Console → Firestore → Indexes, add composite index on `orders/`: `customerEmail` (asc) + `createdAt` (desc) |

### Code Gaps Still Open

| # | Gap | Priority | Notes |
|---|-----|----------|-------|
| G11 | Inventory per-variant display in product list | Low | Shows total stock sum but not per-variant |
| G12 | Order pagination in admin | Low | Hardcoded at 30, no page controls |
| G13 | ~~Product images not downloaded from Square by sync~~ — REMOVED (Phase 1): sync pipeline deleted; images uploaded via admin | — | N/A |
| G14 | JSON-LD on all 20 route dirs | Medium | Currently only layout + product page have it |
| G17 | Checkout retry on payment failure | Medium | No "Try Again" button after failed tokenization |

### Pre-Launch Checklist

| # | Item | Effort |
|---|------|--------|
| G15 | Lighthouse audit (target 90+) | 1 session |
| G19 | Cross-browser testing (Chrome, Firefox, Safari, mobile) | 1 session |
| G20 | Domain DNS cutover (Square registrar → Firebase) | 15 min |
| G21 | Analytics integration (Firebase Analytics or GA4) | 1 session |
| G22 | iOS Safari PWA install test | 30 min |
| G23 | Android Chrome PWA install test | 30 min |

---

## 4. ARCHITECTURE VERIFICATION

### Backend (14 Cloud Functions)
All 14 functions are exported from `functions/src/index.ts` (828 lines) and deployed at `us-central1`, Node 22, Gen 2. Server-side order pricing lives in `functions/src/pricing.ts` (294 lines, pure integer-cents math). The 14 functions:

| Function | Type | Purpose |
|----------|------|---------|
| `createSquareOrderAndPay` | Callable | Builds Square order + processes payment + mirrors to Firestore `orders/`; re-derives all prices server-side from Firestore, never trusts client amounts |
| `health` | HTTPS | Health check |
| `fetchSiteConfig` / `saveSiteConfig` | Callable | Site config read/write |
| `saveAdminEmails` | Callable | Admin email management |
| `fetchRecentOrders` | Callable | Admin order list |
| `createSquareProduct` | Callable | Optional one-way push of an admin product to Square for POS linkage |
| `fetchCustomerOrders` | Callable | Customer order history |
| `getCustomerAddresses` / `saveCustomerAddress` / `deleteCustomerAddress` | Callable | Customer address book |
| `getCustomerProfile` / `saveCustomerProfile` | Callable | Customer profile |
| `updateOrderTracking` | Callable | Order tracking updates |

**Phase 1 (2026-08):** the Square→Firestore catalog-sync architecture was removed — `functions/src/sync.ts` and `functions/src/product-pipeline.ts` deleted, along with `fetchSquareCatalog`, `syncProducts`, `importProducts`, `runPipeline`, `scheduledSync`, `fetchSyncStatus`, `fetchPipelineStatus`, `fetchInventoryCounts`, `clearProducts`, the admin "Catalog Sync" UI, and the `aiSearch`/Genkit function. Firestore is now the master catalog; Square is payment-only. Catalog reads come from Firestore `products/` and `categories/` via the `useCatalog` hook — no Square API fallback on the client. Search is programmatic fuzzy scoring (`fuzzyScore` in `src/hooks/useSearch.ts`).

The core checkout flow:
1. Admin dashboard → edits products in Firestore `products/` (master catalog)
2. `createSquareOrderAndPay` → builds Square order (payment-only) + processes payment + mirrors to Firestore `orders/`
3. `createSquareProduct` → optionally pushes admin-created products to Square via `batchUpsert` for POS linkage

### Data Model (Consistent Across All Layers)
- `ManagedProduct` in `src/types/index.ts` ✅ matches Firestore schema (`functions/src/index.ts` enforces server-side)
- `DesignAsset` stored as individual docs in `designs/` collection ✅ (no longer a flat array)
- `CartItem` preserves `design_x`, `design_y`, `design_scale`, `design_rotation`, `selected_view` through checkout

### Security
- Firestore rules: public read, Auth write for products/categories/designs
- Orders: Auth read only, Functions-only write
- Storage: public read, authenticated upload
- No secrets in client code

---

## 5. WHAT TO DO NEXT

1. **Populate the catalog in the admin dashboard** — Firestore `products/` is the master catalog (the old "Sync Now" Square import was removed in Phase 1); without products nothing works
2. **Swap production Square token** in `functions/.env`
3. **Add Firestore composite index** on `orders/` for `customerEmail` + `createdAt`
4. **Upload product images** via Admin → Images tab
5. **Upload mockup images** via Admin → Image Manager
6. **Run a test checkout** with a real card to verify the payment pipeline end-to-end
7. After that, tackle the pre-launch checklist (Lighthouse, cross-browser, DNS)

---

*Updated 2026-07-09 after deep re-read of commits `9b2364c` (critical fixes), `4bc9507` (designs as individual docs), and `6da33fe` (G1-G18 gap closure). Amended 2026-08 to reflect Phase 1 removal of the Square→Firestore catalog-sync architecture (`sync.ts`, `product-pipeline.ts`, and the related sync/inventory functions) — Firestore is now the master catalog, Square is payment-only.*
