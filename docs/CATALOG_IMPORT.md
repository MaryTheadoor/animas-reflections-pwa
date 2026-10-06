# Catalog Import — migrating a catalog in from a data sheet

**Status:** planned, not implemented. Development note, 2026-10-06.
**Owner decision recorded:** yes — we are adding this feature.
**Shape (2026-10-06):** a **manual, admin-operated file upload**. Not a backend job, not a
Square API integration, not a staged sync — see §1.1 for the scope and its exclusions.

---

## 1. Intent

Add a **catalog import** so an existing store's products can be migrated here from a data
sheet instead of being retyped one at a time through the admin. The operator exports the
catalog by hand, prepares the sheet, and uploads the file in the admin.

Sources we should expect, in rough priority order:

| Source platform | Typical export | Shape |
|---|---|---|
| Square (Square Online / Dashboard) | Item export CSV | one row **per variation**, `item_name` / `variation_name` / `item_price` / `item_sku` |
| Shopify | Products CSV | one row per variant, many `Option1 Name`/`Option1 Value` columns, `Handle`, `Variant SKU`, `Image Src` |
| Etsy | Listings CSV | one row per listing, variations collapsed into multi-value fields |
| WooCommerce | Product CSV | one row per variation, `Attribute 1 name`/`Attribute 1 value(s)`, pipe-delimited multi-values |
| BigCommerce / Wix / Squarespace | CSV | similar to Shopify |
| Our own template | CSV (and ideally XLSX / pasted sheet) | canonical column names |

**The current migration is from Square** (the Square *website builder* products, per §1.1).
The other platforms are future work, and the manual-pipeline shape means the operator can
normalise any of them into our template before uploading.

Because every source names and shapes its fields differently, importing is **two
problems, not one**:

1. **A parser** — read the file (CSV, later XLSX or a pasted sheet).
2. **A translation layer** — identify which source column means which of our fields,
   reshape it, and report anything that could not be mapped. This is the part that
   does the real work, and it is the part worth designing carefully.

**Nothing should be silently dropped.** If a source column cannot be mapped, the
import must say so rather than quietly discarding data.

### 1.1 Scope: a manual, admin-operated file import (owner clarification, 2026-10-06)

**Corrected.** An earlier revision of this note proposed pulling the Square catalog
server-side as the primary route. The owner has clarified the intended shape, and that
recommendation is **cut**:

> "this Is a manual pipeline. I'm not expecting to add an import button or do this in the
> backend. It would be overseen by admin directly. Not opposed to a stag and sync
> protocol, but that's a separate aspect than what I'm describing. We should have a file
> upload for importing and we will export data sheets manually."

The pipeline is therefore:

```
operator exports a data sheet by hand (Square / other platform)
  → operator prepares or normalises it   (an LLM may help — outside the app)
  → operator UPLOADS the file in the admin
  → app: parse → translate → report → write
```

**In scope**

- A **file upload** in the admin, accepting a data sheet (CSV first)
- A tolerant parser, and the **translation layer** (§4) — the substantive work
- The per-field **report** (§4.5): the operator's evidence that nothing was silently dropped
- The Firestore write, performed by the authenticated admin

**Out of scope, explicitly**

- **Backend / Cloud Function work** — no server-side bulk importer
- **A Square API integration**, or any "pull from Square" action
- **A staged sync protocol** and ongoing re-synchronisation — the owner describes this as
  "a separate aspect", i.e. not this feature
- Re-establishing Square as a source of truth: Firestore remains the master catalog
  (`e7e1100`, 2026-08-19)

**Two facts from the cut route still matter**

1. The website-vs-POS split is the **`ecom_visibility` attribute** within one Square
   catalog, not two catalogs. That is relevant when *choosing what to export*: the website
   products are the `VISIBLE` ones, and `docs/SCOPE.md` recorded the split as
   ~405 website-visible vs 74 POS-only. Confirm the export includes the ones we want and
   exclude POS-only noise.
2. **Scale (measured 2026-10-06):** the live catalog holds **42 products** against ~405 on
   the Square side — roughly a **10× expansion**. Batching (§5.4) and the report are
   therefore load-bearing, not polish.

**Tolerance is a convenience; the report is the point.** In a manual pipeline the operator
can pre-normalise the sheet (with or without an LLM), so arbitrary platform dialects matter
less than they would in an automated pipeline. What cannot be delegated to their preparation
is knowing whether the import understood every column — hence §4.5.

**Reference material in git (knowledge, not a route).** The removed
`functions/src/sync.ts` — 755 lines, recoverable at `e7e1100^` — encodes how *this*
catalog's flat Square variant names carry meaning:

- `extractColors()` — colour patterns (`Burgundy`, `Royal`, `Neon`, …) found in variant names
- `extractSizes()` — size patterns found in variant names
- `extractTags()` — product-type tagging from name + description + categories
- `detectBrand()` + `BRAND_PATTERNS` / `getBrandCategoryName()` — a brand→category map naming
  **Biscuit Hockey**, Durango Lacrosse, Durango Hockey, Durango Roller Girls, Dunphy Stock
  FAM, GREEN BUDDHA, LITTLE STRANGER, Jordan Branch Music, ET Art

