# Live Site Audit — animas-reflections-pwa.web.app

**Audited:** 2026-11-11 · **Baseline build:** `502de0c` (deployed 2026-11-11 15:58 UTC), with items
re-checked against `0798391` (deployed 16:22 UTC) — see the status line on each item.
**Method:** real Chrome via the browser bridge (admin session `mary.theadoor.doctor@gmail.com`), a clean
headless Chrome (no profile, no extensions — so nothing here is a browser-extension artifact), and
Firestore REST reads with the public web API key.
**Re-run:** probes live in `C:\Users\AmosA\.agents\tools\browser\ar-*.mjs`
(`ar-reverify.mjs`, `ar-square-net.mjs`, `ar-nav-probe.mjs`, `ar-mobile-probe.mjs`, `ar-perf-probe.mjs`).

Earlier observations were first made against `e6850d9`; **every item below was re-checked against
`502de0c`** except where marked otherwise.

**Status:** `OPEN` still reproducible · `FIXED` verified fixed · `DATA` needs a Firestore/CMS change, not code

---

## P0 — revenue blocking

### AR-01 · Checkout: the Square card form never initializes · `FIXED` (2026-11-11: transposed Application ID)

Reproduced on `502de0c` in a clean headless Chrome. The payment box is empty, a red
"An unexpected error occurred while initializing the payment method." appears, and the Pay button
stays disabled — **no order can be completed**.

> **Update, later on 2026-11-11 — the credentials are NOT the problem.**
> `squareDiagnostics` (new, deployed) reports: `environment: production`,
> `tokenConfigured: true`, `locationsReachable: true`, `locationCount: 1`,
> `requestedLocationMatches: true`, `firstLocationId: L6VCX130RHYQR`. So the production token
> works, the account has exactly one location, and it is the one inlined in the build — the
> "app and location belong to different accounts" hypothesis is **ruled out**.
>
> The hydrate probe cannot settle it either way: the same endpoint returns 401 for a **bogus**
> application id, so "401 for our app id" proves nothing on its own. And headless Chrome blocks
> the third-party cookies Square's PCI iframe needs, which is a known cause of exactly this
> symptom. **A real-browser canary is the only valid test** — see the release plan, step 3.

**Root cause (2026-11-11, proven in a real browser):** the Application ID in the repo and the CI
fallback was **transposed** — `sq0idp-QAzY**zF**HiOcHrBmGfmdfGTQ` where the credentials on disk (the
same document that carries the location id) say `sq0idp-QAzY**Fz**HiOcHrBmGfmdfGTQ`. A probe against
the live HTTPS origin initialising all three candidate ids settled it: the transposed one fails with
"An unexpected error occurred while initializing the payment method", the correct one and the other
desktop app both initialise.

Fixed: `src/lib/constants.ts` and the `.github/workflows/rebuild.yml` fallback now carry the correct
id. Verified after deploy on `/checkout/?cb=…` in a real Chrome: the SDK script loads, `#card-container`
holds one iframe, and Pay is enabled once the customer form is filled (it is disabled before that by
design).

Two follow-ups for the operator: **`.env.local` still holds the transposed id** (a local `npm run build`
will inline it unless the file is corrected), and if a repository *Variable*
`NEXT_PUBLIC_SQUARE_APP_ID` exists in GitHub it overrides the workflow fallback — check it too.

Evidence:

```
200 https://web.squarecdn.com/v1/square.js
200 https://web.squarecdn.com/1.87.2/main-iframe.html?applicationId=sq0idp-QAzYzFHiOcHrBmGfmdfGTQ&hostname=animas-reflections-pwa.web.app
401 https://pci-connect.squareup.com/payments/hydrate?applicationId=sq0idp-QAzYzFHiOcHrBmGfmdfGTQ&hostname=animas-reflections-pwa.web.app&locationId=L6VCX130RHYQR&version=1.87.2
204 https://pci-connect.squareup.com/payments/mtx/v2
```

`Square.payments(appId, locationId)` **resolves**; `instance.card()` throws with an empty `errors[]`.
That points at the app/location/domain triple being rejected, not at the SDK failing to load.

Where: `src/app/checkout/page.tsx:75-101` (`initSquare`), `src/lib/constants.ts:27-28`

