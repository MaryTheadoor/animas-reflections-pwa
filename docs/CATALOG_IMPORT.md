# Catalog Import — migration from other e-commerce platforms

**Status:** planned, not implemented. Development note, 2026-10-06.
**Owner decision recorded:** yes — we are adding this feature.

---

## 1. Intent

Add a **bulk catalog import** so we can migrate an existing store from another
e-commerce platform by exporting its catalog and importing it here, instead of
retyping products one at a time through the admin.

Sources we should expect, in rough priority order:

| Source platform | Typical export | Shape |
|---|---|---|
| Square (Square Online / Dashboard) | Item export CSV | one row **per variation**, `item_name` / `variation_name` / `item_price` / `item_sku` |
| Shopify | Products CSV | one row per variant, many `Option1 Name`/`Option1 Value` columns, `Handle`, `Variant SKU`, `Image Src` |
| Etsy | Listings CSV | one row per listing, variations collapsed into multi-value fields |
| WooCommerce | Product CSV | one row per variation, `Attribute 1 name`/`Attribute 1 value(s)`, pipe-delimited multi-values |
| BigCommerce / Wix / Squarespace | CSV | similar to Shopify |
| Our own template | CSV (and ideally XLSX / pasted sheet) | canonical column names |

Because every source names and shapes its fields differently, importing is **two
problems, not one**:

1. **A parser** — read the file (CSV, later XLSX or a pasted sheet).
2. **A translation layer** — identify which source column means which of our fields,
   reshape it, and report anything that could not be mapped. This is the part that
   does the real work, and it is the part worth designing carefully.

**Nothing should be silently dropped.** If a source column cannot be mapped, the
import must say so rather than quietly discarding data.

---

## 2. What already exists in the repository

Reusable foundation exists on the **Content & Theme line** (`origin/master`), not on
the line currently deployed:

| File | What it does | Notes |
|---|---|---|
| `src/lib/csv.ts` | RFC4180-ish parser (quoted fields, escaped quotes, embedded commas and newlines) + `csvToProducts()` | Also has `normHeader()` (lowercase, strip `space _ -`), `toBool()`, `toNum()`. Already tolerates both our template and Square's column names. |
| `src/lib/catalog-import.ts` | `importCatalogCsv()` — upserts each product to Firestore with `setDoc(..., { merge: true })`, pre-reads to report `{created, updated, errors}` | |
| `src/components/admin/product-manager.tsx` | `Products → Import CSV` UI + downloadable template | |
| `src/lib/__tests__/csv.test.ts` | Parser tests | |

**Important:** this line has **no importer at all**. `createSquareProduct` is a
single-product push *to* Square, not an import. The older Square→Firestore sync
pipeline was deleted: `functions/src/` now contains only `index.ts` and `pricing.ts`,
and `functions/lib/` still holds stale compiled orphans (`sync.js`,
`product-pipeline.js`) from the removed modules.

So the starting point is: **recover `csv.ts` + the import UI from the other line, then
build the translation layer on top.** `csv.ts`'s parser and header normalisation are
directly reusable; its `CatalogCsvRow` is a reasonable intermediate shape but is
currently Square-shaped and needs generalising.

---

## 3. Target schema (what we are mapping INTO)

From `src/types/index.ts`. This is the contract the translation layer must produce.

```ts
ManagedProduct {
  id, name, description, categoryId, productType
  colors: string[], tags: string[], images: string[]
  variants: ManagedVariant[]
  active, featured, createdAt, updatedAt
  squareItemIds?: string[]
  seoTitle?, seoDescription?
  printZones?, mockupImages?, mockupImagesByColor?, colorTints?, colorThumbnails?
  weightOz?, shippingRate?
  designAssets?: DesignAsset[]
  productAddons?: ProductAddon[]      // deprecated in favour of modifiers
  modifiers?: ProductModifier[]
  options?: ProductOption[]           // the dimensions that define variants
  singleDesign?, customizable?, attributes?: ProductAttributes
}

ManagedVariant {
  id, name, price, sku
  squareItemId?, squareVariationId?
  inventory?, inventoryUpdatedAt?
  customFields?: { key, value }[]
  options?: Record<string, string>    // e.g. { Size: "L", Color: "Navy" }
}

ProductOption  { id, name, type: "select"|"color"|"text", values: string[], required }
ProductModifier{ id, name, priceType: "fixed"|"percentage", price, inputType?, inputLabel? }
ProductType    = "apparel" | "sticker" | "sign" | "jewelry" | "accessory" | "other"
```

