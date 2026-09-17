# E-commerce re-scope — from custom card forms to Square-hosted checkout

**Status:** proposal, 2026-09-16. Research complete; one figure needs confirming with Square before we commit.

## The one-line version

Stop taking card details on our own pages. Build the order on the server (as we already do), hand it to
Square's **hosted checkout page** via one API call, and redirect the buyer there. Delete the card form,
the Web Payments SDK, and our PCI surface.

## Why now

The current checkout is the most custom, most fragile part of the site:

| File | Lines |
|---|---|
| src/context/cart-context.tsx | 214 |
| src/app/checkout/page.tsx (Square Web Payments SDK card form) | 348 |
| src/app/order-confirmation/page.tsx | 99 |
| src/app/account/page.tsx | 496 |
| src/components/cart/cart-drawer.tsx | 147 |
| functions/src/pricing.ts | 294 |
| **Subtotal** | **1,598** |

Plus the order/payment half of functions/src/index.ts (1,075 lines total across 18 functions) and a
live Square Web Payments SDK dependency on the checkout page. It is also the only part of the site that
touches card data, which is why it carries the heaviest correctness burden.

## What the research found

### The key realisation: we already build the order

functions/src/index.ts already calls **client.orders.create(...)** (line 306) to build the Square order
from prices re-derived from Firestore — and then charges it with **client.payments.create({ sourceId })**
(line 341), where sourceId is a card nonce from the browser SDK.

Only the second half has to change. The server-authoritative pricing — the part that actually matters for
security — stays exactly as it is.

### Verified capabilities (read from the Square SDK v42 already installed in functions/)

From **CreatePaymentLinkRequest**:

| Field | What it gives us |
|---|---|
| **order** | A full Square Order — the same object we already build, including line items and modifiers |
| **quickPay** | An ad-hoc name + price, for the simplest single-item case |
| **checkoutOptions** | See below |
| **paymentNote** | Landed on the resulting Payment — where we attach our own order reference |
| **prePopulatedData** | Pre-fill buyer email/shipping |
| **idempotencyKey** | Safe retries |

From **CheckoutOptions**:

| Field | What it gives us |
|---|---|
| **redirectUrl** | "The confirmation page URL to redirect the buyer to after Square processes the payment" — **we keep our own order-confirmation page** |
| **shippingFee** | Applied to the Order as a service charge |
| **askForShippingAddress** | Square collects the address |
| **customFields** | Ask the buyer structured questions at checkout |
| **allowTipping**, **enableCoupon**, **enableLoyalty**, **merchantSupportEmail**, **acceptedPaymentMethods** | Hosted-page options we do not have to build |

From **PaymentLink** (the response): **url** (shortened) and **longUrl**, plus **orderId** so we can
reconcile our record against Square's, and **version** for updates.

This is not a consolation prize. It is more capable than what we have: Square handles the card form, the
address, the receipt, the 3-D Secure step-ups, and the wallet buttons, and we keep our confirmation page.

## The fee question — CONFIRM BEFORE COMMITTING

Square's published US rates separate two things:

| Tier | Rate (Square Free) | Square's own wording |
|---|---|---|
| Online | **2.6% + 15¢** | "card payments made online or through an invoice" |
| Online API | **3.3% + 30¢** | "card payments made within your web or mobile application's workflow using our payments APIs" |

We are on the **Online API** tier today, because the card is charged inside our app.

A payment link's card entry happens on **Square's own hosted page**, so the cheaper Online tier should
apply — but the link itself is created through an API, so the wording is genuinely ambiguous.

If it applies, the saving on representative orders is:

| Order | Today (API) | Payment link | Saved |
|---|---|---|---|
| $25 | $1.12 | $0.80 | $0.32 (29%) |
| $50 | $1.95 | $1.45 | $0.50 (26%) |
| $100 | $3.60 | $2.75 | $0.85 (24%) |
| $250 | $8.55 | $6.65 | $1.90 (22%) |

**Confirm with Square before we commit.** Even with no fee change, the simplification below justifies the
move on its own — so this is upside, not the reason.

## The three tiers of "simple"

| Tier | What it is | Cart? | Card code we own | Effort |
|---|---|---|---|---|
| 1 | **Buy buttons.** One pre-made link per product, stored on the Firestore product doc, rendered as a plain link | No | None | Smallest — but ~42 products × variants = many links to manage |
| 2 | **Hosted-checkout cart.** A button calls one function that builds the order and returns a Square URL | Yes | None | **Recommended** |
| 3 | Custom card form (today) | Yes | All of it | Largest |

**Recommendation: Tier 2.** Tier 1 is simpler but pushes operational work onto whoever manages the
catalog, and we already have a working cart and a working catalog — the cart is not the problem.
The card form is.