**Updated 2026-11-11 (second pass) — the first action below is now disproven.** The 401 fires for
every hostname (web.app, the custom domain, localhost, example.com), so the domain allowlist is not
the cause. The server side is verified correct by the deployed `squareDiagnostics` endpoint
(`environment: production`, token configured, exactly one location, and it matches
`L6VCX130RHYQR`). What is left is the **Application ID**
`sq0idp-QAzYzFHiOcHrBmGfmdfGTQ` — it must come from the application that owns that location, with
Web Payments SDK enabled. Full evidence and the rest of the order path:
`docs/ORDER_FULFILLMENT_AND_SQUARE.md`.

Action:

1. In the Square Developer Dashboard, open the app whose ID is `sq0idp-QAzYzFHiOcHrBmGfmdfGTQ`.
   Confirm it belongs to the same account that owns location `L6VCX130RHYQR` and that Web Payments
   SDK is enabled for it. If not, take the Application ID from the app that owns the location,
   update `src/lib/constants.ts:27` and the CI fallback in `.github/workflows/rebuild.yml:100`.
2. Keep the improved error logging (`src/app/checkout/page.tsx`) — it now surfaces Square's
   `errors[]` in the console instead of a generic sentence.

Note: `www.animasreflections.com` is served by Cloudflare and is a **different site** (title
"Home | Animas Reflections"), so it cannot be used to test this checkout.

### AR-02 · The cart is memory-only and dies on reload · `FIXED` (verified live 2026-11-11, deploy 16:22 UTC)

Add an item, reload, and the cart is empty; the nav badge disappears. `localStorage` on the site holds
exactly one key: `theme`.

**Fixed 2026-11-11:** `src/lib/cart-storage.ts` persists the cart under the versioned key
`animas-cart-v1`; `CartProvider` hydrates once on mount and writes on every change. Only the
cart's INPUTS are stored (product, variant, quantity, add-ons, artwork, options); prices are kept
for display but the server still re-derives every amount, so a stale price cannot be charged.
`parseCart` validates each line and drops what it cannot parse, so a corrupt payload degrades to
an empty cart instead of a broken page. Five unit tests in
`src/lib/__tests__/cart-storage.test.ts` (round-trip, dropped invalid lines, quantity clamp,
unknown view, corrupt add-ons).

Live check on the 16:22 UTC deploy: add to cart, reload → badge still shows 1; direct navigation to
`/checkout/` → cart renders with `Total $27.50` instead of "Your cart is empty".

Where: `src/context/cart-context.tsx` — `useReducer(cartReducer, initialCart)` now hydrates from
storage in an effect; `HYDRATE` is a reducer action.

This multiplies the damage of AR-01: a buyer who hits the payment error, refreshes, or opens a product
in a new tab loses everything they picked.

Action: persist `CartItem[]` to `localStorage` behind a schema version, hydrate after mount (guard
against the SSR/static-export mismatch), and keep all totals derived as they are today. Prefer
storing only the inputs (product id, variant id, quantity, addons, design URL/text) so a stale cached
price can never be charged — `createSquareOrderAndPay` already re-derives prices server-side.

---

## P1 — catalog and merchandising (this is what the storefront actually looks like)

### AR-03 · 217 of 234 active products have no image · `OPEN`

