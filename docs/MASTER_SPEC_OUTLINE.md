# Animas Reflections PWA — Master Specification Outline

**Version:** 1.0 | **Date:** 2026-07-18 | **Project:** animas-reflections-pwa

This document is a function-by-function specification of the entire PWA. It is intended as a checklist for systematic code review, testing, and future development. Each function lists its purpose, data flow, key files, and the specific correctness checks to perform.

---

## 1. Core Infrastructure

### 1.1 Project Configuration
- **Purpose:** Define build, deployment, and environment boundaries.
- **Files:** `next.config.ts`, `firebase.json`, `tsconfig.json`, `.firebaserc`, `.env.example`
- **Checks:**
  - [ ] Static export (`output: "export"`) is enabled.
  - [ ] `trailingSlash: true` matches Firebase Hosting `trailingSlash: true`.
  - [ ] Images are unoptimized for static export.
  - [ ] `functions/` is excluded from Next.js TypeScript compilation.
  - [ ] Firebase predeploy hooks build functions before deploy.
  - [ ] No secrets are committed to `.env.example`.

### 1.2 Build & Deploy Pipeline
- **Purpose:** Produce and ship the static site and functions.
- **Commands:** `npm run build`, `npm run build:all`, `firebase deploy`
- **Checks:**
  - [ ] `npm run lint` returns 0 errors.
  - [ ] `npm test` passes all suites.
  - [ ] `npm run build` generates the expected route count.
  - [ ] `cd functions && npm run build` compiles clean.
  - [ ] Deploy uploads `out/` and all Cloud Functions.

### 1.3 Styling & Theme System
- **Purpose:** Consistent brand styling, responsive layout, dark mode.
- **Files:** `src/app/globals.css`, `src/context/theme-context.tsx`, `src/context/site-config-context.tsx`
- **Checks:**
  - [ ] Brand colors map to CSS variables and Tailwind theme.
  - [ ] Dark mode toggles `html.dark` class and persists to `localStorage`.
  - [ ] Site config colors/fonts are applied to `:root` without hydration mismatch.
  - [ ] Header height is measured and exposed via `--header-height`.
  - [ ] Mobile nav uses 2-row grid; desktop uses centered pill.

---

## 2. Layout & Navigation

### 2.1 Root Layout
- **Purpose:** Wrap every page in providers, fonts, metadata, JSON-LD.
- **Files:** `src/app/layout.tsx`
- **Checks:**
  - [ ] Metadata includes OpenGraph, Twitter, robots, manifest.
  - [ ] `OrganizationJsonLd` and `WebsiteJsonLd` are rendered.
  - [ ] `viewport` theme color matches brand primary.
  - [ ] Vesper Libre font variable is applied.

### 2.2 Client Layout
- **Purpose:** Mount context providers and service worker.
- **Files:** `src/components/layout/client-layout.tsx`
- **Checks:**
  - [ ] Provider nesting order: SiteConfig → Theme → Auth → Cart.
  - [ ] Service worker registers only in production; unregisters in dev.
  - [ ] Cart drawer wrapper has access to CartContext.

### 2.3 Header Bar (Nav Dock)
- **Purpose:** Fixed top navigation with announcement, offline banner, nav links, theme toggle, auth, cart.
- **Files:** `src/components/layout/header-bar.tsx`
- **Checks:**
  - [ ] Header uses a single fixed wrapper; `nav-dock` itself is not fixed.
  - [ ] Announcement banner reads from site config.
  - [ ] Offline banner appears when `navigator.onLine` is false.
  - [ ] Active route is highlighted.
  - [ ] Cart button opens cart drawer.

### 2.4 Page Layout
- **Purpose:** Shared page wrapper with nav dock and consistent padding.
- **Files:** `src/components/layout/page-layout.tsx`
- **Checks:**
  - [ ] Renders `HeaderBar`.
  - [ ] Applies header-height padding.

---

## 3. Public Storefront

