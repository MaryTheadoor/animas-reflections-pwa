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

## Session 6 — 2026-07-22 | 14:40 MST

### Context Restored From
- Full doc re-read: PROJECT_CONTEXT, README, MASTER, GAP_ANALYSIS, ARCHITECTURE, SCHEMA, DEVELOPMENT, BUSINESS_MODEL, PROJECT_STATUS_REPORT, MASTER_SPEC_OUTLINE, DEVLOG
- Fresh health baseline (verified, not from docs): lint 0 errors, 71/71 tests (7 suites), build 19 routes, functions compile clean, 23 functions deployed

### Branching & Recovery Setup (user priority #1)
- Established stable + working branch model on GitHub:
  - `master` = stable/staged branch (GitHub default, deployable; only merged-to when verified)
  - `development` = working branch; all edits land here, pushed to `origin/development` as offsite rollback
- Branch protection rules require GitHub Pro on a private repo (HTTP 403) — skipped; recovery relies on master-only-when-verified + git history + local snapshot framework
- **Workflow:** work on `development` → verify (lint/test/build + live UI) → merge to `master` → deploy

### Root-Cause Debugging: Product Save Failures
- Symptom (user-reported): new product creation in Admin failed/hung. Prior commits treated symptoms (docId `||`, 15s timeout, error display), not the cause.
- **ROOT CAUSE:** Firestore Web SDK rejects any write containing `undefined` field values ("Unsupported field value: undefined"). The product form leaves optional fields `undefined` (`mockupImages`, `productAddons`, variant `inventory`, `squareItemIds`); `handleSave`'s `{ ...form }` spread carried them into `setDoc`, rejecting the whole write. `handleDuplicate` failed 100% (explicit undefineds).
- Same bug in `handleDesignUpload` — `description`/`tags` set `undefined` when blank → design doc write rejected (the "live design-catalog errors" from MASTER_SPEC_OUTLINE §12).

