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

## Session 13 — 2026-08-11 | Rich text fix + color system overhaul

### Context Restored From
- Client (Cindy) feedback: (1) rich text formatting on product descriptions "may not be working"; (2) setting up multiple custom colors per product + affiliated per-color images felt broken or unintuitive
- DEVLOG Sessions 1-12, PROJECT_CONTEXT.md, GAP_ANALYSIS.md

### Actions Taken
1. **Rich text debug + fix** — product page rendered `shortDescription` as plain text (formatting lost); raw HTML tags leaked into product cards and search excerpts; admin description toolbar clicks stole the editor's text selection. Fixed all three; hardened `src/lib/html-utils.ts` (sanitizeHTML/stripTags) and added `html-utils.test.ts` (43 lines of cases). Also excluded `_backups/` from `tsconfig.json` type-check (snapshot files were breaking `tsc`).
2. **Color system investigation** — root cause of the client complaint was UX, not data loss: creating a custom color required manually entering a hex tint, and per-color photos were only reachable via an obscure upgrade path. Only 2 of 41 products had colors configured.
3. **Color overhaul (patches 1-4)** —
   - Admin product manager: one-step custom color creation with sensible tint defaults; per-color photo assignment directly in the color editor
   - Image Manager: dedicated per-color "Color Mockups" section
   - Customizer: neutral `#cccccc` swatch fallback for colors with no tint configured (was misleading/blank)
   - Product page: color selector; chosen color flows to customizer via `&color=` param
   - `src/lib/constants.ts`: new `DEFAULT_COLOR_TINTS` map (standard color name -> hex)
4. **Verified + deployed** — lint 0 errors, tests 85/85 (9 suites), build 19 routes, hosting deployed to production. All routes HTTP 200 smoke-tested.

### Decisions Made
- Tints persist to Firestore only on product save — pre-existing products show tint defaults/neutral fallback in UI until re-saved (no migration script; acceptable since only 2 products use colors)
- `mockupImagesByColor` (real per-color photo) continues to take precedence over `colorTints` overlay
- Patch 5 (Firestore data cleanup: duplicate empty product docs + "test 31" product) deferred — needs client approval before deleting data

### Environment Gotchas Discovered (important for next instance)
- **Mixed-case cwd breaks the build on Windows:** `npm run build` from `C:\Users\AmosA\projects\...` (lowercase p) fails with `InvariantError: Expected workStore to be initialized` on `/_global-error` (module duplication from mixed-cased paths). ALWAYS work from `C:\Users\AmosA\Projects\animas-reflections-pwa` (capital P).
- **`scripts/backup-commit.ps1` is unreliable:** `$ErrorActionPreference="Stop"` + `2>&1` turns git's harmless CRLF stderr warning into a fatal error. Used plain `git add/commit/push` this session. Script needs patching (pending).
- `backup-file.ps1` takes space-separated file args; comma-separated lists silently skip all files.

### Files Changed
| File | Change |
|------|--------|
| src/app/product/page.tsx | rich-text short description; color selector + `&color=` customizer link |
| src/app/shop/page.tsx | strip HTML from card excerpts |
| src/components/product/product-card.tsx | strip HTML excerpts |
| src/hooks/useSearch.ts | strip HTML in search results |
| src/lib/html-utils.ts | sanitizeHTML/stripTags hardening |
| src/lib/__tests__/html-utils.test.ts | NEW — 43 lines of rich-text cases |
| tsconfig.json | exclude `_backups/` from type-check |
| src/components/admin/product-manager.tsx | editor selection fix; one-step custom colors + per-color photos |
| src/components/admin/image-manager.tsx | NEW per-color Color Mockups section |
| src/app/customizer/page.tsx | neutral swatch fallback; reads `&color=` param |
| src/lib/constants.ts | NEW `DEFAULT_COLOR_TINTS` |

### Commits This Session
| Hash | Message |
|------|---------|
| `ec02a81` | fix: product description rich text — render formatting on short descriptions, preserve editor selection in admin toolbar, strip HTML for cards/search, exclude _backups from type-check |
| `a706cba` | feat: color system overhaul — one-step custom color tints, per-color mockup photos in admin + image manager, neutral swatches, product page color selector |

