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

### Post-session hotfix — 2026-08-12 | Admin Users tab permission error
- **Bug:** Admin dashboard Users tab showed "Could not load users: Missing or insufficient permissions." — `firestore.rules` only allowed users to read their own `/users/{userId}` doc, but the Users tab lists the whole collection.
- **Fix part 1 (rules):** Added `isSignedIn()` / `isAdmin()` helpers to `firestore.rules` (admin = email in `/config/admin` doc, the same source `saveAdminEmails` writes); `/users/{userId}` read now allows `request.auth.uid == userId || isAdmin()`. Deployed via `firebase deploy --only firestore:rules` — compiled + released.
- **Fix part 2 (data):** Rules fix alone still failed because `/config/admin` emails held only `animasreflections@gmail.com` — the signed-in admin `mary.theadoor.doctor@gmail.com` was admin via the env hardcoded fallback only (see auth-context three-tier check: env email → @animasreflections.com domain → config/admin doc). Added her email to the managed list via Admin → Admins tab. Rules and client now agree.
- **Verified:** Users tab loads live — 2 users (Mary Doctor, Cindy Fuss) with order counts + last-seen dates.
- **NOTE (pre-existing, untouched):** `/orders` is readable by ANY signed-in user (`allow read: if request.auth != null`) — consider restricting to own orders + admins.

### Post-session follow-up — 2026-08-19 | Three deployed bug patches
- **Admin description editor list formatting** — `contentEditable` toolbar created `<ul>/<ol>` markup, but Tailwind preflight removed bullets/numbers inside the editor. Added `.desc-editor` CSS in `globals.css` mirroring `.rich-desc` (disc/decimal lists, bold/italic); applied class to the editor in `product-manager.tsx`. Verified via WebBridge: bullet list renders with `list-style: disc`.
- **Homepage skip-to-content link** — `src/app/page.tsx` imported `HeaderBar` directly and skipped `PageLayout`, so the skip link was missing on the homepage. Added skip link + `#main-content` wrapper directly in `page.tsx`.
- **`/orders` Firestore rules tightened** — changed from `allow read: if request.auth != null` (any signed-in user could read all orders) to `isAdmin() || request.auth.token.email == resource.data.customerEmail`. Account page already uses `fetchCustomerOrders` Cloud Function; admin dashboard queries directly and still works for admins.
- **Deployed:** `firebase deploy --only hosting,firestore:rules` — build 22 routes, rules compiled + released.
- **Live verified:** skip link present on homepage; admin Orders tab loads; editor list formatting confirmed locally.

---

## Session 16 — 2026-08-19 | Catalog architecture overhaul: Phase 1 (remove Square sync)

### Context Restored From
- DEVLOG Sessions 1–15; PRODUCT_MODIFIER_AUDIT.md (Phase 1 audit)
- User direction: Square is payment processor only — Firestore is the master catalog. Remove all sync, make options/modifiers/customer fields admin-configurable. Minimize hardcoded variables.

### Actions Taken
1. **Deleted Square sync code:**
   - Deleted `functions/src/sync.ts` (entire file — `syncProductsFromSquare`, `importFromSquare`, brand detection, color extraction, image download)
   - Deleted `functions/src/product-pipeline.ts` (entire file — `runProductPipeline`, base product/design/instance model)
   - Removed 9 Cloud Functions from `functions/src/index.ts`: `fetchSquareCatalog`, `syncProducts`, `importProducts`, `runPipeline`, `scheduledSync`, `fetchSyncStatus`, `fetchPipelineStatus`, `fetchInventoryCounts`, `clearProducts`
   - Removed `onSchedule` import (no more daily 4 AM cron)
   - Removed `cleanProductName`, `generateDescription`, catalog helper interfaces
2. **Removed sync UI from admin dashboard** (`src/app/admin/page.tsx`):
   - Deleted Catalog Sync section (Sync Now / Import / Pipeline / Clear All buttons + stats grid)
   - Removed `handleSync`, `handleImport`, `handleClear`, `handlePipeline`, `loadSyncStatus`
   - Removed `syncing`, `syncError`, `syncResult` state
   - File reduced from 1133 → 978 lines
3. **Cleaned up Firestore:**
   - Deleted orphaned config docs: `config/sync_status`, `config/import_status`, `config/pipeline_status`, `config/inventory_sync_status`
4. **Hardened Firestore rules:**
   - `products`, `categories`, `designs`, `config` write rules changed from `request.auth != null` (any signed-in user) to `isAdmin()`
   - Closes a real security gap where any authenticated customer could write products or overwrite site config
5. **Deployed everything:**
   - Deleted 9 old sync functions from Google Cloud via `firebase functions:delete`
   - Deployed 14 remaining functions (payment, orders, config, customer, addresses, profiles, tracking, health, `createSquareProduct`)
   - Deployed hardened Firestore rules
   - Deployed hosting (22 routes)
6. **Verified:** lint 0, tests 85/85, build 22 routes, functions compile clean, live site returns 200 on all key routes

### What Was Kept
- `createSquareOrderAndPay` (payment processing — the core reason Square stays)
- `fetchRecentOrders` (reads Square orders for admin dashboard)
- `createSquareProduct` (optional push to Square for catalog linkage — Cindy can push a Firestore product to Square if she wants it in the Square POS)
- `fetchCustomerOrders`, address/profile CRUD, `updateOrderTracking`, `fetchSiteConfig`, `saveSiteConfig`, `saveAdminEmails`, `health`

### Decisions Made
- Firestore is now the master catalog. No more sync from Square. Products are created/edited in the admin dashboard.
- The `scheduledSync` cron trigger is gone — no daily 4 AM pipeline.
- `createSquareProduct` stays as an optional one-way push (Firestore → Square) for POS catalog linkage.
- Rules now require `isAdmin()` for all catalog/config writes. Customers can only read public data and write their own profile/addresses.

### Files Changed
| File | Change |
|------|--------|
| functions/src/index.ts | Removed 9 sync functions, helpers, interfaces; kept payment/orders/config/customer functions |
| functions/src/sync.ts | **DELETED** |
| functions/src/product-pipeline.ts | **DELETED** |
| src/app/admin/page.tsx | Removed Catalog Sync UI section + handlers + state (155 lines removed) |
| firestore.rules | Write rules for products/categories/designs/config changed to `isAdmin()` |

### Commits This Session
| Hash | Message |
|------|---------|
| (pending at time of writing) | |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 22 routes | 14 Cloud Functions deployed
- `development` pushed to origin; deployed live (hosting + rules + functions)
- USE_SYNTHETIC = false; dev server running on :3000
- `_webbridge/` untracked (scratch tooling)

### Pending / Next Session
- [ ] Phase 2: Config-driven catalog defaults (colors, sizes, product types, add-on defaults, customer fields in SiteConfig)
- [ ] Phase 4: Add-on pricing model (fixed fee OR percentage)
- [ ] Phase 5: Configurable customer fields at checkout
- [ ] Phase 3: Dynamic product options schema (ProductOption/ProductModifier types, N-dimension matrix editor)
- [ ] Phase 6: Admin UI polish (visual photo picker, print zone editor, component split, category hierarchy)
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 17 — 2026-08-19 | Catalog architecture overhaul: Phase 2 (config-driven catalog options)

### Context Restored From
- DEVLOG Session 16 (Phase 1 complete — Square sync removed, Firestore is master catalog)
- PRODUCT_MODIFIER_AUDIT.md (Phase 1 audit identified hardcoded colors/sizes/addons/customer fields)
- User direction: make catalog options admin-configurable, minimize hardcoded variables, support dynamic product options

### Actions Taken
1. **Extended SiteConfig with catalog configuration:**
   - Added `catalog_options` (colors with hex tints, sizes, product types, custom option names)
   - Added `addon_defaults` (default price type, default price, standard add-ons list)
   - Added `customer_fields` (checkout field definitions with type/required/placeholder/Square mapping)
   - All fields have sensible FALLBACK defaults in `site-config-context.tsx`

2. **New type system (`src/types/index.ts`):**
   - `CatalogColor` (name + hex)
   - `CatalogProductType` (value + label)
   - `AddonPriceType` ("fixed" | "percentage")
   - `StandardAddon` (id, name, priceType, price)
   - `CustomerField` (id, label, type, required, placeholder, squareMapping)
   - `CatalogOptions` (colors, sizes, productTypes, customOptionNames)
   - `AddonDefaults` (defaultPriceType, defaultPrice, standardAddons)

3. **Migrated hardcoded constants to config-driven approach:**
   - `product-manager.tsx`: colors now read from `config.catalog_options.colors`, standard add-ons from `config.addon_defaults.standardAddons`
   - `variant-matrix-editor.tsx`: sizes/colors read from config with fallback to constants
   - `search-bar.tsx`: color filters read from config
   - `constants.ts`: marked as FALLBACK ONLY (kept for backward compatibility)

4. **Comprehensive admin UI for catalog options (`src/app/admin/page.tsx`):**
   - Colors manager: add/remove/reorder colors with name + hex tint, live preview
   - Sizes manager: add/remove/reorder size values
   - Product types manager: add/remove type values with display labels
   - Custom options manager: add/remove custom option type names (e.g., "Wood Type", "Grommet Count")
   - Standard add-ons editor: configure default add-ons (name, price type, price)
   - Customer fields editor: add/remove/reorder checkout fields, set required, type, Square mapping
   - All changes save via existing "Save Theme" button (writes to `config/site` in Firestore)

5. **Seed script (`scripts/seed-config.ts`):**
   - TypeScript script to initialize Firestore `config/site` with defaults
   - Requires Firebase service account credentials (not run locally — config will be populated when admin saves from UI)

6. **Verification:**
   - Lint: 0 errors (fixed unescaped quotes in JSX, removed unused imports)
   - Tests: 85/85 pass (9 suites)
   - Build: 22 routes, TypeScript clean
   - Deployed to Firebase hosting

### Decisions Made
- **Config-driven, not code-driven:** All catalog options (colors, sizes, product types, add-ons, customer fields) are now editable from the admin UI without code changes
- **Backward compatible:** Existing products continue to work — the FALLBACK defaults in SiteConfig provide immediate values until admin saves
- **No migration needed:** Old products with hardcoded colors/add-ons will continue to render; new products will use config-driven options
- **Seed script deferred:** Config will be populated when admin opens Settings and clicks "Save Theme" (writes full config including new fields to Firestore)

### Files Changed
| File | Change |
|------|--------|
| src/types/index.ts | Added CatalogColor, CatalogProductType, AddonPriceType, StandardAddon, CustomerField, CatalogOptions, AddonDefaults |
| src/context/site-config-context.tsx | Extended SiteConfig with catalog_options, addon_defaults, customer_fields + FALLBACK defaults |
| src/lib/constants.ts | Marked as FALLBACK ONLY (kept for backward compatibility) |
| src/components/admin/product-manager.tsx | Colors + standard add-ons read from config |
| src/components/admin/variant-matrix-editor.tsx | Sizes/colors read from config with fallback |
| src/components/search/search-bar.tsx | Color filters read from config |
| src/app/admin/page.tsx | Added comprehensive catalog options UI (colors, sizes, types, custom options, add-ons, customer fields) |
| scripts/seed-config.ts | NEW — Firestore initialization script (requires service account) |

### Commits This Session
| Hash | Message |
|------|---------|
| `b7760f8` | feat: Phase 2 - config-driven catalog options, admin UI, and type system |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 22 routes | 14 Cloud Functions deployed
- `development` pushed to origin; deployed live (hosting)
- USE_SYNTHETIC = false; dev server running on :3000
- Config will be populated when admin saves from Settings page

### Pending / Next Session
- [ ] Phase 4: Add-on pricing model (fixed fee OR percentage) — partially done (types exist, UI needs work)
- [ ] Phase 5: Configurable customer fields at checkout (types exist, checkout page needs update)
- [ ] Phase 6: Admin UI polish (visual photo picker, print zone editor, component split, category hierarchy)
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 18 — 2026-08-19 | Catalog architecture overhaul: Phase 3 (dynamic product options + modifiers)

### Context Restored From
- DEVLOG Session 17 (Phase 2 complete — config-driven catalog options)
- PRODUCT_MODIFIER_AUDIT.md (Phase 3 scope: ProductOption/ProductModifier types, N-dimension matrix editor)

### Actions Taken
1. **New type system (`src/types/index.ts`):**
   - `ProductOption` — a variant-defining dimension (Size, Color, Material, etc.) with `type` (select/color/text), `values`, `required`
   - `ProductModifier` — an add-on with `priceType` (fixed/percentage), `price`, `inputType` (toggle/text/file), `inputLabel`
   - `SelectedOption` / `ModifierInput` — customer's choices/inputs captured on cart lines
   - `ManagedVariant.options?: Record<string, string>` — structured option values that define the variant
   - `ManagedProduct.options?: ProductOption[]` — product-defined variant dimensions
   - `ManagedProduct.modifiers?: ProductModifier[]` — takes precedence over legacy `productAddons`
   - `CartItem.selectedOptions?` / `CartItem.modifierInputs?` — captured for order fulfillment

2. **Generalized variant-matrix-editor (`src/components/admin/variant-matrix-editor.tsx`):**
   - Now accepts an optional `options` prop (product-defined dimensions)
   - Builds the matrix from N dimensions instead of hardcoded Size × Color
   - Handles 0/1/2+ dimensions (no dimensions → manual entry; 1 dimension → single-select list; 2+ → matrix with extra dimensions noted)
   - Variants now carry structured `options` map; falls back to parsing legacy "A / B" names

3. **Admin product editor UI (`src/components/admin/product-manager.tsx`):**
   - New "Product Options" section — add/remove/reorder option dimensions (name, type, values, required flag)
   - New "Modifiers" section — add/remove modifiers (name, priceType, price, inputType, inputLabel)
   - VariantMatrixEditor now receives `form.options` so the matrix reflects product-defined dimensions

