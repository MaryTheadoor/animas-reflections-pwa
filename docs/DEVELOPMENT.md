# Development Guide

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (hot reload) |
| `npm run build` | Static export → `out/` (18 routes) |
| `npm run lint` | ESLint (0 errors required before deploy) |
| `npm run emulators` | Firebase emulators (Firestore + Functions) |
| `npm run deploy` | Deploy all (functions + hosting + rules) |
| `npm run deploy:functions` | Deploy only Cloud Functions |
| `npm run deploy:hosting` | Deploy only hosting (static files) |
| `cd functions && npm run build` | Compile functions TypeScript |

## Pre-Deploy Checklist

1. `npm run lint` — must return 0 errors
2. `npm run build` — must generate 18 routes
3. `cd functions && npm run build` — must compile clean
4. `firebase deploy` — deploys everything

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

Static export generates 18 routes to `out/`:
```
/  /about  /shop  /product  /customizer  /checkout
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
| Functions timeout locally | Genkit init causes emulator hang — removed, use programmatic search |
| Hydration mismatch | `useState(typeof window)` in static export — use `useEffect(() => setMounted(true))` pattern |
