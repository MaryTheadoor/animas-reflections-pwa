# Order Fulfillment & Square Integration

**Audited:** 2026-11-11 · **Target:** live `animas-reflections-pwa.web.app` + repo working tree
**Companion to:** `docs/LIVE_SITE_AUDIT.md` (AR-01 is corrected there from this pass)

Read this before changing checkout, the order mirror, or Admin → Orders. It answers one question:
**when the first real order lands, do we have everything needed to print and ship it, and where is
it?**

---

## 0. State of the deploy — read this first

| | |
| --- | --- |
| Repo `HEAD` | `0798391` — persists the cart, loads the Square SDK lazily, adds `squareDiagnostics` |
| Deployed hosting | `0798391` build, 2026-11-11 16:22 UTC |
| Deployed functions | same commit — backend and frontend match `HEAD` |

Re-verify that before acting on anything below; the repo moved twice during this audit
(`502de0c` → `39d7b2d` → `0798391`), and the deployed backend briefly ran code that was not yet
committed.

## 1. Payment path, end to end

```
Checkout form (customerFields from config/site)
  └─ card.tokenize() → single-use sourceId            src/app/checkout/page.tsx:157-163
  └─ buildCustomerPayload() via squareMapping         src/app/checkout/page.tsx:141-148
  └─ createSquareOrderAndPay({lineItems, expectedTotal, customer, idempotencyKey})
        functions/src/index.ts:203
        ├─ deriveOrder() re-prices everything from Firestore    functions/src/pricing.ts:180-310
        ├─ ±2¢ total guard vs client expectedTotal              index.ts:260-272
        ├─ Square order (ad-hoc lines, or catalog IDs)          index.ts:277-368
        │    + shipping as a service charge                     index.ts:314-322
        │    + customer note on the first line                  index.ts:324-341
        │    + SHIPMENT fulfillment with the address            index.ts:344-362
        ├─ Square payment (amount = Square's order total)       index.ts:421-435
        ├─ inventory decrement in a transaction                 index.ts:443-473
        └─ Firestore mirror orders/order_<squareOrderId>        index.ts:475-533
```

Money is sound: nothing the client sends is charged, `deriveOrder` rejects a variant with no price
(`pricing.ts:231`) or out of stock (`pricing.ts:220`), and shipping is charged once, on the Square
order (`index.ts:314-322`, `chargeCents = squareOrderCents`).

### The payment blocker, resolved further

`docs/LIVE_SITE_AUDIT.md` AR-01 lists the card form failing with a 401 from
`pci-connect.squareup.com/payments/hydrate` and suggests the domain allowlist first. **That lead is
disproven** — the Web Payments SDK 401s for every hostname (web.app, the custom domain, localhost,
example.com), so the host is not the problem.

The server side is now verified correct. `squareDiagnostics` (deployed, public) reports:

```json
{"environment":"production","tokenConfigured":true,"locationsReachable":true,
 "locationCount":1,"requestedLocationMatches":true,"firstLocationId":"L6VCX130RHYQR"}
```

So: the access token is present, the account has exactly **one** location, and that location is the
one the client build uses. The environment is production on both sides.

What remains is the **Application ID** `sq0idp-QAzYzFHiOcHrBmGfmdfGTQ` (`src/lib/constants.ts:27`,
mirrored in `.github/workflows/rebuild.yml:100`). It is the only unverified element, and a 401 for
every hostname with a valid location is exactly what a wrong-account or Web-Payments-disabled
application ID looks like. Check in the Square Developer Dashboard:

1. Open the application whose ID matches `sq0idp-QAzYzFHiOcHrBmGfmdfGTQ` and confirm it belongs to
   the same account that owns location `L6VCX130RHYQR`.
2. Confirm Web Payments SDK is enabled for that application (not a catalog-only app).
3. If either fails, take the Application ID from the app that owns the location, replace the constant
   and the CI fallback, rebuild, redeploy.

No order can exist until that resolves, which is why everything below is code- and schema-level only.

## 2. What actually survives to fulfillment

| Data | Stored in Square order | Stored in `orders/{doc}` | Admin Orders UI | Customer `/account` |
| --- | --- | --- | --- | --- |
| Line name + variant | ✅ | ✅ `items[].name` | ✅ designs only | ✅ |
| Quantity | ✅ | ✅ | ✅ (designs list) | ✅ |
| Line price | ✅ | ✅ | — | ✅ |
| Tax / shipping / total | ✅ | ✅ `totals` | ✅ total | ✅ |
| Customer name / email | fulfillment recipient | ✅ | ✅ | ✅ |
| **Shipping address** | ✅ `fulfillments` | ✅ `shipping` | ❌ **not shown** | ✅ |
| **Customization note** | ✅ line `note` | ✅ `items[].note` | ❌ **not shown** | ❌ |
| **Design file URL** | only inside the note | ✅ `items[].designUrl` | ✅ expandable link | ❌ |
| Square payment ID | — | ❌ **not stored** | — | — |
| Payment status | ✅ | ❌ always `"PENDING"` | Square's `state` | `"PENDING"` until shipped |
| Tracking | — | ✅ | ✅ editable | ✅ |

