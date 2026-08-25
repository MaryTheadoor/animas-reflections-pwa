# Phase 1 Audit — Product Modifiers, Variants & Catalog Architecture

**Date:** 2026-08-19  
**Scope:** Product schema, admin editing pipeline, customer-facing product/customizer flow, backend/Firestore/Square integration.  
**Goal:** Identify why item modifiers (color, size, add-ons, custom variables) feel fragile, and propose a concrete, phased plan to make the catalog scalable for Animas Reflections' mix of apparel, signs, stickers, jewelry, and custom designs.

---

## Executive Summary

The PWA already has a rich `ManagedProduct` model and a working customizer, but the **modifier system is built on flattened strings rather than structured options**. Variants are just `name` + `price` + `sku`; colors are stored in multiple inconsistent lists; add-ons are hardcoded to three typed IDs; and there is no real distinction between **product options** (size/color), **line-item modifiers/add-ons** (back print, personalization), and **per-order custom fields** (engraving text, custom dimensions).

The good news: the Firestore schema has most of the hooks already (`ProductAttributes`, `ManagedVariant.customFields`, `productAddons`, `colorTints`, `mockupImagesByColor`). The work is mostly about **normalizing the data model, hardening the admin UI, and making the customizer/backend honor the same shape**.

---

## 1. E-Commerce Reference Model

To avoid re-inventing concepts, here is how most modern platforms (Shopify, BigCommerce, WooCommerce, Square) model the same domain:

| Concept | What it is | Example in this project |
|---|---|---|
| **Product** | The sellable thing customers see | `ManagedProduct` (t-shirt, wood sign, sticker) |
| **Product Type** | A top-level classification used for shipping/tax/filtering | `productType`: `apparel`, `sticker`, `sign`, `jewelry`, `accessory`, `other` |
| **Category / Collection** | A merchandising bucket; can be hierarchical | `ManagedCategory` (flat today; "Biscuit Hockey", "Hats") |
| **Brand** | A separate taxonomy, orthogonal to category | *Missing* — the "By Design / Brand" toggle is actually filtering by category |
| **Product Options** | Dimensions that define SKUs: size, color, material | Today flattened into `variant.name` like `"L / Black"` |
| **Variant / SKU** | One concrete sellable unit defined by its option values | `ManagedVariant` (id, name, price, sku, inventory) |
| **Modifiers / Add-ons** | Upsells attached to a line item, **not** part of the SKU | `back_print`, `sleeve_print`, `personalization` |
| **Custom Fields** | Per-line-item information collected at order time | `design_text`, variant `customFields` (underused) |
| **Design / Asset** | A reusable artwork file | `DesignAsset` (global library + per-product `designAssets`) |

The project's current schema conflates **options**, **modifiers**, and **custom fields**, which is why Cindy hits friction when a product has non-apparel options (sign dimensions, grommet count, wood type) or when add-ons need custom pricing.

---

## 2. Current State

### 2.1 Data Model (`src/types/index.ts`, `src/lib/constants.ts`)

- **`ManagedProduct`** is the canonical document. It carries `variants: ManagedVariant[]`, `colors: string[]`, `productAddons?: ProductAddon[]`, `attributes?: ProductAttributes`, `colorTints`, `mockupImagesByColor`, `designAssets`, `singleDesign`, `customizable`, `shippingRate`, `weightOz`, and `baseProductId`.
- **`ManagedVariant`** has `id`, `name`, `price`, `sku`, optional Square IDs, `inventory`, and an optional `customFields` array that is stored but never shown to customers.
- **`ProductAddon`** is just `id`, `name`, `price`. Standard add-ons use typed IDs (`back_print`, `sleeve_print`, `personalization`); custom add-ons use UUIDs.
- **`AddonType`** is hardcoded to the three standard add-ons (`src/types/index.ts:184`). The customizer casts arbitrary add-on IDs to `AddonType` (`src/app/customizer/page.tsx:283`), which is a type lie.
- **Colors are defined in at least four places:**
  1. `PRODUCT_COLORS` (matrix editor) — Title Case: `"Black", "White", "Navy"…`
  2. `AVAILABLE_COLORS` in admin (`product-manager.tsx:40-43`) — lowercase: `black, white, gray, navy, royal blue, red, forest green, cream, charcoal, maroon`
  3. `AVAILABLE_COLORS` in search filter (`useSearch.ts`) — slightly different list
  4. `DEFAULT_COLOR_TINTS` keys — lowercase, includes synonyms like `blue`, `green`, `heather`, `ash`
