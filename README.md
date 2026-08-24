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
  app/                 # Next.js App Router pages (20 routes)
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
    index.ts           # 14 Cloud Functions (checkout, orders, customer, config, admin)
    pricing.ts         # Server-side order pricing (pure, integer-cents math)
public/                # Static assets (logo, manifest, sw.js)
```

---

## Key Architecture Decisions

- **Firestore is the master catalog** — Square is payment-only (catalog sync removed in Phase 1, 2026-08). Products are edited in the admin dashboard.
- **Server-side pricing** — `createSquareOrderAndPay` re-derives every price, add-on, and shipping amount from Firestore (`functions/src/pricing.ts`) and rejects orders whose client total diverges >2¢. Client-sent amounts are never charged.
- **`createSquareProduct`** is an optional one-way push to Square for POS linkage.
- **Static export** (`output: "export"` in next.config.ts) — no SSR; 20 routes emit 22 static HTML files to Firebase Hosting.
- **Admin-only catalog writes** — Firestore and Storage rules restrict product/design/category/config writes to admins; public content stays readable.
- **Fuzzy search** — programmatic `fuzzyScore` matching in `src/hooks/useSearch.ts` (Genkit/AI search removed).
- **Firestore `undefined` safety** — all client writes pass through `stripUndefined()` (src/lib/firestore-utils.ts); the SDK rejects `undefined` values.
- **Branching** — `master` = stable/deployed, `development` = working branch. See DEVELOPMENT.md.

---

## Documentation

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Schema Reference](docs/SCHEMA.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Gap Analysis](GAP_ANALYSIS.md)
- [Project Context](PROJECT_CONTEXT.md)
