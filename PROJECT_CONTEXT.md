# Animas Reflections PWA — Project Context & Recovery Blueprint
## Session: June 5, 2026 | Build Instance Context File

---

## 1. PROJECT OVERVIEW

**Client:** Cindy, Animas Reflections (Durango, CO)
**Business:** Custom screen printing, embroidery, sublimation apparel and merchandise
**Current Live Sites:**
- https://www.animasreflections.com (Square Online — existing site)
- https://animas-reflections-pwa.web.app (Firebase Hosting — NEW PWA)

**Goal:** Replace restrictive Square/Shopify template with a custom headless PWA using Square as backend API.

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.7 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Hosting | Firebase Hosting |
| Backend | Firebase Cloud Functions (Node.js 22, TypeScript) |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Auth | Firebase Authentication (Google + Email/Password) |
| Payments | Square Web Payments SDK + Square API v42.3.0 |
| AI/ML | Genkit + Gemini SDK (installed but not active) |
| Version Control | GitHub: https://github.com/MaryTheadoor/animas-reflections-pwa |

---

## 3. DEPLOYMENT MODE

**Static Export:** `output: "export"` in next.config.ts
- Build: `npm run build` → generates `out/` directory (164 files)
- Deploy: `firebase deploy --only hosting`
- Functions: `firebase deploy --only functions`

---

## 4. ALL ROUTES (16 total)

| Route | File | Purpose |
|---|---|---|
| `/` | src/app/page.tsx | Homepage with hero, featured products, our story |
| `/about` | src/app/about/page.tsx | Our Story |
| `/shop` | src/app/shop/page.tsx | Product catalog with category hierarchy, search, sort |
| `/product` | src/app/product/page.tsx | Product detail page (query param ?id=) |
| `/customizer` | src/app/customizer/page.tsx | Interactive design customizer |
| `/checkout` | src/app/checkout/page.tsx | Cart + Square payment form + customer info |
| `/admin` | src/app/admin/page.tsx | CMS Dashboard (settings, designs, orders, users) |
| `/admin/login` | src/app/admin/login/page.tsx | Admin auth page |
| `/contact` | src/app/contact/page.tsx | Contact info |
| `/custom` | src/app/custom/page.tsx | Design Your Own info |
| `/terms` | src/app/terms/page.tsx | Terms of Sale |
| `/biscuit-hockey` | src/app/biscuit-hockey/page.tsx | Sub-brand page |
| `/im-ok-r-u` | src/app/im-ok-r-u/page.tsx | Sub-brand page |
| `/_not-found` | | 404 |

---

## 5. KEY FILES

| File | Purpose |
|---|---|
| src/lib/content.ts | Centralized site copy (HERO, OUR_STORY, ANNOUNCEMENT, etc.) |
| src/lib/content.ts | NAVIGATION, PAYMENT_METHODS, RETURN_POLICY |
| src/lib/constants.ts | SHIPPING tiers, ADDON_PRICE, SQUARE config |
| src/lib/firebase.ts | Firebase client init (db, storage, auth, functions) |
| src/lib/synthetic-data.ts | 24 test products + 21 categories (USE_SYNTHETIC=true) |
| src/hooks/useCatalog.ts | Catalog hook — toggle USE_SYNTHETIC for Square vs test data |
| src/context/cart-context.tsx | Cart state (reducer), cartOpen for drawer |
| src/context/auth-context.tsx | Firebase Auth (login, loginWithGoogle, logout, isAdmin) |
| src/context/theme-context.tsx | Dark/light mode toggle |
| src/app/globals.css | Brand theme, dark mode, nav-dock, glass-cards, S.I.T.E.S tiles |
| src/components/layout/page-layout.tsx | Shared page wrapper with nav dock |
| src/components/layout/client-layout.tsx | AuthProvider + CartProvider + ThemeProvider |
| src/components/layout/nav-auth.tsx | Login/Admin button in nav |
| src/components/cart/cart-nav-button.tsx | Cart icon in nav dock (toggles drawer) |
| src/components/cart/cart-drawer.tsx | Slide-in cart panel |
| src/components/product/product-card.tsx | Product card (links to /product?id=) |
| src/components/product/product-detail.tsx | Modal detail (legacy, replaced by /product page) |
| src/components/ui/placeholder-image.tsx | SVG image placeholder |
| src/components/home/featured-products.tsx | Homepage featured section |
| functions/src/index.ts | ALL backend functions |
| firebase.json | Hosting + Firestore + Functions + Storage config |
| firestore.rules | Public read, admin-write-only via Functions |
| storage.rules | Public read, authenticated upload |
| firestore.indexes.json | Empty indexes |

---

## 6. FIREBASE FUNCTIONS (6 deployed)