Sources: mirror construction `functions/src/index.ts:486-525`; admin view
`src/app/admin/page.tsx:1241-1404`; customer view `src/app/account/page.tsx:228-310`.

**The data needed to fulfill is captured. The admin UI mostly does not surface it.** The mirror holds
the address and the full note; the Orders tab renders neither, so today the only complete view is the
Square dashboard.

## 3. Gaps that will cost time on the first real order

### F-01 · Admin Orders shows no shipping address and no customization detail · `FIXED` (deployed 2026-11-11)

`src/app/admin/page.tsx:1241` types items as `{name, quantity, designUrl?}` and the expanded row
(`:1377-1404`) contains only tracking inputs. Shipping is not read even though the mirror stores it.
Printing and shipping therefore requires leaving the app for Square.

Fix, smallest useful version: in the expanded row render `shipping` (name, line1, city/state/zip) and
each item's `note` in a monospace block, plus a copy button. Add `note`/`price` to the item type.

### F-02 · No notification when an order arrives · `OPEN`

There is no email provider, no Square webhook, and no Firestore trigger in `functions/src/`
(the only HTTPS triggers are `health` and `squareDiagnostics`). Orders are discoverable only by
opening Admin → Orders or the Square Seller app. **"When we get them" depends on someone looking.**
Interim: turn on Square's own new-order notifications. Proper fix: `onDocumentCreated` on
`orders/{id}` → email/SMS the shop.

### F-03 · The confirmation email is a promise the system may not keep · `PARTIAL` (copy fixed 2026-11-11)

`src/app/order-confirmation/page.tsx:33-37` tells the customer "You'll receive a confirmation email
with your order details." Nothing in the app sends email; the only attempt is
`buyerEmailAddress` on the payment (`functions/src/index.ts:427`), which Square honours **only if
receipts are enabled on the location**. Verify that setting, or change the copy.

### F-04 · Order status is frozen at `PENDING` · `PARTIAL` (2026-11-11)

The mirror writes `status: "PENDING"` unconditionally (`index.ts:508`); `payment.status` is returned to
the client but never persisted. The customer's account shows `PENDING` for a paid order until tracking
is added, and no state ever records PAID / FULFILLED / REFUNDED. Store `paymentId` and the real
`payment.status` at write time, and treat `SHIPPED` (set by `updateOrderTracking`) as the next state.

Related: the payment response status is never checked before mirroring — a non-`COMPLETED` result is
treated as success. Assert `COMPLETED` (or at least record what came back) before the order is
mirrored.

### F-05 · No address line 2 (and no country) · `PARTIAL` (2026-11-11)

`config/site.customer_fields` is exactly: firstName, lastName, email, phone, address→`address.addressLine1`,
city→`address.locality`, state→`address.administrativeDistrictLevel1`, zip→`address.postalCode`.
There is no line 2 and no country; the Square fulfillment hardcodes `country: "US"`
(`index.ts:357`). Apartment and suite numbers have to be crammed into line 1, which is exactly the
kind of thing that produces an undeliverable order. Add an optional `address2` field mapped to
`address.addressLine2` and persist it in the mirror.

### F-06 · Placement is stored in units nobody can print · `OPEN`

The checkout note carries `Pos: 45%,50% | Scale: 0.85 | Rot: 15°`
(`src/app/checkout/page.tsx:184-186`), and `PrintZone` is percent-of-mockup only
(`src/types/index.ts:3-8`) — there are no physical dimensions for the print area, and uploads are
never converted to print size. For a centred default it does not matter; for any order where the
customer moved, scaled, or rotated the design, the shop cannot reproduce the placement from the note.
Nothing in the repo renders a composited preview (`toDataURL`/canvas capture does not exist).

Practical fix: composite the design over the mockup into a flattened preview at checkout and store
that URL beside `designUrl`, so the printer sees the intended result rather than reconstructing it.

### F-07 · Uploads require sign-in, so guests cannot personalize · `OPEN`

`src/components/customizer/file-upload.tsx:29-32` refuses without a user, and
`storage.rules` allows create only under `uploads/{uid}/` for a signed-in owner. Guest checkout is
allowed everywhere else, so a guest who reaches the customizer and uploads artwork hits a dead end
mid-flow. Decide: require sign-in earlier and say so, or accept anonymous uploads to a quarantine
prefix.

### F-08 · `designUrl` is client-supplied and unvalidated · `FIXED` (2026-11-11)

`pricing.ts:275` copies `raw.designUrl` straight through, and both Square's line note and the order
mirror then point at it. Nothing checks the URL is an `uploads/` object belonging to this customer.
Worst case a crafted checkout leaves an arbitrary URL in the fulfilment note for staff to click.
Validate: must be an HTTPS `firebasestorage.googleapis.com` URL under `uploads/`, or a
`designs/` object.