Live shop grid: 234 product cards, **17 with an `<img>`, 217 rendering the fallback** (a big beige
square containing the product's first letter). On mobile that square is ~400px tall.

Data: only 17 active products have `images[0]`.

Where: `src/hooks/useCatalog.ts:12-17` — `getProductImageUrl` reads **only** `images[0]`. The catalog
provider itself now lives in `src/context/catalog-context.tsx`.

Action:

1. Fall back to `mockupImages.front`, then `mockupImagesByColor[<first colour>].front` — 13 active
   products already carry a front mockup, and the per-colour map is the natural source for the rest.
2. Redesign the no-image card: a type icon plus the product name reads better than a full-bleed empty
   square, and it shrinks the grid's vertical cost dramatically.
3. Separately, this is a content gap — the catalog needs photography, but the storefront should stop
   advertising the gap so loudly.

### AR-04 · 54 active products are $1.00 design records · `DATA`

Names are artwork titles ("Angry Biscuit", "Biscuit Fight Club", "Pass The Biscuit"…), `productType`
is `apparel`, price is exactly $1.00, no image, and the description is a **blank-garment spec**
("Adult Vapor® Basic Sublimation Hoodie Sweatshirt…"). They occupy most of the first screens of the
shop and search.

Action: deactivate them as products and confirm the artwork exists in `designs` where it belongs.
`find duplicates` in the admin may help identify them in bulk.

### AR-05 · Internal pricing SKUs are publicly listed · `DATA`

Active and buyable from the shop:

| Product | Price |
| --- | --- |
| Full 1 Side Full Color Screen Print 50 - 100 Unit Price | $9.75 |
| Full 1 Sided Full Color Screen Print Unit Price 1 - 25 | $10.50 |
| Full Color Screenprint Transfer One Side Print & Press 51-75 Unit Price | $19.00 |
| Custom T-shirt Full Back & Front Crest 1-25 Unit Price | $23.00 |
| Pet Scarfs 1- 25 Unit Price | $7.00 |
| Wood 3.5-4" Ornaments 26-50 Unit Price | $6.50 |

Plus zero-priced internal entries still active: `Back Order`, `Shipping TBD`, `UPS Shipping`,
`Catalog Updates 10 Hours Included`.

One of the unit-price SKUs is currently on the **homepage** (see AR-06).

### AR-06 · "Featured Products" is not curated and advertises junk · `OPEN`

No product in the catalog has `featured: true`, so the component silently falls back to the first six
products. Live homepage on `502de0c`: Lanyard With Break Away Clip (no image), Coffee Cup 15 oz,
Bella + Canvas Unisex Jersey T-Shirt, Quarter Zip Pullover Style (no image), **Full 1 Side Full Color
Screen Print 50 - 100 Unit Price** (internal SKU), BBall Jersey.

Where: `src/components/home/featured-products.tsx:10-13`

Action:

1. Set `featured` on six real, photographed products (the admin toggle already exists in the product
   editor).
2. Harden the fallback: `active && price > 0 && image` ordered by `createdAt` desc, and never include
   a product whose name matches the internal-SKU pattern.
3. Consider warning in the admin when zero products are featured.

### AR-07 · Catalog integrity: duplicates, placeholder variants, one 297-variant catch-all · `DATA`

- **4 duplicate product names / 5 extra docs**, both copies active — e.g. "Bella + Canvas Unisex
  Jersey T-Shirt" exists as `07db885e-799f-4899-bb65-f1f7b5a74bb0` (12 photos, categorised) *and* as
  `bella-canvas-unisex-jersey-t-shirt` (no photos, no category). Same for BBall Jersey, Adult
  Lightweight Hooded Sun Shirt (3 copies), 4 in 1 Bluetooth Speaker Can Cooler.
- **42 products have duplicate variant names.** The Bella t-shirt renders five identical
  "Regular $40.00" buttons — the shopper cannot tell which size/SKU they are choosing.
- **218 products use placeholder variant names** (`Regular`, `Price`, `One Size`).
- **One product has 297 variants** — the catch-all literally named "Animas Reflections"
  (`prod_animas_reflections_1783706379770`) renders ~300 identical "Regular $15.00" buttons in one
  "Style / Size" group.
- **9 active products have no price at all** (`Hoodie Unisex`, `Grey Zip Up Hoodie`, `Glass Ornament
  4" Tall`, …). Since `502de0c` they correctly read "Not Available Online", but they are still listed
  in the shop as dead ends.
- 119 active products have no category, 46 have no description.
- `Holiday Mystery Box – Limited Edition SORRY SOLD OUT` is still active and listed.

Where the picker renders: `src/app/product/page.tsx:305` (flat `variants.map` → buttons). The data
already carries Square modifier groups (size/colour) on many products, which the customizer reads and
the product page does not.

Action: prefer grouped selection (size / colour from modifiers) over a flat list; show the SKU when
names collide; quarantine the 297-variant product from the shop entirely.

---

## P2 — customizer

### AR-08 · No cart access anywhere on `/customizer/` · `FIXED` (2026-11-11)

The page renders a standalone header (`Animas Reflections` + `Back to Shop`): no site nav, no cart
button (verified: 0 cart controls in the DOM). The add-to-cart toast
(`src/components/cart/cart-toast.tsx`) has only a dismiss button — no "View cart". After customizing,
the only route to checkout is Back to Shop → Cart.

Action: add a cart button with the item count to the customizer header, and a "View cart" action in
the toast.

### AR-09 · The design library shows 97 tiles all labelled "Little Stranger Logos" · `FIXED` (2026-11-11)

Live on `502de0c`: 97 tiles, one distinct label. In Firestore, 97 of 123 design docs share
`name: "Little Stranger Logos"`; the distinguishing text is in `description` ("Shrooming Stranger",
"Biscuit Crossing"…). The library is unusable except by eyeballing thumbnails.

Where: `src/app/customizer/page.tsx:623,628` (product designs) and `:664,670` (global library) both
render `asset.name`.

Action: label with `description || name` (and use the same string for `alt`). Consider grouping by
`category` and adding a filter — 98 thumbnails in one scroll column is a lot.

### AR-10 · The product picker is one ungrouped native `<select>` with 235 options · `FIXED` (2026-11-11)

235 options including `$0.00` products and duplicate names; no search, no grouping by product type or
category.

Where: `src/app/customizer/page.tsx:495-500`

Action: searchable combobox grouped by `productType` (or category), excluding unpriced products.

### AR-11 · The add button quotes a price before a product is chosen · `FIXED` (2026-11-11)

It reads "Add to Cart — $20.00" with `Select a product...` selected. The button is correctly disabled,
so this is a labelling bug, not a money bug.

---

## P3 — smaller, still worth a line in the backlog

- **AR-12 `(hidden)` is glued to product names** in the admin list ("…Dual Lids(hidden)"). The marker
  uses a margin class, not a space: `src/components/admin/product-manager.tsx:1895`. Wrap it in a real
  badge, and add a filter to hide inactive rows from the 377-item list.
- **AR-13 `/account/` shows only a small spinner for ~7-9 s** before the signed-in content appears
  (`src/app/account/page.tsx:162`). No nav, no skeleton — it reads as a broken page. Not blank (an
  earlier read of mine concluded that; `innerText` is empty because the loading state is dots).
- **AR-14 every client-side prefetch 404s.** `GET /shop/__next.shop.__PAGE__.txt`, and the equivalent
  for every route, returns 404 — the static export does not emit those payloads. Navigation still
  works via full loads, but prefetch never warms and the console fills with errors. Consider
  `prefetch={false}` on the nav links, or emitting the payloads.
- **AR-15 mobile header nav is a 10-item grid** (Shop, Customizer, Cart, Our Story, Fundraising, FAQ,
  Contact, Search, Theme, Login) wrapping into two rows and taking ~200px above the fold at 390px.
  Worth re-checking against the intended design — the runbook note about a 4-column grid no longer
  describes this.
- **AR-16 `/product/?id=<unknown>` returns HTTP 200** with a "Product Not Found" body (soft 404).
  Structural for query-param product routes; note it for SEO rather than chase it.
- **AR-17 design categories `Jewelry` and `Jewelry `** exist as separate values (trailing space).

---

## Verified fixed in `502de0c` — do not re-report

- Unpriced products can no longer be added: `hoodie-unisex` renders a disabled **"Not Available
  Online"** (`src/app/product/page.tsx:107,116`). Before the release it offered "Add to Cart — $0.00".
- The earlier /account/ "blank page" reading was a false alarm, see AR-13.

## False leads — do not re-investigate

- **Variants/images are not string-encoded.** REST returns `arrayValue`/`mapValue` for every product;
  the "JSON string" appearance came from a debug script truncating values.
- **123 design docs vs 98 library tiles is correct**: 25 docs are category stubs with no `image_url`.
- **Admin Orders sitting on "Loading orders…" resolves** to "No orders yet." — the store has no orders
  yet, which is consistent with AR-01.
- **A one-time stale view** (URL `/shop/` while the customizer was still rendered) in a long-lived tab
  did not reproduce in five headless trials or after a fresh load. Treat as stale tab/service-worker
  noise unless it recurs.

## Cross-reference facts (for anything that compares live to data)

| Fact | Value |
| --- | --- |
| Products in Firestore | 377 |
| Active / inactive | 234 / 143 |
| Active with `images[0]` | 17 |
| Categories | 13 |
| Designs | 123 docs, 98 with `image_url` |
| `featured` products | 0 |
| Sitemap URLs | 16 |
| `config/site` | `free_shipping_threshold` 100, `shipping_tier_apparel` 7.5, `shipping_tier_stickers` 1, `addon_price` 5 |

## Messaging follow-up (not a bug, a gap)

The post-purchase path is untested end to end — no order can be created while AR-01 stands, so
order-confirmation, tracking, and the admin Orders tab have never seen real data.