That brand map should **seed the brand taxonomy** ("Biscuit Hockey is a brand", confirmed
2026-10-06) rather than be re-derived, and these heuristics are the starting point for
turning a Square-shaped sheet into our structured variants. Read the file for the mapping
knowledge — do not resurrect its sync behaviour.

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

### 4.2 Header aliases, and profiles as optional extensibility

Because the pipeline is manual (§1.1), the operator can normalise a sheet to our template
before uploading, so arbitrary platform dialects are **not the critical path**. What is
needed is a pragmatic resolution layer: an ordered list of accepted header aliases per
canonical field, resolving **specific alias → generic alias → absent (and report it)**.

The recovered `csv.ts` already normalises headers (lowercase, strip `space _ -`) and
already accepts Square's `item_name` / `variation_name` / `item_price` / `item_sku` — so
Square sheets work without pre-normalising.

Keep the resolution layer **declarative** rather than a pile of
`if (col === "item_name" || col === "Name")` branches, so a future platform is an
addition, not a rewrite:

```ts
interface ImportProfile {
  id: string;                      // "square" | "shopify" | "generic"
  label: string;
  detect(headers: string[]): number;                 // confidence score, pick the best
  fieldAliases: Record<CanonicalField, string[]>;
  reshape?: Record<string, (rows, ctx) => unknown>;  // platform-specific quirks
}
```

Building the profile registry is worth doing only when a second real source appears.
For the Square migration, one `generic` profile plus Square aliases is sufficient — don't
build four profiles for sources nobody has asked to import yet.

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
4. **Write strategy and progress.** Corrected 2026-10-06 against the recovered code:
   it writes one `setDoc(..., { merge: true })` per product, sequentially, each preceded
   by a `getDoc` to decide created-vs-updated. That means the 500-writes-per-`writeBatch`
   limit **does not apply** — any product count will work. The real costs are N+1 reads,
   no progress indication during a long run, and no way to resume or abort a partial
   import. A ~400-product migration is tolerable; a resumable run would be better.
   (An earlier revision of this note claimed a 500-write batching requirement, which
   was wrong for this implementation.)
