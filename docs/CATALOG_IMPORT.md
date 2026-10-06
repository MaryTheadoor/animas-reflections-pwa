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

### 1.1 Source routes (owner input, 2026-10-06)

The client proposed two routes and stated the goal plainly: **get comprehensive product
data off the existing sites and into ours as conveniently as possible**, with the two
routes covering each other's edge cases. There is also a third, and a clear precedence
order between them.

**Context that reframes Route 1:** the client noted the catalog lives in Square's
*website builder* products rather than the POS products. That is **not two separate
catalogs** — in Square it is the **`ecom_visibility` attribute** on catalog objects, and
both populations live in one Catalog API. The deleted sync filtered precisely on
`ecom_visibility === "VISIBLE"`, i.e. the website population. So "website products" is
addressable directly, not a special case to hack around.

**Scale check (measured 2026-10-06):** the live Firestore catalog has **42 products**.
`docs/SCOPE.md` records the Square side at **~405 website-visible + 74 POS-only**
(needs re-measuring before the run). So this is roughly a **10× catalog expansion** — a
migration, not a touch-up. That is why preview, reporting, and batching in §4 and §5 are
not optional niceties.

| Route | What it is | Best for | Risks |
|---|---|---|---|
| **1. Square Catalog API pull** (recommended primary) | One-off server-side `catalog.search` for `ITEM` + `CATEGORY`, filtered to `ecom_visibility === "VISIBLE"` | Structured truth: names, variations, prices, SKUs, categories, images, and the website/POS distinction | Needs the Square token and the **right environment** (see below) |
| **2. Native Square CSV export** | Dashboard item export → our CSV importer | Independent cross-check; works without API credentials; `csv.ts` already tolerates Square's column names | **Unverified whether the export carries `ecom_visibility`** — if not, it cannot tell website products from POS-only |
| **3. Scrape the live site → LLM assemble** | Read rendered product pages, have an LLM normalise into import shape | What exports lack: stored marketing copy, description prose, rendered image URLs, and products live on the site but missing from the export. Also a **verification oracle** — scrape name/price/options and diff against what was imported | Lossy for variant matrices; an LLM can invent plausible prices/SKUs |

**Precedence — do not let the LLM outrank structured data:**

1. Square Catalog API (structured truth)
2. Square CSV export (independent structured check)
3. Scraped / LLM-assembled data — **fills gaps and verifies only; never overrides 1 or 2
   on prices, SKUs, inventory counts, or ids.** Every LLM-derived field must be tagged as
   such in the import report and reviewed before commit.

**Route 1 already has a working precedent in git.** `functions/src/sync.ts` (755 lines,
recoverable at `e7e1100^`) used `client.catalog.search({ objectTypes: ["ITEM" | "CATEGORY"] })`
server-side and mapped Square objects into our product shape. It also contains the
hardest part of the translation layer as heuristics:

- `extractColors()` — colour patterns (`Burgundy`, `Royal`, `Neon`, …) parsed out of flat variant names
- `extractSizes()` — size patterns out of variant names
- `extractTags()` — product-type tagging from name + description + categories (`tee`, `hoodie`, `sticker`, …)
- `detectBrand()` + `BRAND_PATTERNS` / `getBrandCategoryName()` — a hardcoded brand→category map naming **Biscuit Hockey**, I'M OK R U, Durango Lacrosse, Durango Hockey, Durango Roller Girls, Dunphy Stock FAM, GREEN BUDDHA, LITTLE STRANGER, Jordan Branch Music, ET Art

That brand map is directly relevant to the now-confirmed brand taxonomy ("Biscuit Hockey"
is a brand, not a product type) and should seed the brand list rather than being
re-derived.

**Use it as a one-off importer, not a revived sync.** Commit `e7e1100` (2026-08-19,
"Phase 1 catalog overhaul") deliberately removed the Square sync and made **Firestore the
master catalog**, with Square reduced to a push target (`createSquareProduct`). Keep that
architecture: migration is a one-time, previewable, reported import — not Square
reclaiming source-of-truth status.