Two schema facts drive most of the mapping work:

- **Variants are structured**, not parsed from a name. `ManagedVariant.options`
  (`{Size: "L", Color: "Navy"}`) is the modern path, and `ManagedProduct.options`
  declares the dimensions. Most platform exports are **flat, one row per variant**,
  so the importer must derive the option dimensions from the data (distinct values
  per column) rather than expecting them declared.
- **Add-ons are per-product with three-state semantics** (`undefined` = inherit site
  defaults, `[]` = none, `[...]` = exactly these). An import must decide which state
  it is producing, and "no add-on columns in the file" should mean `undefined`
  (inherit), **not** `[]` (none).

---

## 4. Translation layer — proposed design

### 4.1 Structure

```
file bytes
  → parse            (CSV → string[][]; later XLSX/Sheets)
  → header detect     (which dialect is this?)
  → canonical row     (source-agnostic intermediate record)
  → translate         (canonical row → ManagedProduct, per product group)
  → report            (mapped / defaulted / unmapped / errors per field)
  → preview           (human approves)
  → commit            (batched Firestore upsert)
```

### 4.2 Dialect profiles, not a single mapping

Each source gets a **profile**: an ordered list of accepted header aliases per
canonical field, plus any reshaping rules.

```ts
interface ImportProfile {
  id: string;                      // "square" | "shopify" | "woocommerce" | "generic"
  label: string;
  detect(headers: string[]): number;         // confidence score, pick the best
  fieldAliases: Record<CanonicalField, string[]>;
  reshape?: Record<string, (rows, ctx) => unknown>;  // platform-specific quirks
}
```

This keeps platform-specific knowledge **declarative and testable** instead of a pile
of `if (col === "item_name" || col === "Name")` branches scattered through the
importer. Adding Etsy later should mean adding a profile, not editing the pipeline.

Resolution order for each canonical field: **profile alias → generic alias → absent
(report it)**.

### 4.3 Canonical intermediate fields

```ts
CanonicalRow {
  externalId?, handle?, name, description?
  variantName?, options?: Record<string,string>   // dimension → value
  price?, compareAtPrice?, currency?
  sku?, barcode?, inventory?
  category?, productType?, tags[]
  colors[], sizes[], images[]                     // images may be multi-value
  weight?, shippingRate?
  active?, featured?
  seoTitle?, seoDescription?
  addons?                                          // when present
  __source: { platform, row, raw: Record<string,string> }
}
```

`__source.raw` is retained so the report can quote the original value for anything
that failed.

### 4.4 Grouping and derived structure

- Rows sharing an identity key collapse into one product.
- Identity key, in order: explicit `id` → `handle` → normalised `name`.
  (Square exposes no stable key in its CSV, so `item_name` is likely the practical key —
  see §6.)
- **Option dimensions are derived**: for each group, every column that varies across
  the group's rows becomes an option (`type: "select"`, or `"color"` when the column
  is a colour dimension). Values come from the distinct values in the group. This is
  what turns Shopify/Woo flat rows into our `options` + variant `options` map.
- Variant `name` is then composed from the option values (matching how the admin
  variant matrix names variants today).

### 4.5 Reporting (the acceptance criterion)

Every import produces a report and the report is the deliverable the operator reads
before committing:

| Bucket | Meaning |
|---|---|
| Mapped | field populated from a recognised column |
| Defaulted | field not in the file, filled with a stated default (and which default) |
| Unmapped source columns | present in the file, no destination in our schema — **listed explicitly** |
| Row errors | unparseable price, missing required field, duplicate key |
| Conflicts | existing product with the same key — will it update or be skipped? |

An import that cannot tell the operator what it did not understand is not finished.

### 4.6 Identity and idempotency

- Upsert with `setDoc(..., { merge: true })` keyed on a **deterministic** product id so
  re-importing a corrected file updates rather than duplicates.
- Proposed: a slug of the identity key, or a stored `externalId` → product id map.
- Must decide behaviour when a file key collides with a **hand-made** product.

---

## 5. Non-obvious hazards (specific to this codebase)

