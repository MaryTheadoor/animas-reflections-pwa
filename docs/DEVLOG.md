# Development Log — Animas Reflections PWA

A chronological record of all development sessions, decisions, and state changes.
Purpose: restore full context in any new terminal instance.

---

## Session 1 — 2026-06-16 | 18:15 MST

### Context Restored From
- `PROJECT_CONTEXT.md` — recovery blueprint
- `docs/ARCHITECTURE.md` — system overview
- `docs/DEVELOPMENT.md` — commands and conventions
- `docs/SCHEMA.md` — data model
- `Downloads/animas_reflections_scope_roadmap.md` — original engineering spec

### Actions Taken
1. **Full project analysis** — catalogued all 87+ source files, 18 routes, 16+ Cloud Functions, 6 Firestore collections, 4 test suites
2. **Backup framework established** (3-layer redundancy):
   - Created `scripts/backup-file.ps1` — pre-edit file snapshot to `_backups/` + redundant local disk
   - Created `scripts/backup-commit.ps1` — git add → commit → push to GitHub → redundant local copy
   - Created `scripts/snapshot-full.ps1` — full project snapshot (excludes node_modules/.next/out)
   - Created `scripts/restore.ps1` — browse + restore from any backup point
   - Added 5 npm scripts: `backup:file`, `backup:commit`, `backup:snapshot`, `backup:list`, `backup:restore`
   - Updated `.gitignore` to exclude `_backups/`
   - Redundant local path: `C:\Users\AmosA\Backups\animas-reflections-pwa\`
3. **Master scope document** — created `docs/SCOPE.md` v1.0 synthesizing external roadmap, Square site copy, current codebase state, and stated requirements
4. **This devlog initiated** — `docs/DEVLOG.md`

### Key State at Session Start
- `USE_SYNTHETIC = true` in `src/hooks/useCatalog.ts`
- Working tree clean, on `master`, up to date with `origin/master`
- Firebase fully configured (Auth, Firestore, Storage, Functions, Hosting)
- Last commit before session: `bc8f580` — "fix: restore err in saveAddress catch block"

### Commits This Session
| Hash | Message |
|------|---------|
| `8e7c3ce` | feat: add rigorous backup framework |
| `79ef789` | fix: handle git stderr warnings in backup-commit.ps1 |
| `5fbf422` | docs: create v1.0 master scope document (SCOPE.md) |

### Snapshots Taken
| Timestamp | Label |
|-----------|-------|
| `20260616-182010` | baseline-initial |
| `20260616-182107` | backup-framework-complete |
| `20260616-183008` | master-scope-v1 |

### Pending / Next Session
See `docs/SCOPE.md` Section 9 "Roadmap — Priority Order"
- [ ] Run `npm run lint` + `npm test`
- [ ] Customizer: finish drag-to-reposition + scale/rotate
- [ ] Switch `USE_SYNTHETIC=false`

---

## Session 2 — 2026-06-16 | 18:30 MST

### Context Restored From
- `docs/DEVLOG.md` Session 1
- `docs/SCOPE.md` Section 9 — Immediate priority items

### Actions Taken
1. **Phase 1: Code Health & Stability — ALL PASS**
   - `npm run lint` — **0 errors** (clean)
   - `npm test` — **48/48 tests pass**, 4 suites green (search, catalog, cart, views)
   - `npm run build` — **18 routes generated** successfully (21 static pages)
   - `cd functions && npm run build` — **compile clean** (0 errors)

2. **Fixes applied during Phase 1:**
   - `tsconfig.json`: excluded `functions/` directory — was causing type errors from missing function deps during Next.js build
   - `.env.local`: created from `.env.example` (Firebase API key was missing at build time, causing `auth/invalid-api-key` during static export)

3. **Discovered:** `USE_SYNTHETIC` was already `false` in `src/hooks/useCatalog.ts` (line 8) — real Firestore data path is active. Previously documented as `true` in PROJECT_CONTEXT.md (stale doc).

### Decisions Made
- `functions/` should never be type-checked by Next.js — it has its own tsconfig and dependencies
- `.env.local` must exist at build time even for static export (Firebase SDK initializes at module scope)

### Files Changed
| File | Change |
|------|--------|
| `tsconfig.json` | Added `"functions"` to `exclude` array |
| `.env.local` | Created from `.env.example` (not committed, gitignored) |

### Commits This Session
| Hash | Message |
|------|---------|
| `d3c1178` | fix: exclude functions/ from Next.js TypeScript compilation |

### Current State at Session End
- Lint: 0 errors
- Tests: 48/48 pass (4 suites)
- Build: 18 routes, 21 static pages
- Functions: compile clean
- USE_SYNTHETIC: false (real Firestore data)
- Working tree: clean
- Branch: master
- `.env.local` exists with Firebase public config

### Pending / Next Session
- [ ] End-to-end checkout test with Square sandbox
- [ ] Wire "Push to Square" in admin product manager
- [ ] Wire "Sync from Square" in admin with progress feedback
- [ ] Customizer: finish drag-to-reposition + scale/rotate (pointer events on canvas)

---

## Session 3 — 2026-06-16 | 18:50 MST

### Context Restored From
- `docs/DEVLOG.md` Session 2 — Phase 1 complete, pending items
- `docs/SCOPE.md` Section 9

### Actions Taken
1. **Architectural refactor: Standalone e-commerce framework with Square adapter layer**
   - Decoupled entire frontend from Square-specific types
   - `ManagedProduct` is now the canonical type consumed by all components
   - `SquareCatalogItem` retained only as internal bridge for sync/fallback
   - `CartItem` uses managed IDs (`variant_id`, `addon_id`) with optional `squareVariationId`/`squareModifierId` for Square checkout path
   - Checkout sends managed IDs; backend `createSquareOrderAndPay` resolves to Square catalog IDs internally
   - New `CheckoutLineItem`/`CheckoutAddon` types are payment-provider-agnostic
   - To switch payment providers in future: only the Cloud Function + checkout page payment UI need changes

2. **Files refactored (16 total):**
   - `src/types/index.ts` — CartItem uses managed IDs, added CheckoutLineItem, deprecated SquareCatalogItem as bridge type
   - `src/hooks/useCatalog.ts` — returns `ManagedProduct[]` directly (was `SquareCatalogItem[]`), property renamed `items` → `products`
   - `src/hooks/useSearch.ts` — works with `ManagedProduct` directly
   - `src/context/cart-context.tsx` — `modifier_id` → `addon_id`
   - `src/components/product/product-card.tsx` — props `item: SquareCatalogItem` → `product: ManagedProduct`
   - `src/components/product/product-detail.tsx` — same pattern
   - `src/components/cart/cart-drawer.tsx` — shows `variant_name` in cart
   - `src/components/home/featured-products.tsx` — `items` → `products`, `ProductCard` props
   - `src/app/shop/page.tsx` — `items` → `products`, `categoryIds[]` → `categoryId`
   - `src/app/product/page.tsx` — `variations` → `variants`, new CartItem schema
   - `src/app/search/page.tsx` — `items` → `products`
   - `src/app/customizer/page.tsx` — switched from SquareCatalogItem to ManagedProduct
   - `src/app/fundraising/page.tsx` — `items` → `products`, `categoryIds.includes()` → `categoryId ===`
   - `src/app/checkout/page.tsx` — uses managed IDs, removed isSynthetic check, payment provider abstraction comment
   - `src/lib/__tests__/search.test.ts` — test data uses ManagedProduct
   - `functions/src/index.ts` — OrderLineItem accepts variant_id + squareVariationId, resolves at runtime

3. **Verification:**
   - `npm run lint` — 0 errors
   - `npm test` — 48/48 pass, 4 suites green
   - `npm run build` — 18 routes, 21 static pages
   - `cd functions && npm run build` — compile clean

### Decisions Made
- **Provider abstraction strategy**: Frontend is entirely Square-free. Backend Cloud Function is the only place Square-specific logic lives. When switching to Stripe/PayPal: fork `createSquareOrderAndPay` → `createStripeOrderAndPay`, keep same line item schema.
- **Naming convention**: `variants` (plural, ManagedProduct) vs `variations` (Square-specific). Removed all `isSynthetic` references — it's now handled at the catalog hook level.

### Commits This Session
| Hash | Message |
|------|---------|
| `1e07df0` | refactor: decouple frontend from Square — use ManagedProduct as canonical type |

### Current State at Session End
- Lint: 0 errors
- Tests: 48/48 pass (4 suites)
- Build: 18 routes, 21 static pages
- Functions: compile clean
- Frontend: fully decoupled from Square (ready for any payment provider)
- Working tree: clean
- Branch: master
- `.env.local`: present

### Pending / Next Session
- [ ] End-to-end checkout test with Square sandbox
- [ ] Wire "Push to Square" in admin product manager
- [ ] Wire "Sync from Square" in admin with progress feedback

---

## Session 4 — 2026-06-16 | 19:15 MST

### Context Restored From
- `docs/DEVLOG.md` Session 3 — architecture refactor complete, customizer was next priority

### Actions Taken
1. **Customizer interactive controls — fully implemented**
   - Drag-to-reposition: pointer capture with pixel-to-percent delta conversion, real-time bounds clamping
   - Resize handle: bottom-right corner grip, drag to proportionally scale (0.25x–3x)
   - Wheel/trackpad scroll resize: +/- 3% per tick, position-preserving
   - Rotation: +-1/15/90 degree preset buttons, proper modulo 360
   - Auto-center: design resets to print zone center on view/product change via defaultDesignPosition()
   - Bounds clamping: clampToPrintZone() on all operations accounting for scaled dimensions
   - Touch/iOS Safari: touch-action:none, pointer events, global pointerup fallback
   - UI polish: hint text when no design, aria-labels, tabular-nums

2. **Verification:**
   - `npm run lint` — 0 errors, 0 warnings
   - `npm test` — 48/48 pass, 4 suites green
   - `npm run build` — 18 routes, 21 static pages

### Files Changed
| File | Change |
|------|--------|
| `src/components/customizer/customizer.tsx` | Full rewrite: drag/resize/rotate with pointer events, bounds clamping, touch, export defaultDesignPosition |
| `src/app/customizer/page.tsx` | Auto-center on view/product change, handleViewChange, defaultStateForView |

### Commits This Session
| Hash | Message |
|------|---------|
| `75d2ef5` | feat: customizer drag/resize/rotate with bounds clamping and touch support |

### Current State at Session End
- Lint: 0 errors | Tests: 48/48 | Build: 18 routes | Customizer: fully interactive
- Working tree: clean | Branch: master

### Pending / Next Session
- [ ] Run "Sync from Square" from admin — verify products get Square IDs
- [ ] Test "Push to Square" on an admin-created product
- [ ] Test checkout flow with Square card (real sandbox data)

---

## Session 5 — 2026-06-16 | 19:30 MST

### Context Restored From
- `docs/DEVLOG.md` Session 4 — customizer complete

### Actions Taken
1. **All 24 Cloud Functions redeployed** with updated OrderLineItem schema
2. **Square sandbox credentials** configured via `functions/.env`
3. **Admin product manager enhanced:** step-by-step sync progress, elapsed time, dismissable push error banner
4. **Full deployment:** build (213 files) + hosting + functions all live

### Files Changed
| File | Change |
|------|--------|
| `functions/.env` | Created with Square sandbox credentials |
| `src/components/admin/product-manager.tsx` | Progress steps, elapsed time, dismissable error banner |

### Commits This Session
| Hash | Message |
|------|---------|
| `325516e` | feat: deploy all 24 Cloud Functions + enhanced admin sync feedback |

### Current State at Session End
- Lint: 0 | Tests: 48/48 | Build: 18 routes
- 24 functions deployed | Hosting: 213 files live
- All deployed to https://animas-reflections-pwa.web.app
- Working tree: clean | Branch: master

### Pending / Next Session
- [ ] Run "Sync from Square" from admin — verify products get Square IDs
- [ ] Test "Push to Square" on an admin-created product
- [ ] Test checkout flow with Square card (real sandbox data)

---

```
## Session N — YYYY-MM-DD | HH:MM MST

### Context Restored From
- (which docs/files were read to pick up where we left off)

### Actions Taken
1. ...
2. ...

### Decisions Made
- ...

### Files Changed
| File | Change |
|------|--------|

### Commits This Session
| Hash | Message |
|------|---------|

### Snapshots Taken
| Timestamp | Label |
|-----------|-------|

### Current State at Session End
- (key flags, data state, what's deployed vs local)
- USE_SYNTHETIC = ?
- Working tree: clean/dirty
- Branch: ?

### Pending / Next Session
- [ ] ...
- [ ] ...
```