## Recommended architecture

    Product page / cart  ->  "Checkout" button
        |
        | (line item ids + quantities ONLY — never prices)
        v
    createCheckoutLink  (Cloud Function, server-authoritative)
        - re-derives every price from Firestore  [EXISTING LOGIC, KEPT]
        - builds a Square Order                   [EXISTING LOGIC, KEPT]
        - checkout.paymentLinks.create({ order, checkoutOptions: { redirectUrl }, paymentNote })
        - returns { url }
        |
        v
    window.location = url      <-- Square hosts the entire payment UI
        |
        v
    Square processes payment -> redirects to /order-confirmation/?order=<orderId>

Nothing in our codebase ever sees a card number again. PCI scope becomes SAQ A.

## What changes

**Delete**
- The Square Web Payments SDK script tag and the card form on the checkout page.
- The sourceId plumbing and the sourceId branch in the function.
- The client-side expectedTotal divergence check (the server builds the order; there is no client amount
  to diverge from).
- Card-error handling UI.

**Keep**
- Server-side price derivation from Firestore — the single most valuable invariant in the current design.
- The cart, the catalog, the admin CMS, the customizer.
- Our own order-confirmation page, via **redirectUrl**.

**Add**
- One function: createCheckoutLink (order build + one API call).
- A webhook (or a reconciliation read on the confirmation page) if we want the order mirrored into
  Firestore for the admin's Orders tab. Square remains the system of record for payment either way.

## The part that actually dictates the design: custom orders

This is a print shop. Many orders are "put this logo on 24 hoodies with names", which cannot be priced
by a button, and a payment link cannot carry an uploaded design file.

So there are two flows, and they are different on purpose:

1. **Stock merch** (biscuit-hockey tees, im-ok-r-u shirts, standard items) — self-serve buy now, exactly
   as above.
2. **Custom work** — the customer uploads artwork (we already have this), which creates a **quote request**.
   It is stored with the design files, an admin prices it, and a payment link goes out (from the Square
   Dashboard, or a one-click button in the admin using the same function).

Flow 2 is not a compromise. You cannot print a logo before a human has looked at it, so human-in-the-loop
is the correct workflow, and it means **zero payment code** for the highest-value orders.

Self-serve custom can still be preserved if wanted: upload the design first, then create the link for
that configuration, and tie the two together with **paymentNote** carrying our pending-order id.

## Phased plan

**Phase 1 — prove it (half a day).** Behind a flag on one product, switch to a payment link and run a
real $1 transaction in production, then refund it. Confirms the fee tier, the redirect back to our page,
and the Square order appearing correctly. Do this before deleting anything.

**Phase 2 — migrate the cart (1–2 days).** Point the existing cart and checkout button at
createCheckoutLink. Remove the Web Payments SDK. Keep the old function deployed but unused for one
release so we can roll back instantly.

**Phase 3 — the quote flow (1–2 days).** Repoint the customizer's finish action from "checkout" to
"request a quote", add the admin view, and wire the one-click send-a-link action.

**Phase 4 — cleanup.** Delete the retired code and the retired function once a full order cycle has
passed on the new path.

## Rejected options, and why

- **Firebase "Run Payments with Stripe" extension.** Firebase Extensions **shut down 31 March 2027** —
  no new installs or edits after that. Building on it now means a forced migration later.
- **Stripe Payment Links / Buy Button.** Genuinely excellent and slightly simpler than Square's API. But
  Stripe is **2.9% + 30¢** against Square's online rate, it means re-onboarding and re-keying, and we
  would run two processors alongside the physical POS that already uses Square. Only worth it if we were
  starting from nothing.
- **Shopify Buy Button / Snipcart / Ecwid.** Another subscription, another catalog to keep in sync with
  Firestore and the Square POS, and a second source of truth for inventory.

## The game, in one paragraph

Keep the catalog, the cart and the customizer. Replace the **card form** with a **redirect to Square's
hosted checkout**, built from the order we already know how to build. That removes the only code touching
card data, removes the PCI burden, plausibly cuts the processing rate, and shrinks the most fragile
surface on the site — while the one security property worth keeping (never trust a client-supplied price)
survives untouched, because the server still derives every cent.

## Open questions

1. **Which Square fee tier applies to an API-created payment link?** (Phase 1 answers this.)
2. Do we want orders mirrored into Firestore for the admin Orders tab, or is the Square Dashboard enough?
3. Does the customizer keep a self-serve checkout, or does all custom work route through a quote?
4. Do we keep user accounts at all? With Square hosting payment and receipts, /account earns its keep only
   for order history and saved addresses.