| Function | Purpose |
|---|---|
| fetchSquareCatalog | Fetches items + categories from Square, filters ecom_visibility=VISIBLE, returns categoryIds arrays |
| createSquareOrderAndPay | Creates Square order + processes payment with customer/shipping data |
| fetchSiteConfig | Returns site config from Firestore (colors, banner, shipping rates) |
| fetchRecentOrders | Returns last 50 Square orders for admin dashboard |
| syncCatalog | Groups Square items into virtual_products in Firestore (name-matching) |
| health | Status check endpoint |

---

## 7. CREDENTIALS LOCATION

| Credential | File |
|---|---|
| Square Access Token + Location ID | `animasreflections square API info.txt` on Desktop |
| Gemini API Key | `animas gemini key.txt` in Downloads |
| Firebase Config | Already in .env.local |
| All .env files | .env.local (gitignored), .env.example (committed) |

---

## 8. KNOWN ISSUES — DO NOT REPEAT

1. **Square SDK v42 BigInt issue:** priceMoney.amount is BigInt, must convert with Number() before arithmetic. Fixed in fetchSquareCatalog.
2. **Square items have NO categoryId:** Categories are in itemData.categories[] array. Fixed — returns categoryIds[] per item.
3. **ecom_visibility filter:** Only "VISIBLE" items shown. 405 website products vs 74 POS-only filtered.
4. **Nav dock stability:** DO NOT use position:fixed on nav-dock directly. Use a SINGLE fixed wrapper div containing both announcement banner and nav-dock. The nav-dock itself should NOT be position:fixed — let the parent wrapper handle positioning.
5. **Mobile nav:** Use CSS Grid `grid-template-columns: repeat(4, 1fr)` for 2-row layout on mobile. Desktop: centered pill with `max-width: fit-content; margin: 0 auto`.
6. **Hero overlap:** Add `pt-12 sm:pt-16` to hero section to push content below fixed header.
7. **Synthetic data:** Currently USE_SYNTHETIC=true. Products load instantly. Switch back when UI is stable.
8. **Images:** Only Square images should render. All fallbacks use PlaceholderImage SVG component.
9. **Cart button:** Only the nav dock cart icon (CartNavButton). No floating button. Removed.

---

## 9. DESIGN SYSTEM — DO NOT BREAK

**Brand Colors (from roadmap):**
- Cream: #FAF6F0, Warm Sand: #F5EBE6
- Teal: #1E4D4F (primary text), Teal Light: #2A6B6E
- Gold: #D97706 (CTAs/buttons), Gold Light: #E68A00
- Plum: #935B8A (highlights/badges)

**Dark Mode:** html.dark body — switches to midnight slate (#0F172A)

**S.I.T.E.S Protocol (from Nown.digital):**
- Tactile buttons (.btn-tactile): solid depth with bottom-border simulating height
- Glassmorphism cards (.glass-card): backdrop-blur, translucent white
- Self-aware tile grid (.tile-grid-sites): auto-fit, minmax(280px, 1fr)
- Floating dock nav (.nav-dock): pill-shaped, glassmorphism

---

## 10. MASTER ROADMAP REFERENCE

Location: `animas_reflections_scope_roadmap.md` in Downloads

- Phase 1: Workspace & Init (DONE)
- Phase 2: Square API Gateway (DONE)
- Phase 3: Customizer Component (STUBBED — needs interactive drag/resize)
- Phase 4: Order Assembly & Checkout (DONE — needs testing)
- Phase 5: Admin CMS Dashboard (DONE — basic)
- Phase 6: PWA Optimization & Launch (PARTIAL — manifest.json done, need JSON-LD refinement)

---

## 11. NEXT INSTANCE — START HERE

1. Read `docs/DEVLOG.md` for last session state + pending items
2. Read `docs/SCOPE.md` for full feature scope and implementation status
3. Check `USE_SYNTHETIC` flag in `src/hooks/useCatalog.ts`
4. Run `npm run dev` to test locally
5. Run `npm run build && firebase deploy --only hosting` to deploy
6. Fix UI issues BEFORE touching Square API
7. Every deploy MUST pass: build (18 routes), lint (0 errors), visual check
8. Do NOT modify nav-dock position — it's inside a fixed wrapper
9. Do NOT add bottom navigation bars — only top dock
10. All new images go through PlaceholderImage component
11. Category filtering uses item.categoryIds array (from itemData.categories)
12. Use backup framework: `backup:file` before edits, `backup:commit` after

---

## 12. SYNTHETIC DATA TOGGLE

```typescript
// src/hooks/useCatalog.ts
const USE_SYNTHETIC = true; // true = test data, false = Square API
```

When restoring Square: set to false, deploy both functions and hosting.

---

## 13. FIREBASE CONSOLE LINKS

- Project: https://console.firebase.google.com/project/animas-reflections-pwa
- Hosting: https://animas-reflections-pwa.web.app
- Authentication: Enable Email/Password + Google providers

---
END OF CONTEXT FILE
