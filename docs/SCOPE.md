# Animas Reflections — Master Scope Document v1.0

**Project:** Animas Reflections Headless E-Commerce PWA  
**Client:** Cindy, Owner-Operator — Animas Reflections (Durango, CO)  
**Business:** Custom screen printing, embroidery, sublimation, direct-to-film printing — apparel, merchandise, jewelry, signs, glassware, metal panels, pet/auto products  
**Document Type:** Working master scope — updated incrementally as development progresses  
**Last Updated:** 2026-08-24  
**Live (Current Site):** https://www.animasreflections.com (Square Online template)  
**Live (New PWA):** https://animas-reflections-pwa.web.app (Firebase Hosting)  
**GitHub:** https://github.com/MaryTheadoor/animas-reflections-pwa  

---

## 1. EXECUTIVE SUMMARY

### 1.1 Core Objective
Completely overhaul the existing e-commerce storefront, transitioning from a restrictive built-in Square/Shopify template to a custom, high-performance, headless Progressive Web App (PWA).

### 1.2 Strategic Goals
- **Decouple** frontend presentation from transactional backend
- **Maintain Square** for payment processing only; **Firestore** is the master product catalog (Square catalog sync removed 2026-08)
- **Eliminate** Shopify monthly overhead fees entirely
- **Introduce** a flagship Pseudo-3D Product Customizer Canvas Engine for local bands, sports teams, school clubs, and retail consumers to preview, modify, and build custom merchandise
- **Deliver** a full-featured on-site product management system (CMS) for the business owner
- **Provide** complete user account management with order tracking via carrier-provided tracking URLs

### 1.3 Business Context
- Family-owned and operated since 1999 (Durango, CO)
- Print operation: screen printing, embroidery, sublimation, direct-to-film
- Serves: bands/musicians, sports teams, school clubs, local businesses, individual consumers
- Sub-brands: **Biscuit Hockey** (hockey apparel, est. 2021), **I'M OK R U** (mental health positivity apparel, est. 2021)
- Fundraising program: 50/50 profit split, no upfront costs, no minimums
- Current Square catalog: ~405 website-visible products, 74 POS-only

---

## 2. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 16.2.7 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Hosting | Firebase Hosting (CDN) | — |
| Backend Runtime | Firebase Cloud Functions | Node.js 22, Gen 2 |
| Database | Cloud Firestore (NoSQL) | — |
| File Storage | Firebase Storage | — |
| Authentication | Firebase Auth (Email/Password + Google) | — |
| Payment Processing | Square Web Payments SDK + Square API | v42 |
| AI/ML (removed) | Genkit + Gemini SDK — removed 2026-08 | — |
| PWA | Service Worker + Web App Manifest | — |
| Deployment Mode | Static Export (`output: "export"`) | — |

---

## 3. DESIGN SYSTEM

### 3.1 Brand Identity — "Clean Modern-Rustic"
Combines the efficiency of clean web apps with the approachable warmth of a local independent print shop, inspired by Southwest Colorado's natural warm sunsets and earth tones.

### 3.2 Color Palette
| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Background | `#FAF6F0` | `cream` | Page backgrounds |
| Section Alternates | `#F5EBE6` | `warm-sand` | Section grouping tint |
| Brand Tone | `#1E4D4F` | `teal` / `brand` | Nav links, headings (h1/h2), text |
| Accent/CTAs | `#D97706` | `gold` | Buttons, links, pricing, announcements |
| CTA Hover | `#E68A00` | `gold-light` | Button hover states |
| Highlight/Accent | `#935B8A` | `plum` | Badges, hover states, secondary categories |
| Dark Mode BG | `#0F172A` | `midnight` | Dark mode background |

### 3.3 Typography
- **Primary:** Vesper Libre (serif, loaded via next/font)
- **Fallback:** System serif stack