### 3.1 Home Page (`/`)
- **Purpose:** Marketing landing page.
- **Files:** `src/app/page.tsx`
- **Checks:**
  - [ ] Hero loads logo, heading, subheading, CTAs from config/content.
  - [ ] Featured products render via `FeaturedProducts`.
  - [ ] Fundraising, band merch, FAQ teasers render.
  - [ ] Our Story glass card renders with config overrides.
  - [ ] Footer includes links, payment methods, socials, copyright.

### 3.2 Shop Page (`/shop`)
- **Purpose:** Browse catalog with filters, sort, search.
- **Files:** `src/app/shop/page.tsx`, `src/components/product/product-card.tsx`
- **Checks:**
  - [ ] Products load from `useCatalog` (Firestore only — no Square fallback; Square is payment-only).
  - [ ] Category filter pills work.
  - [ ] Search input filters by name/description.
  - [ ] Sort modes (price/name) work.
  - [ ] Empty/loading/error states handled.
  - [ ] Product cards link to `/product?id={id}`.

### 3.3 Product Detail Page (`/product?id=`)
- **Purpose:** Show product details, variant picker, add to cart.
- **Files:** `src/app/product/page.tsx`, `src/components/product/product-detail.tsx`
- **Checks:**
  - [ ] Reads `id` query param.
  - [ ] Finds product from catalog.
  - [ ] Variant picker updates price.
  - [ ] Custom text input preserved to cart.
  - [ ] "Customize & Order" links to `/customizer?product={id}`.
  - [ ] JSON-LD Product schema rendered.
  - [ ] Placeholder image used when no product image exists.

### 3.4 Customizer Page (`/customizer?product=`)
- **Purpose:** Interactive design customizer.
- **Files:** `src/app/customizer/page.tsx`, `src/components/customizer/customizer.tsx`, `src/components/customizer/file-upload.tsx`
- **Checks:**
  - [ ] Preselects product from query param.
  - [ ] Product dropdown loads active catalog.
  - [ ] Variant picker works.
  - [ ] Views (front/back/sleeve/sideL/sideR) render with correct print zones.
  - [ ] Design library loads from Firestore `designs/` collection.
  - [ ] File upload stores to `uploads/{uid}/` and returns URL.
  - [ ] Text tool sets font/color/text.
  - [ ] Drag/resize/rotate updates design state.
  - [ ] Per-view design state is preserved.
  - [ ] Add-ons toggle and update price.
  - [ ] Add to Cart creates a `CartItem` with design metadata.

### 3.5 Checkout Page (`/checkout`)
- **Purpose:** Collect shipping info, tokenize card, create Square order.
- **Files:** `src/app/checkout/page.tsx`
- **Checks:**
  - [ ] Square Web Payments SDK loads once.
  - [ ] Card input attaches to `#card-container`.
  - [ ] Customer/shipping form validates required fields.
  - [ ] Order summary shows line items, subtotal, add-ons, shipping, total.
  - [ ] `createSquareOrderAndPay` callable sends correct payload.
  - [ ] On success, redirects to `/order-confirmation` and clears cart.
  - [ ] On failure, displays error and allows retry.

### 3.6 Order Confirmation Page (`/order-confirmation`)
- **Purpose:** Post-purchase success display.
- **Files:** `src/app/order-confirmation/page.tsx`
- **Checks:**
  - [ ] Reads `orderId` and `status` from query params.
  - [ ] Displays order info.
  - [ ] Provides links to home/shop.

### 3.7 Search Page (`/search`)
- **Purpose:** Fuzzy product search with filters.
- **Files:** `src/app/search/page.tsx`, `src/components/search/search-bar.tsx`, `src/hooks/useSearch.ts`
- **Checks:**
  - [ ] Search input filters catalog.
  - [ ] Category and color filters work.
  - [ ] Sort dropdown works.
  - [ ] Empty state handled.

