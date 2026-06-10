# Architecture & Data Flow

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  Next.js Static Export → Firebase Hosting                    │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐     │
│  │   Shop   │ │ Product  │ │ Customizer │ │ Checkout │     │
│  │ Catalog  │ │  Detail  │ │  Canvas    │ │ + Square │     │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬─────┘     │
│       │             │              │              │           │
│       └─────────────┴──────────────┴──────────────┘           │
│                        │ Firestore SDK (reads)                │
│                        │ Firebase Auth (writes)               │
│                        │ Square SDK (payment token)           │
└────────────────────────┼──────────────────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────────────────┐
│                    FIREBASE CLOUD                              │
│                         │                                      │
│  ┌──────────────────────┼──────────────────────────────┐     │
│  │            Cloud Firestore (NoSQL)                    │     │
│  │  products/    categories/    config/    designs/     │     │
│  │  users/       orders/        import_status/         │     │
│  └──────────────────────┼──────────────────────────────┘     │
│                         │                                      │
│  ┌──────────────────────┼──────────────────────────────┐     │
│  │          Firebase Storage                             │     │
│  │  products/{id}/    designs/{id}    uploads/{uid}/   │     │
│  └──────────────────────┼──────────────────────────────┘     │
│                         │                                      │
│  ┌──────────────────────┼──────────────────────────────┐     │
│  │     Cloud Functions (16 functions, Node 22, Gen 2)   │     │
│  │                                                       │     │
│  │  fetchSquareCatalog   ← pulls items from Square       │     │
│  │  syncProducts         ← Square → Firestore sync      │     │
│  │  importProducts       ← alt sync by category         │     │
│  │  createSquareProduct  ← Firestore → Square push      │     │
│  │  createSquareOrderAndPay ← checkout + payment        │     │
│  │  fetchRecentOrders    ← order history                │     │
│  │  fetchSiteConfig      ← site settings read           │     │
│  │  saveSiteConfig       ← site settings write          │     │
│  │  saveAdminEmails      ← admin management             │     │
│  │  aiSearch             ← programmatic text search     │     │
│  │  health               ← status check                 │     │
│  │  + pipeline/sync helpers                              │     │
│  └──────────────────────┼──────────────────────────────┘     │
└────────────────────────┼──────────────────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────────────────┐
│                   SQUARE API (v42)                             │
│  Catalog API  │  Orders API  │  Payments API                  │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow: Product Sync

```
Square Catalog (405 items, ecom_visibility=VISIBLE)
    │
    ▼
syncProducts Cloud Function
    │  ┌─ Fetches all ITEM + ITEM_VARIATION objects
    │  ├─ Groups by detected brand name
    │  ├─ detectProductType() classifies as apparel/sticker/sign/etc
    │  ├─ buildManagedProduct() creates ManagedProduct doc
    │  └─ Writes to Firestore products/{id}
    ▼
Firestore products/ collection (ManagedProduct[])
    │
    ▼
useCatalog() hook
    │  ┌─ Reads Firestore products/ collection
    │  ├─ managedToCatalogItem() converts to SquareCatalogItem
    │  └─ Returns { items, categories, loading, error }
    ▼
React Components (Shop, Product, Customizer)
```

## Data Flow: Checkout

```
User adds items to cart (CartContext reducer)
    │
    ▼
Checkout page
    │  ┌─ Square Web Payments SDK renders card input
    │  ├─ Customer fills shipping info
    │  ├─ card.tokenize() → payment token
    │  └─ calls createSquareOrderAndPay({ lineItems, sourceId, customer })
    ▼
createSquareOrderAndPay Cloud Function
    │  ┌─ Builds Square Order with line items
    │  ├─ Attaches customer/shipping info
    │  ├─ Creates payment with sourceId token
    │  └─ Returns { orderId, paymentId, paymentStatus }
    ▼
Order Confirmation page (/order-confirmation)
```

## Data Flow: Admin Product Push

```
Admin creates product in Firestore (product-manager.tsx)
    │
    ▼
Admin clicks "Push → Square"
    │
    ▼
createSquareProduct Cloud Function
    │  ┌─ Reads product from Firestore
    │  ├─ Builds Square ITEM + ITEM_VARIATION objects
    │  ├─ client.catalog.batchUpsert() → Square returns real IDs
    │  ├─ Maps temp #-prefixed IDs → permanent Square IDs
    │  └─ Writes squareItemIds + squareVariationIds back to Firestore
    ▼
Product now has valid Square IDs → can be used in checkout
```

## Component Tree

```
RootLayout (layout.tsx)
└── ClientLayout (client-layout.tsx)
    ├── SiteConfigProvider
    │   └── ThemeProvider
    │       └── AuthProvider
    │           └── CartProvider
    │               ├── HeaderBar (fixed nav dock)
    │               │   ├── NavAuth (login/admin)
    │               │   ├── ThemeToggle
    │               │   └── CartNavButton
    │               ├── {children} (page content)
    │               └── CartDrawer
    │
    └── Pages:
        ├── / → Home (hero, featured, fundraising, about, footer)
        ├── /shop → ShopPage (catalog, filters, sort)
        ├── /product?id= → ProductPage (detail, variations, add-to-cart)
        ├── /customizer?product= → CustomizerPage
        │   └── Customizer (canvas, views, drag/resize)
        │       └── FileUpload
        ├── /checkout → CheckoutPage (shipping, Square card, order summary)
        ├── /admin → AdminDashboard
        │   ├── ProductManager (+ "Push → Square", "Sync from Square")
        │   ├── CategoryManager
        │   ├── ImageManager (bulk upload, mockup assignment)
        │   ├── SiteConfig form
        │   ├── DesignCatalog upload
        │   ├── OrdersSection
        │   └── UsersSection
        └── /search → SearchPage (fuzzy text search)
```

## Route Map (18 routes, all static)

| Route | File | Auth |
|-------|------|------|
| `/` | `page.tsx` | Public |
| `/shop` | `shop/page.tsx` | Public |
| `/product` | `product/page.tsx` | Public |
| `/customizer` | `customizer/page.tsx` | Public |
| `/checkout` | `checkout/page.tsx` | Public |
| `/order-confirmation` | `order-confirmation/page.tsx` | Public |
| `/search` | `search/page.tsx` | Public |
| `/about` | `about/page.tsx` | Public |
| `/contact` | `contact/page.tsx` | Public |
| `/custom` | `custom/page.tsx` | Public |
| `/faq` | `faq/page.tsx` | Public |
| `/fundraising` | `fundraising/page.tsx` | Public |
| `/terms` | `terms/page.tsx` | Public |
| `/biscuit-hockey` | `biscuit-hockey/page.tsx` | Public |
| `/im-ok-r-u` | `im-ok-r-u/page.tsx` | Public |
| `/admin` | `admin/page.tsx` | Auth required |
| `/admin/login` | `admin/login/page.tsx` | Public |
| `/_not-found` | `not-found.tsx` | Public |