4. **Customer-facing integration:**
   - **Customizer** (`src/app/customizer/page.tsx`): three-state modifier resolution; modifier UI with text/file inputs (FileUpload for file modifiers); percentage pricing resolved against base price; captures `selectedOptions` + `modifierInputs` on add-to-cart
   - **Product page** (`src/app/product/page.tsx`): showPersonalization checks modifiers; captures personalization text as a modifier input; captures selectedOptions on add-to-cart
   - **Checkout** (`src/app/checkout/page.tsx`): order note includes selectedOptions + modifierInputs for fulfillment
   - **Cart drawer** (`src/components/cart/cart-drawer.tsx`): renders selectedOptions + modifierInputs; addon badges keyed by addon_id (supports arbitrary modifier ids)

5. **Verification:**
   - Lint: 0 errors (only 1 warning from a backup copy)
   - Tests: 85/85 pass (9 suites)
   - Build: 22 routes, TypeScript clean
   - Deployed to Firebase hosting

### Decisions Made
- **Backward compatible:** Products without `options`/`modifiers` continue to work via the legacy path (site-standard sizes/colors and productAddons)
- **Modifiers take precedence** over legacy productAddons when both are configured
- **Percentage modifiers** resolve against the variant's base price at add-to-cart time (stored as resolved dollar amount on the cart line)
- **Order fulfillment** captures selectedOptions + modifierInputs in the order note (visible in admin Orders tab)

### Files Changed
| File | Change |
|------|--------|
| src/types/index.ts | Added ProductOption, ProductModifier, SelectedOption, ModifierInput; extended ManagedVariant/ManagedProduct/CartItem |
| src/components/admin/variant-matrix-editor.tsx | Generalized to N dimensions; accepts options prop; structured variant options |
| src/components/admin/product-manager.tsx | Product Options + Modifiers editor sections; passes options to matrix editor |
| src/app/customizer/page.tsx | Modifier resolution, modifier UI with text/file inputs, percentage pricing, captures selectedOptions/modifierInputs |
| src/app/product/page.tsx | showPersonalization checks modifiers; captures modifierInputs + selectedOptions |
| src/app/checkout/page.tsx | Order note includes selectedOptions + modifierInputs |
| src/components/cart/cart-drawer.tsx | Renders selectedOptions + modifierInputs; addon badges keyed by addon_id |

### Commits This Session
| Hash | Message |
|------|---------|
| `61a7644` | feat: Phase 3 - dynamic product options + modifiers schema, N-dimension matrix editor, admin UI, customer-facing integration |

### Current State at Session End
- Lint 0 | Tests 85/85 (9 suites) | Build 22 routes | 14 Cloud Functions deployed
- `development` pushed to origin; deployed live (hosting)
- USE_SYNTHETIC = false; dev server needs restart
- Existing products unaffected — new options/modifiers are opt-in per product

### Pending / Next Session
- [ ] Phase 4: Add-on pricing model (fixed fee OR percentage) — types exist; need to wire percentage resolution through cart context TOGGLE_ADDON + site defaults UI
- [ ] Phase 5: Configurable customer fields at checkout (types exist; checkout page needs dynamic render)
- [ ] Phase 6: Admin UI polish (visual photo picker, print zone editor, component split, category hierarchy)
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 19 — 2026-08-19 | Catalog architecture overhaul: Phases 4 + 5 (percentage pricing + dynamic customer fields)

### Context Restored From
- DEVLOG Sessions 17–18 (config-driven catalog options + dynamic product options/modifiers)
- PRODUCT_MODIFIER_AUDIT.md (Phases 4–5 scope)

### Actions Taken
1. **Phase 4 — percentage add-on pricing wired end-to-end:**
   - `CartAddon` gains `priceType?: AddonPriceType`; new `resolveAddonPrice(addon, basePrice)` helper in `src/types/index.ts` resolves percentage add-ons against the line's base price
   - `cart-context.tsx`: `addonsTotal` now resolves via `resolveAddonPrice`; `TOGGLE_ADDON` reducer no longer hardcodes labels (accepts `addonLabel` + `priceType`); `toggleAddon` signature extended
   - `customizer/page.tsx`: stores raw price + `priceType` on the cart addon (cart is the source of truth for resolution)
   - `cart-drawer.tsx` + `checkout/page.tsx`: addon display/Square payload resolve percentage via `resolveAddonPrice`
   - Added 4 tests (custom label/priceType on toggle, resolveAddonPrice fixed/percentage/default) — 89/89 pass

2. **Phase 5 — dynamic customer fields at checkout:**
   - Checkout now renders the shipping form from `siteConfig.customer_fields` (admin-managed), with a `FALLBACK_CUSTOMER_FIELDS` matching the traditional form for backward compat
   - Supports text/email/tel/select inputs, required flags, and email format validation
   - Customer payload is built by mapping each field's value into the backend's nested shape via its `squareMapping` path (`setNestedPath` helper)
   - Standardized `squareMapping` convention to backend-customer paths (`firstName`, `lastName`, `email`, `phone`, `address.addressLine1`, etc.) across `site-config-context.tsx`, `admin/page.tsx` DEFAULT_CONFIG, and `seed-config.ts`; added `lastName` mapping

3. **Verification:**
   - Lint: 0 errors (live files; only 1 warning from a backup copy)
   - Tests: 89/89 pass (9 suites)
   - Build: 22 routes, TypeScript clean
   - Deployed to Firebase hosting

### Decisions Made
- **Percentage resolution happens in the cart**, not at display time — `resolveAddonPrice` is the single source of truth, so cart drawer, checkout, and Square payload all agree
- **Backend `createSquareOrderAndPay` unchanged** — the checkout maps dynamic fields into the existing customer shape via `squareMapping`, keeping the payment function stable
- **squareMapping convention** = paths into the backend customer object (not Square `recipient.*`), so admins can remap fields from the Settings UI without code changes

### Files Changed
| File | Change |
|------|--------|
| src/types/index.ts | CartAddon.priceType; resolveAddonPrice helper; CheckoutAddon doc |
| src/context/cart-context.tsx | percentage-aware addonsTotal; de-hardcoded TOGGLE_ADDON; extended toggleAddon |
| src/context/__tests__/cart.test.ts | updated reducer shape + 4 new percentage/label tests |
| src/app/customizer/page.tsx | store raw price + priceType on cart addons |
| src/components/cart/cart-drawer.tsx | resolve percentage for display |
| src/app/checkout/page.tsx | dynamic customer form from config; buildCustomerPayload via squareMapping |
| src/context/site-config-context.tsx | squareMapping convention update + lastName mapping |
| src/app/admin/page.tsx | DEFAULT_CONFIG squareMapping convention update |
| scripts/seed-config.ts | squareMapping convention update |

### Commits This Session
| Hash | Message |
|------|---------|
| `9e97b3f` | feat: Phases 4+5 - percentage add-on pricing end-to-end + dynamic customer fields at checkout |

### Current State at Session End
- Lint 0 | Tests 89/89 (9 suites) | Build 22 routes | 14 Cloud Functions deployed
- `development` pushed to origin; deployed live (hosting)
- USE_SYNTHETIC = false; dev server needs restart

### Pending / Next Session
- [ ] Phase 6: Admin UI polish (print zone editor, visual photo picker, category hierarchy, component split)
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 20 — 2026-08-19 | Catalog architecture overhaul: Phase 6 (admin polish)

### Context Restored From
- DEVLOG Sessions 17–19 (config-driven catalog, dynamic options/modifiers, percentage pricing, dynamic customer fields)
- PRODUCT_MODIFIER_AUDIT.md (Phase 6 scope: print zone editor, visual photo picker, category hierarchy, component split)

### Actions Taken
1. **Print Zone Editor** (`src/components/admin/product-manager.tsx`):
   - New section lets the admin define the printable area per view (front/back/sleeve/sideL/sideR) as X/Y/W/H percentages
   - Writes to `form.printZones` (previously only editable by direct Firestore writes); blank views fall back to the customizer's default zone; per-view "reset" clears back to default

2. **Visual Photo Picker** for per-color mockups:
   - Replaced the `gallery…/img 1/img 2` dropdowns with clickable image thumbnails — clicking a thumbnail assigns that gallery image to the color+view; the active photo is highlighted with a gold ring

3. **Category Hierarchy** (`parentId` on `ManagedCategory`):
   - `src/types/index.ts`: added optional `parentId` to `ManagedCategory`
   - `src/components/admin/category-manager.tsx`: parent selector on add + edit, indented display + "under <parent>" badge for subcategories, self-reference prevented when editing
   - Flat categories continue to work unchanged (parentId omitted)

4. **Deferred (Phase 6 remainder):** splitting the 1,600-line `product-manager.tsx` into smaller components and the brand collection. The component split is a large refactor with no user-facing behavior change; deferred to keep this change shippable and low-risk.

5. **Verification:**
   - Lint: 0 errors, 0 warnings (live files)
   - Tests: 89/89 pass (9 suites)
   - Build: 22 routes, TypeScript clean
   - Deployed to Firebase hosting

### Decisions Made
- **Print zones are now admin-editable** — closes the long-standing gap where `printZones` existed in the schema but had no admin UI
- **Category hierarchy is opt-in** — existing flat categories are unaffected; subcategories are created by choosing a parent
- **Component split deferred** — high effort, no user-facing benefit this iteration; noted as future cleanup

### Files Changed
| File | Change |
|------|--------|
| src/components/admin/product-manager.tsx | Print Zone Editor section; visual thumbnail photo picker for per-color mockups |
| src/components/admin/category-manager.tsx | Parent selector on add/edit; indented subcategory display; self-ref guard |
| src/types/index.ts | ManagedCategory.parentId |

### Commits This Session
| Hash | Message |
|------|---------|
| `c6c0143` | feat: Phase 6 - admin polish: print zone editor, visual per-color photo picker, category hierarchy |

### Current State at Session End
- Lint 0 | Tests 89/89 (9 suites) | Build 22 routes | 14 Cloud Functions deployed
- `development` pushed to origin; deployed live (hosting)
- USE_SYNTHETIC = false; dev server needs restart