5. **Images.** Exports give **URLs** (often the old platform's CDN). We either store
   remote URLs (fast, but they break when the old store is cancelled) or fetch and
   re-upload to Firebase Storage (durable, but needs CORS, size limits, and failure
   handling). This is a real decision with a migration cost either way.
6. **Categories.** Nearly all platforms classify products. Do we create missing
   categories, or require a mapping to existing ones first? Silent category creation
   from a messy export is how you end up with 60 categories.
7. **Client-side writes (this is the chosen path).** Per §1.1 the import runs from the
   browser as the authenticated admin — no backend function. That is fine, and it keeps
   the feature small, but it carries three consequences to handle deliberately:
   - Writes go through `firestore.rules`, so the products collection must permit admin
     writes (it already does — this line hardened rules to admin-only writes).
   - The 500-writes-per-batch limit applies client-side too, so chunking is still required.
   - Gating must depend on the **admin claim**, not a Firestore lookup — the storage-rules
     lesson: cross-service `firestore.exists()` checks were verified broken against the
     live bucket.
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

1. **The sheet's shape.** Since the operator prepares it by hand, do we standardise on our
   own template (simplest, least tolerant), or keep tolerance for raw platform exports
   (Square / Shopify / Woo column names)? Recommend: accept **our template and Square's
   column names** — the recovered `csv.ts` already handles both.
2. **Identity, and the collision rule.** Which field keys a product (id, handle, name), and
   when a row keys to a product that already exists, do we update, skip, or abort? With 42
   products already in Firestore and ~405 incoming, collisions are likely and the default
   matters.
3. **Images**: keep the source URLs, or re-host into Firebase Storage? Re-hosting is the
   durable option but needs CORS and failure handling; source URLs are fast but break when
   the old store is cancelled.
4. **Categories**: auto-create from the sheet, or a map-only step against existing
   categories? Silent creation from a messy export is how you end up with 60 categories.
5. **Delete-on-absent?** If a product exists here but not in the sheet, does the import
   remove it, deactivate it, or leave it? Default: **leave it.**
6. **File format**: CSV only, or CSV + XLSX? XLSX needs a parser dependency (e.g. SheetJS).
   The export step is manual, so CSV should be easy to produce either way.
7. **Add-ons/modifiers.** Square exposes modifier lists separately from items. In a manual
   pipeline, does the operator carry them in the sheet, or are they recreated by hand?
8. **Does the Square export distinguish website items from POS-only?** Not verified. If it
   does not, the operator must filter the sheet before upload — the website products are the
   `ecom_visibility = VISIBLE` ones (§1.1).
9. **Where the upload lives** — extend the existing `Products → Import CSV` control (already
   built on the other line) or give it its own admin section. Placement only, no behaviour
   difference.
10. **Is a read-only preview wanted now?** The owner classifies staging as "a separate
    aspect". A preview is still the cheapest way to trust a ~400-product write, so this note
    recommends keeping it even if a full staged-sync protocol is deferred.

---

## 7. Suggested phasing

Revised 2026-10-06 for the manual, file-upload scope in §1.1. The server-side catalog pull
is out; the recovered CSV upload path is the foundation.

| Phase | Deliverable | Why this order |
|---|---|---|
| 1 | Recover `csv.ts` + the `Products → Import CSV` file-upload UI from the other line (commit `86b1362`) onto this branch | It **is** the upload importer described in §1.1 — a working starting point, and its parser is solid |
| 2 | Generalise the translation layer: the canonical row (§4.3), **derive option dimensions from flat rows**, and the **report** (§4.5) | This is the real work. The recovered importer groups rows by name but neither derives options nor reports unmapped columns |
| 3 | Harden: `stripUndefined()` on every payload, money/encoding/bool handling, chunked writes for >500 products | Correctness before the first real ~400-product run |
| 4 | Add the Square variant-name heuristics (`extractColors` / `extractSizes` / `extractTags` / `detectBrand`) and seed the brand list from `BRAND_PATTERNS` | Reuses mapping knowledge already tuned to *this* catalog |
| 5 | Identity + collision rules, category and brand mapping, image strategy (§6.2–6.4) | The decisions that need the operator's input |
| 6 | Practice run on the real sheet — dry run first, then eyeball the imported catalog against the live Square site | In a manual pipeline, the acceptance test is the operator recognising their own catalog |
| 7 | Later: XLSX support, other platform dialects | Only if the manual CSV path proves insufficient |

## 8. Definition of done

- Uploading the same real sheet twice in a row is idempotent (no duplicates, no drift).
- Every source column is either mapped or **listed** in the report as unmapped.
- Every defaulted field is named in the report.
- A read-only pass over the file is available and never writes (§6.10).
- No `undefined` reaches Firestore; a malformed row fails that row, not the run.
- The run reports progress and survives any catalog size (the sequential writer already
  has no 500-write ceiling — see §5.4).
- Variants are written with structured `options` and the product's `options` dimensions,
  so the variant matrix editor can round-trip them.
- Categories on the sheet resolve to real categories, not an empty `categoryId`.
- The operator can recognise their own catalog in the result — for a manual pipeline that
  is the real acceptance test.
- **The Help tab has an entry explaining the Square → data sheet → upload migration
  workflow** (owner instruction, 2026-10-06). It must describe the feature as it actually
  behaves, so it lands with the phase that finishes the translation layer, not before.

## 9. Implementation status (updated 2026-10-06)

**Phase 1: done and deployed** (`32d29ab`). Recovered from `origin/master` (`86b1362`):
`src/lib/csv.ts`, `src/lib/catalog-import.ts`, `src/lib/__tests__/csv.test.ts`, and the
admin `Products → Import CSV` upload control with template download. Verified live.

**Phase 2: the three blocking defects are fixed and deployed** (`2a362cb`). Both decisions
in §6 were taken by the owner: **update the existing product** on a collision, and
**map categories to existing only, reporting the rest**.

| # | Was | Now |
|---|---|---|
| 1 | Re-import duplicated the catalog — grouping keyed on the name but the id was a fresh `randomUUID()` | `slugifyKey(name)` makes the id deterministic (sheet `id` when present), so a re-import updates in place |
| 2 | `categoryId: ""` threw the sheet's category away | Resolved by name against the caller's categories; unmatched names are reported, **never auto-created** |
| 3 | `options: {}` claimed a modelled variant that wasn't | Removed. Variants carry only the sheet's label until the heuristics below land |

The **report** is now complete: `warnings` is a separate channel from `errors`, and covers
unmatched categories, headers that map to nothing, and `productType` values that fell back
to `"other"`. Header aliases moved into a single `FIELD_ALIASES` map so the row mapper and
the unmapped-column detection cannot drift apart.

Tests: 117 → 121 (deterministic ids, category resolution, unmapped columns, productType
coercion).

**The Help entry is in** (owner instruction): a "Migrating a catalog from Square" guide
entry plus a step-by-step migration tutorial — export, create categories first, import,
read the report, correct-and-re-import. It states the remaining limitation plainly rather
than describing the feature aspirationally.

**Still outstanding — the one open piece:**
- **Structured variant options.** Decomposing a sheet label like `"L / Navy"` into
  `{Size: "L", Color: "Navy"}` plus the product's declared `options` dimensions needs the
  Square variant-name heuristics (`extractColors` / `extractSizes` / `extractTags`) and
  the `BRAND_PATTERNS` brand map from the deleted `functions/src/sync.ts` (recoverable at
  `e7e1100^`). Until then, imported variants are name-only and must be wired to matrix
  dimensions per product by hand. This is §7 phase 4.
- Migrating to another platform (Shopify/Woo/Etsy column sets) and XLSX remain future work.

---
**Scope recap:** manual, admin-operated, file-upload import. No backend, no Square API
integration, no staged sync (§1.1).
