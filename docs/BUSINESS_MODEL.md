# Animas Reflections — Business Model & Requirements

**Date:** 2026-07-09 | **Version:** 2.0

---

## 1. COMPANY OVERVIEW

**Animas Reflections** is a family-owned and operated custom design and print business based in Durango, Colorado, operating since 1999. The company specializes in custom screen printing, embroidery, sublimation, and direct-to-film (DTF) printing on a wide range of products.

- **Location:** Durango, CO, USA
- **Phone:** 970-769-2779
- **Email:** AnimasReflections@gmail.com
- **Current Website:** https://www.animasreflections.com (Square Online template)
- **New PWA:** https://animas-reflections-pwa.web.app (custom headless build)

---

## 2. BUSINESS MODEL

### 2.1 Revenue Streams

| Stream | Description |
|--------|-------------|
| **Custom Apparel** | Screen-printed/embroidered t-shirts, hoodies, tanks, long-sleeves for individuals and groups |
| **Fundraising Program** | 50/50 profit split — Animas builds the catalog, handles printing, shipping; organizations earn 50% of profit. No inventory, no minimums, no upfront costs |
| **Band & Music Merch** | Monthly concert tees, limited-run tour merchandise, full-color sublimation for musicians |
| **Team Sports Merch** | Custom designs for Durango-area sports teams (hockey, lacrosse, alpine ski, roller girls) |
| **School Clubs** | Merchandise for school programs and events |
| **Jewelry & Accessories** | Handmade silver necklaces, resin pendants, beaded pieces, bracelets |
| **Home & Decor** | Wood signs, metal panels, glass cutting boards, ornaments, magnets |
| **Pet Products** | Custom pet scarves and accessories |
| **Auto Products** | Customized auto accessories |
| **Stickers/Slaps** | 2" and 3" custom vinyl stickers in bulk |

### 2.2 Sub-Brands

| Brand | Est. | Focus |
|-------|------|-------|
| **Biscuit Hockey** | 2021 | Hockey-themed apparel with sport-specific language and humor |
| **I'M OK R U** | 2021 | Mental health positivity apparel with hidden messages — encouraging mindful reactions |

### 2.3 Target Customers

- Local sports teams (Durango High School, youth leagues)
- Bands, musicians, and music venues
- School clubs and organizations
- Fundraising organizers (teams, nonprofits, causes)
- Individual retail consumers (custom designs, gifts)
- Local businesses (staff uniforms, promotional items)

### 2.4 Pricing Model

- Base product prices from Square catalog (ranging ~$0.54 stickers to $65+ jewelry)
- Custom add-ons: $5 each (Back Print, Sleeve Print, Name/Number Personalization)
- Flat-rate shipping: $3.00 stickers/envelopes, $7.50 apparel/parcels, free over $100

---

## 3. PRODUCT CATALOG

### 3.1 Product Types

| Type | Examples |
|------|----------|
| **Apparel** | T-shirts, hoodies, tank tops, long-sleeve tees, crewnecks, hats, pet scarves |
| **Stickers** | 2" and 3" vinyl slaps, custom sticker packs |
| **Signs** | Wood signs (small/medium), tin & wood signs, ChromaLuxe wood panels |
| **Jewelry** | Silver necklaces, stone pendants, resin pieces, beaded necklaces, bracelets, earrings |
| **Accessories** | Drink huggers, glass cutting boards, ornaments, bags, purses |
| **Other** | Metal panels, magnets, custom-print-on-anything |

### 3.2 Customization Options

- Upload custom PNG artwork
- Select from pre-loaded design library (band logos, team graphics, brand artwork)
- Text personalization (name/number with font and color selection)
- Per-view placement (front, back, sleeves, sides)
- Position, scale, and rotation adjustments via interactive visual customizer

---

## 4. COMPREHENSIVE FEATURE REQUIREMENTS

### 4.1 Public Storefront (Customer-Facing)