- **Sizes** are hardcoded to apparel sizes (`XS`…`4XL`) in the matrix editor; no custom option support.

### 2.2 Admin Editing Pipeline (`src/components/admin/product-manager.tsx` etc.)

- `product-manager.tsx` is a ~1,586-line monolith covering list view, edit form, category creation, Square sync, inventory sync, and bulk actions.
- **Variants:** manual entry or matrix editor. Matrix only supports size/color with one shared base price and auto-generated SKUs (`prefix-SIZE-COL`).
- **Add-ons:** three-state semantics (`undefined` = site defaults, `[]` = none, `[...]` = exact list). The UI pre-checks the three standard add-ons, so as soon as an admin touches the section the product stops following site defaults.
- **Categories:** flat list with `order` field; no subcategories, no brand taxonomy, slug collisions possible.
- **Images/mockups:** per-view mockups + per-color photos + color tints. Per-color photo assignment uses non-visual dropdowns (`img 1`, `img 2`).
- **Custom attributes:** `ProductAttributes` (background color, patch shape, border style, customFields) plus per-variant `customFields`. Two overlapping systems.

### 2.3 Customer-Facing Pipeline (`src/app/product/page.tsx`, `src/app/customizer/page.tsx`, `src/app/shop/page.tsx`)

- **Product page:** variant buttons, color swatches, optional personalization text. No display of variant `customFields`.
- **Customizer:** supports per-view mockups, color tints/per-color photos, design upload/selection, add-ons, design positioning. Only the **active view's** design state is persisted to the cart; text color/font are local state and not persisted.
- **Shop/Search:** "By Design / Brand" toggle filters by `categoryId`; "By Product Type" filters by `productType`. Search color filter requires an exact lowercase match against a hardcoded list.

### 2.4 Backend / Firestore / Square (`functions/src/index.ts`)

- `products`, `categories`, `designs` are publicly readable and writable by **any signed-in user** (no admin gating in rules).
- Square sync reads items from Square, groups by detected brand or Square category, and writes `ManagedProduct` docs. A re-sync can overwrite admin-enriched fields (`mockupImages`, `printZones`, `colorTints`, etc.).
- `createSquareProduct` pushes Firestore products to Square but only sends name, description, variants (name/price/sku). It does not push categories, images, modifiers, inventory, or taxes.
- Orders are mirrored from Square with `customerEmail`; design URLs are captured per line item. Subtotal/tax in the mirrored order are hard-coded to `0`.
- Inventory is pulled from Square but not enforced at checkout or written back.

---

## 3. Gap Analysis

### Critical (blocks scaling)

1. **Flattened variant options.** Variants are just strings like `"L / Black"`. There is no structured `{size, color, material, …}` object, so the system cannot reliably filter by size, group by color, or generate SKUs for non-apparel options.
2. **Conflated modifier model.** Add-ons, custom fields, and product options are treated similarly. There is no `modifiers` collection, no per-product modifier catalog, and Square modifier passthrough is minimal.
3. **No brand / subcategory taxonomy.** The "By Design / Brand" filter is actually category filtering. Cindy cannot build `Apparel > T-Shirts` or browse `Brand: Biscuit Hockey` across categories.
4. **Color normalization is broken.** Divergent color lists and case mismatches mean tints, per-color photos, matrix generation, and search filters can disagree.