### 3.8 Static Content Pages
- **Pages:** `/about`, `/contact`, `/custom`, `/faq`, `/terms`, `/fundraising`, `/biscuit-hockey`, `/im-ok-r-u`
- **Checks:**
  - [ ] Content renders from `src/lib/content.ts` or site config.
  - [ ] FAQ items are expandable.
  - [ ] Contact links are clickable.
  - [ ] Terms sections render.

### 3.9 Not Found Page
- **Files:** `src/app/not-found.tsx`
- **Checks:**
  - [ ] Renders 404 with link to home.

---

## 4. User Account

### 4.1 Authentication
- **Purpose:** Sign in/up, admin detection, logout.
- **Files:** `src/context/auth-context.tsx`, `src/app/admin/login/page.tsx`
- **Checks:**
  - [ ] Email/password sign-in works.
  - [ ] Google sign-in works and handles popup cancellation.
  - [ ] Admin detection checks hardcoded email, animasreflections.com domain, and Firestore `config/admin`.
  - [ ] `RequireAdmin` blocks non-admin users.
  - [ ] User doc is synced to Firestore `users/{uid}`.

### 4.2 Account Page (`/account`)
- **Purpose:** Orders, addresses, profile management.
- **Files:** `src/app/account/page.tsx`
- **Checks:**
  - [ ] Auth-gated.
  - [ ] Orders tab fetches from `fetchCustomerOrders`.
  - [ ] Tracking URL opens carrier page.
  - [ ] Address CRUD uses `get/save/deleteCustomerAddress`.
  - [ ] Profile form uses `get/saveCustomerProfile`.

---

## 5. Admin CMS Dashboard (`/admin`)

### 5.1 Dashboard Shell
- **Purpose:** Tabbed admin interface.
- **Files:** `src/app/admin/page.tsx`
- **Checks:**
  - [ ] Admin auth gate.
  - [ ] Error boundary catches crashes.
  - [ ] Tabs render and switch correctly.

### 5.2 Products Tab
- **Purpose:** Full product CRUD, optional one-way push to Square for POS linkage.
- **Files:** `src/components/admin/product-manager.tsx`, `src/components/admin/variant-matrix-editor.tsx`
- **Checks:**
  - [ ] Product list loads from Firestore.
  - [ ] Create/edit form validates name, category, variants.
  - [ ] Variant matrix editor generates size/color combos.
  - [ ] Colors, tags, images, mockups, add-ons, designAssets editable.
  - [ ] "Push → Square" calls `createSquareProduct` and updates Square IDs.
  - [ ] Bulk activate/deactivate/delete work.
  - [ ] Duplicate product clears Square IDs.

### 5.3 Categories Tab
- **Purpose:** Manage product categories.
- **Files:** `src/components/admin/category-manager.tsx`
- **Checks:**
  - [ ] CRUD operations work.
  - [ ] Reorder updates `order` field.

### 5.4 Images Tab
- **Purpose:** Upload product images and assign mockup views.
- **Files:** `src/components/admin/image-manager.tsx`
- **Checks:**
  - [ ] Product selector loads products.
  - [ ] Upload queue processes files.
  - [ ] Mockup assignment writes to `mockupImages`.
  - [ ] Gallery images added to `images` array.

### 5.5 Designs Tab (Design Catalog)
- **Purpose:** Upload/manage design assets for the customizer library.
- **Files:** `src/app/admin/page.tsx` (Designs tab)
- **Checks:**
  - [ ] Loads designs from Firestore `designs/` collection.
  - [ ] Upload form requires name and category.
  - [ ] File uploads to `designs/{uuid}_{filename}`.
  - [ ] Firestore doc created with `id`, `name`, `description`, `category`, `image_url`, `tags`, `created_at`.
  - [ ] Delete removes both Firestore doc and Storage file.
  - [ ] Migrate tool converts old `designs/catalog` array to individual docs.
  - [ ] List displays thumbnail, name, category, description, tags.

