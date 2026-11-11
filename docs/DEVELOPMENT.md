# Development Guide

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (hot reload) |
| `npm run build` | Static export → `out/` (26 pages). Needs **Node 22** — see below |
| `npm run lint` | ESLint (0 errors required before deploy) |
| `npm run emulators` | Firebase emulators (Firestore + Functions) |
| `npm run deploy` | Deploy all (functions + hosting + rules) |
| `npm run deploy:hosting` | Deploy only hosting |
| `npm run deploy:functions` | Deploy only Cloud Functions |
| `npm run deploy:hosting` | Deploy only hosting (static files) |
| `cd functions && npm run build` | Compile functions TypeScript |

## Node version — read this first

**Use Node 22 LTS.** CI uses 22 and `firebase.json` pins `nodejs22`. Node 24.15.0 crashes V8 while compiling
this project's dependencies, which breaks `tsc`, `jest`, `eslint` and `next build` alike (PROJECT_CONTEXT
Known Issue #52). On this machine a portable Node 22.23.3 lives at `~/.local/node22`:

```bash
source ~/.local/node22/env.sh   # prepends it to PATH for this shell
node -v                          # expect v22.x
```

**PATH order is what matters**, not which binary starts the build: Turbopack's PostCSS helper resolves `node`
from PATH, so leaving the broken 24 in front fails with `os error 10054` while compiling `globals.css`.
The durable fix is `winget install OpenJS.NodeJS.LTS`.

## Pre-Deploy Checklist

1. `npm run lint` — 0 errors
2. `npx tsc --noEmit` — 0 errors (a running `npm run dev` can make this fail on its own generated
   `.next/dev/types/validator.ts`; stop the server first — Known Issue #55)
3. `npm test` — 380 tests, 25 suites, all passing
4. `npm run build` — 26 pages, and the SEO gate (`check-seo`) runs automatically afterwards
5. `cd functions && npm run build` — must compile clean
6. `firebase deploy --only firestore:rules,storage` **first** if any rules changed, then
   `firebase deploy --only hosting` (or `firebase deploy` for everything)

**Steps 1–3 ARE gated on the Publish path since 2026-10-16** (PROJECT_CONTEXT §15.2): `.github/workflows/rebuild.yml`
— what the admin's Publish button dispatches — runs `npm run verify` (lint + typecheck + tests) before the build, so
a red suite or a type error stops a publish. `npm run publish` (local: build + hosting deploy) still runs only the
build, so run `npm run verify` yourself before using it.

## Branching & Rollback

**One branch: `development`.** It is the GitHub default and the branch the admin's Publish button rebuilds
(`GITHUB_PUBLISH_REF` in `functions/src/index.ts`), so what is pushed is what can be published.

| Branch | Role | Rule |
|--------|------|------|
| `development` | The only branch | GitHub default. Everything lands here. `origin/development` is the offsite rollback. |

The old two-branch model (`master` = stable, `development` = working) was retired on **2026-10-13**: `master`
was deleted after verifying every commit on it was an ancestor of `development`. It had become a divergence
hazard — two branches that both looked authoritative is how the two lines of work split in the first place.
Do not recreate a second "main" branch.

**Flow:** work on `development` → verify (lint 0, tsc clean, tests pass, build 26 pages, live UI check) → push →
`firebase deploy --only firestore:rules,storage` if rules changed, then hosting.

**Rollback options (most to least granular):**
1. `git revert <hash>` on the offending commit
2. `git reset --hard <last-good-hash>` on `development` (it is now the only branch, so reset with care)
3. Local snapshots via `npm run backup:restore` / `npm run backup:list`
4. Re-deploy a known-good commit: `git checkout <hash> && npm run build && firebase deploy --only hosting`

Note: GitHub branch *protection rules* require a Pro plan on private repos — recovery relies on the merge discipline above plus the local snapshot framework, not platform enforcement.

## Conventions

### Code Style
- All new components are `"use client"` unless purely static
- Types live in `src/types/index.ts`
- Shared constants in `src/lib/constants.ts`
- Site copy in `src/lib/content.ts`
- Firebase client init in `src/lib/firebase.ts`

### Firestore Writes
- All client writes require Firebase Auth (`request.auth != null`)
- Admin UI is protected by `RequireAdmin` component (checks `isAdmin` from `AuthContext`)
- Cloud Functions use admin SDK (bypasses rules)
- **Always write through `stripUndefined()`** (`src/lib/firestore-utils.ts`) — the Web SDK rejects any document containing `undefined` field values

### Square Integration
- `square` package v42 — uses BigInt for `priceMoney.amount`
- `getSquareClient()` in `functions/src/index.ts` — configured from env vars
- Catalog search filters `ecom_visibility === "VISIBLE"`
- `batchUpsert` method on `client.catalog` — not `batchUpsertCatalogObjects`

### Navigation
- Floating nav dock in `header-bar.tsx` — inside a fixed wrapper div
- Do NOT use `position: fixed` directly on nav-dock
- Use CSS variable `--header-height` for content padding

### Catalog Data Flow
1. `useCatalog()` hook reads Firestore `products` collection
2. `managedToCatalogItem()` maps `ManagedProduct` → `SquareCatalogItem`
3. Components consume `SquareCatalogItem` for display
4. Cart uses `variation_id` (must be valid Square variation ID for checkout)

### Image Management
- Upload via Admin → Images tab
- Images stored in Firebase Storage at `products/{productId}/`
- Mockup images stored on product doc as `mockupImages: { front?, back?, sleeve? }`
- Gallery images in `images: string[]` array
- Customizer prefers `mockupImages` per view, falls back to `image_url` → `images[0]` → placeholder

## Build Output

Static export generates 26 pages to `out/`:
```
/  /about  /account  /shop  /product  /customizer  /checkout
/admin  /admin/login  /contact  /custom  /terms
/biscuit-hockey  /im-ok-r-u  /faq  /fundraising
/search  /order-confirmation  /_not-found
```

## Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_SQUARE_APP_ID
NEXT_PUBLIC_SQUARE_LOCATION_ID
NEXT_PUBLIC_SQUARE_ENVIRONMENT
NEXT_PUBLIC_ADMIN_EMAIL
NEXT_PUBLIC_SHIPPING_TIER_STICKERS
NEXT_PUBLIC_SHIPPING_TIER_APPAREL
NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD
```

### Functions (`functions/.env`)
```
SQUARE_ACCESS_TOKEN
SQUARE_ENVIRONMENT
SQUARE_LOCATION_ID
```

## Troubleshooting

| Problem | Likely Cause |
|---------|-------------|
| "No products available" | Firestore empty — run sync from Admin |
| Payment fails | Cart items need valid Square `variation_id` — push product to Square first |
| Image upload fails | Must be signed in (auth required for write) |
| Save error "Unsupported field value: undefined" | A write contained `undefined` — always pass through `stripUndefined()` from `src/lib/firestore-utils.ts` |
| Functions deploy fails "User code failed to load. Timeout after 10000" | Transient CLI analysis timeout — just re-run `firebase deploy` |
| Rich-text description loses cursor / jumps | The contentEditable must not be overwritten while focused — keep the `descFocused` guard in product-manager |
| Stock/low-stock badge in wrong place | Absolute-positioned badges must live inside a `position:relative` container |
| Functions timeout locally | Genkit init causes emulator hang — removed, use programmatic search |
| Hydration mismatch | `useState(typeof window)` in static export — use `useEffect(() => setMounted(true))` pattern |