### High (daily friction)

5. **Add-on ID/type mismatch.** Standard add-ons use `AddonType` literals; custom add-ons use UUIDs. The customizer casts UUIDs to `AddonType`, and cart labels are hardcoded English strings, ignoring `ProductAddon.name`.
6. **Matrix editor limitations.** Only size/color, one price for all new cells, collision-prone SKUs, no custom options (e.g., wood type, grommet count).
7. **Per-color photo workflow.** Dropdowns without thumbnails; two UIs (`product-manager` and `image-manager`) edit the same `mockupImagesByColor` field.
8. **Custom fields not surfaced.** `ManagedVariant.customFields` and `ProductAttributes.customFields` are stored but not shown on product pages or captured in order mirroring.
9. **Square sync overwrites manual work.** ~~`syncProductsFromSquare` and `importFromSquare` regenerate products from Square and discard admin edits.~~ **RESOLVED (2026-08):** the Square→Firestore catalog sync was removed in Phase 1 — Firestore `products/` is now the master catalog and Square is payment-only.

### Medium (polish / correctness)

10. **Customizer only persists one view's design.** A customer customizing front and back loses the inactive view's coordinates.
11. **Text styling not persisted.** Customizer text color/font are local state; the product page has no color/font control.
12. **Inventory not enforced.** `inventory` is pulled from Square but never checked at checkout or decremented on sale.
13. **Firestore rules too permissive.** Any signed-in user can write `products`, `categories`, `config`, and `designs`.
14. **Order mirroring is incomplete.** Subtotal/tax are `0`; status lifecycle is thin; no Square webhook integration.

---

## 4. Recommended Plan of Action

### Phase 1A — Data Normalization (quick wins, low risk)

- **Unify color lists.** Pick one canonical color list (suggest Title Case display names with lowercase keys for tints) and migrate `PRODUCT_COLORS`, admin `AVAILABLE_COLORS`, search `AVAILABLE_COLORS`, and `DEFAULT_COLOR_TINTS` to use the same values. Add a normalization helper for legacy data.
- **Standardize `productType` values.** Enforce `apparel`, `sticker`, `sign`, `jewelry`, `accessory`, `other` on save; default new products to `other` only if detection fails.
- **Fix add-on ID model.** Remove the hardcoded `AddonType` enum for custom add-ons; use `ProductAddon.id` as the source of truth everywhere. Keep `AddonType` only as a legacy alias for the three standard add-ons if needed for Square mapping.
- **Harden Firestore rules.** Restrict `products`, `categories`, `designs`, and `config` writes to `isAdmin()`.

### Phase 1B — Admin UX Refactor (medium effort, high value)

- **Break up `product-manager.tsx`.** Split into smaller components: `ProductList`, `ProductForm`, `VariantEditor`, `AddonEditor`, `AttributeEditor`, `ImageManagerPanel`.
- **Visual per-color photo picker.** Show thumbnails of `product.images` when assigning per-color mockups; merge the two competing UIs into one panel.
- **Category hierarchy + brand taxonomy.**
  - Add optional `parentId` to `ManagedCategory` for subcategories.
  - Add a new `brands` collection (`id`, `name`, `slug`, `logoUrl`) and a `brandId` field on `ManagedProduct`.
  - Update shop filters: "By Brand", "By Category" (with subcategories), "By Product Type".
- **Better variant creation.**
  - Allow custom option names beyond size/color (e.g., "Material", "Grommet Count").
  - Generate SKUs from a safe slug of option values.
  - Support bulk price update for selected variants.

### Phase 1C — Modifier / Custom Field Architecture (larger effort)

- **Introduce three distinct concepts:**
  1. **Product Options** → define variants/SKUs (size, color, material).
  2. **Line-Item Modifiers / Add-ons** → upsells priced per item (back print, sleeve print, personalization, rush processing).
  3. **Custom Fields** → free-form data collected per line item (name/number, engraving, custom dimensions, file upload).
