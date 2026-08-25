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
│  │  users/       orders/                                │     │
│  └──────────────────────┼──────────────────────────────┘     │
│                         │                                      │
│  ┌──────────────────────┼──────────────────────────────┐     │
│  │          Firebase Storage                             │     │
│  │  products/{id}/    designs/{id}    uploads/{uid}/   │     │
│  └──────────────────────┼──────────────────────────────┘     │
│                         │                                      │
│  ┌──────────────────────┼──────────────────────────────┐     │
│  │     Cloud Functions (14 functions, Node 22, Gen 2)     │     │
│  │                                                       │     │
│  │  createSquareOrderAndPay ← checkout + payment        │     │
│  │  health               ← status check                 │     │
│  │  fetchSiteConfig      ← site settings read           │     │
│  │  saveSiteConfig       ← site settings write          │     │
│  │  saveAdminEmails      ← admin management             │     │
│  │  fetchRecentOrders    ← order history                │     │
│  │  createSquareProduct  ← Firestore → Square push      │     │
│  │  fetchCustomerOrders  ← customer order history       │     │
│  │  getCustomerAddresses ← address book read            │     │
│  │  saveCustomerAddress  ← address book write           │     │
│  │  deleteCustomerAddress ← address book delete         │     │
│  │  getCustomerProfile   ← profile read                 │     │
│  │  saveCustomerProfile  ← profile write                │     │
│  │  updateOrderTracking  ← tracking info write          │     │
│  └──────────────────────┼──────────────────────────────┘     │
└────────────────────────┼──────────────────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────────────────┐
│                   SQUARE API (v42)                             │
│  Catalog API  │  Orders API  │  Payments API                  │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow: Catalog (Admin-Managed)

The old Square → Firestore catalog sync was removed in Phase 1 (2026-08).
Firestore products/ is now the master catalog; Square is payment-only.

```
Admin dashboard (ProductManager)
    │  └─ Admin creates/edits products directly
    ▼
Firestore products/ collection (ManagedProduct[]) — master catalog
    │
    ▼
useCatalog() hook
    │  ┌─ Reads Firestore products/ collection (no Square API fallback)
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
    │  ┌─ Re-derives all prices server-side from Firestore (integer cents)
    │  ├─ Builds Square Order with line items
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
        │   ├── ProductManager (+ "Push → Square")
        │   ├── CategoryManager
        │   ├── ImageManager (bulk upload, mockup assignment)
        │   ├── SiteConfig form
        │   ├── DesignCatalog upload
        │   ├── OrdersSection
        │   └── UsersSection
        └── /search → SearchPage (fuzzy text search)
```

## Route Map (20 route dirs → 22 static HTML files)

| Route | File | Auth |
|-------|------|------|
| `/` | `page.tsx` | Public |
| `/shop` | `shop/page.tsx` | Public |
| `/product` | `product/page.tsx` | Public |
| `/customizer` | `customizer/page.tsx` | Public |
| `/checkout` | `checkout/page.tsx` | Public |
| `/order-confirmation` | `order-confirmation/page.tsx` | Public |
| `/privacy` | `privacy/page.tsx` | Public |
| `/search` | `search/page.tsx` | Public |
| `/about` | `about/page.tsx` | Public |
| `/account` | `account/page.tsx` | Auth required |
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