### Snapshots Taken
| Timestamp | Label |
|-----------|-------|
| `20260811-164106` | PRE-EDIT (batch start) |
| `20260811-164111` | PRE-EDIT rich-text files (product/shop pages, product-manager, product-card, html-utils, useSearch) |
| `20260811-164401` | PRE-EDIT tsconfig.json |
| `20260811-183345` | PRE-EDIT color-system files (constants, product-manager, image-manager, customizer, product page) |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 19 routes | Functions unchanged (hosting-only deploy)
- `USE_SYNTHETIC = false` (production Firestore)
- Working tree clean; `development` = `master` = `a706cba`, synced with origin
- Deployed: https://animas-reflections-pwa.web.app
- Color UI verified via lint/tests/build/HTTP only — NOT yet browser-tested visually (see pending)

### Pending / Next Session
- [ ] Visual browser verification of color features (product swatches, customizer tint, admin color editor) — WebBridge + vision now available for this
- [ ] Patch `scripts/backup-commit.ps1` (CRLF stderr handling)
- [ ] Patch 5 data cleanup (duplicate empty products + "test 31") — awaiting client approval
- [ ] Carry-over from Session 12: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics, G19/G22/G23 cross-browser/PWA

---

## Session 14 — 2026-08-12 | Light-mode readability overhaul

### Context Restored From
- DEVLOG Sessions 1–13; user-reported concerns: light mode felt intense, gray text low-contrast, wanted black default text + cream background
- Browser audit via Kimi WebBridge (screenshots of live homepage, shop, product pages in light mode)

### Actions Taken
1. **Browser-based theme audit (WebBridge)** — visually confirmed: gray body text (`text-primary/60`, `text-foreground/70`) failing readability, background cooler than brand cream, nav dock icons faint at `opacity: 0.6`, announcement banner intense (kept — matches logo moon).
2. **Background warmed** — `--color-cream` `#F7F4EE` → `#FAF6F0` (brand cream) in globals.css theme + `body::before` texture layer.
3. **Global contrast sweep** — `text-primary/80|70|60|50` → `text-foreground` (near-black `#111827`); `/40` → `text-foreground/80`; `/30` → `text-foreground/70`; `/20` → `text-foreground/50`; consolidated `text-foreground/90|80` → `text-foreground`. Accent colors (`text-gold`, `text-primary` teal, `text-plum`, `text-teal`, `text-red-400`) preserved.
4. **Nav dock** — `.nav-dock-link` opacity `0.6` → `0.75`.
5. **Prices** — removed `opacity-70` wrapper on variant price spans (product page + product-detail).
6. **Verified + deployed** — lint 0 errors, tests 85/85 (9 suites), build 21 routes, hosting deployed. Visually verified live homepage + shop via WebBridge screenshots (dark/black text confirmed).

