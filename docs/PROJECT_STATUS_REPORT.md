# Animas Reflections PWA — Comprehensive Project Status Report
**Date:** 2026-07-09 | **Build:** `6da33fe` — G1-G18 gap closure | **Session:** 7+

---

## 1. CURRENT HEALTH

| Check | Result |
|-------|--------|
| Lint | ✅ **0 errors** |
| Tests | ✅ **48/48 pass** (4 suites) |
| Build | ✅ **18 routes, 21 pages** (5.2s Turbopack) |
| Functions Build | ✅ Compiles clean |
| Git | Clean on `master`, up to date with `origin/master` |

---

## 2. WHAT WAS FIXED THIS SESSION

| Issue | Fix |
|-------|-----|
| **Color mismatch** (`#8400FF` vs `#1E4D4F`) | `globals.css` `@theme` now uses `--color-primary: #1E4D4F`. `layout.tsx` `themeColor` is `#1E4D4F`. All brand elements consistently teal. |
| **`ProductTemplate` missing sideL/sideR** | Added `sideL?` and `sideR?` to `ProductTemplate.views` |
| **Customizer `selected_view` type assertion** | `CartItem.selected_view` now typed as `"front" | "back" | "sleeve" | "sideL" | "sideR"` |
| **`sync.ts` backend type drift** | `ManagedProduct` in `sync.ts` now includes `sideL`/`sideR` in `printZones` and `mockupImages`, plus `designAssets`, `weightOz` |
| **Designs stored in flat catalog doc** | Now individual docs in `designs/` collection with `name`, `description`, `category`, `image_url`, `tags[]`, `created_at`, `productId`. Migration tool in admin. |
| **No offline indicator** | Red "You're offline" banner added to `header-bar.tsx` |
| **No inventory sync button** | "Sync Inventory" button in product manager with result display |
| **Design upload missing metadata** | Upload form now includes description + tags fields |

---

## 3. REMAINING GAPS

### Operational (need action, not code)

| # | Gap | What to Do |
|---|-----|------------|
| G1 | **Square sync never run** — Firestore has no products | Go to Admin → Settings → "Sync Now" |
| G2 | **Checkout never tested** end-to-end | Run a $1 test purchase with Square production card |
| G3 | **Functions `.env` uses sandbox token** | Swap `functions/.env` `SQUARE_ACCESS_TOKEN` from sandbox to production |
| G4 | **Products have no images after sync** | Upload via Admin → Images tab (you mentioned doing this manually) |
| G5 | **No mockup images for customizer** | Upload blank product shots via Admin → Image Manager |
| G6 | **Missing Firestore composite index** | In Firebase Console → Firestore → Indexes, add composite index on `orders/`: `customerEmail` (asc) + `createdAt` (desc) |

### Code Gaps Still Open

| # | Gap | Priority | Notes |
|---|-----|----------|-------|
| G11 | Inventory per-variant display in product list | Low | Shows total stock sum but not per-variant |
| G12 | Order pagination in admin | Low | Hardcoded at 30, no page controls |
| G13 | Product images not downloaded from Square by sync | Low | Sync copies Square URLs but doesn't transfer files to Firebase Storage |
| G14 | JSON-LD on all 18 routes | Medium | Currently only layout + product page have it |
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

### Backend (23 Cloud Functions)
All functions are deployed at `us-central1`, Node 22, Gen 2. The core checkout flow:
1. `syncProducts` → populates Firestore `products/` + `categories/`
2. `createSquareOrderAndPay` → builds Square order + processes payment + mirrors to Firestore `orders/`
3. `createSquareProduct` → pushes admin-created products to Square via `batchUpsert`
4. `fetchInventoryCounts` → batch-pulls stock counts (100 at a time)
5. `scheduledSync` → runs daily at 4 AM UTC

### Data Model (Consistent Across All Layers)
- `ManagedProduct` in `src/types/index.ts` ✅ matches `functions/src/sync.ts` ✅ matches Firestore schema
- `DesignAsset` stored as individual docs in `designs/` collection ✅ (no longer a flat array)
- `CartItem` preserves `design_x`, `design_y`, `design_scale`, `design_rotation`, `selected_view` through checkout

### Security
- Firestore rules: public read, Auth write for products/categories/designs
- Orders: Auth read only, Functions-only write
- Storage: public read, authenticated upload
- No secrets in client code

---

## 5. WHAT TO DO NEXT

1. **Run Sync from Square** (Admin → Settings → Sync Now) — this is the biggest blocker, without it Firestore is empty and nothing works
2. **Swap production Square token** in `functions/.env`
3. **Add Firestore composite index** on `orders/` for `customerEmail` + `createdAt`
4. **Upload product images** via Admin → Images tab
5. **Upload mockup images** via Admin → Image Manager
6. **Run a test checkout** with a real card to verify the payment pipeline end-to-end
7. After that, tackle the pre-launch checklist (Lighthouse, cross-browser, DNS)

---

*Updated 2026-07-09 after deep re-read of commits `9b2364c` (critical fixes), `4bc9507` (designs as individual docs), and `6da33fe` (G1-G18 gap closure).*
