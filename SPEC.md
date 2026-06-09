# Animas Reflections PWA — Master Specification & Development Record
> **Consolidated:** 2026-06-09 16:43 EDT  
> **Sources merged:** `PROJECT_CONTEXT.md`, `GAP_ANALYSIS.md`, `animas_reflections_scope_roadmap.md`
> **Source tools:** OpenClaw, OpenCode, Gemini, Claude/Cursor  
> **Purpose:** Single authoritative spec. All prior docs are subsumed by this file.

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| **Client** | Cindy, Owner-Operator of Animas Reflections |
| **Location** | Durango, Colorado |
| **Business** | Custom screen printing, embroidery, sublimation apparel & merchandise |
| **Live Sites** | https://www.animasreflections.com (Square Online), https://animas-reflections-pwa.web.app (Firebase) |
| **Goal** | Replace restrictive Square/Shopify template with custom headless PWA using Square as backend |
| **GitHub** | https://github.com/MaryTheadoor/animas-reflections-pwa |
| **Branch** | `master` |

---

## 2. TECH STACK

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) | 16.2.7 |
| Build | Turbopack | bundled |
| Styling | Tailwind CSS | v4 |
| Hosting | Firebase Hosting | CDN-backed |
| Backend | Firebase Cloud Functions | Node.js 22 |
| Database | Cloud Firestore | Serverless NoSQL |
| Storage | Firebase Storage | authenticated uploads |
| Auth | Firebase Authentication | Google + Email/Password |
| Payments | Square Web Payments SDK + Square Node SDK | v42.3.0 |
| CI/CD | `npm run build` → `firebase deploy --only hosting` | manual |
| **Deploy mode** | Static Export (`output: "export"`) | 204 files in `out/` |

---

## 3. DESIGN SYSTEM — BRAND ARCHITECTURE

### 3.1 Visual Identity
**Aesthetic:** Clean Modern-Rustic — combining efficient web UX with Durango mountain warmth.

