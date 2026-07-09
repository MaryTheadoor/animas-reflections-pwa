# Animas Reflections PWA — Master Technical Document

**Date:** 2026-07-09 | **Version:** 3.0 | **Status:** Active Development

---

## 1. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 16.2.7 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Hosting | Firebase Hosting | CDN |
| Backend Runtime | Firebase Cloud Functions | Gen 2, Node.js 22 |
| Database | Cloud Firestore | NoSQL |
| File Storage | Firebase Storage | — |
| Authentication | Firebase Auth | Email/Password + Google |
| Payment Processing | Square API + Web Payments SDK | v42 |
| PWA | Service Worker + Web App Manifest | — |
| Version Control | Git + GitHub | — |
| Deployment Mode | Static Export (`output: "export"`) | — |
| Build Tool | Turbopack | — |

---

## 2. DEPLOYMENT

| Environment | URL | Status |
|-------------|-----|--------|
| Production | https://animas-reflections-pwa.web.app | Live |
| Local Dev | `http://localhost:3000` | `npm run dev` |
| Functions | 23 deployed, us-central1 | Live |
| Firebase Project | animas-reflections-pwa (ID: 508402195460) | Active |
| GitHub | https://github.com/MaryTheadoor/animas-reflections-pwa | master branch |

---

## 3. PROJECT STRUCTURE

```
animas-reflections-pwa/
├── src/
│   ├── app/                  # 18 routes (Next.js App Router)
│   │   ├── layout.tsx        # Root layout (providers, metadata, JSON-LD)
│   │   ├── page.tsx          # Home page
│   │   ├── globals.css       # Brand theme, Tailwind v4 @theme
│   │   ├── about/
│   │   ├── account/          # Auth-gated: orders, addresses, settings
│   │   ├── admin/            # CMS dashboard (8 tabs)
│   │   ├── biscuit-hockey/
│   │   ├── checkout/         # Square payment + customer info
│   │   ├── contact/
│   │   ├── custom/
│   │   ├── customizer/       # Visual product customizer canvas
│   │   ├── faq/
│   │   ├── fundraising/
│   │   ├── im-ok-r-u/
│   │   ├── order-confirmation/
│   │   ├── product/          # Product detail page
│   │   ├── search/           # Fuzzy search + filters
│   │   ├── shop/             # Catalog with category/sort
│   │   └── terms/
│   ├── components/
│   │   ├── admin/            # ProductManager, CategoryManager, ImageManager, VariantMatrixEditor
│   │   ├── cart/             # CartDrawer, CartNavButton
│   │   ├── customizer/       # Customizer canvas, FileUpload
│   │   ├── home/             # FeaturedProducts, FundraisingTeaser, BandMerchTeaser, FaqTeaser
│   │   ├── layout/           # ClientLayout, HeaderBar, NavAuth, JsonLd, PageLayout
│   │   ├── product/          # ProductCard, ProductDetail
│   │   ├── search/           # SearchBar
│   │   └── ui/               # PlaceholderImage, DebugPanel
│   ├── context/              # AuthProvider, CartProvider, ThemeProvider, SiteConfigProvider
│   ├── hooks/                # useCatalog, useSearch, useSiteConfig
│   ├── lib/                  # firebase, constants, content, synthetic-data
│   └── types/                # 26+ TypeScript interfaces
├── functions/
│   └── src/
│       ├── index.ts          # 23 Cloud Functions (1,061 lines)
│       ├── sync.ts           # Square → Firestore sync (745 lines)
│       └── product-pipeline.ts # Product classification (361 lines)
├── public/                   # Static assets (manifest, sw.js, icons, images)
├── docs/                     # Documentation
├── scripts/                  # Backup framework (PowerShell)
└── _backups/                 # Pre-edit file snapshots (gitignored)
```

---

## 4. DATA MODEL

### 4.1 Firestore Collections