### 5.6 Settings Tab
- **Purpose:** Site config and theming.
- **Files:** `src/app/admin/page.tsx` (Settings tab)
- **Checks:**
  - [ ] Loads `config/site`.
  - [ ] Color/font/copy/shipping/add-on fields bind to state.
  - [ ] Save calls `saveSiteConfig`.

### 5.7 Orders Tab
- **Purpose:** View recent Square orders and set tracking URLs.
- **Files:** `src/app/admin/page.tsx` (OrdersSection)
- **Checks:**
  - [ ] Loads orders via `fetchRecentOrders`.
  - [ ] Pagination controls work.
  - [ ] Tracking URL saves via `updateOrderTracking`.

### 5.8 Users Tab
- **Purpose:** Browse registered users.
- **Files:** `src/app/admin/page.tsx` (UsersSection)
- **Checks:**
  - [ ] Loads `users/` collection.
  - [ ] Handles missing `created`/`updatedAt` gracefully.

### 5.9 Admins Tab
- **Purpose:** Manage admin email list.
- **Files:** `src/app/admin/page.tsx` (Admin management)
- **Checks:**
  - [ ] Loads `config/admin` emails.
  - [ ] Add/remove updates Firestore via `saveAdminEmails`.

---

## 6. Catalog Data Layer

### 6.1 Catalog Hook
- **Purpose:** Load products and categories for the storefront.
- **Files:** `src/hooks/useCatalog.ts`
- **Checks:**
  - [ ] `USE_SYNTHETIC` toggle is `false` for production.
  - [ ] Reads Firestore `products/` and `categories/`.
  - [ ] Filters inactive products.
  - [ ] Reads Firestore only; there is no Square API fallback (Square catalog sync was removed in Phase 1).
  - [ ] Maps Firestore documents to ManagedProduct consistently.

### 6.2 Search Hook
- **Purpose:** Fuzzy text search over catalog.
- **Files:** `src/hooks/useSearch.ts`
- **Checks:**
  - [ ] Scores products by name/description/tag match.
  - [ ] Returns sorted results.

### 6.3 Site Config Hook
- **Purpose:** Provide site-wide config to components.
- **Files:** `src/hooks/useSiteConfig.ts`, `src/context/site-config-context.tsx`
- **Checks:**
  - [ ] Returns merged fallback + Firestore `config/site`.
  - [ ] Applies CSS variables on config change.
  - [ ] No hydration mismatch.

---

## 7. Cart & Checkout State

### 7.1 Cart Context
- **Purpose:** Cart state, add-ons, shipping calculation.
- **Files:** `src/context/cart-context.tsx`, `src/components/cart/cart-drawer.tsx`, `src/components/cart/cart-nav-button.tsx`
- **Checks:**
  - [ ] Add/remove/update quantity work.
  - [ ] Add-on toggle preserves price from site config.
  - [ ] Shipping tier auto-detects stickers vs apparel.
  - [ ] Free shipping applies above threshold.
  - [ ] Cart drawer opens/closes and displays items.
  - [ ] Cart nav button shows item count.

---

## 8. Backend Cloud Functions

The backend is 14 Cloud Functions, all exported from `functions/src/index.ts` (828 lines), plus `functions/src/pricing.ts` (294 lines, server-side order pricing with pure integer-cents math). Firestore is the master catalog; Square is payment-only. The Square catalog-sync architecture — `functions/src/sync.ts` and `functions/src/product-pipeline.ts`, the `fetchSquareCatalog`, `syncProducts`, `importProducts`, `runPipeline`, `scheduledSync`, `fetchSyncStatus`, `fetchPipelineStatus`, `fetchInventoryCounts`, and `clearProducts` functions, and the admin "Catalog Sync" UI — was removed in Phase 1 (2026-08).

### 8.1 Square Product Push
- **Function:** `createSquareProduct`
- **Checks:**
  - [ ] Optional one-way push of an admin product to Square for POS linkage.
  - [ ] Builds ITEM + ITEM_VARIATION objects.
  - [ ] Uses temp IDs prefixed with `#`.
  - [ ] Calls `batchUpsert`.
  - [ ] Maps returned IDs back to Firestore variants.

