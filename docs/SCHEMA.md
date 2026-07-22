# Firestore Schema Reference

All data is stored in Cloud Firestore. Clients read directly; writes are authenticated (see `firestore.rules`).

---

## Collections

### `products/{productId}` — ManagedProduct

The canonical product format. Source of truth for all product data.

```
{
  id: string;                    // "prod_biscuit_hockey_1718400000000"
  name: string;                  // "BISCUIT HOCKEY"
  description: string;           // Max 600 chars
  categoryId: string;            // "cat_biscuit_hockey"
  productType: string;           // "apparel" | "sticker" | "sign" | "jewelry" | "accessory" | "other"
  colors: string[];              // ["black", "white", "navy"]
  tags: string[];                // ["biscuit hockey", "hockey", "sports"]
  images: string[];              // Firebase Storage URLs (gallery)
  variants: ManagedVariant[];    // Size/color variations
  active: boolean;               // Show in catalog?
  featured: boolean;             // Show on homepage?
  createdAt: string;             // ISO timestamp
  updatedAt: string;
  squareItemIds?: string[];      // Square catalog ITEM IDs (for payment)
  seoTitle?: string;             // Custom SEO title
  seoDescription?: string;       // Custom SEO meta description
  printZones?: PrintZoneTemplate; // Per-view print coordinates
  mockupImages?: {               // Blank garment photos per view
    front?: string;              // Firebase Storage URL
    back?: string;
    sleeve?: string;
  };
  weightOz?: number;             // For calculated shipping
  baseProductId?: string;        // Parent product grouping
}
```

### `products/{productId}` — ManagedVariant (nested array)

```
{
  id: string;                    // "VAR_12345"
  name: string;                  // "Large / Black"
  price: number;                 // 25.00
  sku: string;                   // "BH-L-BLK"
  squareItemId?: string;         // Parent Square ITEM ID
  squareVariationId?: string;    // Square variation ID (required for payment!)
  inventory?: number;            // Stock count (undefined = unlimited)
}
```

### `categories/{categoryId}` — ManagedCategory

```
{
  id: string;                    // "cat_biscuit_hockey"
  name: string;                  // "BISCUIT HOCKEY"
  slug: string;                  // "biscuit-hockey"
  order: number;                 // Display order
  createdAt: string;
  updatedAt: string;
}
```

### `config/site` — SiteConfig

```
{
  announcement_text: string;
  announcement_active: boolean;
  primary_color: string;         // "#1E4D4F"
  accent_color: string;          // "#D97706"
  background_color: string;      // "#FAF6F0"
  shipping_tier_stickers: number; // 3.00
  shipping_tier_apparel: number;  // 7.50
  free_shipping_threshold: number;// 100.00
  addon_price: number;           // 5.00
  hero_heading: string;
  hero_subheading: string;
  about_body: string;
}
```

### `config/admin` — Admin emails

```
{
  emails: string[];              // ["mary.theadoor.doctor@gmail.com"]
}
```

### `config/sync_status` — Sync status

```
{
  lastSync: string | null;       // ISO timestamp
  productCount: number;
  categoryCount: number;
  itemCount: number;
  errors: string[];
}
```

### `config/import_status` — Import status

```
{
  lastImport: string;            // ISO timestamp
  imported: number;
  errors: string[];
}
```

### `designs/{designId}` — DesignAsset (individual docs)

Design assets for the customizer library. Stored as **one document per design**
(migrated away from the old single `designs/catalog` doc holding an `items[]`
array — a migration tool in Admin → Designs converts any legacy entries).

```
{
  id: string;                    // UUID
  name: string;
  description?: string;
  category: string;
  image_url: string;             // Firebase Storage URL (transparent PNG)
  tags?: string[];
  created_at: string;            // ISO timestamp
  productId?: string;            // set when pinned to a specific product
}
```

> **Deprecated:** `designs/catalog` (`{ items: DesignAsset[] }`) — read-only
> fallback for un-migrated data; do not write new designs here.

### `users/{userId}` — User profiles

```
{
  email: string;
  displayName?: string;
  updatedAt: Timestamp;
}
```

### `orders/{orderId}` — Order records (via Cloud Functions only)

Not directly readable by clients. Managed by `createSquareOrderAndPay`.

---

## PrintZone & PrintZoneTemplate

```
PrintZone {
  x_percent: number;     // 0-100, position from left
  y_percent: number;     // 0-100, position from top
  width_percent: number; // 0-100, relative to canvas
  height_percent: number; // 0-100
}

PrintZoneTemplate {
  front: PrintZone;
  back?: PrintZone;
  sleeve?: PrintZone;
}
```

---

## Firebase Storage Structure

```
/products/{productId}/{uuid}_{filename}.ext    # Product gallery images
/designs/{uuid}_{filename}.png                 # Design assets (transparent PNGs)
/uploads/{userId}/{filename}.ext               # User custom uploads
```