| Collection | Document Pattern | Access | Purpose |
|-----------|-----------------|--------|---------|
| `products/` | `{productId}` | Public read, Auth write | ManagedProduct docs |
| `categories/` | `{categoryId}` | Public read, Auth write | ManagedCategory docs |
| `designs/` | `{designId}` | Public read, Auth write | Individual DesignAsset docs |
| `config/site` | `site` | Public read, Auth write | Site-wide config (colors, banner, rates) |
| `config/admin` | `admin` | Auth read/write | Admin email list |
| `config/sync_status` | `sync_status` | Auth read/write | Last sync timestamp/counts |
| `users/` | `{uid}` | Auth read/write (own) | User profile data |
| `orders/` | `order_{squareOrderId}` | Auth read, no write | Mirrored Square orders |
| `customers/{uid}/addresses/` | `{addressId}` | Auth read/write/delete (own) | Saved shipping addresses |

### 4.2 Key Types

**ManagedProduct** — canonical product (provider-agnostic):
- `id`, `name`, `description`, `categoryId`, `productType`
- `variants[]` (ManagedVariant with managed ID + optional squareVariationId)
- `images[]`, `colors[]`, `tags[]`
- `mockupImages` (front, back, sleeve, sideL, sideR)
- `printZones` (front, back, sleeve, sideL, sideR)
- `designAssets[]` (per-product pre-loaded graphics)
- `active`, `featured`, `createdAt`, `updatedAt`
- `squareItemIds[]` (optional), `seoTitle`, `seoDescription`, `weightOz`

**DesignAsset** — individual design database object:
- `id`, `name`, `description`, `category`, `image_url`, `tags[]`, `created_at`, `productId`

**CartItem** — cart line item:
- `id`, `product_id`, `variant_id`, `squareVariationId?`
- `name`, `variant_name`, `base_price`, `productType`
- `quantity`, `selected_view` (front/back/sleeve/sideL/sideR)
- `design_url?`, `design_text?`
- `design_x?`, `design_y?`, `design_scale?`, `design_rotation?`
- `addons[]` (CartAddon with type, label, price, addon_id, squareModifierId)

---

## 5. CLOUD FUNCTIONS (23 deployed)

| Function | Type | Purpose |
|----------|------|---------|
| `fetchSquareCatalog` | Callable | Fetches Square catalog (ecom_visibility=VISIBLE) |
| `syncProducts` | Callable (300s) | Square → Firestore full sync |
| `importProducts` | Callable (600s) | Alternative import path |
| `createSquareProduct` | Callable | Push Firestore product → Square (`batchUpsert`) |
| `createSquareOrderAndPay` | Callable | Order creation + payment (catalog or ad-hoc) |
| `fetchRecentOrders` | Callable | Last 50 Square orders |
| `fetchCustomerOrders` | Callable | Orders matching user email |
| `fetchInventoryCounts` | Callable (300s) | Batch inventory fetch |
| `fetchSiteConfig` / `saveSiteConfig` | Callable | Site config CRUD |
| `saveAdminEmails` | Callable | Admin email management |
| `fetchSyncStatus` | Callable | Read sync status doc |
| `runPipeline` | Callable (600s) | Product classification pipeline |
| `fetchPipelineStatus` | Callable | Pipeline status |
| `clearProducts` | Callable | Batch delete all products/categories |
| `scheduledSync` | PubSub | Daily 4 AM auto-sync |
| `health` | HTTP | Status endpoint |
| `updateOrderTracking` | Callable | Set tracking URL/number |
| `getCustomerAddresses` / `saveCustomerAddress` / `deleteCustomerAddress` | Callable | Address CRUD |
| `getCustomerProfile` / `saveCustomerProfile` | Callable | Profile CRUD |

---

## 6. FEATURE COMPLETION STATUS

### Phase 1: Foundation — ✅ 100%
- Next.js 16 + Tailwind v4 + TypeScript setup
- Firebase (Hosting, Firestore, Functions, Storage, Auth, Emulators)
- Config files, project docs, backup framework