1. **Firestore rejects `undefined`.** Known Issue #10 in `PROJECT_CONTEXT.md`: the Web
   SDK throws "Unsupported field value: undefined" and rejects the *whole* write. The
   importer must run every payload through `stripUndefined()`
   (`src/lib/firestore-utils.ts`). This is the single most likely way an importer
   fails silently per-product while appearing to work.
2. **Encoding.** The DEVLOG records a Unicode/encoding trap that previously corrupted
   CMS copy silently. CSV exports from Shopify/Woo/Square carry BOMs, and typographic
   characters in product names are exactly the payload that gets mangled. Import must
   read as UTF-8, strip BOM, and the report should flag mojibake.
3. **Money parsing.** `toNum()` currently strips everything but digits and `.` — which
   silently turns `1.234,56` (EU) into `1.23456` and `$1,299.00` into `1299.00` by luck.
   Currency format needs to be explicit and tested.
4. **Batching.** Firestore allows 500 writes per batch. A 2,000-product catalog with
   variants exceeds that; needs chunking plus progress reporting, and ideally a
   resumable/abortable run.
5. **Images.** Exports give **URLs** (often the old platform's CDN). We either store
   remote URLs (fast, but they break when the old store is cancelled) or fetch and
   re-upload to Firebase Storage (durable, but needs CORS, size limits, and failure
   handling). This is a real decision with a migration cost either way.
6. **Categories.** Nearly all platforms classify products. Do we create missing
   categories, or require a mapping to existing ones first? Silent category creation
   from a messy export is how you end up with 60 categories.
7. **Client-side vs server-side.** The existing importer writes from the browser. Bulk
   import is better as an **admin callable function**: it bypasses client rules for
   batching, keeps the write path server-authoritative, and gives one place to enforce
   admin gating. (Note the storage-rules lesson — cross-service rule checks were
   verified broken; make gating depend on the admin claim, not a Firestore lookup.)
8. **`productType` is a closed union** (`apparel | sticker | sign | jewelry |
   accessory | other`). Source platforms have free-text types, so type needs either
   an explicit mapping table or a safe default of `"other"` plus a report warning —
   never a guess that invents a union member.
9. **The variant-name convention.** Legacy products have variants whose meaning is
   parsed from the name string; newer ones carry `options`. Import should write
   `options`, but must not produce products that the variant matrix editor cannot
   round-trip.

---

## 6. Open decisions

1. **Which platforms first?** Square (because the current catalog came from Square) and
   Shopify are the highest value. Confirm with the client which store(s) she is
   actually migrating from — if the answer is only Square Online, the profile work is
   much smaller.
2. **Source of truth for identity** — external id, handle, or name? And what happens on
   collision with an existing product: update, skip, or abort?
3. **Images**: remote URLs or re-host into Firebase Storage?
4. **Categories**: auto-create, or map-only with an explicit mapping step?
5. **Delete-on-absent?** If a product exists here but not in the file, does the import
   remove it, deactivate it, or leave it? (Default should be *leave it*.)
6. **XLSX / Google Sheets** support — needs a parser dependency (e.g. SheetJS). Worth it
   or CSV-only?
7. **Add-ons/modifiers in the source**: Square exports modifier lists separately from
   items. Do we import them in this feature or leave them to be recreated by hand?
8. **Where the importer lives** — admin-only callable function (recommended) vs the
   existing client-side write path.

---

## 7. Suggested phasing

| Phase | Deliverable | Why this order |
|---|---|---|
| 1 | Recover `csv.ts` + admin import UI from the other line onto the current branch | Working parser and a real UI to hang the rest on |
| 2 | Canonical-row layer + `Generic` profile + full report + **dry-run preview** | The report and preview are what make an import trustworthy; build them before adding dialects |
| 3 | Money/encoding/bools hardening + `stripUndefined()` on every payload + batching | Correctness before scale |
| 4 | Dialect profiles: Square, then Shopify | Each is a small declarative addition once §4.2 exists |
| 5 | Category + `productType` mapping step, image strategy | The parts that need explicit human decisions |
| 6 | Optional: XLSX / full-sheet import | Needs a dependency; defer until CSV is proven |

## 8. Definition of done

- Importing a real export from a supported platform twice in a row is idempotent
  (no duplicates, no drift).
- Every source column is either mapped or **listed** in the report as unmapped.
- Every defaulted field is named in the report.
- A dry run is always available and never writes.
- No `undefined` reaches Firestore; a malformed row fails that row, not the run.
- The run survives >500 products (batching) and reports progress.