### 3.2 Color Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Background | Soft Warm Cream | `#FAF6F0` | Page body |
| Background Alt | Warm Sand | `#F5EBE6` | Section blocks |
| Primary Text/Brand | Deep Slate Teal | `#1E4D4F` | Headers, nav text, body |
| Accent/CTA | Sunset Moon Gold | `#D97706` | Buttons, active states, pricing |
| Highlight | Soft Plum | `#935B8A` | Badges, hover states |
| Dark Mode Body | Midnight Slate | `#0F172A` | html.dark |
| Dark Mode Surface | | `#1E293B` | Cards in dark mode |
| Note | | | Square brand colors (#9d689d purple, #9dbd73 sage) NOT yet applied |

### 3.3 UI Ergonomics
- **Rounded Geometry:** `rounded-xl` to `rounded-2xl` (12-16px radius)
- **Shadows:** Soft diffused ambient: `box-shadow: 0 4px 20px -2px rgba(30,77,79,0.05)`
- **Buttons:** S.I.T.E.S Tactile protocol (4px bottom-border depth, press animation)
- **Cards:** Glassmorphism: `backdrop-filter: blur(16px)`, translucent white
- **Navigation:** Floating pill-shaped dock (`.nav-dock`) with glassmorphism

### 3.4 Dark Mode
- Triggered by `html.dark` class
- Body bg swaps to `#0F172A`
- Paper texture disabled via `background-image: none`
- Nav icons: white default, gold active
- Cards: `rgba(30,41,59,0.65)` translucent

---

## 4. S.I.T.E.S PROTOCOL (from Nown.design)

| Letter | Meaning | Implementation |
|---|---|---|
| **S**can | Intelligent discovery | Full-text product search, category filters, browse-by-design |
| **I**nterface | Tactile interaction | `.btn-tactile` solid-depth buttons, `.glass-card` cards, `.nav-dock` floating nav |
| **T**ile | Self-aware containers | `.tile-grid-sites` auto-fit grid (minmax 280px), container queries |
| **E**levate | Visual hierarchy | Ambient dot texture (`.bg-ambient`), gradient overlays, diffused shadows |
| **S**ynthesize | Meaningful connections | Cart + customizer pipeline, admin → frontend config reactivity |

---

## 5. ARCHITECTURE

```
PUBLIC FRONTEND (Next.js SSG + Selective Hydration)
    ├── Firebase Hosting (CDN)
    ├── Firebase Cloud Functions (Square proxy)
    │   └── SQUARE ENGINE (Catalog/Orders/Payments)
    ├── Cloud Firestore (Config, Products, Designs, Orders)
    └── Firebase Storage (User uploads, product images)
```

---

## 6. ALL ROUTES (18 pages)

| Route | File | Type | Purpose |
|---|---|---|---|
| `/` | `page.tsx` | Static | Homepage: hero, featured products, story |
| `/about` | `about/page.tsx` | Static | Our Story |
| `/shop` | `shop/page.tsx` | Static | Product catalog + filters + sort |
| `/product` | `product/page.tsx` | Static | Product detail (`?id=` query param) |
| `/customizer` | `customizer/page.tsx` | Static | Interactive design customizer (`?product=` param) |
| `/checkout` | `checkout/page.tsx` | Static | Cart + Square Payment + customer info |
| `/order-confirmation` | `order-confirmation/page.tsx` | Static | Post-payment thank-you |
| `/admin` | `admin/page.tsx` | Static | CMS Dashboard (settings, products, images, orders) |
| `/admin/login` | `admin/login/page.tsx` | Static | Firebase Auth login |
| `/contact` | `contact/page.tsx` | Static | Contact info |
| `/faq` | `faq/page.tsx` | Static | FAQ |
| `/fundraising` | `fundraising/page.tsx` | Static | Fundraising info |
| `/custom` | `custom/page.tsx` | Static | Design Your Own info |
| `/terms` | `terms/page.tsx` | Static | Terms of Sale |
| `/search` | `search/page.tsx` | Static | Full-text product search |
| `/biscuit-hockey` | `biscuit-hockey/page.tsx` | Static | Sub-brand |
| `/im-ok-r-u` | `im-ok-r-u/page.tsx` | Static | Sub-brand |
| `/_not-found` | `not-found.tsx` | Static | 404 |

---

## 7. COMPONENT TREE

```
layout.tsx → ClientLayout
    ├── SiteConfigProvider (Firestore config → CSS vars)
    ├── ThemeProvider (light/dark toggle)
    ├── AuthProvider (Firebase Auth)
    ├── CartProvider (reducer-based cart state)
    ├── HeaderBar (floating dock nav)
    │   ├── nav-dock-link × 8
    │   ├── CartNavButton
    │   ├── NavAuth (Login/Admin)
    │   └── ThemeToggle
    └── CartDrawer (slide-in panel)

Pages:
├── Home → FeaturedProducts, FundraisingTeaser, BandMerchTeaser, FaqTeaser
├── Shop → ProductCard × n (uses useCatalog hook)
├── Product → ProductDetail modal + "Customize & Order" → /customizer
├── Customizer → Customizer (drag/resize/rotate) + FileUpload + DesignLibrary
├── Checkout → Square Web Payments SDK + Cart Summary + Shipping
├── Admin → ProductManager, CategoryManager, ImageManager, SiteConfig forms
└── Search → SearchBar + results
```

---

## 8. DATA MODEL

### 8.1 Firestore Collections

| Collection | Doc ID | Fields |
|---|---|---|
| `products` | product ID | name, description, categoryId, productType, colors[], tags[], images[], variants[], active, featured, seoTitle, seoDescription, printZones, mockupImages, weightOz, baseProductId, createdAt, updatedAt |
| `categories` | category ID | name, slug, order, createdAt, updatedAt |
| `config/site` | (singleton) | announcement_text, announcement_active, primary_color, accent_color, background_color, shipping_tier_stickers, shipping_tier_apparel, free_shipping_threshold, addon_price, hero_heading, hero_subheading, about_body |
| `config/pipeline_status` | (singleton) | lastRun, baseProducts, designs, instances, errors[] |
| `designs` | design ID | name, brand, category, logoUrl |
| `baseProducts` | base ID | name, type, category, defaultImage, description, tags[] |
| `productInstances` | instance ID | baseProductId, designId, name, price, image, sku, squareItemId, squareVariationId, active |

### 8.2 TypeScript Types (see `src/types/index.ts`)

```typescript
ProductType: "apparel" | "sticker" | "sign" | "jewelry" | "accessory" | "other"
PrintZone: { x_percent, y_percent, width_percent, height_percent }
PrintZoneTemplate: { front: PrintZone, back?: PrintZone, sleeve?: PrintZone }
ManagedProduct: { id, name, description, categoryId, productType, colors[], tags[], images[], variants[], active, featured, seoTitle?, seoDescription?, printZones?, mockupImages?, weightOz?, baseProductId?, ... }
ManagedVariant: { id, name, price, sku, squareItemId?, squareVariationId?, inventory? }
ManagedCategory: { id, name, slug, order, ... }
CartItem: { id, product_id, variation_id, name, base_price, quantity, selected_view, design_url?, design_text?, addons[] }
SiteConfig: { announcement_text, announcement_active, primary_color, accent_color, highlight_color, background_color, updated_at }
```

---

## 9. FIREBASE FUNCTIONS (6 deployed)

| Function | Trigger | Purpose |
|---|---|---|
| `fetchSquareCatalog` | Callable | Fetches items + categories from Square, filters ecom_visibility=VISIBLE |
| `createSquareOrderAndPay` | Callable | Creates Square order + processes payment with customer/shipping data |
| `fetchSiteConfig` | Callable | Returns site config from Firestore for admin validation |
| `fetchRecentOrders` | Callable | Returns last 50 Square orders for admin dashboard |
| `syncCatalog` | Callable | Groups Square items into virtual_products in Firestore (name-matching) |
| `health` | HTTPS | Status check endpoint |

---

## 10. IMPLEMENTATION PHASES & STATUS

| Phase | Status | Progress | Key Deliverables |
|---|---|---|---|
| **1. Workspace & Init** | ✅ COMPLETE | 100% | Git repo, Firebase init, Next.js + Tailwind setup |
| **2. Square API Gateway** | ✅ COMPLETE | 100% | Cloud Functions + Square auth, catalog fetch, data shielding |
| **3. Customizer Component** | 🟡 IN PROGRESS | ~70% | Drag/reposition/rotate/resize done. Product selector exists. Print zones partially dynamic. Design library picker built. FileUpload works. |
| **4. Order Assembly & Checkout** | 🟡 IN PROGRESS | ~80% | Cart state complete. Square Web Payments SDK integrated. createSquareOrderAndPay function done. Order confirmation page exists. |
| **5. Admin CMS Dashboard** | 🟡 IN PROGRESS | ~85% | Site config forms (colors, text, shipping). Product manager with Square sync. Category manager. Image manager with bulk upload + mockup assignment. |
| **6. PWA Optimization & Launch** | 🔴 EARLY | ~40% | manifest.json done. SW caching 6 routes. Organization + WebSite JSON-LD done. |

---

## 11. GAP ANALYSIS — BY PRIORITY

### 🔴 BLOCKERS (Cannot launch without)

| # | Gap | Status |
|---|---|---|
| 1 | **Site config reactivity** — admin changes in Firestore must take effect without rebuild | 🟡 Partial — `SiteConfigProvider` reads from Firestore but `content.ts` has hardcoded fallbacks |
| 2 | **Customizer → Cart → Checkout end-to-end** — must carry real Square variation/modifier IDs | 🔴 NOT DONE |
| 3 | **Payment sandbox testing** — zero test transactions run | 🔴 NOT DONE |
| 4 | **Production deploy + DNS** — 5 commits unpushed, domain not pointing to Firebase | 🔴 NOT DONE |

### 🟡 HIGH (Degraded experience)

| # | Gap | Status |
|---|---|---|
| 5 | **Product JSON-LD** — per-product Schema.org blocks for AI/voice SEO | 🔴 Missing |
| 6 | **Real product mockup images** — replace hero-bg.jpg placeholder with actual garment photos | 🔴 Missing |
| 7 | **Print zone metadata per product in Firestore** — currently hardcoded, needs per-product entries | 🟡 Schema exists, data missing |
| 8 | **Order confirmation page** — exists but needs real data wiring | 🟡 Basic page exists |
| 9 | **Firestore products collection sync** — populate from Square via pipeline | 🟡 Pipeline built, not run |
| 10 | **Brand color/font alignment** — match live Square site (#9d689d / Recoleta font) | 🔴 Not done |
| 11 | **Shipping tier logic** — free threshold $100 in admin but spec says $50; hardcoded constants may conflict | 🟡 Needs audit |

### 🟢 MEDIUM (Polish)

| # | Gap |
|---|---|
| 12 | Sitemap.xml + robots.txt (metadata robots exists but no static files) |
| 13 | Sub-brand pages (Dunphy Stock FAM, GREEN BUDDHA, Women In Aviation, ET Art) |
| 14 | Instagram social link in JSON-LD `sameAs` array + footer |
| 15 | BreadcrumbList JSON-LD for navigation context |
| 16 | PWA install prompt ("Add to Home Screen") |
| 17 | Analytics integration (Google/Firebase Analytics) |
| 18 | Category hierarchy in content.ts doesn't match ALL 27 Square categories |

### ⚪ LOW (Nice-to-have)

| # | Gap |
|---|---|
| 19 | Live admin preview of config changes before saving |
| 20 | Automated Square→Firestore sync schedule (currently manual via admin button) |
| 21 | Email notifications for orders |
| 22 | Touch gesture support on customizer (pinch-zoom, two-finger rotate) |
| 23 | Dark mode brand palette refinement |
| 24 | Error monitoring (Sentry or equivalent) |

---

## 12. KNOWN ISSUES & GOTCHAS — DO NOT REPEAT

1. **Square SDK BigInt:** `priceMoney.amount` is BigInt, must `Number()` before arithmetic
2. **Square categories:** `itemData.categories[]` array, NOT `categoryId` field
3. **ecom_visibility filter:** Only `"VISIBLE"` items shown (405 website vs 74 POS-only)
4. **Nav dock position:** Do NOT `position:fixed` on `.nav-dock`. Use single fixed wrapper div containing both announcement banner and nav-dock
5. **Mobile nav grid:** `repeat(5, 1fr)` for 2-row layout on mobile. Desktop: `display: flex; max-width: fit-content`
6. **Hero overlap:** `paddingTop: var(--header-height, 88px)` on page content
7. **Dev server HMR loop:** SiteConfigProvider must guard CSS property writes with `getPropertyValue` check before `setProperty` to avoid Turbopack refresh loops
8. **Static export:** `output: "export"` in next.config — `next dev` works but images must be `unoptimized: true`
9. **USE_SYNTHETIC flag:** `false` in production. Set in `src/hooks/useCatalog.ts`
10. **Service Worker:** Dev mode unregisters all SWs. Production registers `/sw.js`

---

## 13. DEPLOYMENT

```bash
# Build
npm run build          # → next build → out/ (204 files)

# Deploy hosting only
npm run deploy:hosting # → firebase deploy --only hosting

# Deploy functions only
npm run deploy:functions

# Full deploy
npm run deploy         # → firebase deploy
```

**Git push warning:** 5 commits are currently unpushed on `master`.

---

## 14. CREDENTIALS MAP

| Credential | Source |
|---|---|
| Square Access Token + Location ID | `Desktop/animasreflections square API info.txt` |
| Gemini API Key | `Downloads/animas gemini key.txt` |
| Firebase Config | `.env.local` (gitignored) |
| Firebase Project | `animas-reflections-pwa` |
| Firebase Console | https://console.firebase.google.com/project/animas-reflections-pwa |

---

## 15. SUB-BRAND PAGES REQUIRED

| Brand | Status | URL |
|---|---|---|
| Dunphy Stock FAM | ❌ Not built | Needs dedicated page |
| GREEN BUDDHA | ❌ Not built | Needs dedicated page |
| LITTLE STRANGER | ❌ Not built | Used in fundraising context |
| Jordan Branch Music | ❌ Not built | Needs dedicated page |
| Biscuit Hockey | ✅ Built | `/biscuit-hockey` |
| I'M OK R U | ✅ Built | `/im-ok-r-u` |
| Women In Aviation | ❌ Not built | Needs dedicated page |
| ET Art | ❌ Not built | Needs dedicated page |
| Durango Lacrosse | ❌ Not built | Needs dedicated page |
| Kevin Fundraiser | ❌ Not built | Needs dedicated page |

---

## 16. DOCUMENTATION SOURCES (all consolidated here)

| Source | Location | Tool | Content |
|---|---|---|---|
| `animas_reflections_scope_roadmap.md` | Downloads | Gemini/DeepSeek | Original master engineering spec |
| `PROJECT_CONTEXT.md` | Project root | OpenClaw/Claude | Project overview + recovery blueprint |
| `GAP_ANALYSIS.md` | Project root | OpenClaw/Claude | Spec vs implementation audit |
| `PROJECT_INVENTORY.md` | Project root | OpenClaw | Machine-wide project catalog |
| `AGENTS.md` | Project root | Next.js plugin | Framework agent rules stub |
| `CLAUDE.md` | Project root | Claude | Points to AGENTS.md |

### Other agent workspaces checked:
- **OpenCode** (`C:\Users\AmosA\.config\opencode`, `C:\Users\AmosA\opencode`) — No Animas-specific docs
- **DeepSeek GUI** (`C:\Users\AmosA\deepseek-cli`) — No project docs
- **Kimi** (`C:\Users\AmosA\.kimi`, `C:\Users\AmosA\.kimi_openclaw`) — Plans are for NownCard, not Animas
- **Gemini** (`C:\Users\AmosA\.gemini`) — No markdown docs
- **Codex** (`C:\Users\AmosA\.codex`) — System skills only, no project docs
- **Cursor** (`C:\Users\AmosA\.cursor`) — System skills only, no project docs

---

## 17. IMMEDIATE NEXT STEPS (recommended order)

1. **Push 5 commits** — unblock other developers / parallel sessions
2. **Populate Firestore products** — run `syncCatalog` or Square→Firestore pipeline
3. **Complete customizer→cart pipeline** — wire real Square variation IDs
4. **Add product mockup images** — real garment photos for customizer base layers
5. **Product JSON-LD** — per-product Schema.org for SEO
6. **Sandbox payment test** — one real end-to-end transaction
7. **Brand color alignment** — match live Square site
8. **Production DNS** — point domain to Firebase Hosting

---

*This document supersedes all prior spec files. Updates should be made here only.*