| Feature | Priority | Description |
|---------|----------|-------------|
| Home page with hero, featured products, fundraising teaser, band merch teaser | Critical | Marketing landing page driving to catalog and customizer |
| Product catalog with category filters, search, sort | Critical | Browse by design/brand or product type |
| Product detail page with variant picker, JSON-LD schema | Critical | Individual product view with add-to-cart |
| Interactive visual customizer | Critical | Drag/resize/rotate design overlay on product mockup |
| Design library browser | High | Browse and select from pre-loaded designs |
| Custom file upload (PNG) | High | User uploads own artwork |
| Cart with add-on toggles, shipping calculation | Critical | Full shopping cart experience |
| Checkout with Square payment processing | Critical | Secure card payment via tokenization |
| Order confirmation page | Critical | Post-purchase success display |
| Product search (fuzzy text, category, color filters) | High | Design and product name search |
| FAQ page | Medium | 16 common questions answered |
| Fundraising information page | Medium | Program details, how it works, active fundraisers |
| Contact page | Medium | Phone, email, location |
| Terms of Sale | Medium | Legal terms (FOB Origin, Durango CO) |
| Sub-brand pages (Biscuit Hockey, I'M OK R U) | Medium | Brand-specific landing pages |
| About / Our Story page | Low | Company history |
| Custom Orders page | Low | "Design Your Own" info |

### 4.2 User Account

| Feature | Priority | Description |
|---------|----------|-------------|
| Firebase Auth (Email/Password + Google) | Critical | User registration and login |
| Order history with expandable details | High | View past orders, line items, totals |
| Carrier tracking URL display | High | Click-to-track package link |
| Saved shipping addresses (CRUD) | Medium | Manage multiple delivery addresses |
| Profile management (name, phone) | Medium | Edit personal information |

### 4.3 Admin CMS Dashboard

| Feature | Priority | Description |
|---------|----------|-------------|
| Product CRUD with variant matrix editor | Critical | Full product management |
| Category CRUD with reorder | Critical | Organize product categories |
| Image upload gallery with mockup assignment | Critical | Product photos + blank product shots per view (front/back/sleeve/sideL/sideR) |
| Sync from Square (catalog import) | Critical | Pull Square catalog → Firestore managed products |
| Push to Square (product export) | High | Push Firestore products → Square catalog |
| Design catalog management (individual DB objects) | Critical | Upload/manage design assets with name, description, photo, tags |
| Site configuration (colors, banner, shipping rates) | High | Real-time style overrides |
| Inventory sync with Square | High | Batch fetch stock counts |
| Order tracking URL update | High | Set carrier tracking on orders |
| Admin email management | Medium | Add/remove admin accounts |
| User browser | Low | View registered users |

### 4.4 Design & Branding

| Feature | Priority | Description |
|---------|----------|-------------|
| Brand color palette (teal, gold, plum, cream) | Critical | Consistent visual identity |
| Dark mode support | Medium | System-preference-aware toggle |
| Glassmorphism card design | High | Modern UI aesthetic |
| Tactile button effects (3D press) | High | Touch-friendly interactions |
| Responsive design (mobile-first) | Critical | Works on all screen sizes |
| PWA installable (manifest, service worker) | High | Install to home screen |
| WCAG accessibility | Medium | Keyboard navigation, contrast ratios |

### 4.5 Technical Infrastructure

| Feature | Priority | Description |
|---------|----------|-------------|
| Firebase Hosting (CDN) | Critical | Static export deployment |
| Cloud Firestore (NoSQL database) | Critical | Products, categories, designs, users, orders, config |
| Firebase Storage (file storage) | Critical | Product images, design assets, user uploads |
| Cloud Functions (serverless backend) | Critical | Square API integration, sync, payments, admin operations |
| Square API integration (v42) | Critical | Catalog, orders, payments, inventory |
| Service worker with offline caching | Medium | Cache-first strategy for static routes |
| JSON-LD structured data | Medium | SEO optimization |
| Sitemap + robots.txt | Low | Crawler configuration |
| Backup framework (3-layer redundancy) | Medium | Git + local snapshots + pre-edit backups |

### 4.6 Future (Not Implemented)

| Feature | Priority | Description |
|---------|----------|-------------|
| Email notifications (order confirmations, shipping) | Future | SendGrid or similar integration |
| Advanced analytics (GA4 or Firebase Analytics) | Future | Traffic and conversion tracking |
| Band merch campaign landing page builder | Future | Template-based campaign pages |
| Fundraising portal dashboard for organizers | Future | Self-service campaign management |
| Multi-language support | Future | Spanish language option |
| Push notifications (Web Push API) | Future | Order status updates |
| Product reviews and ratings | Future | User-generated content |

---

## 5. OPERATIONAL WORKFLOW

### 5.1 Order Flow
```
Customer browses → Selects product → Customizes design (customizer) → Adds to cart
→ Checkout (Square card payment) → Order created in Square → Mirrored to Firestore
→ Admin sets tracking URL → Customer tracks via account page
```

### 5.2 Catalog Management
```
Square Catalog (405 items) ←→ syncProducts / createSquareProduct
         ↓
Firestore products/ (ManagedProduct)
         ↓
Admin CMS (edit, manage, upload images/designs)
         ↓
Public Storefront (shop, product, customizer)
```

### 5.3 Design Management
```
Admin uploads design → Firebase Storage (designs/{id}_{name})
         ↓
Design metadata written to Firestore designs/{id}
         ↓
Customizer reads designs/ collection → shows in library
         ↓
Customer selects design → overlays on product mockup
         ↓
Design position/scale/rotation saved in cart → passed to order
```

---

*This document should be updated whenever the business model or feature requirements change.*