### Fixes Applied
1. New shared helper `src/lib/firestore-utils.ts` → `stripUndefined()` (recursive; preserves null/0/false/""; drops undefined array elements)
2. `product-manager.tsx` — stripUndefined in `handleSave` + `handleDuplicate`; fixed secondary bug: new products got `createdAt: ""` (`??` doesn't catch empty string → changed to `||`)
3. `admin/page.tsx` — stripUndefined in `handleDesignUpload`
4. New test suite `firestore-utils.test.ts` (7 tests) modeling the exact failing payloads
- Audited all other setDoc sites (auth-context users, image-manager, category-manager): safe — Firebase uses `null` (valid) not `undefined`, or no optional fields

### Verification
- Lint: 0 errors | Tests: **78/78, 8 suites** | Build: 19 routes, TS clean
- **User confirmed in live admin:** new product creation + design upload now save correctly

### Commits This Session
| Hash | Message |
|------|---------|
| `ccba14c` | fix: product save rejected by Firestore undefined values — strip undefined before setDoc; fix empty createdAt on new products |
| `e6a37f7` | fix: design upload rejected by Firestore undefined values — strip blank description/tags before setDoc |

### Current State at Session End
- Branch: `development` (2 commits ahead of `master`), pushed to origin
- Lint 0 | Tests 78/78 (8 suites) | Build 19 routes | Functions 23 deployed
- USE_SYNTHETIC = false (production Firestore)

### Pending / Next Session
- [ ] Merge `development` → `master` + deploy (awaiting user go-ahead)
- [ ] Gap list: G11 per-variant inventory, G12 order pagination, G17 checkout retry
- [ ] Fix doc drift: SCHEMA.md designs format, stale counts (tests/routes/functions)
- [ ] End-to-end checkout test (production Square)

---

## Session 7 — 2026-07-25 | ~09:00 MST

### Context Restored From
- DEVLOG Session 6, refreshed GAP_ANALYSIS.md, MASTER_SPEC_OUTLINE §12

### Actions Taken
1. **G14 — JSON-LD structured data** — added FAQPage schema (built from the same FAQ items the page renders) and BreadcrumbList on the shop/product funnel; consolidated the hardcoded base URL into `SITE_URL`.
2. **G18 — Admin Users tab enrichment** — per-user order count (fetches + tallies `orders/`), display name fallback, fixed the "Invalid Date" bug (Firestore Timestamp needs `.toDate()`), and `syncUserDoc` now records `createdAt` on first sign-in.
3. Merged to `master` and deployed.

### Commits This Session
| Hash | Message |
|------|---------|
| `5394d59` | feat: add FAQPage + BreadcrumbList JSON-LD — faq rich results, breadcrumbs on shop/product funnel (G14) |
| `a09d43e` | feat: enrich admin Users tab — per-user order count, display name, fix Timestamp 'Invalid Date' rendering; record createdAt on first sign-in (G18) |

### Current State at Session End
- Lint 0 | Tests 78/78 | Build 19 routes | Functions 23 deployed
- `development` + `master` synced and deployed

### Pending / Next Session
- [ ] Modular add-ons per Cindy's feedback (done next session)

---

## Session 8 — 2026-07-27 | ~19:30 MST

### Context Restored From
- Client (Cindy) feedback: irrelevant add-ons showing; want single design per item; "love that clicking a design pops it onto the puzzle"

### Actions Taken
1. **Full data-structure / attribute→UI analysis** — mapped `ManagedProduct`, add-on flow, price model, design selection; presented proposed modular design and aligned with user decisions (keep globals as default; per-product single-design setting; editable standard add-on prices).
2. **Modular per-product add-ons** — `productAddons` is now the single source of truth with 3-state meaning (`undefined`=site defaults, `[]`=none, `[...]`=exact). Admin form has standard add-on checkboxes + editable prices + custom add-ons + "Reset to site defaults".
3. **Single-design option** — `singleDesign?: boolean`; when on, customizer hides the Name/Number text tool and shows a "one design" hint.
4. **Hidden empty add-ons card** in customizer when a product has none.

### Commits This Session
| Hash | Message |
|------|---------|
| `632c49d` | feat: modular per-product add-ons + single-design option — prune irrelevant add-ons per product (editable standard prices), limit items to one design |
| `39c9b61` | fix: hide add-ons card in customizer when no product selected |

### Current State at Session End
- Lint 0 | Tests 78/78 | Build 19 routes
- Deployed to production after merge

### Pending / Next Session
- [ ] Second round of Cindy's feedback (Name/Number, colors, descriptions, shipping, attributes)

---

## Session 9 — 2026-07-30 | ~11:30 MST

### Context Restored From
- Second round of client feedback: Name/Number field showing when not selected; reduce default colors + prominent custom color w/ hex input; auto-resize description; read-more descriptions; per-product shipping; modular attributes (bg color, patch shape, border style, custom fields); rich text descriptions; site-wide text coherency.

### Actions Taken
1. **Gated Name/Number field** on the product page by `personalization` add-on presence (`showPersonalization`).
2. **Colors** — reduced defaults 15→10; prominent custom-color section with color picker + hex input synced; unified add flow.
3. **Description** — auto-resizing contentEditable with **rich text toolbar** (bold/italic/lists); product page read-more fold + sanitized HTML rendering (`src/lib/html-utils.ts` `sanitizeHTML`/`stripTags`).
4. **Per-product flat-rate shipping override** — `shippingRate?: number` on product; cart uses max(per-product rates, global tier); captured on CartItem as `shipping_rate`.
5. **Modular product attributes** — `attributes?: ProductAttributes` (backgroundColor, patchShape, borderStyle, customFields) shown as a specs row on the product page.
6. **Text coherency** — fixed footer nav label (About Us → Our Story); removed dead `FEATURED_PRODUCTS`.

### Commits This Session
| Hash | Message |
|------|---------|
| `aecb567` | fix: gate Name/Number field by personalization addon; reduce default colors; add hex input to custom color picker; auto-resize description; rename 'Choose Design' |
| `7886276` | feat: per-product flat shipping override; read-more expandable description on product page |
| `5a7a165` | feat: rich text descriptions w/ formatting toolbar (bold/italic/lists); sanitized HTML render; fix footer nav label; remove dead FEATURED_PRODUCTS |
| `c91ec02` | feat: modular per-product visual attributes — background color, patch shape, border style, custom fields; shown as specs on product page |

### Current State at Session End
- Lint 0 | Tests 78/78 | Build 19 routes
- All deployed to production

### Pending / Next Session
- [ ] Product-handling robustness + customer/user CMS audit

---

## Session 10 — 2026-07-31 | ~14:00 MST

### Context Restored From
- Session 9 state; user priorities: robust on-site product handling + customer/user management CMS (Square sync de-prioritized; manual catalog rebuild)

### Actions Taken
1. **Robustness audit** — product delete now cleans up Firebase Storage files (orphaned images); added tracking **number** field to admin Orders (was URL-only).
2. **Customizable flag** — `customizable?: boolean` gates the "Customize This" button on the product page.
3. **Design files to order + admin** — fixed severe order-mirror bug in `createSquareOrderAndPay` (was storing only name/qty + hardcoded `price:0`, dropping design URLs). Checkout now sends `designUrl` per line item; backend persists it + price + note; admin Orders tab merges Firestore mirror data and shows design files (expandable rows) for printing.
4. **Mock-up preview polish** — spotlight effect dims area outside the print zone; design overlay outline.
5. **Color-variant mockups (hybrid)** — `colorTints` (color→hex overlay) tints the single base mockup; `mockupImagesByColor` takes precedence when a real per-color photo exists (upgrade path). Admin has a per-color tint picker with **live mockup preview**; customizer has a color selector that tints the mockup and captures `selected_color` into the cart/order.

### Commits This Session
| Hash | Message |
|------|---------|
| `24ff876` | fix: cleanup Storage files on product delete (prevent orphaned images); add tracking number field to admin Orders tab |
| `07c08f0` | feat: customizable flag gates customizer button; design files saved to order + visible in admin; fix order mirror dropping price/design data |
| `44165c6` | feat: mock-up preview polish — spotlight print zone + design overlay outline |
| `482421a` | feat: color-variant mockups — admin tint picker w/ live preview, customizer color selector + multiply tint overlay, per-color photo upgrade path, color captured in cart/order |

### Current State at Session End
- Lint 0 | Tests 78/78 | Build 19 routes | Functions 23 deployed (redeployed for order-mirror fix)
- All deployed to production

### Pending / Next Session
- [ ] Shop page toggle bug report (next session)

---

## Session 11 — 2026-08-02 | ~16:00 MST

### Context Restored From
- User report: shop "By Design / By Product Type" toggle not functioning

### Actions Taken
1. **Debugged shop toggle** — root cause: `browseMode` was dead state (set but never read by the filter). Fixed: "By Design / Brand" filters by `categoryId`; "By Product Type" filters by `productType` (new `activeType` state + type pills/select + reset on toggle + correct empty-state/result labels).
2. **Product card stock badge fix** — "Out of stock"/"Only X left" badge had `absolute` positioning with no positioned ancestor; moved inside the `relative` image container.
3. **Tile density control** — new "View" selector (2/3/4/5 tiles per row) on shop + search; extracted shared `DensityPicker` component + `DENSITY_CLASSES` for consistent grids.
4. **Customer-facing product propagation audit** — verified ProductCard, product page, customizer, homepage featured, and search all render consistently with proper error/empty/image-fallback handling.

### Commits This Session
| Hash | Message |
|------|---------|
| `662fba9` | fix: shop By Design/Type toggle now filters correctly (was dead state); fix product card stock badge absolute positioning |
| `d3751ea` | feat: tile density control on shop + search (2-5 per row); shared DensityPicker for consistent product grids |

### Current State at Session End
- Lint 0 | Tests 78/78 | Build 19 routes
- All deployed to production

### Pending / Next Session
- [ ] Bring all documentation current (this session)

---

## Session 12 — 2026-08-06 | Documentation refresh

### Context Restored From
- User preparing for a hardware reboot/update — requested all docs current for easy startup

### Actions Taken
1. Added Sessions 7–12 to DEVLOG (this file) with full commit history.
2. Refreshed `PROJECT_CONTEXT.md`, `MASTER.md`, `SCHEMA.md`, `GAP_ANALYSIS.md`, `README.md`, `DEVELOPMENT.md` against the actual current state (see their files).
3. Confirmed `development` = `master` = `d3751ea`, all pushed to origin, deployed to Firebase.

### Current State at Session End
- Lint 0 | Tests 78/78 (8 suites) | Build 19 routes | Functions 23 deployed
- `USE_SYNTHETIC = false` (production Firestore)
- Working tree clean, on `development`, synced with `origin/development` and `master`
- Deployed: https://animas-reflections-pwa.web.app

### Pending / Next Session
- [ ] G2: end-to-end checkout test with a real card (validates idempotency + design-file capture)
- [ ] G15: Lighthouse PWA audit + fixes
- [ ] G20: DNS cutover (animasreflections.com → Firebase Hosting)
- [ ] G21: Analytics integration
- [ ] Cross-browser + PWA install tests (G19/G22/G23)
- [ ] Housekeeping: keep DEVLOG + GAP_ANALYSIS current after each session

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