- **Create a `modifiers` collection** in Firestore with schema: `id`, `name`, `type` (`toggle` | `select` | `text` | `file`), `price?`, `options?`, `appliesToProductTypes?`. Let admins attach modifiers to products.
- **Replace the current `productAddons` three-state logic** with a clear list of attached modifier IDs; site defaults become a default attachment list in `SiteConfig`.
- **Capture custom fields in `CartItem`** and mirror them into the Firestore order so fulfillment sees them.

### Phase 1D — Backend Hardening

- **Preserve admin metadata on Square sync.** Merge incoming Square data with existing `mockupImages`, `printZones`, `colorTints`, `attributes`, etc. instead of overwriting.
- **Inventory guard at checkout.** Check `variant.inventory` in `createSquareOrderAndPay` before payment; return a clear error if oversold.
- **Write inventory back.** Decrement Firestore variant inventory on successful order creation (Square is the source of truth long-term, but Firestore should reflect real-time sales).
- **Complete order mirroring.** Compute real subtotal/tax from Square response; support webhook-driven status updates.

### Phase 1E — Customizer Improvements

- **Persist all views.** Store a `Record<viewKey, DesignState>` in the cart item and order mirror, not just the active view.
- **Persist text styling.** Add `designTextColor` and `designTextFont` to `CartItem` and render them in the order summary/admin.
- **Show custom field inputs in customizer.** When a product has text/file modifiers, render them before "Add to Cart".

---

## 5. Immediate Quick Wins (could ship this week)

1. **Fix the admin editor list formatting** — already done (`desc-editor` CSS).
2. **Unify color lists and normalize case** — reduces tint/photo/search mismatches immediately.
3. **Add `isAdmin()` to `products`, `categories`, `designs`, `config` write rules** — closes the security gap.
4. **Display `ProductAttributes.customFields` and `ManagedVariant.customFields` on the product page** — surfaces data that is already stored.
5. **Add a `brandId` field and basic brand filter** — gives Cindy a real "By Brand" toggle without a full taxonomy rewrite.

---

## 6. Open Questions for Cindy / Stakeholders

1. **Square as source of truth?** Do you want to keep syncing products *from* Square, or should Firestore become the master catalog and Square only receive pushes at checkout?
2. **What non-apparel options do you need?** Wood sign dimensions? Sticker finish (matte/gloss)? Jewelry metal type? This determines the custom option builder.
3. **Add-on pricing model?** Flat fee per add-on (current), percentage of product price, or tiered by product type?
4. **Custom fields at order time?** What do you need to collect from customers beyond name/number and uploaded designs? (engraving text, dates, team roster CSVs, etc.)
5. **Brand vs. Category?** Should "Biscuit Hockey" be a brand that spans categories, or a category that contains products? Both?

---

## 7. Files Referenced

- `src/types/index.ts` — core schema
- `src/lib/constants.ts` — sizes, colors, tints, defaults
- `src/context/cart-context.tsx` — cart/add-on assembly
- `src/components/admin/product-manager.tsx` — main admin editor
- `src/components/admin/variant-matrix-editor.tsx` — size/color matrix
- `src/components/admin/image-manager.tsx` — image/mockup uploads
- `src/components/admin/category-manager.tsx` — categories
- `src/app/product/page.tsx` — product detail page
- `src/app/customizer/page.tsx` — customizer flow
- `src/app/shop/page.tsx`, `src/app/search/page.tsx` — filtering
- `functions/src/index.ts` — backend payment/admin (14 functions); `functions/src/pricing.ts` — server-side order pricing. (`sync.ts` / `product-pipeline.ts` removed in Phase 1, 2026-08)
- `firestore.rules` — security rules

---

*End of Phase 1 audit. Implementation planning for Phase 1A/B should follow stakeholder answers to the open questions.*