**Blocker to settle first:** an API pull is useless if the deployment is pointing at
sandbox. `SQUARE_ENVIRONMENT` (`functions/src/index.ts:23`) defaults to `"sandbox"`, so
confirm it is `production` in `functions/.env` before trusting any pull — the same
unresolved question that gates the end-to-end checkout test.

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

1. **Which platforms first?** — **ANSWERED 2026-10-06: Square**, and specifically the
   Square *website builder* products. That is the `ecom_visibility === "VISIBLE"`
   population in the Square Catalog API (see §1.1), so Route 1 covers it directly.
   Shopify and the rest stay as profiles for later; only the Square route is in scope now.
2. **Should the LLM-assembled route be allowed to write at all, or only to propose?**
   §1.1 sets the rule (never authoritative for prices/SKUs/inventory/ids) but the
   mechanism is open: a separate review queue, or LLM output landed in the report as
   suggestions only. Recommend: **suggestions only, human-confirmed**, for the first run.
3. **Does the Square CSV export include `ecom_visibility`?** If not, Route 2 cannot
   distinguish website products from POS-only, and Route 1 becomes the only route that
   can. TO VERIFY before relying on the export.
4. **Source of truth for identity** — external id, handle, or name? And what happens on
   collision with an existing product: update, skip, or abort?
5. **Images**: remote URLs or re-host into Firebase Storage?
6. **Categories**: auto-create, or map-only with an explicit mapping step?
7. **Delete-on-absent?** If a product exists here but not in the file, does the import
   remove it, deactivate it, or leave it? (Default should be *leave it*.)
8. **XLSX / Google Sheets** support — needs a parser dependency (e.g. SheetJS). Worth it
   or CSV-only?
9. **Add-ons/modifiers in the source**: Square exposes modifier lists separately from
   items. Do we import them in this feature or leave them to be recreated by hand?
10. **Where the importer lives** — admin-only callable function (recommended) vs the
    existing client-side write path.

---

## 7. Suggested phasing

Revised 2026-10-06 for the source routes in §1.1 — the Square Catalog API pull is the
primary path, so it moves to the front and the CSV work becomes the cross-check.

| Phase | Deliverable | Why this order |
|---|---|---|
| 1 | **Read-only Square probe.** Confirm `SQUARE_ENVIRONMENT=production`, then count and sample the `ecom_visibility === "VISIBLE"` `ITEM` and `CATEGORY` objects. No writes. | Settles the sandbox question and replaces the stale ~405 estimate with a real number, before any code is written. If the environment is wrong, everything downstream is wasted work. |
| 2 | Recover `sync.ts`'s mapper + heuristics (`extractColors` / `extractSizes` / `extractTags` / `detectBrand` / brand map) as a **one-off importer module**, emitting canonical rows + the full report as a **dry run** | The hardest translation logic already exists; get it running read-only first |
| 3 | Harden: `stripUndefined()` on every payload, money/encoding/bool handling, **derive option dimensions from Square variations**, chunked writes | Correctness before any write touches Firestore |
| 4 | Commit path: identity + dedupe rules, upsert, category and brand mapping (seed the brand list from `BRAND_PATTERNS`), image strategy | The parts needing explicit human decisions (§6.4–6.6) |
| 5 | Optional: recover `csv.ts` + admin import UI from the other line as the **independent cross-check** route, then diff against the Phase 4 result | A second route is the cheapest way to catch silent mapping errors |
| 6 | Gap-fill: scrape the live site, LLM proposes missing products/descriptions, **human-confirmed** into the report | Last, because it is the least authoritative route (§1.1 precedence) |
| 7 | Later: profiles for other platforms (Shopify, Woo, Etsy); XLSX | Out of scope until the Square migration is done and proven |

## 8. Definition of done

- Importing a real export from a supported platform twice in a row is idempotent
  (no duplicates, no drift).
- Every source column is either mapped or **listed** in the report as unmapped.
- Every defaulted field is named in the report.
- A dry run is always available and never writes.
- No `undefined` reaches Firestore; a malformed row fails that row, not the run.
- The run survives >500 products (batching) and reports progress.