### Phase 2: Square API Gateway — ✅ 100%
- 23 Cloud Functions deployed
- Catalog fetch + sync pipeline
- Order creation + payment processing
- Square Web Payments SDK checkout integration

### Phase 3: Customizer — ✅ 95%
- ✅ Drag/reposition (pointer capture, bounds clamping)
- ✅ Resize (corner grip + wheel + buttons + slider)
- ✅ Rotation (±1°/15°/90°)
- ✅ View tabs (front/back/sleeve/sideL/sideR)
- ✅ Text tool (font picker 7 fonts, color picker)
- ✅ Design library browser (designs/ collection)
- ✅ File upload (auth-gated, 10MB limit)
- ✅ Per-view design state preservation
- ✅ Design position/scale/rotation saved to cart
- ✅ CSS mix-blend-mode: multiply for ink-on-fabric
- □ Pseudo-3D fabric distortion (de-scoped)

### Phase 4: Checkout — ✅ 95%
- ✅ Cart context with reducer
- ✅ Cart drawer with item display
- ✅ Checkout with Square SDK + customer form
- ✅ Shipping auto-detection (sticker vs apparel)
- ✅ Ad-hoc payments (no Square catalog ID needed)
- ✅ Order confirmation page
- □ End-to-end checkout test with live card

### Phase 5: Admin CMS — ✅ 92%
- ✅ Products tab (full CRUD, mockup uploads, variant matrix, bulk ops)
- ✅ Categories tab (CRUD + reorder)
- ✅ Images tab (upload queue, mockup assignment, 5 views)
- ✅ Designs tab (individual DB objects, name/description/tags)
- ✅ Settings tab (site config, sync controls)
- ✅ Orders tab (tracking URL update)
- ✅ Users tab
- ✅ Admins tab
- □ Inventory per-variant display in list
- □ Order pagination

### Phase 6: PWA & Launch — ⚠️ 60%
- ✅ Web app manifest with icons
- ✅ Service worker (cache-first)
- ✅ robots.txt + sitemap (18 routes)
- ✅ JSON-LD (Organization, WebSite, Product)
- ✅ OpenGraph + Twitter Cards
- ✅ Brand colors unified (teal #1E4D4F)
- □ Lighthouse audit
- □ Cross-browser testing
- □ Domain DNS cutover
- □ Analytics integration

---

## 7. BUILD HEALTH

| Check | Result |
|-------|--------|
| `npm run lint` | 0 errors |
| `npm test` | 48/48 pass (4 suites) |
| `npm run build` | 18 routes, 21 static pages |
| `cd functions && npm run build` | Compile clean |

---

## 8. BACKUPS

| Layer | Location |
|-------|----------|
| Git + GitHub | origin/master |
| Local snapshots | `C:\Users\AmosA\Backups\animas-reflections-pwa\` |
| Pre-edit backups | `_backups/pre-edit/` |
| Devlog | `docs/DEVLOG.md` |

---

## 9. DOCUMENTATION INDEX

| Document | Purpose |
|----------|---------|
| `docs/MASTER.md` | This file — tech stack, data model, feature status |
| `docs/BUSINESS_MODEL.md` | Company overview, products, feature requirements |
| `docs/GAP_ANALYSIS.md` | Planned vs implemented gap analysis |
| `docs/ARCHITECTURE.md` | System diagrams, data flows, component tree |
| `docs/SCHEMA.md` | Firestore collections, types, storage structure |
| `docs/DEVELOPMENT.md` | Commands, conventions, troubleshooting |
| `docs/DEVLOG.md` | Chronological development log |
| `docs/SCOPE.md` | Original engineering scope (v1.0) |
| `docs/PROJECT_STATUS_REPORT.md` | Comprehensive status report (auto-generated) |
| `README.md` | Project overview, quick start |
| `PROJECT_CONTEXT.md` | Recovery blueprint |

---

*Updated 2026-07-09. Version 3.0 supersedes SCOPE.md v1.0.*