### 3.4 UI Ergonomics (S.I.T.E.S Protocol)
- **Rounded Geometry:** All buttons, cards, inputs use `rounded-xl` to `rounded-2xl` (12-16px radius)
- **Shadows:** Soft diffused ambient drops (`box-shadow: 0 4px 20px -2px rgba(30,77,79,0.05)`)
- **Tactile Buttons (.btn-tactile):** Solid depth with bottom-border simulating height, 3D press effect
- **Glassmorphism (.glass-card):** `backdrop-blur` on translucent white/slate backgrounds
- **Self-Aware Tile Grid (.tile-grid-sites):** CSS Grid `auto-fit, minmax(280px, 1fr)`
- **Floating Dock Nav (.nav-dock):** Pill-shaped, glassmorphism, fixed to top within wrapper
- **Dark Mode:** `html.dark body` switches to midnight slate (#0F172A) with adjusted glass cards

### 3.5 Accessibility
- WCAG AA compliance target
- All interactive elements keyboard-navigable
- Sufficient color contrast ratios

---

## 4. FEATURE SCOPE — COMPLETE BREAKDOWN

---

### 4.1 PUBLIC STOREFRONT (20 Route Dirs → 22 Static Pages)

| Route | Page | Key Features |
|-------|------|-------------|
| `/` | Home | Hero with logo/CTAs, announcement banner, featured products grid, fundraising teaser, band merch teaser, Our Story glass card, FAQ teaser, footer with nav/socials/policies |
| `/shop` | Catalog | Category filter pills, search input, sort (price/name/newest), Browse Mode toggle (design/type), ProductCard grid, loading/error/empty states |
| `/product?id=` | Product Detail | Variation picker (size × color), custom text input, price display, "Customize & Order" CTA, breadcrumb, Product JSON-LD structured data, image gallery |
| `/customizer?product=` | Customizer | Pseudo-3D mockup canvas, product selector, design upload, design library browser (Firestore), view tabs (front/back/sleeve), add-on toggles ($5 each), price summary, drag/resize design overlay |
| `/checkout` | Checkout | Square Web Payments SDK card input, customer/shipping form, order summary, cart line items display, shipping tier calculation, card tokenization, `createSquareOrderAndPay` callable |
| `/order-confirmation` | Confirmation | Order ID display, success state, continue shopping/home links |
| `/search` | Search | Fuzzy search bar (programmatic `fuzzyScore` in `src/hooks/useSearch.ts`), category filter pills, color filter toggles, sort dropdown, results grid |
| `/account` | Account (auth-gated) | Orders tab (expandable details, carrier tracking URL), Addresses tab (CRUD), Settings tab (profile edit) |
| `/about` | About | Our Story content, contact info, glass card |
| `/contact` | Contact | Phone/email links, privacy note |
| `/custom` | Custom Orders | "Design Your Own" info, email CTA |
| `/faq` | FAQ | 16 expandable questions, contact CTA |
| `/fundraising` | Fundraising | Program details (50/50 split, how it works, who it's for), active fundraiser products from catalog, CTA |
| `/terms` | Terms | 13-section Terms of Sale (FOB Origin, Durango CO) |
| `/biscuit-hockey` | Sub-brand | Biscuit Hockey brand page |
| `/im-ok-r-u` | Sub-brand | I'M OK R U brand page |
| `/admin` | Admin Dashboard | See Section 4.4 |
| `/admin/login` | Admin Login | Email/password + Google sign-in, redirect if already admin |
| `/_not-found` | 404 | Gold heading, back-to-home link |

---

### 4.2 FLAGSHIP: PSEUDO-3D PRODUCT CUSTOMIZER CANVAS ENGINE

#### Concept
Instead of expensive WebGL/Three.js rendering (which degrades mobile battery and load times), the customizer achieves visual excellence through **layered coordinate-based assets** on HTML5 `<canvas>`.

#### Architecture

1. **Asset Foundation:** Every product has high-definition pre-rendered stills for each view angle:
   - `front.png`, `back.png`, `sleeve.png` for apparel
   - Single view for non-apparel (stickers, signs, jewelry, etc.)

2. **Print Zone Metadata Matrix (Firestore):**
   ```json
   {
     "product_id": "SQ_CAT_HEAVY_TEE",
     "views": {
       "front": {
         "base_image": "https://storage.firebase.../heavy_tee_front.png",
         "print_zone": {
           "x_percent": 32.5, "y_percent": 24.0,
           "width_percent": 35.0, "height_percent": 42.0
         }
       },
       "back": {
         "base_image": "https://storage.firebase.../heavy_tee_back.png",
         "print_zone": {
           "x_percent": 25.0, "y_percent": 18.5,
           "width_percent": 50.0, "height_percent": 55.0
         }
       }
     }
   }
   ```

3. **Client Rendering:**
   - HTML5 `<canvas>` overlays transparent PNG design onto base product image
   - CSS `mix-blend-mode: multiply` to simulate ink-on-fabric appearance
   - **Simple distortion** applied to conform design to natural fabric ripples/wrinkles in mockup
   - Pointer events for drag-to-reposition, wheel for scale, rotate buttons
   - Text input tool: font picker, color, sizing on overlay

4. **Design Sources:**
   - Pre-loaded design library from Firestore `designs/` collection (Cindy's band logos, team graphics)
   - User upload (Firebase Storage, auth-gated, 10MB limit, PNG/JPEG/WebP)
   - Text tool for name/number personalization

5. **Pricing:**
   - Base product price from Square variant
   - $5 per add-on placement (Back Print, Sleeve Print, Name/Number Personalization)
   - Real-time total calculation as user toggles options

#### Current Status
- Canvas component built with view tabs, drag/resize stubs, image overlay
- Print zone metadata type system defined (`PrintZone`, `PrintZoneTemplate`, `ProductView`)
- View generation logic tested (4 test cases in `customizer/__tests__/views.test.ts`)
- **REMAINING:** Finish drag-to-reposition interactivity, fix iOS Safari touch compatibility, integrate design library browser, complete text tool, wire upload-to-canvas pipeline end-to-end

---

### 4.3 USER ACCOUNT & ORDER TRACKING

#### Features
- **Authentication:** Firebase Auth — Email/Password + Google Sign-In
- **Account Page (`/account`):**
  - **Orders Tab:** Fetches from Square via `fetchCustomerOrders` + `fetchRecentOrders`. Expandable rows showing order items, totals, status. **Carrier tracking URL** displayed when order ships (propagated from Square fulfillment or manually set via admin)
  - **Addresses Tab:** CRUD for saved shipping addresses (Firestore subcollection `customers/{uid}/addresses/`)
  - **Settings Tab:** Edit profile display name/email (Firestore `customers/{uid}` doc)
- **Underlying Functions:** `fetchCustomerOrders`, `getCustomerAddresses`, `saveCustomerAddress`, `deleteCustomerAddress`, `getCustomerProfile`, `saveCustomerProfile`, `updateOrderTracking`

#### Current Status
- Account page fully built (`src/app/account/page.tsx`, 496 lines)
- All supporting Cloud Functions deployed
- **REMAINING:** End-to-end test of order tracking URL propagation, test address CRUD edge cases

---

### 4.4 ADMIN CMS DASHBOARD (`/admin`)

#### Access Control
- Gated behind `RequireAdmin` component
- Admin email list in Firestore `config/admin` doc + `NEXT_PUBLIC_ADMIN_EMAIL` env var
- Login page at `/admin/login` with friendly error messages

#### Tabs & Functionality

| Tab | Component | Functionality |
|-----|-----------|--------------|
| **Products** | `ProductManager` (781 lines) | Full CRUD: name, category, description, active/featured toggle, variants, colors, tags, images. Matrix editor for bulk variant creation. "Push to Square" → runs `createSquareProduct` function (optional one-way push for POS linkage). Bulk actions: activate/deactivate/delete, duplicate |
| **Categories** | `CategoryManager` (229 lines) | Full CRUD: inline rename, reorder (move up/down), add/delete |
| **Images** | `ImageManager` (378 lines) | Gallery viewer, drag-and-drop upload to Firebase Storage (`products/{id}/`), mockup image assignment (front/back/sleeve), delete |
| **Settings** | SiteConfig form | Visual color pickers for CSS variables, sitewide announcement banner text, shipping rates. Reads/writes `config/site` Firestore doc |
| **Designs** | Design Catalog | Upload/remove design assets to Firebase Storage + Firestore `designs/` collection, populates customizer dropdown |
| **Orders** | OrdersSection | Fetches recent orders from Square via `fetchRecentOrders`, table display |
| **Users** | UsersSection | Reads Firestore `users/` collection for admin view |
| **Admins** | Admin management | Add/remove admin email addresses |

#### Current Status
- All CMS tabs built with components
- Product Manager is the most complete (781 lines)
- **REMAINING:** Wire "Push to Square" end-to-end, add inventory count display, add order tracking update capability, add pagination/filtering to Orders/Users

---

### 4.5 SQUARE INTEGRATION

#### Data Flow
```
Admin Dashboard (Products tab — ProductManager CRUD)
    ↓ writes ManagedProduct docs
Firestore products/ (master catalog)
    ↓ useCatalog() hook → managedToCatalogItem()
Client Components (Shop, Product, Customizer, Fundraising)
    ↓ CartContext reducer
Checkout Page → Card Tokenization (Square Web Payments SDK)
    ↓ createSquareOrderAndPay() Cloud Function
    (re-derives all prices server-side from Firestore — never trusts client amounts)
Square Orders API → Payment Processing (Square is payment-only)
    ↓ returns orderId, paymentId, status
Order Confirmation Page
```

#### Functions Deployed (14 total)
| Function | Trigger | Purpose |
|----------|---------|---------|
| `createSquareOrderAndPay` | Callable | Builds Square order + processes payment; re-derives all prices server-side from Firestore, never trusts client amounts |
| `health` | HTTPS | Status check endpoint |
| `fetchSiteConfig` / `saveSiteConfig` | Callable | Site config CRUD |
| `saveAdminEmails` | Callable | Admin email management |
| `fetchRecentOrders` | Callable | Returns last 50 Square orders |
| `createSquareProduct` | Callable | Optional one-way push of an admin product from Firestore → Square for POS linkage |
| `fetchCustomerOrders` | Callable | Returns orders for authenticated user |
| `getCustomerAddresses` / `saveCustomerAddress` / `deleteCustomerAddress` | Callable | Address CRUD |
| `getCustomerProfile` / `saveCustomerProfile` | Callable | Profile CRUD |
| `updateOrderTracking` | Callable | Update carrier tracking URL on order |

Removed 2026-08 with the Square→Firestore catalog-sync architecture: `fetchSquareCatalog`, `syncProducts`, `importProducts`, `runPipeline`, `scheduledSync`, `fetchSyncStatus`, `fetchPipelineStatus`, `fetchInventoryCounts`, `clearProducts` (along with `functions/src/sync.ts`, `functions/src/product-pipeline.ts`, and the admin "Catalog Sync" UI).

#### Known Issues (DO NOT REPEAT)
1. Square SDK v42 BigInt: `priceMoney.amount` is BigInt, must `Number()` before arithmetic
2. Square items have categories in `itemData.categories[]` array, not `categoryId` field
3. `ecom_visibility` filter: only "VISIBLE" items shown (405 web vs 74 POS)
4. `batchUpsert` method on `client.catalog`, not `batchUpsertCatalogObjects`

#### Current Status
- All 14 functions deployed and tested
- Square checkout flow end-to-end stubbed but not yet tested with live sandbox card
- **REMAINING:** End-to-end checkout test with Square sandbox, verify tracking URL propagation, inventory count display in admin

---

### 4.6 SHIPPING

#### Tiered Flat-Rate Model
| Tier | Rate | Applies To |
|------|------|-----------|
| Stickers & Envelopes | $3.00 | Lightweight items, stickers, jewelry |
| Apparel & Parcels | $7.50 | Shirts, hoodies, bags, signs |
| Free Shipping | $0.00 | Orders subtotal ≥ $100.00 |

#### Implementation
- Logic in cart context reducer + checkout page
- Appended as fulfillment line item during Square Order construction
- Configurable via admin settings + env vars

#### Current Status
- Implemented in `CartContext`, checkout page, constants
- **REMAINING:** Verify tier auto-detection per product type

---

### 4.7 SEO & DISCOVERABILITY

- **Meta Tags:** OpenGraph + Twitter Cards per product page
- **JSON-LD Structured Data:** `Organization`, `WebSite` (with SearchAction), `Product` per detail page
- **Heading Progression:** `<h1>` per page, `<h2>` for sections
- **Alt Text:** Auto-generated from product name/description
- **Sitemap.xml:** All routes listed (20 route dirs)
- **Robots.txt:** Crawl allowed, admin/checkout disallowed
- **Service Worker:** Cache-first strategy with offline fallback for static routes

#### Current Status
- Meta tags and JSON-LD on layout + product page
- Sitemap and robots.txt deployed
- **REMAINING:** Verify JSON-LD on all pages, ensure per-product structured data, Lighthouse audit

---

### 4.8 PWA FEATURES

| Feature | Status |
|---------|--------|
| Web App Manifest | Deployed (`manifest.json`, 4 icon sizes incl. maskable) |
| Service Worker | Deployed (`sw.js`, cache-first for GET, v2 cache) |
| Installable | Standalone display, portrait-primary |
| Offline Support | Static routes cached, dynamic content requires network |
| Push Notifications | Not yet implemented |

---

## 5. DATA ARCHITECTURE

### 5.1 Firestore Collections

| Collection | Document | Access | Purpose |
|-----------|----------|--------|---------|
| `products/` | `{productId}` | Public read, Auth write | ManagedProduct docs (master catalog, edited via admin dashboard) |
| `categories/` | `{categoryId}` | Public read, Auth write | ManagedCategory docs |
| `config/site` | `site` | Public read, Auth write | Global site config (colors, banner, rates) |
| `config/admin` | `admin` | Auth read/write | Admin email addresses |
| `config/sync_status` | `sync_status` | Auth read/write | Last catalog sync timestamp/results — removed 2026-08 with catalog sync |
| `designs/` | `{designId}` | Public read, Auth write | Design assets for customizer library |
| `users/` | `{uid}` | Auth read/write (own only) | User profile data |
| `orders/` | `{orderId}` | Auth read, no write | Order records |
| `customers/` | `{uid}` | Auth read/write (own only) | Customer profile |
| `customers/{uid}/addresses/` | `{addressId}` | Auth read/write/delete (own) | Saved shipping addresses |

### 5.2 Firebase Storage Structure
| Path | Access | Purpose |
|------|--------|---------|
| `products/{productId}/` | Public read, Auth write | Product images, mockups, gallery |
| `designs/{designId}` | Public read, Auth write | Customizer design library assets |
| `uploads/{userId}/` | Public read, Auth create (own) | User-uploaded custom designs |

### 5.3 Key Data Types
See `src/types/index.ts` for all interfaces (26 types):
`ManagedProduct`, `ManagedVariant`, `ManagedCategory`, `SquareCatalogItem`, `SquareVariation`, `CartItem`, `CartAddon`, `ShippingTier`, `SiteConfig`, `PrintZone`, `PrintZoneTemplate`, `ProductView`, `ProductTemplate`, `DesignAsset`, `ProductType`, `CustomerAddress`, `CustomerProfile`, `CustomerOrder`, `OrderStatus`, `OrderLineItem`, `OrderShipping`, `OrderTotals`, `SyncStatus`
See `docs/SCHEMA.md` for full schema reference.

---

## 6. IMPLEMENTATION PHASES & STATUS

### Phase 1: Workspace & Initialization — COMPLETE
- [x] Git repo, directory structure, framework install (Next.js 16, Tailwind v4)
- [x] Firebase init (Hosting, Firestore, Functions, Storage, Auth, Emulators)
- [x] Core config files (next.config.ts, tsconfig.json, firebase.json, etc.)

### Phase 2: Square API Gateway & Serverless Layer — COMPLETE
- [x] Cloud Functions deployed and tested (now 14 total)
- [x] Square catalog fetch + sync pipeline *(removed 2026-08 — Firestore is now the master catalog)*
- [x] Product pipeline (brand detection, type classification, color/size extraction) *(removed 2026-08)*
- [x] Order creation + payment processing
- [x] Square Web Payments SDK integrated on checkout

### Phase 3: Customizer Component — IN PROGRESS (~70%)
- [x] Canvas component with view tabs (front/back/sleeve)
- [x] Image overlay with basic positioning
- [x] Print zone metadata type system + view generation logic
- [x] Design file upload to Firebase Storage
- [x] Product selector and add-on toggle pricing
- [ ] **Drag-to-reposition** design overlay (pointer events)
- [ ] **Scale/rotate** design overlay (wheel + buttons)
- [ ] **Text tool** (font picker, color, sizing on canvas)
- [ ] **Design library browser** (Firestore designs/ collection)
- [ ] **iOS Safari touch compatibility** fix
- [ ] **Simple distortion** to conform design to fabric ripples (CSS mix-blend-mode or canvas transform)
- [ ] **Upload-to-canvas pipeline** end-to-end
- [ ] **Mobile responsive canvas** (viewport-aware sizing)

### Phase 4: Order Assembly & Checkout — COMPLETE (needs testing)
- [x] Cart context with reducer (add/remove/quantity/addon/clear)
- [x] Cart drawer with items, subtotal/shipping/total
- [x] Checkout page with Square card input + shipping form
- [x] Order confirmation page
- [ ] **End-to-end sandbox purchase test**
- [ ] **Shipping tier auto-detection per product type**
- [ ] **Error recovery** for payment failures (retry, clear card, messages)

### Phase 5: Admin CMS Dashboard — IN PROGRESS (~85%)
- [x] All tabs built (Products, Categories, Images, Settings, Designs, Orders, Users, Admins)
- [x] Product CRUD with variant matrix editor
- [x] Category CRUD with reorder
- [x] Image upload + mockup assignment
- [x] Site config form with color pickers
- [x] Admin auth gating
- [ ] **Wire "Push to Square"** end-to-end with progress/error feedback
- [ ] **Inventory count display** per variant
- [ ] **Order tracking update** capability
- [ ] **Pagination/filtering** on Orders and Users tables

### Phase 6: PWA Optimization & Launch — PARTIAL (~50%)
- [x] Web app manifest with icons
- [x] Service worker (cache-first)
- [x] robots.txt + sitemap.xml
- [x] JSON-LD on layout + product page
- [ ] **Verify JSON-LD on all routes**
- [ ] **Per-product structured data** (full Product schema)
- [ ] **Lighthouse audit** (target 90+ on all categories)
- [ ] **Cross-browser testing** (Chrome, Firefox, Safari, mobile)
- [ ] **iOS Safari PWA install test**
- [ ] **Android Chrome PWA install test**
- [ ] **Offline fallback test** for all static routes
- [ ] **Domain DNS cutover** from Square registrar to Firebase Hosting
- [ ] **Analytics integration** (Firebase Analytics or GA4)
- [ ] **Production .env** configuration (Square prod tokens)

---

## 7. CURRENT STATE — WHAT EXISTS IN THE CODEBASE

### Frontend (87+ source files)
| Category | Files | Status |
|----------|-------|--------|
| Pages (20 route dirs) | 22 static HTML files | All built, 16 server, 2 client-hydrated |
| Components | 17 groups | All built |
| Context Providers | 4 | Auth, Cart, SiteConfig, Theme — all built |
| Hooks | 3 | useCatalog, useSearch, useSiteConfig — all built |
| Library | 4 | constants, content, firebase, synthetic-data — all built |
| Types | 1 | 26 interfaces — all defined |
| Tests | 4 suites | search, catalog, cart, customizer views — all passing |
| Styling | 1 file | globals.css — brand theme, dark mode, S.I.T.E.S protocol |

### Backend (2 source modules, ~1,120 LOC)
| Module | Lines | Purpose |
|--------|-------|---------|
| `functions/src/index.ts` | 828 | All 14 Cloud Functions |
| `functions/src/pricing.ts` | 294 | Server-side order pricing (pure integer-cents math) |

`functions/src/sync.ts` and `functions/src/product-pipeline.ts` were DELETED (2026-08) along with the Square→Firestore catalog-sync architecture.

### Build Output
- Static export generates `out/` (20 route dirs → 22 static HTML files)
- Firebase Hosting serves from `out/`
- `next.config.ts`: `output: "export"`, `trailingSlash: true`, `images: { unoptimized: true }`

### Synthetic Data Toggle
- `src/hooks/useCatalog.ts` line ~6: `const USE_SYNTHETIC = true`
- `true` = 24 mock products + 21 categories (for UI development)
- `false` = real Firestore data (master catalog in `products/` + `categories/`)
- **Must switch to `false` before production launch**

---

## 8. KNOWN TECHNICAL CONSTRAINTS & GOTCHAS

1. **Nav dock**: Uses a fixed wrapper div with CSS variable `--header-height`. Do NOT apply `position: fixed` directly to nav-dock. Do NOT add bottom navigation bars.
2. **Mobile nav**: CSS Grid `repeat(4, 1fr)` for 2-row layout. Desktop: centered pill `max-width: fit-content; margin: 0 auto`.
3. **Hero overlap**: Add `pt-12 sm:pt-16` to hero to clear fixed header.
4. **Images**: Only Square/Firebase images should render. Fallbacks use `PlaceholderImage` SVG. No external hotlinked images.
5. **Cart button**: Only in nav dock (`CartNavButton`). No floating cart button.
6. **Hydration**: Static export causes hydration mismatches. Use `useEffect(() => setMounted(true))` pattern for browser-only state.
7. **Square v42 BigInt**: Always `Number()` price amounts before arithmetic.
8. **Firestore writes**: All client writes require Firebase Auth. Admin UI protected by `RequireAdmin`. Functions use admin SDK (bypass rules).
9. **Static export limitation**: No SSR, no API routes. All dynamic data via client-side Firestore reads + Cloud Functions callables.

---

## 9. ROADMAP — PRIORITY ORDER

### Immediate (Next Session)
1. Run `npm run lint` + `npm test` — fix any issues
2. Customizer: finish drag-to-reposition + scale/rotate
3. Switch `USE_SYNTHETIC=false` — test with real Firestore data

### Short-Term (This Week)
4. End-to-end checkout test with Square sandbox
5. Wire "Push to Square" in admin
6. Account page: test order tracking URL propagation
8. iOS Safari touch compatibility on customizer canvas

### Medium-Term (Next 1-2 Weeks)
9. Customizer text tool (font, color, size)
10. Design library browser (Firestore designs/)
11. Inventory count display in admin
12. Order tracking update capability in admin
13. Pagination/filtering on Orders/Users tables
14. Lighthouse audit + PWA optimization
15. Cross-browser + mobile device testing

### Pre-Launch
16. Production .env configuration (Square prod tokens)
17. DNS cutover from Square registrar to Firebase Hosting
18. Final security audit (Firestore rules, Storage rules, function permissions)
19. Analytics integration
20. Soft launch + monitoring

### Future (Post-Launch)
21. AI/Genkit semantic product search (requires Gemini API key)
22. Email notifications (order confirmation, shipping updates via SendGrid/etc.)
23. Band merch campaign landing page builder
24. Fundraising portal dashboard for organizers
25. Multi-language support
26. Push notifications (web push API)

---

## 10. ENVIRONMENT & CREDENTIALS

### Required Environment Variables
**Frontend (`.env.local`):**
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

**Functions (`functions/.env`):**
```
SQUARE_ACCESS_TOKEN
SQUARE_ENVIRONMENT
SQUARE_LOCATION_ID
```

### Credential Sources (External to Repo)
- Square App ID + Access Token: `Desktop\animasreflections square API info.txt`
- Gemini API Key: `Downloads\animas gemini key.txt`
- Firebase Config: Already in `.env.local` (gitignored)
- `.env.example` committed (safe template)

### Firebase Console
- Project: `animas-reflections-pwa` (ID: 508402195460)
- Console: https://console.firebase.google.com/project/animas-reflections-pwa
- Emulators: `npm run emulators` (Auth:9099, Functions:5001, Firestore:8080, Hosting:5000)

---

## 11. DOCUMENTATION INDEX

| Document | Location | Purpose |
|----------|----------|---------|
| **SCOPE.md** (this file) | `docs/SCOPE.md` | Master scope, features, phases, status |
| **DEVLOG.md** | `docs/DEVLOG.md` | Chronological development log for session restore |
| Architecture | `docs/ARCHITECTURE.md` | System diagrams, data flows, component tree |
| Schema | `docs/SCHEMA.md` | Firestore collections, types, storage structure |
| Development | `docs/DEVELOPMENT.md` | Commands, conventions, troubleshooting |
| Project Context | `PROJECT_CONTEXT.md` | Recovery blueprint, known issues, design system |
| README | `README.md` | Project overview, quick start |

External references:
- Full roadmap: `Downloads\animas_reflections_scope_roadmap.md`
- Existing site content: `Downloads\animas_reflections\` (HTML snapshots)
- Square site copy: `Desktop\animasreflections copy.txt`

---

## 12. WORKFLOW & DEVELOPMENT RIGOR

### Backup Framework (3-Layer Redundancy)
| Layer | Location | Trigger |
|-------|----------|---------|
| Git + GitHub | `origin/master` | Every edit via `backup:commit` |
| Local Full Snapshots | `C:\Users\AmosA\Backups\animas-reflections-pwa\full-snapshots\` | `backup:snapshot` |
| Pre-Edit File Backups | `_backups/pre-edit/` + redundant disk copy | `backup:file` before every edit |

### Standard Edit Workflow
```bash
npm run backup:file -- src/path/to/file.tsx    # 1. Snapshot before editing
# [make edits]
npm run backup:commit -- -Message "feat: ..."  # 2. Commit + push + redundant local copy
```

### Pre-Deploy Checklist
1. `npm run lint` — 0 errors required
2. `npm run test` — all suites pass
3. `npm run build` — generates 22 static HTML files (20 route dirs)
4. `cd functions && npm run build` — compiles clean
5. `firebase deploy` — deploy all

### Available Commands
```bash
npm run dev                 # Next.js dev server
npm run build               # Static export → out/
npm run build:all           # Build frontend + functions
npm run lint                # ESLint
npm run test                # Jest
npm run emulators           # Firebase emulators
npm run deploy              # Full Firebase deploy
npm run deploy:functions    # Functions only
npm run deploy:hosting      # Hosting only
npm run backup:file         # Pre-edit file backup
npm run backup:commit       # Commit + push + redundant copy
npm run backup:snapshot     # Full project snapshot
npm run backup:list         # List available backups
npm run backup:restore      # Restore from backup
```

---

*This document is version 1.0 and will be updated incrementally as development progresses. Last updated: 2026-08-24.*