### Decisions Made
- Default light-mode text is now near-black (`--color-foreground` `#111827`); opacity-tinted `text-primary` text reserved for accents/icons/placeholders only.
- Announcement banner stays `bg-gold` (#D97706) — same hue as logo moon, per user direction.
- No dark-mode changes this session.

### Files Changed
| File | Change |
|------|--------|
| src/app/globals.css | cream #FAF6F0, nav-dock-link opacity 0.75 |
| 38 tsx files across src/ | text-primary opacity classes → text-foreground (near-black) |

### Commits This Session
| Hash | Message |
|------|---------|
| `6e2dbc1` | feat: light-mode readability overhaul — black default text, cream background, higher nav contrast |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 21 routes | Functions unchanged (hosting-only deploy)
- `development` = `master` = `6e2dbc1`, pushed to origin, deployed
- Live: https://animas-reflections-pwa.web.app (visually verified via WebBridge)

### Pending / Next Session
- [ ] Dark-mode counterpart audit (same readability pass on dark palette)
- [ ] Patch `scripts/backup-commit.ps1` (CRLF stderr handling)
- [ ] Patch 5 data cleanup (duplicate empty products + "test 31") — awaiting client approval
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics, G19/G22/G23 cross-browser/PWA

---

## Session 15 — 2026-08-12 | A11y + legal compliance pass (crash recovery)

### Context Restored From
- Previous session (`kimi-code` session e9c852bb) crashed mid-turn on provider errors (k3 403 usage limit, then DeepSeek 400s) — recovered its wire log to reconstruct in-flight work
- DEVLOG Sessions 1–14, PROJECT_CONTEXT.md, uncommitted working tree (4 files), `_webbridge/contrast.py` audit script

### Actions Taken
1. **Crash recovery** — read session wire log; the session was mid-implementation of a WCAG 2.2 AA + legal-compliance audit. Reconstructed its findings and finished the work.
2. **A11y mechanical fixes** (started pre-crash, completed this session):
   - Removed `maximumScale: 1` from viewport (pinch-zoom, WCAG 1.4.4)
   - Global `:focus-visible` outline + `prefers-reduced-motion` support in globals.css
   - Skip-to-content link + `#main-content` target in page-layout
   - Body class `text-primary` → `text-foreground`
   - Cart drawer: `role="dialog"`/`aria-modal`/label, Escape close, Tab focus trap, focus restore on close
   - Customizer: design overlay is now focusable — arrow keys reposition (Shift = 5% steps), clamped to print zone
3. **Contrast fixes (user-approved)**:
   - New `--color-gold-deep` (#B45309) theme token
   - Announcement banner → `bg-gold-deep` + `announcement-banner` class; dark-mode rule keeps `#D97706` behind remapped dark text (both modes ≥4.5:1)
   - Gold subheadings on cream → `text-gold-deep` (about, home, fundraising, biscuit-hockey, im-ok-r-u, terms)
4. **Privacy Policy** — new `/privacy` route (11 sections: collection, use, Square processing, cookies/localStorage/SW caching, Firebase, retention, rights, children, contact) + `PRIVACY_POLICY` content block; footer link; Terms §10 now points to the page; contact page privacy note links it.
5. **Verification** — lint 0 errors, tests 85/85 (9 suites), build 22 routes, WebBridge live checks: banner both modes, subheading color, footer link, privacy page render.

### Decisions Made
- Banner: darker gold (#B45309) in light mode; original gold retained in dark mode because `text-white` remaps to slate-800 there
- Subheadings: `text-gold-deep` (amber family), `text-gold` reserved for icons/accents
- Privacy policy: full draft page authored from stack facts (Firebase + Square, no analytics), client review recommended before launch
- Borderline items left as-is (pre-existing, not flagged in audit): product-card gold price on white (3.19:1), stock badge, fundraising teaser pill, offline banner in dark mode

### Files Changed
| File | Change |
|------|--------|
| src/app/globals.css | `--color-gold-deep` token, `:focus-visible`, skip-link, reduced-motion, dark-mode `.announcement-banner` rule |
| src/app/layout.tsx | viewport zoom fix, body `text-foreground` |
| src/components/layout/page-layout.tsx | skip link + `#main-content` |
| src/components/cart/cart-drawer.tsx | dialog semantics, ESC, focus trap + restore |
| src/components/customizer/customizer.tsx | keyboard arrow-key reposition + hints |
| src/components/layout/header-bar.tsx | banner `bg-gold-deep` + `announcement-banner` |
| 6 page files (about/home/fundraising/biscuit-hockey/im-ok-r-u/terms) | subheadings → `text-gold-deep` |
| src/lib/content.ts | PRIVACY_POLICY block, Terms §10 URL, contact note, footer link |
| src/app/contact/page.tsx | privacy note links to /privacy |
| src/app/privacy/page.tsx | NEW — privacy policy page |

### Commits This Session
| Hash | Message |
|------|---------|
| `a5ec1c6` | feat: WCAG a11y + compliance pass — zoom fix, focus-visible outline, skip link, cart drawer dialog + focus trap, customizer arrow-key reposition, gold-deep contrast token, privacy policy page |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 22 routes
- Committed to `development` and pushed to origin; NOT yet deployed (hosting-only deploy pending client review of the privacy policy draft)
- USE_SYNTHETIC = false; dev server running on :3000
- `_webbridge/contrast.py` left untracked (audit scratch tooling)

### Pending / Next Session
- [ ] Commit + push + deploy this session's work (hosting-only)
- [ ] Client review of Privacy Policy draft
- [ ] Dark-mode counterpart audit (still open from Session 14)
- [ ] Optional contrast follow-ups: product price, stock badge, teaser pill, offline banner
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics, G19/G22/G23 cross-browser/PWA
- [ ] Patch `scripts/backup-commit.ps1` (CRLF stderr handling)

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