### 8.2 Checkout Payment
- **Function:** `createSquareOrderAndPay`
- **Checks:**
  - [ ] Validates line items and source ID.
  - [ ] Re-derives all prices server-side from Firestore via `pricing.ts` (integer-cents math); never trusts client amounts.
  - [ ] Adds shipment fulfillment with customer address.
  - [ ] Charges payment including shipping.
  - [ ] Mirrors order to Firestore `orders/`.

### 8.3 Orders
- **Functions:** `fetchRecentOrders`, `fetchCustomerOrders`, `updateOrderTracking`
- **Checks:**
  - [ ] `fetchRecentOrders` searches Square orders by location.
  - [ ] `fetchCustomerOrders` requires auth and filters by email.
  - [ ] `updateOrderTracking` requires auth and updates Firestore.

### 8.4 Customer Data
- **Functions:** `get/saveCustomerProfile`, `get/save/deleteCustomerAddress`
- **Checks:**
  - [ ] All require authenticated user.
  - [ ] Addresses scoped to `customers/{uid}/addresses`.

### 8.5 Site Config & Admin
- **Functions:** `fetchSiteConfig`, `saveSiteConfig`, `saveAdminEmails`
- **Checks:**
  - [ ] Read/write correct `config/` docs.

### 8.6 Health
- **Function:** `health`
- **Checks:**
  - [ ] Returns status and Square configuration flag.

---

## 9. Security & Rules

### 9.1 Firestore Rules
- **Files:** `firestore.rules`
- **Checks:**
  - [ ] Public read for products, categories, designs, config.
  - [ ] Auth write for products, categories, designs, config.
  - [ ] Orders read requires auth; write only via Functions.
  - [ ] Users/customers scoped to own UID.

### 9.2 Storage Rules
- **Files:** `storage.rules`
- **Checks:**
  - [ ] Public read for designs, uploads, products.
  - [ ] Auth write for designs and products.
  - [ ] Uploads write scoped to `request.auth.uid`.

---

## 10. PWA & SEO

### 10.1 Web App Manifest
- **Files:** `public/manifest.json`
- **Checks:**
  - [ ] Icons include 192, 512, maskable variants.
  - [ ] Theme/background colors match brand.
  - [ ] Display is `standalone`.

### 10.2 Service Worker
- **Files:** `public/sw.js`
- **Checks:**
  - [ ] Precaches core routes.
  - [ ] Cache-first fetch strategy.
  - [ ] Skips waiting and claims clients.

### 10.3 SEO
- **Files:** `src/components/layout/json-ld.tsx`, page metadata
- **Checks:**
  - [ ] Organization and Website JSON-LD on layout.
  - [ ] Product JSON-LD on product page.
  - [ ] Sitemap and robots.txt present.

---

## 11. Testing

### 11.1 Test Suites
- **Files:** `src/hooks/__tests__/catalog.test.ts`, `src/lib/__tests__/search.test.ts`, `src/context/__tests__/cart.test.ts`, `src/app/customizer/__tests__/views.test.ts`
- **Checks:**
  - [ ] All tests pass.
  - [ ] Tests use `ManagedProduct` canonical type.
  - [ ] Customizer view generation tested.

---

## 12. Current Debugging Focus: Design Catalog

The following checks are the immediate priority for reported live design-catalog errors:

1. **Admin upload** creates a valid `DesignAsset` doc at `designs/{id}`.
2. **Customizer library** loads only individual docs with `name` + `image_url`.
3. **Old `designs/catalog` fallback** still works but does not leak into the new list.
4. **No duplicate designs** appear when a design is both global and pinned to a product.
5. **Delete design** removes both Firestore doc and Storage file.
6. **Design thumbnails** render with fallback placeholder on broken URLs.
7. **Auth/permission errors** during upload/delete surface clear messages.

---

*This outline should be updated whenever a new route, component, or Cloud Function is added.*