### Pending / Next Session
- [ ] Split product-manager.tsx into smaller components (deferred refactor)
- [ ] Brand collection / taxonomy (needs Cindy's answer on "Biscuit Hockey")
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 21 — 2026-08-21 | Color-image rework + full product data-linkage audit

### Context Restored From
- Cindy feedback: product page wasn't showing the matching image when selecting colors; the tint overlay on admin thumbnails was unwanted complexity
- Requested: tag gallery images to colors, show the matching image when a color is selected

### Actions Taken
1. **Color-image rework:**
   - Product page: main image now responds to color selection — `mockupImagesByColor[color].front` → `colorThumbnails[color]` → `mockupImages.front` → `images[0]`
   - Admin: removed the tint overlay preview (multiply blend) and the redundant separate `colorThumbnails` upload; renamed "Color Tints" → "Color Images"; per-color image picker now drives the product page directly
2. **Full product data-linkage audit** (admin write path × customer read path):
   - **Dead code removed:** Square fallback in `useCatalog` (called the deleted `fetchSquareCatalog`); `baseProductId` type field (pipeline-only, pipeline deleted in Phase 1)
   - **Fields wired to UI:** `seoTitle`/`seoDescription` (new admin inputs; drive h1 + Product JSON-LD), `weightOz` (new admin input)
   - **Broken UI fixed:** `variant.customFields` "+Attrs" added empty entries with no way to type key/value — now proper key/value inputs with remove
   - **Consistency:** description stripping unified on `stripTags` (product page, JSON-LD, product-detail modal); product page image priority aligned with the customizer (`mockupImages.front` honored)
3. **Verification:** lint 0 (live files), tests 89/89, build 22 routes, deployed to hosting

### Files Changed
| File | Change |
|------|--------|
| src/app/product/page.tsx | color-specific image; seoTitle/seoDescription in h1 + JSON-LD; stripTags; image priority chain |
| src/components/admin/product-manager.tsx | removed tint overlay + colorThumbnails upload; renamed section; SEO/weight inputs; variant customFields key/value editor |
| src/components/product/product-detail.tsx | stripTags for description |
| src/hooks/useCatalog.ts | removed dead Square fallback; clean empty-catalog handling |
| src/types/index.ts | removed dead baseProductId |

### Commits This Session
| Hash | Message |
|------|---------|
| `6ccdc16` | fix: product page shows color-specific image; remove tint overlay from admin |
| `acf6aab` | fix: full product data-linkage audit — wire all fields to UI, remove dead code |

### Current State at Session End
- Lint 0 | Tests 89/89 (9 suites) | Build 22 routes
- `development` pushed to origin; deployed live (hosting)
- USE_SYNTHETIC = false

### Pending / Next Session
- [ ] Split product-manager.tsx into smaller components (deferred refactor)
- [ ] Brand collection / taxonomy (needs Cindy's answer on "Biscuit Hockey")
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 22 — 2026-08-21 | Context refresh prep (session close)

### Actions Taken
1. Verified working tree clean; `development` in sync with origin; `master` 17 commits behind (merge pending user approval — see PROJECT_CONTEXT §11.6)
2. Updated `PROJECT_CONTEXT.md` recovery blueprint:
   - §6 functions: 23 → 14 (removed deleted Square-sync functions; added DELETED list)
   - §8 known issues: marked #1–3 obsolete (Square sync removed); revised #12/#18 (color system rework); added #22–28 (Firestore master catalog, config in config/site, modifiers, dynamic customer fields, branch state, WebBridge checkout note, session-log discipline)
   - §10: added "Catalog Architecture Overhaul" summary (Phases 1–6 + color-image rework + data-linkage audit)
   - §11: refreshed counts (tests 89/89), master-merge gate, new discipline items
   - §12: removed obsolete "restoring Square" note
   - Header date → 2026-08-21
3. Ran `npm run backup:snapshot` full-project snapshot (see Snapshots)

### Current State at Session End
- Lint 0 | Tests 89/89 (9 suites) | Build 22 routes | 14 Cloud Functions
- Working tree: clean | Branch: `development` = origin/development
- Deployed live: hosting (all Phases 1–6 + color-image rework + data-linkage fixes)
- USE_SYNTHETIC = false
- Context files current: PROJECT_CONTEXT.md + DEVLOG.md (Sessions 1–22)

### Pending / Next Session
- [ ] Split product-manager.tsx into smaller components (deferred refactor)
- [ ] Brand collection / taxonomy (needs Cindy's answer on "Biscuit Hockey")
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?
- [ ] Carry-over: G2 live checkout test, G15 Lighthouse, G20 DNS cutover, G21 analytics

---

## Session 23 — 2026-08-21 17:15 EDT | Security batch 1: server-side pricing + admin auth

### Context Restored From
- Consolidated 3-area code analysis (admin product management, public display, checkout) — 40+ findings in 4 batches
- Batch plan: B1 security → B2 customer-facing bugs → B3 admin UX/data → B4 efficiency

### Actions Taken
1. **C1 — Admin callables authenticated** (`functions/src/index.ts`): new `requireAdmin()` helper (config/admin doc + @animasreflections.com domain + `BOOTSTRAP_ADMIN_EMAIL` param) applied to saveSiteConfig, saveAdminEmails, fetchRecentOrders, createSquareProduct, updateOrderTracking (was logged-in-only). `saveAdminEmails` normalizes emails to lowercase so every admin check compares the same shape.
2. **C1 — firestore.rules**: split `config/{document=**}` into `config/site` (public read), `config/admin` (admin-only read+write), catch-all; `isAdmin()` now case-insensitive with legacy-doc tolerance.
3. **C2 — Server-side price derivation**: new pure module `functions/src/pricing.ts` (`deriveOrder`, integer-cents math). `createSquareOrderAndPay` re-derives every price, add-on, and the shipping amount from Firestore (products + config/site), compares the client's `expectedTotal` (±2¢, reject on divergence), and charges the server-computed amount. Client-sent prices/shipping are never trusted.
4. **C3 — Add-ons actually charged**: the client's `addons` array is now accepted; each add-on becomes an ad-hoc Square line item at server-resolved cents (modifiers → legacy productAddons → site standardAddons). The Firestore mirror now includes add-on line items and a real `subtotal` (was hardcoded 0).
5. **C3 client**: checkout sends `product_id`, `addon_id`, `priceType`, `expectedTotal`. Product page attaches the personalization add-on to the cart line when a name/number is entered (was free — revenue leak).
6. **C4 — storage.rules**: `products/**` + `designs/**` writes admin-only (was any authenticated user); `uploads/{uid}/**` reads restricted to owner + admin.
7. **M5 folded in**: backend tolerates customer payloads without address fields instead of throwing on every submission.
8. **Tests**: +23 → 112/112 (10 suites). New `server-pricing.test.ts` covers derivation, tamper rejection, legacy/standard add-ons, and shipping tiers; line-items tests updated to the new payload shape.

### Decisions Made
- Catalog-linked variants (squareVariationId) keep Square's catalog path; drift vs Firestore prices is logged, not blocked (existing behavior — tracked as M10).
- Zero-priced variants accept the client's $20 fallback (mirrors the customizer's BASE_PRICE_FALLBACK); nothing is gained by tampering.
- All validation failures throw `HttpsError` so the client gets proper codes.

### Files Changed
| File | Change |
|------|--------|
| functions/src/pricing.ts | NEW — pure deriveOrder (catalog-derived prices/add-ons/shipping, cents math) |
| functions/src/index.ts | requireAdmin on 5 admin callables; createSquareOrderAndPay rewritten around deriveOrder; real subtotal + add-on items in mirror; email normalization |
| firestore.rules | config/admin private read; case-insensitive isAdmin |
| storage.rules | admin-only product/design writes; owner-scoped uploads reads |
| src/app/checkout/page.tsx | payload: product_id, addon_id, priceType, expectedTotal |
| src/app/product/page.tsx | personalization add-on attached to cart line when text entered |
| src/app/checkout/__tests__/line-items.test.ts | updated to new payload shape |
| src/app/checkout/__tests__/server-pricing.test.ts | NEW — 23 derivation/tamper/shipping tests |

### Commits This Session
| Hash | Message |
|------|---------|
| `8acfb93` | feat: batch 1 security — server-side pricing derivation, admin auth guards, hardened rules |
| `669a7c1` | feat: batches 2-4 — customer-facing fixes, admin data safety, efficiency |

### Batches 2–4 (continued in the same session)
9. **B2 display path:** product page resets selection state on `productId` change (dead $0.00 button + color/text leak); `variants`/`colors` access guarded on the product page and cards ($NaN guard); customizer generates a fresh cart-item UUID per add; JSON-LD escapes `<` everywhere and derives `availability` from variant inventory; search color filter is OR not AND; `/search?q=` seeds the search form.
10. **B2 filters in URL:** shop/search now read initial filter state from the query string and write it back (debounced) — filtered views are shareable and the `WebSite` SearchAction target finally works.
11. **B2 sanitizer:** `sanitizeHTML` uses DOMPurify in the browser (real sanitization), with a hardened regex fallback for prerender/tests. New dependency: `dompurify@^3.4.14`.
12. **B2 catalog provider:** new `src/context/catalog-context.tsx` (mounted in client-layout) — one Firestore read per session, shared loading/error/refresh; `useCatalog` re-exports from it with the same signature. Error + retry states wired on search, product, and home featured sections.
13. **B2 orders:** `customerEmailLower` stored on new orders; `fetchCustomerOrders` matches the normalized key plus a legacy exact-case query (merged, sorted client-side); orders read rule accepts the lowercase match; checkout surfaces mirror-write failures on the confirmation page; idempotency key now fingerprints cart contents (was total-only); empty-cart shipping is 0.
14. **B3 category manager:** reorder/save wrapped in `stripUndefined` (top-level categories no longer crash); error banner; unique slugs; parent selectors exclude the whole descendant subtree (no cycles); delete blocked while subcategories or products remain.
15. **B3 admin dashboard:** product/category editors stay mounted (hidden) across tab switches — no more silent loss of in-progress edits; `admin-categories-changed` event keeps all three category consumers in sync; admin email add/remove awaits the server and alerts on failure.
16. **B3 product manager:** dead "Sync from Square"/"Sync Inventory" controls removed (backing functions deleted in Phase 1); delete/bulk-delete skip Storage files still referenced by another product (duplicated products share files safely); bulk delete continues on error with a summary.
17. **B3 variant matrix:** extra dimensions (3+) get value dropdowns — the 2-D grid shows one combination at a time instead of baking empty strings into the variant options map.
18. **B4:** admin Orders tab bounds the mirror read (orderBy createdAt desc, limit 200); removed dead `shippingTier` reducer state and the unused `product-detail.tsx`.

### Current State at Session End
- Lint 0 errors (live files) | Tests 113/113 (10 suites) | Functions tsc clean | Build 22 routes
- Deployed live: hosting + all 14 functions + firestore rules (batches 1–4)
- Branch: `development` @ 669a7c1
- USE_SYNTHETIC = false
- New client dependency: dompurify (sanitizer)

### Pending / Next Session
- [ ] G2 live checkout smoke test (add-ons as line items, total matches UI)
- [ ] Backlog: Square webhooks/refunds (M11), tax handling, promo codes, guest→account `customerUid` linking, image resizing pipeline, product-manager component split, admin full-collection re-reads, `createSquareProduct` mapping-gap guard, legacy `colorThumbnails` admin UI, "Heather Grey" default tint
- [ ] Ask Cindy: "Biscuit Hockey" — brand or category?

---

## Session 24 — 2026-08-24 01:15 EDT | Docs refresh finish + build-environment investigation

### Context Restored From
- Parallel instance crashed mid-session; recovered from `git status` + commits `3bb1e4a`/`85b7fbc` (docs refresh for Firestore-master catalog + 14 functions)
- Uncommitted: docs edits (.env.example, README, ARCHITECTURE, BUSINESS_MODEL, MASTER, MASTER_SPEC_OUTLINE, PROJECT_STATUS_REPORT, SCOPE) + `src/components/ui/debug-panel.tsx` deletion
- DEVLOG Sessions 1–23, PROJECT_CONTEXT.md

### Actions Taken
1. **Finished the docs refresh:** fixed `docs/MASTER.md` tree line (`DebugPanel` → `AdminTooltip` — component deleted); updated `docs/PRODUCT_MODIFIER_AUDIT.md` (item 9 resolved by Phase 1 removal; backend files list). Verified all remaining mentions of removed functions across docs are intentional "removed in Phase 1" notes.
2. **Killed orphaned dev server** left by the crashed instance (npm→next chain PIDs 19312/16404/5028 holding port 3000 and `.next`).
3. **Build failure investigation:** `next build` (output: "export") died prerendering `/_global-error` with `Invariant: Expected workStore to be initialized` (E1068 — metadata resolution reads the request store). Proved it is **not a code problem**: an identical minimal Next app builds green in Temp / `next-min-home` / `projects2` / `sub\projects`, but fails deterministically in ANY subdir of `C:\Users\AmosA\projects\` — including the real repo stripped to a stub page. Ruled out: src changes (none since 669a7c1), lockfile drift (`npm ci` from committed lockfiles), Next 16.2.7 vs 16.3.2, a custom `global-error.tsx`, the extra `S-1-4-221205482-876100782` ACE on `projects\` (unremovable without elevation; clean-ACL dir still fails), NTFS compression, per-dir case sensitivity, Controlled Folder Access (off), sync clients, zombie processes, shell (cmd vs bash).
4. **Workaround (in use): mirror build.** Project copied to `C:\Users\AmosA\build\animas-mirror` (excludes node_modules/.next/.git/out/_backups); `npm ci && npm run build` there → **22/22 static pages, exit 0**; `out/` copied back. Functions `tsc` build also green.
5. Reverted a trial upgrade `next@16.3.2` → back to pinned 16.2.7 (upgrade did not fix the build).

### Decisions Made
- Keep `next` pinned at 16.2.7 (matches lockfile).
- Keep the diff scoped to the docs refresh; dropped the experimental custom `global-error.tsx`.
- Production verification runs via the mirror build until the `projects\` location failure is root-caused.

### Files Changed
| File | Change |
|------|--------|
| docs/MASTER.md | DebugPanel → AdminTooltip in tree; (session) Firestore-master + 14-function refresh |
| docs/PRODUCT_MODIFIER_AUDIT.md | Item 9 resolved-by-Phase-1 note; backend files list |
| docs/ARCHITECTURE.md, BUSINESS_MODEL.md, MASTER_SPEC_OUTLINE.md, PROJECT_STATUS_REPORT.md, SCOPE.md, README.md, .env.example | Phase 1 catalog-sync removal refresh (from crashed instance) |
| src/components/ui/debug-panel.tsx | DELETED (dead code, backing functions removed in Phase 1) |
| out/ | Regenerated via mirror build — 22 static pages |

### Commits This Session
| Hash | Message |
|------|---------|
| — | (pending user confirmation) |

### Current State at Session End
- Lint 0 errors | Tests 113/113 (10 suites) | Mirror build 22/22 | Functions tsc clean
- Branch: `development` @ 3bb1e4a; working tree = docs refresh (dirty)
- USE_SYNTHETIC = false
- Live deploy: unchanged from session 23 (Phases 1–6)

### Pending / Next Session
- [ ] Commit the docs-refresh session (needs user confirmation)
- [ ] Root-cause the `C:\Users\AmosA\projects\` build failure (suspects: Windows update/Defender behavior, the unremovable `S-1-4-…` ACE, or move the repo out of `projects\`)
- [ ] Carry-over: G2 live checkout smoke test, Square webhooks (M11), "Biscuit Hockey" question for Cindy

---

## Session 25 — 2026-08-25 11:54 -04:00 | Dead-code cleanup + dependency audit fix

### Context Restored From
- Active goal: address all current known issues (fixing bugs + implementation)
- Prior sweep surfaced dead code (`getCatalogItemImageUrl`, `managedToCatalogItem` + `catalog.test.ts`) and npm audit findings (8 frontend / 15 functions vulns)

### Actions Taken
1. **Dead-code cleanup:** removed `managedToCatalogItem` and `getCatalogItemImageUrl` from `src/hooks/useCatalog.ts` (deprecated `SquareCatalogItem` bridge — nothing imports either; the converter direction became obsolete once Firestore became the master catalog). Kept `getProductImageUrl` (still used by product-card/product/customizer). Deleted `src/hooks/__tests__/catalog.test.ts` (it tested an inline copy of the removed converter).
2. **Dependency audit fix (non-breaking):** `npm audit fix` in root + functions. Frontend 8 → 3 vulns (the 3 remaining all require the blocked `next@16.3.x` upgrade); functions 15 → 9 (8 moderate + 1 high, all gated on the blocked `firebase-admin@14` upgrade). The critical `websocket-driver` was resolved in both. `next` stayed pinned at 16.2.7 and `firebase-admin` at 13.10.0 (verified).
3. **Created `animas-reflections-dev` skill** at `~/.agents/skills/` (deploy runbook + do-not-repeat gotchas) — auto-discovered live by the harness skill watcher.

### Files Changed
| File | Change |
|------|--------|
| src/hooks/useCatalog.ts | removed dead `managedToCatalogItem` + `getCatalogItemImageUrl` |
| src/hooks/__tests__/catalog.test.ts | DELETED (tested the removed converter's inline copy) |
| package-lock.json | non-breaking audit fix |
| functions/package-lock.json | non-breaking audit fix |
| PROJECT_CONTEXT.md | test gate 113/113 → 107/107 |

### Commits This Session
| Hash | Message |
|------|---------|
| — | (this session) |

### Current State at Session End
- Lint 0 errors | Tests 107/107 (9 suites) | Build 22/22 | Functions tsc clean
- Branch: `development` (this session's changes pending commit)
- USE_SYNTHETIC = false
- npm audit: frontend 3 high (gated on next upgrade), functions 9 (gated on firebase-admin upgrade)

### Pending / Next Session
- [ ] G2 live checkout smoke test
- [ ] `next@16.3.x` upgrade (unblocks 3 frontend vulns) — blocked by Session 24 build-location investigation
- [ ] `firebase-admin@14` upgrade (unblocks functions uuid chain)
- [ ] `master` merge (24 commits behind)
- [ ] Root-cause `C:\Users\AmosA\projects\` build failure

---

## Session 26 — 2026-08-25 12:05 -04:00 | Remove deprecated SquareCatalogItem + fix stale customizer test

### Actions Taken
1. **Removed `SquareCatalogItem` + `SquareVariation`** from `src/types/index.ts` (deprecated bridge types — Square is payment-only since Phase 1; nothing consumed them after the round-1 converter removal).
2. **Migrated `src/lib/synthetic-data.ts`** from `SquareCatalogItem[]` to `ManagedProduct[]` (24 products; inferred `productType` — 18 apparel / sticker / jewelry / sign / 3 accessory; added required `active`/`featured`/`createdAt`/`updatedAt`/`images`/`colors`/`tags`).
3. **Simplified `catalog-context.tsx`** synthetic branch — SYNTHETIC_PRODUCTS is now consumed directly (inline conversion deleted).
4. **Fixed `views.test.ts`** — its inline `getProductViews`/`getPrintZone` copies had drifted from `customizer/page.tsx` (still `SquareCatalogItem`, used `image_url`, missed the `sideL`/`sideR` views + the "sleeve for apparel" rule). Rewrote to mirror production `ManagedProduct` logic; updated expectations (null product now yields only the front view).

### Files Changed
| File | Change |
|------|--------|
| src/types/index.ts | removed SquareCatalogItem + SquareVariation |
| src/lib/synthetic-data.ts | migrated to ManagedProduct[] |
| src/context/catalog-context.tsx | synthetic branch uses data directly |
| src/app/customizer/__tests__/views.test.ts | fixed stale inline copies to match production |

### Current State at Session End
- Lint 0 errors | Tests 109/109 (9 suites) | Build 22/22 | Functions tsc clean (unchanged this round)
- Branch: `development` (this round's changes pending commit)
- USE_SYNTHETIC = false

---

## Session 27 — 2026-08-25 12:11 -04:00 | Payment-path audit + createSquareProduct mapping-gap fix

### Actions Taken
1. **G2 blocker identified:** Square is in PRODUCTION mode (`SQUARE_ENVIRONMENT=production` in functions/.env and `NEXT_PUBLIC_SQUARE_ENVIRONMENT=production` in .env.local). A live checkout smoke test would place a real charge — deferred until the client runs it or a sandbox config is approved.
2. **Shipping/pricing consistency verified (static audit):** compared client (cart-context + site-config FALLBACK) vs server (pricing.ts deriveOrder). Defaults ($3 sticker / $7.5 apparel / $100 free threshold), the all-stickers-vs-apparel tier selection, the per-product shippingRate max, and the free-shipping threshold comparison all MATCH — no expectedTotal-divergence bug found.
3. **Fixed createSquareProduct mapping-gap guard (bug):** the variation loop wrote `squareVariationId: tempToReal.get(#var_i) ?? String(v.id)`, falling back to the MANAGED variant id when Square returned no mapping. A bogus squareVariationId makes checkout set `catalogPath=true` and charge via a non-existent Square variation. Changed the fallback to "" so unmapped variants stay on the ad-hoc, server-priced path.

### Files Changed
| File | Change |
|------|--------|
| functions/src/index.ts | createSquareProduct: squareVariationId fallback → "" (no managed-id fallback) |

### Current State at Session End
- Lint 0 | Tests 109/109 (9 suites) | Build 22/22 | Functions tsc clean
- Square: PRODUCTION — G2 needs a client-driven test or sandbox switch

---

## Session 28 — 2026-08-25 12:16 -04:00 | Color-swatch catalog-hex fallback + stripUndefined coverage audit

### Actions Taken
1. **Fixed "Heather Grey default tint" (bug):** the product-page color swatch used `product.colorTints?.[color]` with a fallback to `#cccccc` for named colors. Named colors (e.g. "Heather Grey") whose hex lives in the admin `catalog_options.colors` now fall back to that catalog hex before the generic gray.
2. **Verified stripUndefined coverage (Known Issue #10):** audited every Firestore write in `src/`. Unwrapped writes (auth-context user doc, category create, image-manager, designs migration) are all safe — they write `null` or clean Firestore-read data, never `undefined`. No remaining undefined-rejection gap found.

### Files Changed
| File | Change |
|------|--------|
| src/app/product/page.tsx | color swatch falls back to catalog_options.colors hex |

### Current State at Session End
- Lint 0 | Tests 109/109 (9 suites) | Build 22/22 | Functions tsc clean
- Square: PRODUCTION (G2 deferred); createSquareProduct fix still pending deploy

---

## Session 29 — 2026-08-25 12:19 -04:00 | Backup-script bug fixes (Known Issues #17/#18)

### Actions Taken
1. **backup-commit.ps1 (Known Issue #17):** `$ErrorActionPreference = "Stop"` combined with `git … 2>&1` turned git's CRLF stderr warnings into terminating errors. Changed to `"Continue"` (the script already checks `$LASTEXITCODE` after every git call).
2. **backup-file.ps1 (Known Issue #18):** file args were space-separated only, so a comma-separated list silently skipped files. Added comma-splitting + trimming so both `a b` and `a,b` work; corrected the misleading doc example.

### Files Changed
| File | Change |
|------|--------|
| scripts/backup-commit.ps1 | ErrorActionPreference Stop → Continue |
| scripts/backup-file.ps1 | comma-separated file args + doc example |

### Current State at Session End
- Lint 0 | Tests 109/109 (9 suites) | Build 22/22 | Functions tsc clean
- Backup scripts: syntax-checked + functionally verified (comma-split, no stderr abort)

---

## Session 30 — 2026-09-16 | 14:00 MST — Admin upload permission failure + Nown S.I.T.E.S SEO conventions

### Context Restored From
- Screenshot in Downloads (`IMG_20260916_174730.jpg`): `Upload failed: Firebase Storage: User does not have permission to access 'products/aae7490d-…/color-mockups/charcoal/front-c4ff63f2-….png'. (storage/unauthorized)`
- `storage.rules`, `firestore.rules`, `firebase.json`, `functions/src/index.ts`, `src/context/auth-context.tsx`, `src/components/admin/image-manager.tsx`, `src/components/admin/product-manager.tsx`, PROJECT_CONTEXT.md
- Live state: Firebase Rules API (deployed rulesets), Firestore `config/admin`, and the real browser session.

### Actions Taken

1. **Diagnosed the upload failure from the deployed rules, not the local files.** Pulled both live rulesets from the Rules API and confirmed the deployed `storage.rules` was current (released 2026-08-21) and identical to the working tree.
2. **Reproduced in the user's real browser** as `mary.theadoor.doctor@gmail.com`. With one valid ID token: Firestore `GET config/admin` returned **200** (so `firestore.rules` `isAdmin()` = true) while a Storage upload to the exact failing path returned **403**. Two logically identical admin checks disagreed — so the fault had to be the Storage-side check itself.
3. **Bisected it with temporary probe paths** (dedicated `permprobeA..H` prefixes, so no real data path was ever loosened):
   | Probe | Rule | Result |
   |---|---|---|
   | A | `isSignedIn()` | **200** |
   | B | signedIn + email in a literal list | **200** |
   | C | signedIn + `firestore.exists(config/admin)` | 403 |
   | F | signedIn + `firestore.exists(config/site)` (public-read) | 403 |
   | G | signedIn + `firestore.exists(products/{id})` (public-read) | 403 |
   | H | signedIn + `firestore.exists(config/__absent__)` (control) | 403 |
   **Conclusion: cross-service `firestore.exists()`/`firestore.get()` from Cloud Storage rules returns false for EVERY path in this project — including public-read documents and an absent control — so `storage.rules`' `isAdmin()` could never be true.** All probe paths were removed after diagnosis.
4. **Rewrote `storage.rules` `isAdmin()` to be self-contained:** the `admin` custom claim OR a bootstrap list of the two founder emails. No `firestore.*` anywhere. Documented in-file why it must not come back.
5. **Added claim minting** to `functions/src/index.ts`: `syncAdminClaims` (admin-only backfill) and `syncMyAdminClaim` (self-service — grants only when the caller's own email is already an admin). `saveAdminEmails` now re-syncs claims after saving the list, so an admin added through the UI works on their next sign-in with no rules redeploy.
6. **`auth-context.tsx`** mints the claim on sign-in and forces `getIdToken(true)` once per user per session, guarded by a ref so the token refresh cannot re-trigger `onAuthStateChanged` into a loop.
7. **Verified live, end to end:** token claim `admin: true`; upload to the exact failing path **200**; probe cleanup **204**; unauthenticated upload still **403**.
8. **Ported the Nown S.I.T.E.S SEO conventions** into the Next.js app (see Decisions).
9. **Caught an OG-card regression caused by my own title change.** `scripts/generate-og.mjs` sources its headline from `src/app/layout.tsx`'s `metadata.title.default`, which I shortened in the same session — so the card drew the brand twice ("ANIMAS REFLECTIONS" as the brand row, then "ANIMAS REFLECTIONS — CUSTOM PRINTING IN DURANGO, CO" as the headline). Fixed generically with a `stripBrand()` helper so the card stays correct however the headline source is reworded, rather than re-pointing it at one specific string that can drift again. Verified by re-rendering the PNG and reading it: brand row, then "CUSTOM PRINTING IN DURANGO, CO".
10. **Added the framework's SEO gate** as `scripts/check-seo.mjs`, wired to `postbuild`. It walks the emitted `out/` **recursively** (unlike the framework's own non-recursive scan, which would only ever see the home page in this export). It immediately caught three real defects: the home title was **63 chars** and its description **158** (both over the SERP limits), and 404/\_not-found duplicated it. All four core rules were then negative-tested by deliberately breaking the output (stripped `og:image`, wrong canonical, doubled brand in the title, sitemap `<loc>` with no page) — each failed as intended, and the restored tree passed.

### Decisions Made
- **`config/admin` stays the single source of truth for admins.** The email list inside `storage.rules` is a *bootstrap fallback* only, so uploads work before any claim exists; ordinary admin changes go through the claim and need no redeploy. Only a founder-email change requires editing and redeploying the rules.
- **`firestore.rules` was left untouched** — its admin check is proven working (200), and there was no reason to disturb a working authorization path.
- **No `firestore.*` in `storage.rules`, ever** — the failure mode is silent (rules evaluate false, uploads just 403), which is what made this cost a full diagnosis.
- **Auto-generated keyword landing pages were NOT shipped.** The framework's `compact-keywords.mjs` is portable and the method is sound, but a real keyword set is a client/business input, and shipping thin auto-generated pages onto a live commercial site is a net SEO risk. The infrastructure is in place; the keyword list needs the client's approval first.
- Titles/descriptions are clamped on word boundaries (60/155) and address data we cannot verify (street address, postal code, geo, opening hours) is **omitted rather than invented**.

### Files Changed
| File | Change |
|------|--------|
| storage.rules | isAdmin() = custom claim OR bootstrap email list; removed cross-service firestore.* + probe paths |
| functions/src/index.ts | +syncAdminClaims, +syncMyAdminClaim, +applyAdminClaims; saveAdminEmails re-syncs claims |
| src/context/auth-context.tsx | mints the admin claim on sign-in + one forced token refresh |
| src/lib/seo.ts | NEW — PAGE_SEO registry, metadataFor(), clip(), JSON-LD @graph builders |
| src/app/sitemap.ts, src/app/robots.ts | NEW — generated from PAGE_SEO |
| public/sitemap.xml, public/robots.txt | DELETED (hand-maintained, had drifted, conflict with generated routes) |
| src/components/layout/json-ld.tsx | One @graph (WebSite + LocalBusiness, @id-linked) replaces two flat nodes |
| src/app/layout.tsx | metadataBase, og:image + twitter:image, <SiteJsonLd /> |
| scripts/generate-og.mjs, public/og-image.png | NEW — dependency-free 1200×630 share card + npm prebuild |
| scripts/check-seo.mjs | NEW — recursive SEO gate over out/, wired to postbuild |
| src/app/(home)/layout.tsx, src/app/(home)/page.tsx | Home page moved into a route group so it can carry its own (60/155-clamped) metadata |
| src/app/**/layout.tsx, 8 server pages | Per-route static metadata from the registry |
| PROJECT_CONTEXT.md | Known Issues #30/#31; functions + key-files tables refreshed |

### Continued (same session) — CMS-managed SEO + keywords, and a full debugging pass

**Requested:** put SEO and keywords under CMS control so they can be edited from an admin session without touching code, then a final debugging pass and a repo/live sync.

11. **CMS data layer.** New `config/seo` Firestore doc + `src/lib/seo-config.ts` contract (`SeoConfig`, `KeywordPage`, `normalizeSeoConfig()`, `slugifyKeyword()`, `RESERVED_SLUGS`). `src/lib/seo.ts` now merges CMS overrides over the committed `PAGE_SEO` defaults, so **a blank field always means "use the default"** and a cleared box can never publish an empty `<title>`.
12. **Build-time fetch.** `scripts/fetch-seo-config.mjs` (on `prebuild`) snapshots `config/seo` into the committed `src/lib/seo-content.generated.ts`; it keeps the committed snapshot if Firestore is unreachable, so a build never depends on the network. Idempotent — writes only on change.
13. **Keyword landing pages.** One real static page per published keyword at `/<slug>/` (`src/app/[keyword]/page.tsx`, `generateStaticParams`), listed in `sitemap.xml` and cross-linked from the new `/services/` hub so none are orphans. Seeded three real pages (embroidery, t-shirt printing, corporate apparel) **through the CMS write path** to prove the chain end to end.
14. **Admin → SEO.** New tab: per-page title/description with live counters and per-page reset, a full keyword manager (live slug, URL preview, thin-content warning, duplicate/blank/reserved blocking), and a Publish section.
15. **Publish.** `publishSite` + `savePublishToken` functions, `.github/workflows/rebuild.yml`, and `npm run publish` locally. The PAT lives in the admin-only, client-unreadable `secrets/githubPublish` — deliberately **not** Secret Manager, because functions v2's `defineSecret()` fails the deploy when the secret does not exist yet, which would block `firebase deploy --only functions`.

**Debugging pass findings (all fixed):**

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | **High (security)** | `config/admin` was readable **anonymously** — `match /config/{document=**}` with `allow read: if true` ALSO matched `config/admin`, and Firestore ORs matching rules, so the public wildcard overrode the admin-only rule. Verified: unauthenticated GET returned 200 with the admin email list. | Single-segment `config/{docId}` with `allow read: if docId != 'admin'`. Re-verified: 403. |
| 2 | **High (SEO)** | The catch-all `rewrites` entry made **every unknown URL return HTTP 200 serving the home page** — soft 404s; `out/404.html` was never served. It also made live verification lie: an undeployed keyword page answered 200. | `"rewrites": []`; Hosting now serves 404.html with a real 404. |
| 3 | **High (functionality)** | `savePublishToken` had **zero callers**, so the Publish button could never work and its error message pointed at a UI that did not exist. | Token input + save action added to the Publish section. |
| 4 | **High (build)** | A published keyword with an empty body derived an **empty meta description**, which fails the SEO gate at postbuild — the build went red *after* the admin was told the publish had started. | `keywordMetadata()` now falls back to a generated sentence; the derived description can never be empty. |
| 5 | Medium (security) | The bootstrap Storage admin list matched on email alone, with no `email_verified` check. | `email_verified` now required in `storage.rules` and in `syncMyAdminClaim`. Confirmed both founder accounts are Google-verified before tightening. |
| 6 | Medium (SEO) | `/services/` had zero inbound links in the emitted HTML — an orphan hub. | Linked from the footer nav. |
| 7 | Medium (UX) | The title counter measured the **pre-`pageTitle()`** string, so a 55-character override showed green while the published title was silently truncated. | Counter measures the composed title. |
| 8 | Medium (build safety) | `fetch-seo-config.mjs` wrote an **empty config and exited 0** when there was no committed snapshot to fall back on — a silent SEO regression. | Now exits 1 with a clear message. |
| 9 | Low (data loss) | Saving in the editor dropped fields it does not model — keyword `order` and page overrides for routes outside its editable list. | Editor preserves what it does not edit. |

**Also caught during the pass:** a lint error from my new `/[keyword]/` route exposing a pre-existing `<a href="/admin/login">` (now `<Link>`); and a duplicate `publishSite` subagent that I had launched twice — the orphan was interrupted, and the surviving agent independently found and fixed a **critical** CI defect: the workflow had no `NEXT_PUBLIC_*` env, so a CI checkout (no `.env.local`) would have deployed a site with undefined Firebase config.

### Commits This Session
| Hash | Message |
|------|---------|
| 3095407 | fix(admin): storage rules cannot read Firestore — authorize admin uploads by custom claim |
| 94f6dbd | docs: DEVLOG session 30 commit hash |
| 672a382 | feat(seo): build-time SEO gate, and fix the title/description limits it found |
| 3a8c08a | fix(og): stop the share card drawing the brand twice |
| 31cac04 | feat(cms): CMS-managed SEO and keyword landing pages, plus a full debugging pass |

### Current State at Session End
- Lint 0 errors/0 warnings | `tsc --noEmit` **0** (project type-clean for the first time) | Tests 109/109 (9 suites) | Build 25 pages (22 routes + 3 keyword pages + sitemap.xml + robots.txt) | SEO gate green | Functions tsc clean
- Deployed: firestore rules, storage rules, all **18** functions, hosting — all verified live
- Live: 3 keyword pages 200 with their own titles; unknown URLs now **404** (were 200-homepage); sitemap 16 URLs; storage admin upload 200 / unauthenticated 403; `publishSite` returns a graceful not-configured message
- CMS: `config/seo` holds 3 published keyword pages; Admin → SEO renders with live counters; save/reset round-trip verified via an authoritative CLI-token read
- Branch: development (pushed)

### Outstanding setup for the client (one-time, for hands-off publishing)
- Create a GitHub **fine-grained PAT** (repo `MaryTheadoor/animas-reflections-pwa`, permissions `Actions: write` + `Contents: read`) and paste it into **Admin → SEO → Rebuild access**. Until then the Publish button reports not-configured and `npm run publish` is the local fallback.
- Create a GCP service account with Firebase Hosting Admin and store its JSON as the repository secret `FIREBASE_SERVICE_ACCOUNT_ANIMAS_REFLECTIONS` (step-by-step instructions are in the header comment of `.github/workflows/rebuild.yml`).
- Optional: override any `NEXT_PUBLIC_*` value with a repository **Variable** of the same name; the workflow falls back to the public defaults.

### Pending / Next Session
- [ ] Client to confirm street address, postal code, geo coordinates and opening hours → then add them to `BUSINESS` in `src/lib/seo.ts` (LocalBusiness gains address/geo/hours).
- [ ] Decide on a real compact-keyword set for keyword landing pages (framework tool: `nown-sites-framework/tools/compact-keywords.mjs`).
- [ ] `animas-reflections-pwa.zip` (230 MB) is untracked in the repo root — delete or move it out.
- [ ] Merge `development` → `master` only on explicit user approval.

---

## Session 31 — 2026-10-05 | A11y contrast follow-ups + dead-token fix

### Context Restored From
- DEVLOG Sessions 1–30 (repo had moved on well past Session 15's a11y pass); Session 15 "Pending" list of optional contrast follow-ups; `_webbridge/contrast.py`
- Live-current palette in `src/app/globals.css` (`gold-deep` from Session 15, `--color-teal` never defined)

### Actions Taken
1. **Re-verified Session 15's a11y/compliance work is intact** — zoom fix, `:focus-visible`, skip link, cart-dialog semantics, customizer arrow-key reposition, `/privacy` route + Square cookie disclosure + CPA rights language, `gold-deep` token. All present; nothing to redo.
2. **Closed the flagged contrast follow-ups** (product price, stock badge, teaser pill, offline banner). Offline banner was already `bg-red-600` (4.8:1). The rest fixed via `gold-deep` / new `gold-ink`.
3. **Found and fixed a real class bug — the `teal` token does not exist.** `--color-teal` is not defined anywhere (Tailwind v4 CSS-first theme, no config file), so `bg-teal/80`, `bg-teal/10`, `text-teal`, `bg-teal/5` compiled to **nothing**. The "X in stock" product badge therefore had no background at all — white text straight over the product photo. Replaced with real `teal-700`/`teal-100` (5.5:1 / 4.8:1). Affected: product card, admin product + legend dots, account tracking box.
4. **Gold-on-light text was failing AA** (2.96:1 on cream). Introduced `--color-gold-ink` (#92400E) for gold-family text sitting on a `gold/10` tint (5.95:1) and moved all other light-surface gold text/hover/nav-active to `gold-deep`. `--color-gold-deep` is now **remapped to #E68A00 under `html.dark`**, so one class is correct in both themes (6.8:1 on dark).
5. **Gold CTA buttons (user decision: dark label on bright gold).** `bg-gold text-white` was 3.19:1 — a failure at every button's text size (14–16px). Added `--color-on-gold` (#111827, deliberately **not** dark-remapped, because the gold face stays #D97706 in both themes while `text-foreground`/`text-white` flip). All 37 `bg-gold text-white` → `bg-gold text-on-gold` (5.6:1; hover `gold-light` = 6.8:1). `.btn-gold-tactile` label shortened to dark. Bright brand gold face preserved exactly.
6. **Small gold pills/badges** (stock badge, cart count, variant-matrix cells) → `bg-gold-deep` (5.0:1 light / 4.6:1 dark).
7. **Danger colour is now semantic** — `--color-danger` (#dc2626 light → #f87171 dark). Replaced `text-red-400` (2.8:1 on white) and bare `text-red-500` (3.8:1) and bare `text-red-600` (3.0:1 on dark). Deliberately kept `text-red-600` on `bg-red-50` badges, which stay light in both themes.
8. **Verified** — lint 0, tests 109/109 (9 suites), build 25 pages, SEO gate green. WebBridge visual check in light + dark (shop, home, CTAs). All new tokens confirmed present in the emitted CSS.

### Decisions Made
- Gold family is now four tokens with distinct jobs: `gold` (fills/accents, bright, unchanged), `gold-deep` (text on light surfaces; auto-flips to #E68A00 on dark), `gold-ink` (gold text on a `gold/10` tint), `on-gold` (label on a gold fill; never flips).
- `--color-gold-deep`, `--color-gold-ink`, `--color-danger` are theme-remapped; `--color-on-gold` intentionally is not.
- Accent/brand hues unchanged: bright gold, teal primary, plum, and the announcement banner hue the client asked to keep.

### Files Changed
| File | Change |
|------|--------|
| src/app/globals.css | +`--color-gold-ink`, `--color-on-gold`, `--color-danger`; dark remap of gold-deep/gold-ink/danger; nav-dock active → gold-deep; `.btn-gold-tactile` dark label |
| 31 tsx files | dead `teal` classes → real `teal-700`/`teal-100`; gold-on-light → gold-deep/gold-ink; 37 CTAs → `text-on-gold`; danger token; gold-deep/teal-700 badge fills |

### Current State at Session End
- Lint 0 | Tests 109/109 (9 suites) | Build 25 pages | SEO gate green
- Changes staged in the working tree on `development`; **not committed and not deployed** — awaiting go-ahead
- `_webbridge/contrast.py` restored untouched — its hardcoded colour list predates this session

### Pending / Next Session
- [ ] Review + deploy this session's work (hosting-only)
- [ ] **Dark-mode counterpart audit** — still open since Session 14; this session fixed the dark *regressions* it could introduce, but the full dark pass is unstarted
- [ ] `_webbridge/contrast.py` colour list is now stale (predates gold-ink/on-gold/danger)
- [ ] Carry-over: client address/geo for LocalBusiness, keyword set decision, `animas-reflections-pwa.zip` cleanup, G2 live checkout, G15 Lighthouse, G20 DNS, G21 analytics

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

---

## Session 32 — 2026-10-06 | Help Hub restored + catalog-import spec

> Numbering note: the DEVLOG restarted at 30 on the unmerged `origin/master` line and
> has also reached 32 there. Numbers are per-line until the two are reconciled — see
> `docs/STATUS_SWEEP.md` §1.

### Context Restored From
- `docs/STATUS_SWEEP.md` (this session's sweep); client answers in the meeting
- Verified that production runs this line and that `origin/master`'s work was
  overwritten by this line's deploys

### Actions Taken
1. **Diagnosed why deployments looked "missing"** — the service worker is cache-first
   and `CACHE_NAME` (`"animas-reflections-v2"`) never changes between builds, so a
   returning visitor is served the *previous* JS on the first load after a deploy.
   Confirmed live: the admin showed 9 tabs with no Help until the SW registration and
   cache were cleared, after which Help appeared immediately. This has been masking
   deploys generally.
2. **Restored the admin Help & Tutorials tab** (10th tab) — ported from `origin/master`
   (`4a23bc3`) and re-adapted so it documents the admin that actually exists: dropped
   the CSV-import entry/tutorial (not on this line), dropped modifier-group and
   colour-library wording, reframed inventory as a display/search signal rather than a
   sales block, described print zones as percentage fields, and corrected the tab list
   and SEO entry. Verified live: tab renders, search filters (`inventory` → 1 result).
3. **Answered the bulk-import question with evidence** — this line has no importer:
   `functions/src/` holds only `index.ts` + `pricing.ts` (the old `sync.ts` and
   `product-pipeline.ts` were deleted, leaving stale compiled orphans in
   `functions/lib/`), and `createSquareProduct` is a single-product push to Square.
   The working CSV importer lives on the other line (`86b1362`).
4. **Wrote `docs/CATALOG_IMPORT.md`** — the development note requested: a plan to import
   catalog data sheets in order to migrate a store from another e-commerce platform,
   including the programmatic translation layer (header aliases, canonical intermediate
   row, derived option dimensions, and a mandatory mapped/defaulted/unmapped report).
   Records the target schema from `src/types/index.ts`, nine codebase-specific hazards
   (`stripUndefined`, encoding, money parsing, 500-write batching, image strategy,
   category creation, client-side write path, closed `productType` union, variant
   round-tripping), and ten open decisions.
5. **Scope correction on that note (same day, owner input)** — the pipeline is **manual and
   admin-operated**: the operator exports a sheet by hand, prepares it, and **uploads the
   file**. No backend/functions work, no Square API integration, no staged sync. This cut
   the server-side Square Catalog API pull I had first recommended as the primary route.
   Two facts survived the cut: Square's website-vs-POS split is the `ecom_visibility`
   attribute (relevant when choosing what to export), and the migration is ~42 → ~405
   products. The recoverable `sync.ts` mapper is retained as **reference knowledge only** —
   its `extractColors`/`extractSizes`/`extractTags`/`detectBrand` heuristics and brand map
   (which should seed the confirmed brand taxonomy), not as a route to resurrect.

### Decisions Made
- The import is **two problems**: a parser and a **translation layer**. The translation
  layer is the deliverable; the parser already exists to be recovered.
- Nothing may be silently dropped — every unmapped source column and every defaulted
  field must appear in the import report. An import that cannot report what it did not
  understand is not finished.
- Field resolution stays **declarative** (header aliases) rather than branching inside the
  pipeline — but profiles are optional extensibility, not the critical path, because the
  operator pre-normalises the sheet.
- **Client-side writes are the chosen path** — no admin callable function — since the
  owner scoped this as a manual, admin-operated feature. Consequences handled explicitly:
  rules must allow admin writes, the 500-write batch limit applies client-side, and gating
  must use the admin claim (never a cross-service `firestore.exists()` lookup).

### Files Changed
| File | Change |
|------|--------|
| src/lib/help-content.ts | NEW — 15 guide entries + 2 tutorials, adapted to this line |
| src/components/admin/help-guide.tsx | NEW — Help tab UI (search, tutorials, guide) |
| src/app/admin/page.tsx | +Help import, +`"help"` tab key, +tab entry, +render block |
| docs/STATUS_SWEEP.md | +client answers (online-only; Biscuit Hockey is a brand) |
| docs/CATALOG_IMPORT.md | NEW — catalog import / migration plan and translation-layer design |

### Commits This Session
| Hash | Message |
|------|---------|
| `acb83a3` | docs: status sweep — live state, divergent lines, outstanding issues, client questions |
| `9663202` | docs(sweep): correct the divergence finding — it is a live regression, not a bad claim |
| `e70949d` | feat(admin): restore the Help & Tutorials tab |

### Current State at Session End
- Lint 0 | Tests 109/109 (9 suites) | Build 25 pages | SEO gate green
- Hosting deployed and verified live: Help tab present (10th), search working
- Branch `development`; `master` still diverged (13 vs 20) and **unpushed** — no force-push
- No dev server running (the wedged PID 22876 was cleared; port 3000 free)

### Pending / Next Session
- [ ] **Fix the service-worker staleness** — version `CACHE_NAME` per build, or make
      `/_next/static/*` and navigations network-first. Small, and it stops masking deploys.
- [ ] **Reconcile the two lines** — now the highest-value task; Help Hub, CSV import,
      theme/copy editor, modifier groups, colour library, print-zone editor, and
      inventory enforcement are all built and all stranded on `origin/master`
- [ ] Confirm the `SQUARE_ENVIRONMENT=` line in `functions/.env` is `production`
- [ ] Choose which platform(s) the catalog migration is actually from → scopes
      `docs/CATALOG_IMPORT.md` §6.1
- [ ] Remove the stale `functions/lib/{sync,product-pipeline}.js*` orphans
- [ ] Carry-over: G2 real-card checkout test, G1 catalog population, G4/G5 images,
      G15 Lighthouse, G19/G22/G23, G20 DNS cutover, G21 analytics

---

## Session 33 — 2026-10-06/07 | Lost-functionality recovery, admin security fix, catalog import

> Numbering note: `origin/master` also reaches 33. Numbers are per-line until the two are
> reconciled — see `docs/STATUS_SWEEP.md` §1.

### Context Restored From
- `docs/STATUS_SWEEP.md` (the two-line divergence), the client's answers, and a full
  lost-functionality inventory produced by diffing `development` against `origin/master`

### Actions Taken
1. **CRITICAL security fix — live privilege escalation.** The admin checks accepted any
   email ending in `@animasreflections.com`, and public email/password signup is enabled, so
   an attacker could register an address on a domain they do not own and inherit full admin.
   Removed from all three sites (`isUserAdmin`, `requireAdmin`, `isAlwaysAdmin`) and
   deployed. Verified the provider really was enabled by probing the public Identity Toolkit
   with a malformed email (got `INVALID_EMAIL`, not `OPERATION_NOT_ALLOWED`) — **no account
   was created**. Confirmed the allowlist held only gmail addresses before deploying, so
   nobody was locked out. Post-deploy: the wildcard literal is absent from all 11 live
   chunks, with positive controls.
2. **Recovered the six isolated items** lost in the divergence (`15a5ec9`): server-side
   inventory enforcement + out-of-stock product page, modifier groups, the visual
   print-zone editor, the rich-text toolbar (H2/H3/Link/Clear), and the reusable colour
   library (which needed a `site-config` `refresh()` adding first). Investigated the
   `tsconfig` scripts exclude and **found it unnecessary here** — `tsc --noEmit` is clean,
   so copying it would only have reduced coverage.
3. **CSV catalog import — recovered and completed.** Phase 1 recovered the parser, writer,
   tests and upload UI. Phase 2 fixed three real defects the recovered code carried:
   re-import duplicated the catalog (name-keyed grouping but a random product id), the
   sheet's category was parsed then discarded (`categoryId: ""`), and variants were written
   with a meaningless `options: {}`. Phase 4 recovered the size/colour/brand/type heuristics
   from the deleted `sync.ts` into `src/lib/catalog-heuristics.ts` so imports arrive with
   real variant dimensions and brand-derived categories.
4. **Help tab.** New "Migrating a catalog from Square" entry plus a step-by-step migration
   tutorial, written to describe actual behaviour — including the defects fixed in the same
   session, which is why it landed last.
5. **Sweep.** Live bundle verified for every feature; stale claims in this session's own
   docs corrected (a "planned, not implemented" status line, a "no importer at all"
   paragraph, and a Help limitation note that the heuristics had made untrue).

### Decisions Made
- **Update the existing product** on an import collision (deterministic slug id), and
  **map categories to existing only, reporting the rest** — never auto-create, so a messy
  export cannot invent categories.
- **`detectBrand` returns null rather than a default brand.** The recovered version
  defaulted to "Animas Reflections", which would have filed every generic product under a
  brand category.
- **Only declare option dimensions with more than one value.** A single-valued dimension
  ("One Size", or a colour every variant shares) would put a pointless one-option selector
  on the storefront.
- **Drop the recovered `extractTags` word-frequency tags** — it added every 3+ letter word
  of the product name ("classic", "tee"), which pollutes search.
- Service worker caching keeps masking deploys; hard-refresh is still required to see admin
  changes.

### Files Changed
| File | Change |
|------|--------|
| src/context/auth-context.tsx, functions/src/index.ts | removed the admin domain wildcard + DO-NOT warnings |
| functions/src/pricing.ts, src/app/product/page.tsx | inventory enforcement + out-of-stock UI |
| src/types/index.ts, src/app/customizer/page.tsx, product-manager.tsx | modifier groups |
| src/components/admin/print-zone-editor.tsx | NEW — visual print-zone editor |
| src/context/site-config-context.tsx, src/hooks/useSiteConfig.ts | `refresh()` / `useSiteConfigRefresh()` |
| src/lib/csv.ts | deterministic ids, category resolution, derived options, full report |
| src/lib/catalog-import.ts | category map in, `ImportReport` out |
| src/lib/catalog-heuristics.ts | NEW — recovered size/colour/brand/type heuristics |
| src/lib/help-content.ts, src/components/admin/help-guide.tsx | migration entry + tutorial |
| src/app/globals.css | `.rich-desc` / `.desc-editor` h2/h3/a styles (neither line had them) |
| docs/{CATALOG_IMPORT,STATUS_SWEEP,DEVLOG}.md | plan, findings, this record |

### Commits This Session
`40911cb` security fix · `15a5ec9` six recovered items · `2a362cb` import phase 2 + Help ·
`9dc084d` import phase 4 heuristics · `a9f3a09` dimension filtering · plus doc commits.

### Current State at Session End
- Lint 0/0 | Tests **140/140** (11 suites) | tsc clean (app + functions) | Build 25 pages |
  SEO gate green
- Hosting + functions deployed and verified live; `development` @ `a9f3a09`, pushed
- **Recovery tally: 8 of 12 done, 1 unnecessary, 3 outstanding** — all three gated on the
  same decision (who owns page title/description)
- Local `master` is still a stale, diverged leftover (holds `7e71997`, cannot be pushed)

### Pending / Next Session
- [ ] **Decide who owns page `title`/`description`** — this unblocks the theme editor, the
  copy editor and editable SEO, the last three recoverable items
- [ ] The six-plus-five recoveries could still be superseded by a full reconciliation; every
  isolated item is now proven portable, so a merge would mostly be the three collisions
- [ ] Clean up: stale `functions/lib/{sync,product-pipeline}.js*` orphans; the local `master`
  branch; the untracked 230 MB zip
- [ ] Confirm `SQUARE_ENVIRONMENT=production` in `functions/.env` (still open, and blocking
  a trustworthy checkout test)
- [ ] Decide whether to fix the service-worker cache strategy
- [ ] Carry-over: G2 real-card checkout test, G1 catalog population, G4/G5 images,
  G15 Lighthouse, G19/G22/G23, G20 DNS cutover, G21 analytics

---

## Session 34 — 2026-10-07 | Square catalog migration: modifiers, duplicates, design editing

> Numbering note: `origin/master` also reaches 34. Numbers are per-line until the two are
> reconciled — see `docs/STATUS_SWEEP.md` §1.

### Context Restored From
- `docs/CATALOG_IMPORT.md`, `docs/STATUS_SWEEP.md`, the client's real Square export
  (`AR square_catalog-2026-10-07-1525.csv`, 161 columns / 524 rows), and the live Firestore
  catalog read back through the public products endpoint

### Actions Taken
1. **Mapped the real export properly.** Only 8 of 41 populated columns were recognised.
   Added: `Token` → `variant.squareVariationId`; `Categories` (comma-separated, `>`-nested,
   `(SOMEID)`-suffixed) → category; `Archived` + `Square Online Item Visibility` → active;
   the location-suffixed `Current Quantity …` (by prefix) → inventory; `Weight (lb)` → weightOz;
   `Option Name/Value n` → structured options; Square's generic `Item Type` treated as
   unstated. **147 archived items would otherwise have imported as active.**
2. **Fixed a real bug inherited from the recovered code:** `(await getDoc(ref)).exists` read
   the *method* as a property, so `created` could never increment — a first-ever import would
   have reported "0 created". Also: header normalisation kept parentheses, so `Weight (lb)`
   matched nothing.
3. **Found and fixed the duplicate explosion.** A re-import had taken the catalog 408 → 600
   products (259 redundant copies) because the name→id index *excluded* ambiguous names,
   pushing those rows to fresh slug ids. It now picks the lowest id and reports the collision.
4. **Built the add-on (modifier) pipeline.** `fetchSquareModifiers` reads `MODIFIER_LIST`
   objects (BigInt conversion for money *and* min/max selections, environment in the reply);
   the importer records which sets each item uses, keeping the Square id from the column; and
   **Import Square add-ons** joins them. Run against the live catalog: **183 products, 4,122
   add-ons, 84 groups**, rendered grouped with prices in the customizer.
5. **Fixed the duplicated-set-name defect** it exposed: 12 set names are shared by 2–8 lists,
   and **163 of the 183** products touch a colliding name. Resolution now prefers the recorded
   list id and only trusts a bare name when exactly one list carries it; an ambiguous set is
   reported and skipped rather than guessed at.
6. **Reorganised the Products tab** (all action controls above the list, per request) and made
   duplicate merges individual, batched (checkbox + Merge selected) or wholesale (Merge all).
7. **Opt-in category creation** during import, off by default, so a messy export cannot invent
   categories unless the operator chooses it.
8. **Designs are editable after creation** — edit a design's name, category, description, tags,
   or replace its image (image optional on edit), with blank description/tags now clearing
   properly (written as null, because the write merges).
9. **Recognised the modifier-set columns** instead of reporting 123 of them as unmapped noise.

### Decisions Made
- Identity for imports: sheet `id` → existing product by name → name slug, so re-imports
  converge instead of proliferating (known issue #38).
- An existing product receives a **patch**, never a replacement: `createdAt` is never reset and
  a blank value never overwrites stored curation. A matched product's `variants` *are*
  replaced, and the report says so.
- Categories are mapped to existing ones by default, with creation opt-in per run.
- Add-ons: Square choice → our toggle, Square list name → our `group`. Square's SINGLE/MULTIPLE
  rule has no equivalent in our flat model, so it is reported rather than silently dropped.
- Duplicated Square set names: prefer the id, and **refuse rather than guess** on an ambiguous
  bare name.

### Files Changed
| File | Change |
|------|--------|
| functions/src/index.ts | +`fetchSquareModifiers`; health now reports the Square environment |
| src/lib/csv.ts | real Square column mapping, deterministic ids, category resolution/creation, `squareModifierRefs` |
| src/lib/catalog-import.ts | convergence on ambiguous names, patch-not-replace, opt-in category creation |
| src/lib/catalog-heuristics.ts | NEW — recovered size/colour/brand/type patterns |
| src/lib/duplicate-products.ts | NEW — semantic duplicate grouping + merge plan |
| src/lib/square-addons.ts | NEW — Square modifier lists → `ProductModifier` |
| src/components/admin/product-manager.tsx | actions moved to the top, duplicate panel + batch merges, add-on import, category checkbox |
| src/app/admin/page.tsx | editable designs |
| src/types/index.ts | `squareModifierRefs`, `ProductModifier.group` |
| PROJECT_CONTEXT.md | known issues 38–44 |
| docs/CATALOG_IMPORT.md | §10–13: live findings, column coverage, duplicates, add-ons |

### Current State at Session End
- Lint 0/0 | Tests **171/171** (13 suites) | tsc clean (app + functions) | Build 25 pages | SEO gate green
- Live catalog: 385 products · 183 with add-ons (4,122 entries) · 121 categorised · 147 inactive
- Contrast audit refreshed and green: **25/25 combinations pass AA**
- `functions/lib` orphaned build output for deleted modules removed
- Hosting + functions deployed; `development` pushed
- ⚠️ Untracked 230 MB `animas-reflections-pwa.zip` left in the repo root — the client's file,
  deliberately not deleted

### Pending / Next Session
- [ ] Create the genuine missing categories (`Durango Lacrosse`, `I'M OK R U`, `ET Art`,
  `BISCUIT HOCKEY`, `Teams`, `GREEN BUDDHA`) and re-import to place those products
- [ ] Re-run **Import Square add-ons** so the id-based resolution takes effect (the run that
  populated 183 products used the name-matching build)
- [ ] Decide who owns page `title`/`description` — still the gate on the last three recoverable
  items (theme editor, copy editor, editable SEO)
- [ ] Carry-over: G2 real-card checkout test, G1 catalog population, G4/G5 images, G15
  Lighthouse, G19/G22/G23, G20 DNS cutover, G21 analytics
- [ ] Housekeeping: stale local `master`; the 230 MB zip
---

## Recovered from the `origin/master` line — Content & Theme sessions (30–33)

> The sessions below ran on a line that branched from a *newer* base than this one and
> renumbered its own log from 30. They are kept verbatim for history: they are the record
> of the Content & Theme feature (data-driven light/dark theme + the page-by-page copy
> editor) that this line later reconciled rather than reimplemented. Session numbers
> collide by construction and are NOT a single sequence — see `docs/STATUS_SWEEP.md` §1.

## Session 30 — Content & Theme: Phase 1 (editable light + dark theme)

### What was done
- Added a data-driven theme system so **both light and dark** palettes + fonts are editable from the admin.
- **`src/lib/site-defaults.ts`** (new): `ThemePalette`/`SiteTheme`, `LIGHT_THEME`/`DARK_THEME` (mirror `globals.css`), `DEFAULT_FONTS`, `mergeTheme()` (folds `config/site.theme` + legacy flat fields over defaults → full palettes), `toThemeConfig()`, `themeToCss()`, `THEME_TOKENS`, `FONT_OPTIONS`.
- **`src/context/site-config-context.tsx`**: `SiteConfig.theme`; the provider injects a `#dsh-theme` `<style>` (light on `:root`, dark under `html.dark`, plus fonts) so both modes apply live. Replaced the old inline `--color-*` setters.
- **`src/app/globals.css`**: removed the hardcoded `html.dark body { --color-* }` (now data-driven); `html.dark body::before` uses `var(--color-cream)`. Component overrides (glass-card, nav-dock, announcement-banner) unchanged.
- **`src/components/admin/theme-editor.tsx`** (new) + admin **Content & Theme** tab: Light/Dark sub-tabs, per-token color pickers + hex input, font dropdowns, **live WYSIWYG preview** (`#dsh-theme-edit`), Reset per mode, Save via `saveSiteConfig`.
- **Tests**: `src/lib/__tests__/theme.test.ts` (7 cases: defaults, sparse override, dark override, legacy flat, theme>legacy precedence, fonts, themeToCss).

### Verification
- lint 0 errors · tsc 0 · tests 124/124 · build 22/22 · hosting deployed live.

### Files Changed
| File | New/Edit |
|------|----------|
| src/lib/site-defaults.ts | new |
| src/context/site-config-context.tsx | edit |
| src/app/globals.css | edit |
| src/components/admin/theme-editor.tsx | new |
| src/app/admin/page.tsx | edit |
| src/lib/__tests__/theme.test.ts | new |
| docs/THEME_EDITOR.md | new |

### Current State at Session End
- Branch: `fix/auth-storage-reuse` (PR #1)
- Content & Theme → Theme editor deployed live; copy editor (Phase 2) not yet built.

### Pending / Next Session
- [ ] Phase 2: page-by-page copy editor for all site text (per-page wireframe diagrams + fields), building on `config/site.content`.
- [ ] Phase 3: per-field reset, help links, SEO/OG text.
```

## Session 31 — Content & Theme: Phase 2 (page-by-page copy editor)

### What was done
- **`src/lib/content-schema.ts`** (new): `SiteContent` types, `DEFAULT_CONTENT` (sourced from `content.ts`), `mergeContent()` deep-merge, `COPY_PAGES` (page → region diagram + fields), `getContentPath`/`setContentPath`.
- **`src/context/site-config-context.tsx`**: `SiteConfig.content` + **`useSiteContent()`**.
- **`src/components/admin/copy-editor.tsx`** (new) in the **Content & Theme** tab: page selector, **wireframe diagram** per page, per-region text/textarea/toggle fields, Save via `saveSiteConfig`.
- **Wired** `/about`, `/contact`, `/custom`, `/biscuit-hockey`, `/im-ok-r-u`, home hero + Our-Story, and the announcement bar to `useSiteContent()` so edits apply live.

### Verification
- lint 0 errors · tsc 0 · tests 124/124 · build 22/22 · hosting deployed live.

### Files Changed (key)
| File | New/Edit |
|------|----------|
| src/lib/content-schema.ts | new |
| src/context/site-config-context.tsx | edit |
| src/components/admin/copy-editor.tsx | new |
| src/app/{about,contact,custom,biscuit-hockey,im-ok-r-u}/page.tsx | edit |
| src/app/page.tsx · src/components/layout/header-bar.tsx | edit |

### Current State at Session End
- Branch: `fix/auth-storage-reuse` (PR #1)
- Content & Theme → Theme + Copy editors deployed live.

### Pending / Next Session
- [ ] Phase 2b: footer/nav links + structured list content (FAQ items, terms/privacy sections, fundraising steps) editable.
- [ ] Phase 3: per-field reset, help links, SEO/OG text.
```

## Session 32 — Content & Theme: Phase 2b (structured content)

### What was done
- `content-schema.ts`: `faq.items` (`{q,a}[]`), `terms/privacy.sections` (`{title,body}[]`), navigation defaults; `CopyField` gained a **`list`** type + array helpers (`getContentArray`/`setContentArray`/`addContentItem`/`removeContentItem`).
- `copy-editor.tsx`: repeatable **list fields** (add/remove rows) for FAQ Q&A and Terms/Privacy sections.
- Wired `/faq`, `/terms`, `/privacy` to `useSiteContent()` so items/sections are editable live.

### Verification
- lint 0 errors · tsc 0 · tests 124/124 · build 22/22 · hosting deployed live.

### Current State at Session End
- Branch: `fix/auth-storage-reuse` (PR #1)
- Content & Theme → Theme + Copy (incl. FAQ/Terms/Privacy list editing) deployed live.

### Pending / Next Session
- [ ] Remaining structured content: nav/footer links + fundraising steps.
- [ ] Phase 3: per-field reset, help links, SEO/OG text.
```

## Session 33 — Content & Theme: Phase 3 polish + fundraising steps

### What was done
- `content-schema.ts`: `fundraising.howItWorks` (`{title,body}[]`) + global SEO fields
  (`metaTitle`/`metaDescription`/`ogImage`); COPY_PAGES adds SEO + fundraising steps.
- `copy-editor.tsx`: per-field **Reset** (to site default) + "?" help button (opens Help tab).
- `seo-meta.tsx` (new) in `PageLayout`: applies editable SEO title/description/og:image
  to the document head.
- Wired `/fundraising` headings/intro/steps to `useSiteContent`.

### Verification
- lint 0 errors · tsc 0 · tests 124/124 · build 22/22 · hosting deployed live.

### Current State at Session End
- Branch: `fix/auth-storage-reuse` (PR #1)
- Phase 1 (theme), 2 (copy editor), 2b (FAQ/terms/privacy/fundraising), 3 (reset/help/SEO) done + deployed.

### Known limitations / Next
- Nav dock uses fixed links/icons; `whoFor`/`products`/`whyUs` lists + home CTA labels remain static.
```

---

### Reconciliation note (added when the two lines were merged)

- The theme + copy editors, `src/lib/site-defaults.ts`, `src/lib/content-schema.ts`,
  `ThemeEditor`, `CopyEditor`, `useSiteContent()` and `config/site.content`/`.theme` were
  taken from this line and are now live on `development`.
- `src/components/layout/seo-meta.tsx` (Session 33) was DELETED during the merge. It wrote
  one *global* title/description to every page, and it was mounted in `PageLayout`, so the
  home page was not covered. It is superseded by `src/lib/seo-runtime.ts` +
  `src/context/seo-context.tsx`, which apply `config/seo` per route — and by the
  build-time `metadataFor()` in each server page, which is what non-JS scrapers read.
- The copy editor's Global page no longer exposes SEO title/description/og image
  (`metaTitle`/`metaDescription`/`ogImage`) for the same reason: they were one page's worth
  of metadata applied site-wide. Per-page SEO lives in the SEO tab.
- Dark-mode colour tokens moved OUT of the `html.dark body` block in `globals.css` and into
  `DARK_THEME` in `src/lib/site-defaults.ts`, so the theme editor really can change dark
  mode. `DARK_THEME` carries the accessibility values that block held (goldDeep/goldInk
  #E68A00, danger #f87171, onGold deliberately unchanged).

---

## Session 35 — 2026-10-08 | Reconciliation: the two lines merged, Firebase made authoritative

> This is the session that ends the divergence. Everything above it on this line, and the
> recovered `origin/master` block, now live on one branch.

### Context Restored From
- `docs/STATUS_SWEEP.md` §1 (the divergence), the previous session's plan, and direct reads
  of both branches' files rather than the earlier notes about them
- The live `config/site` document read back through the Firestore REST API (public read)

### Actions Taken

1. **Runtime SEO, so Firebase is authoritative for `title`/`description` without a rebuild.**
   New `src/lib/seo-runtime.ts` (pure resolver), `src/context/seo-context.tsx` (live read of
   `config/seo`) and `src/components/layout/runtime-seo.tsx` (head writer, mounted once in
   `ClientLayout` so routes that bypass `PageLayout` are covered). The build-time snapshot
   stays as the fallback and is still what non-JS social scrapers receive. Canonical and
   JSON-LD deliberately stay build-time — they are structural and crawl-time only. 13 tests.

2. **Merged `origin/master` into a `reconcile/master-into-development` branch.** 24
   conflicted files, 62 hunks. Resolutions, all to this line's verified behaviour:
   `functions/src/index.ts` (ours is a strict superset — 33 exports vs 14),
   `auth-context.tsx` (ours carries the security fix and its rationale),
   `csv.ts` / `catalog-import.ts` / `help-content.ts` / `help-guide.tsx` / `csv.test.ts`
   (each file the two lines added independently — ours is the evolved, tested one),
   `product-manager.tsx` (ours: 2364 lines vs 2036, and no top-level identifier exists only
   in theirs), `customizer/page.tsx` and `product/page.tsx` (ours kept `text-gold-deep` /
   `text-on-gold`, and theirs had dropped the currency symbol in "Add to Cart"),
   `tsconfig.json` (dropped their `scripts` exclude — `tsc --noEmit` is clean, so it would
   only have reduced coverage).

3. **The 8 content pages needed a real decision, not a side to pick.** This line makes them
   server components that `export const metadata` (per-page SEO); `origin/master` made them
   client components calling `useSiteContent()` (editable copy) with a *global* title applied
   by their `<SeoMeta />`. Taking either side alone loses a requirement, and Next forbids both
   in one file. Resolution: `page.tsx` keeps `metadataFor(path)` and renders a new
   `*-view.tsx` client child that holds the copy. Verified the split still server-renders the
   copy into the export (16 `<details>` on /faq, sections on /terms) so SEO and no-JS users
   lose nothing. Deleted `seo-meta.tsx`: it wrote one page's title to every route and was
   mounted in `PageLayout`, so it missed the home page entirely.

4. **Made the theme editor actually able to change dark mode.** `themeToCss` emitted
   `html.dark {}` (0,1,0) while `globals.css` held an `html.dark body {}` token block
   (0,1,1) — the stylesheet won for every token it declared, so dark edits did nothing. The
   block is gone and its accessibility values moved into `DARK_THEME`, together with three
   tokens the palette never had (`goldInk`, `onGold`, `danger`).

5. **Added a contrast floor, because Firebase-as-truth otherwise ships the regression.**
   The live document holds `theme.dark.goldDeep = #B45309` — 3.5:1 on the dark navy, where
   the stylesheet it replaced used #E68A00 at 6.8:1. `enforceContrast()` measures the guarded
   pairs on every `themeToCss()`, substitutes the shipped default when the saved colour fails
   AA, and the editor now lists what moved, why, and at what ratio. 12 tests.

6. **Removed every dead control the merge exposed.** Read the live document and found
   `config/site` sets every `theme.light` token and has no `content` field at all — which
   proves the Settings tab's brand colours/fonts were shadowed and its announcement/hero/
   about/footer copy inputs were write-only. Deleted those sections (with a pointer to
   Content & Theme), along with the corresponding fields in `SiteConfig`, the admin's
   `SiteConfigData`, and the copy editor's `metaTitle`/`metaDescription`/`ogImage`/`tagline`/
   `footerTagline`. Wired the two copy fields that genuinely had no consumer: the footer now
   reads `c.global.description` and `c.navigation.footer`.

7. **Fixed the contrast the merged admin editors reintroduced:** `bg-gold text-white`
   (3.19:1) → `text-on-gold` in `copy-editor.tsx` and `theme-editor.tsx`, and `text-foreground/50`
   (3.3:1) → `/70` in the six admin files that used it. The storefront was already clear of both.

8. **Docs:** help-content gained a "Editing site copy, colours & fonts" entry, the Settings
   and SEO entries were corrected, and the tab list in Getting started was updated.

### Decisions Made
- **Per-page SEO beats global editable metadata.** Copy is editable per page; titles and
  descriptions stay per-route in the SEO tab, applied at runtime for visitors and at build
  time for crawlers.
- **One owner per setting.** Colours/fonts → the theme object. Copy → the content object.
  Per-page SEO → `config/seo`. Anything that duplicated those was deleted rather than wired.
- **Accessibility is a floor, not a suggestion.** A saved colour is published exactly when it
  is readable; otherwise the readable default is used and the substitution is visible.
- **The merge brought the editors; it did not bring their wiring.** The copy editor had never
  been saved on production (no `content` field in the live document), so first save creates it.

### Verification
- Lint 0/0 · `tsc --noEmit` clean (app + functions) · tests **203/203** (16 suites) · build
  **25 pages** · SEO gate green · contrast audit **25/25 AA** · no conflict markers anywhere
- Exported HTML spot-checked: per-page `<title>`/description/canonical baked and distinct
  (`/about/` = "Our Story", `/shop/` = "Shop Custom Apparel…"), and all 8 split pages
  server-render their copy

### Files Changed (key)
| File | Change |
|------|--------|
| src/lib/seo-runtime.ts, src/context/seo-context.tsx, src/components/layout/runtime-seo.tsx | NEW — runtime SEO |
| src/lib/site-defaults.ts, src/lib/content-schema.ts | NEW (from the other line) + contrast floor, dark tokens |
| src/components/admin/{theme,copy}-editor.tsx | NEW (from the other line) + contrast report, contrast fixes |
| src/context/site-config-context.tsx | merged: our load/refresh + their theme/content, dead fields removed |
| src/app/{about,contact,custom,faq,im-ok-r-u,privacy,terms,biscuit-hockey}/*-view.tsx | NEW — client copy views |
| src/components/layout/seo-meta.tsx | DELETED — superseded by the runtime SEO |
| src/app/admin/page.tsx | Content & Theme tab + SEO tab, dead Settings sections removed |
| src/app/globals.css | dark token block removed (now data-driven), comments corrected |
| src/lib/help-content.ts | new Content & Theme entry; Settings/SEO entries corrected |

### Current State at Session End
- Branch `reconcile/master-into-development`, merged and verified; not yet merged to
  `development`, not pushed, not deployed
- The stale local `master` (holds `7e71997`, 13 ahead / 20 behind, unpushable) is still there
- 230 MB `animas-reflections-pwa.zip` still untracked in the repo root — the client's file

### Pending / Next Session
- [ ] Merge to `development`, push, then deploy hosting (and functions only if touched)
- [ ] Delete or reset the stale local `master`, then decide the branch topology going forward
      (the two lines converging is the reason `master` was unpushable)
- [ ] The admin `Admins` allowlist and `config/site.theme.dark` are worth a look: the saved
      palette still carries `warmSand: #4f6c9d` and `gold: #ffd862`, which pass AA but are a
      hand-tweak worth confirming is intentional
- [ ] `--color-text` is a dead token (aliased to `--color-foreground`, used by no class)
- [ ] Carry-over: G2 real-card checkout test, G1 catalog population, G4/G5 images, G15
      Lighthouse, G19/G22/G23, G20 DNS cutover, G21 analytics

---

## Session 36 — 2026-10-12 | Theme tightening: accent contrast, both modes

Goal: "tighten up the theme — some accent colours are derived from the logo, make
sure everything has appropriate contrast."

### What was measured first

The shipped palette was already audited (25/25 AA), but that audit describes a site
nobody sees: the real palette lives in `config/site.theme`, and it differs
(`theme.dark.warmSand #4f6c9d`, `gold #ffd862`, `goldDeep #B45309`). So this session
started by reading the live document back and checking the accent pairs **for real**,
in both modes.

### Fixed

1. **Skip link was invisible in dark mode.** `.skip-link` used
   `background: var(--color-primary); color: #fff` — but `--color-primary` REMAPS to a
   near-white in dark (it is the "ink" colour there), so the one control a keyboard user
   needs first measured **1.1:1**. Now `color: var(--color-cream)`: primary and cream are
   always opposite ends of the palette, so it holds in both modes (8.8:1 / 16.3:1).
2. **The plum family was broken in both modes**, exactly the way the gold buttons were
   before `--color-on-gold` existed:
   - `text-plum` on a `bg-plum/20` tint: **4.19:1 light, 3.5:1 dark** → added `plumInk`
     (#7E4B76 light, #C08BB6 dark) and repointed 5 call sites.
   - `bg-plum text-white`: **2.86:1 in dark**, because `--color-white` becomes slate-800
     there → added `onPlum` (#FFFFFF both modes) and repointed the band-merch CTA.
   - `hover:bg-plum-light`: white on #A86B9F was **3.99:1 in both modes**, and no label
     colour can rescue a surface in that band → `plumLight` is now #8E5484 (5.6:1).
3. **`goldInk` on a gold/20 tint failed in dark** (3.80:1). The guard had been judging the
   tint at `gold/10`; it now judges the lightest tint the components actually use
   (`gold/20`), and `DARK_THEME.goldInk` is #F5B84D so it clears it (7.8:1).
4. **The contrast floor can now move a SURFACE, not just text.** `GuardPair.surface`
   replaces the surface token with the shipped value when no label colour can fix the
   pair — the plum hover face is the case that forced it. Substitution is measured on a
   trial palette, so `ContrastFix.ratioAfter` is the ratio that actually ships.

`_webbridge/contrast.py` grew from 25 to 32 combinations (plum family, gold-ink tint
levels, both modes) and all pass AA.

### Deliberately NOT changed

The live `theme.dark.warmSand` is `#4f6c9d`, a mid blue. On it `goldDeep` reaches
**2.02:1** and `goldInk` **2.99:1** — a surface in that lightness band cannot carry the
accent golds, and the floor cannot fix it by swapping text because both the shipped and
the admin's golds fail there. The shipped `#1E293B` would give `goldDeep` 5.57:1. That is
a visible brand surface, so it is a client decision (one click in the theme editor), not
something to change silently. Same for `gold #ffd862`.

### A tool built and thrown away (worth recording)

I wrote a DOM audit that walked every text node, resolved its rendered colours through a
canvas (so `lab()`/`oklab()` values from Tailwind v4 convert correctly) and computed the
real ratio. It reported ~20 failures per page — **all contradicted by screenshots at
native resolution**. `getComputedStyle(el).color` returned the LIGHT value for elements
whose own parent reported the dark one, while the paint was correct; toggling `html.dark`
outside the React provider is the likely trigger. The tool was deleted rather than
shipped, and the general rule is recorded as Known Issue #51: verify contrast on rendered
pixels plus arithmetic over the tokens, and treat computed-style readings taken after a
scripted theme change as suspect.

Also learned: grepping `\btext-gold\b` matches `text-gold-deep`, because `-` is a word
boundary. Counts taken that way are meaningless; use `text-gold[^-]`.

### Verification
- lint 0/0 · `tsc --noEmit` clean · tests **231/231** (17 suites) · build 25 pages · SEO gate green
- `_webbridge/contrast.py`: **32/32 combinations pass AA**
- Browser, dark mode via the site's own toggle: `--color-on-plum #FFFFFF`,
  `--color-plum-ink #C08BB6`, `--color-plum-light #8E5484`, `--color-gold-ink #F5B84D`
  all resolved, skip link now #0F172A on #F1F5F9 (16.3:1)
- Screenshots at native resolution confirm the shop filter pills, the browse toggle and
  the nav dock read correctly in dark mode

### Pending / Next
- [ ] Client decision: dark `warmSand` (#4f6c9d → the shipped #1E293B) and `gold` (#ffd862)
- [ ] The product photo library + category pinning plan (Phases 2-6) is still unstarted;
      Phase 1 (data model, rules, matcher, 24 tests) landed in `be9ecdb`

---

## Session 37 — 2026-10-13 | Product build-out speed: the library, the matrix, auto-pin, bulk apply

Brief: Cindy asked for two things, restated as one goal — **build products faster, and
update them, without manually selecting as much or uploading**. That framing changed the
work: the shop-page change from the earlier plan was dropped (it is shopper-facing and does
not speed up building a product), and one item nobody had asked about turned out to be the
largest cost, so it was added.

### What was measured first

Three time sinks in the product editor, in order of cost:

| | |
|---|---|
| Variants | the matrix is a click-every-cell grid — a hoodie with 8 sizes and 10 colours is **80 clicks**, and no way to set one price across them |
| Mockups | five views uploaded per product, plus per-colour photos, each a file dialog |
| Designs | pinned one at a time from a 50-item list with no search, and a 10-cap that failed silently |

### Shipped

1. **Product photo library** (`product_photos`, `product-photos/` in Storage). A photo
   declares its **blank product** and its **view**, so the library is read as SETS; applying
   one fills every mockup view in a single action instead of five uploads, and states which
   views the blank cannot fill. Multi-file upload infers the view from the filename so all
   five can go up in one pass. The gallery can also pull from the library without
   re-uploading. Admin tab: **Product Photos** (distinct from the per-product **Images** tab).
2. **Variant matrix fill** — *Add all in view*, *Add every combination* (which covers the
   dimensions the dropdown pins, previously unreachable), *Remove all in view*, and *Apply
   this price to all*. Filling is idempotent; a batch over 20 asks first.
3. **Designs auto-pin by category** — choosing a category on a NEW product pins that
   category's designs. The automatic pass only ever touches designs IT added, so a hand-picked
   design is never removed and a hand-deselected one is never resurrected. An existing product
   is never rewritten automatically.
4. **Bulk update existing products** — apply a blank's photos, or one price, across a category
   or type. Planned, previewed, then applied exactly as previewed.
5. **Tidy-ups**: `colorThumbnails` removed (verified 0 of 377 live products carried it),
   the dead `--color-text` token removed with the legacy `text_color` field remapped to
   `foreground`, and the shop's product-type filter now reads `catalog_options.productTypes`
   instead of the hardcoded enum — so that Settings control is no longer a dead one.

### Decisions worth keeping

- **The design editor gained a real category picker ALONGSIDE the free-text label**, because
  products reference categories by id while designs carried a label. The matcher accepts an
  explicit id, the label by name, or a tag naming the category — so the designs that already
  exist pin with **no retagging**, and the picker marks those with "≈" so an operator can see
  *why* a design already pins rather than finding it unexplained.
- **Filename view inference stops at a word boundary** — `backdrop.png` is not a back photo.
  Precision over recall: a wrong automatic placement is worse than one the operator picks.
- **Bulk apply refuses to work on a too-long sheet of noise** — see Known Issue #54.
- **`useProductPhotos` is a hook, not a provider**: only the admin reads that collection, and a
  provider would cost every storefront visitor a Firestore read for nothing.

### Verification
- Gate on every slice: tsc clean · lint 0/0 · **286 tests / 20 suites** · contrast **32/32 AA**
- The production build could NOT be run — see below — so nothing from this session is deployed

### ⚠️ Blocking the release: Node v24.15.0 crashes V8 on this machine

`require("typescript")` alone dies with `Fatal error ... unreachable code`, which takes out
`npm run build`, `npx tsc`, `npm test` and `npm run lint`. It began mid-session on commands
that had just succeeded, and it is not caused by the repo. `node --no-opt <script>` works for
tsc/eslint/jest, but Next rejects `--no-opt` for its workers (`ERR_WORKER_INVALID_EXEC_ARGV`)
and `--jitless` has no WebAssembly for Turbopack. **Fix: Node 22 LTS (what CI uses).** Full
detail in PROJECT_CONTEXT Known Issue #52. Do not commit flags into the build scripts.

### RELEASED (same day)

The Node blockage was cleared without a system change: the official **portable** Node 22.23.3
zip was unpacked to `~/.local/node22/` and put FIRST ON PATH for the release commands. Nothing
was installed system-wide, no PATH change was made for the user, and deleting the folder undoes
it. The one non-obvious step: Node 22 as the parent is NOT enough — Turbopack's PostCSS helper
resolves `node` from PATH, so with the broken 24 still first the build died with
`os error 10054` / `TurbopackInternalError` while processing `globals.css`. PATH ORDER is the
fix, not the choice of binary. (`~/.local/node22/env.sh` sources it for a shell; the durable fix
is still `winget install OpenJS.NodeJS.LTS`.)

- `next build` clean (25 pages) · `check-seo` OK (25 pages / 16 sitemap URLs) · 286 tests ·
  contrast 32/32 AA
- `git push origin development` (0ff69a1..183c3ba)
- `firebase deploy --only firestore:rules,storage` — both rules files COMPILED and released,
  which also validated the new `product_photos` / `product-photos` blocks that could not be
  checked offline
- `firebase deploy --only hosting` — 263 files
- Live check: `/`, `/shop/`, `/admin/login/`, `/admin/`, `/product/` all 200, and the five new
  admin surfaces (`Product Photo Library`, `Bulk update products`, `Add every combination`,
  `Pins onto these categories`, `Apply a saved blank`) are present in the deployed chunk

### Help guide pass (same day, after the release)

The admin guide was re-written against the DEPLOYED admin rather than from the previous
text: four new entries (product photos, duplicates, description formatting, using the guide),
a new tutorial for reusing a blank garment, and corrections to eight existing entries —
including a stale tab list, a typo in the auto-pin instructions, print zones described as
typed percentages when they are dragged, and the missing parent/subcategory hierarchy. The
offline-cache hard refresh is now documented, because it has repeatedly made a deployed
change look absent.

Each claim was verified before it was written (the service worker's constant CACHE_NAME, the
duplicate-merge labels, the print-zone drag editor, the toolbar buttons, category parents).
The file header now states the rule the guide has twice broken: it must describe what the
admin does, and its entry changes in the same commit as the feature. Deployed and confirmed
present in the live admin chunk.

### Pending / Next
- [ ] Durable fix for the machine: `winget install OpenJS.NodeJS.LTS` (or update 24.x — the
      crash is a V8 fault in 24.15.0 specifically)
- [ ] The shop-page change from the earlier plan stays dropped unless asked for
- [ ] Optional follow-up once the library is in use: batch-apply photos to products *matching a
      blank already applied* is covered, but re-pointing a whole category at a different blank
      is not
- [ ] The `designIds` read-path refactor remains the honest fix for Known Issue #53; the
      refresh-on-save in this session is the stopgap
- [ ] The admin surfaces have NOT been clicked through by a person yet (they sit behind the
      admin login, and a localhost origin has no session) — see Known Issue #51 for why a
      rendered pixel check matters more than a computed-style one

