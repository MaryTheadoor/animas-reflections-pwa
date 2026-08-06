# Animas Reflections PWA

Custom apparel & merchandise e-commerce PWA for Animas Reflections (Durango, CO). Replaces the Square Online template with a headless Next.js frontend, Firebase backend, and Square payment processing.

**Live:** https://animas-reflections-pwa.web.app  
**Firebase:** `animas-reflections-pwa` (project 508402195460)  
**GitHub:** `MaryTheadoor/animas-reflections-pwa`

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, TypeScript, static export) |
| Styling | Tailwind CSS v4 |
| Hosting | Firebase Hosting (`out/` directory) |
| Backend | Firebase Cloud Functions v2 (Node 22) |
| Database | Cloud Firestore |
| Storage | Firebase Storage (product images, design assets) |
| Auth | Firebase Auth (Google + email/password) |
| Payments | Square Web Payments SDK + Square API v42 |

---

## Quick Start

```bash
npm install              # Install frontend deps
cd functions && npm install  # Install function deps
npm run dev              # Local dev server (no emulators needed for UI)
npm run build            # Static export → out/
firebase deploy          # Deploy hosting + functions + rules
```

### Environment

Copy `.env.example` → `.env.local` and fill in:
- `SQUARE_ACCESS_TOKEN` — Square production token
- `SQUARE_LOCATION_ID` — Square location
- `NEXT_PUBLIC_FIREBASE_*` — Firebase config (already committed)
- `NEXT_PUBLIC_ADMIN_EMAIL` — CMS access email

Functions get their own `.env` at `functions/.env` with Square credentials.

---

## Project Structure

```
src/
  app/                 # Next.js App Router pages (19 routes)
    admin/             # CMS dashboard (products, categories, designs, images, settings, orders, users, admins)
    checkout/          # Cart + Square payment form
    customizer/        # Interactive design customizer (colors, mockups, designs, add-ons)
    product/           # Product detail page (?id=)
    shop/              # Product catalog — By Design/Brand or By Type, search, sort, tile density
    ...
  components/
    admin/             # product-manager, category-manager, image-manager, variant-matrix-editor
    cart/              # cart-drawer, cart-nav-button
    customizer/        # customizer canvas, file-upload
    layout/            # header-bar (nav dock), client-layout, json-ld
    product/           # product-card, density-picker
    ui/                # placeholder-image
  context/             # auth, cart, site-config, theme providers
  hooks/               # useCatalog, useSearch, useSiteConfig
  lib/                 # firebase, constants, content, html-utils, firestore-utils, synthetic-data
  types/               # All TypeScript interfaces
functions/
  src/
    index.ts           # 23 Cloud Functions (catalog, orders, sync, checkout, customer, config)
    sync.ts            # Square→Firestore sync with brand detection
    product-pipeline.ts # Alternative product grouping pipeline
public/                # Static assets (logo, manifest, sw.js)
```

---

## Key Architecture Decisions

- **Firestore is source of truth** for products. Square is used for payment processing.
- **`syncProducts`** pulls from Square catalog, groups items by brand, writes `ManagedProduct` docs to Firestore.
- **`createSquareProduct`** pushes admin-created products back to Square for valid payment IDs.
- **Static export** (`output: "export"` in next.config.ts) — no SSR, deployed as 213 static files.
- **All writes authenticated** — Firestore and Storage rules require `request.auth != null`.
- **AI search removed** — Genkit was replaced with programmatic `fuzzyScore` matching (same algorithm in frontend `useSearch.ts` and backend `aiSearch` function).
- **Firestore `undefined` safety** — all client writes pass through `stripUndefined()` (src/lib/firestore-utils.ts); the SDK rejects `undefined` values.
- **Branching** — `master` = stable/deployed, `development` = working branch. See DEVELOPMENT.md.

---

## Documentation

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Schema Reference](docs/SCHEMA.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Gap Analysis](GAP_ANALYSIS.md)
- [Project Context](PROJECT_CONTEXT.md)