### F-09 · Line-item notes may exceed Square's limit · `FIXED` (clamped 2026-11-11)

The composed note (design URL ~150 chars + text + colour + options + modifier inputs + view +
pos/scale/rot + add-ons) runs 300-450 characters for a typical customized item, and the customer note
is appended to the first line when that line has no note (`index.ts:339-341`). Square caps order
line-item notes; a long filename plus several modifier groups could cross it and fail the payment at
the last step. Add a truncation guard and test a worst-case item.

### F-10 · Add-ons and $0.00 modifiers become their own Square lines · `OPEN (cosmetic)`

Every add-on — including a $0.00 colour/size modifier — is pushed as `Add-on: <label>`
(`index.ts:295-302`). The admin and Square both show these as separate items, inflating item counts
and making a picking list harder to read. Keep price-bearing add-ons as lines; fold $0.00 modifiers
into the parent line's note instead.

### F-11 · Orders that Square does not list are invisible in Admin → Orders · `FIXED` (2026-11-11)

`fetchRecentOrders` searches Square for `COMPLETED`/`CANCELED` only, limit 50
(`index.ts:704-717`), and the admin merges Firestore mirrors **into that list**
(`src/app/admin/page.tsx:1268`) — so a mirror with no matching Square order is dropped. Any paid
order older than the newest 50, or one whose Square state never reached COMPLETED, silently disappears
from the shop's only order view. Drive the admin list from Firestore (which has the money, items,
address and tracking) and treat Square as enrichment.

## 4. What a fulfilment record should contain

For the printer, per line: product, variant name, colour, size, quantity, the artwork file, the
flattened preview, placement, personalization text, and add-ons — all structured, not a note string.
For shipping: name, line1, line2, city, state, zip, country, phone, email. Both are achievable with
the current schema plus F-01, F-04, F-05 and F-06.

## 5. Things that are already right

- Server-side pricing and the ±2¢ divergence guard — a tampered cart cannot set its own price.
- Shipping charged exactly once, as a Square service charge.
- Tax taken from Square's order and mirrored.
- Idempotency keys derived per order and per payment, reused on retry after an ambiguous failure.
- Inventory decremented post-payment inside a transaction, and never able to fail a paid order.
- `orders/{id}` is server-write-only and readable by the matching customer or an admin
  (`firestore.rules:81-88`).
- Customer uploads are owner-or-admin readable, ≤10 MB, image types only (`storage.rules`).

---

## 6. Fix pass — 2026-11-11 (deployed)

What landed, by item:

| Item | What changed |
| --- | --- |
| F-01 | Admin → Orders expanded row renders the **ship-to block** (name, line1, line2, city/state/zip), every item's `note` in a monospace block, per-line totals, `paymentId`/`paymentStatus` and a **Copy packing slip** button with a manual-copy fallback. Data layer extracted to `src/components/admin/order-model.ts` (15 tests) and `order-fulfillment.tsx`. |
| F-04 | The mirror now stores `paymentId`, `paymentStatus` and `squarePaymentId`; `status` is `PAID` when Square reports `COMPLETED`, otherwise Square's own state. A `FAILED`/`CANCELED` payment is refused before anything is mirrored. Still open: nothing writes `REFUNDED` when a refund is issued in Square. |
| F-05 | `address.addressLine2` is accepted, sent on the Square fulfillment and stored as `shipping.line2`. The checkout form still has no line-2 field — add a `config/site.customer_fields` entry mapped to `address.addressLine2`. |
| F-08 | `isTrustedDesignUrl()` in `pricing.ts`: a `designUrl` must be https on `firebasestorage.googleapis.com`/`storage.googleapis.com`, otherwise it is dropped before it reaches the note or the mirror. Two tests. |
| F-09 | Square line-item notes are clamped to 250 chars (`clampNote`); the Firestore mirror keeps the **full** note, so nothing is lost for fulfilment. |
| F-11 | Admin → Orders is now driven by **Firestore** (`orders`, newest 100) with Square as enrichment: a mirror with no Square match is shown and flagged "not found in Square" instead of disappearing. Square-only orders still appear. Degrades to the Square-only path if the Firestore read fails. |
| F-03 | Confirmation copy no longer promises an email the app cannot send; it tells the customer to keep the reference and that a Square receipt (if enabled) arrives separately. |

Still open and deliberate: **F-02** (no order notification — turn on Square's new-order
notifications, or add an `onDocumentCreated` email trigger), **F-06** (no flattened print preview),
**F-07** (guest uploads require sign-in), **F-10** ($0.00 modifiers as separate Square lines).

Gate after this pass: tsc 0 · lint 0 · **351 tests / 23 suites** · build 25 pages · functions compile
clean · deployed functions + hosting.
