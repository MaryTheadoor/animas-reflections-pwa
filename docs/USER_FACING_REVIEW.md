# User-Facing Site Review — vs. e-commerce norms

**Reviewed:** 2026-11-11 · **Build:** `0798391` (deployed 16:22 UTC)
**Method:** full route crawl (14 public routes + 404), live DOM/CTA inspection in headless Chrome,
axe-core WCAG 2.0/2.1 A+AA scan per page, and a read of the content/legal sources in `src/lib/content.ts`.

Verdict: the storefront *looks* complete and every route loads, but it is missing the scaffolding a
shopper expects around the buy button — **size selection on product pages, a site-wide footer, a
customer login, and shopper-facing shipping/returns pages**. Policies exist but contradict each other
and are reachable only from the homepage.

---

## 1. Purchase path — the functional gaps that cost sales

### U-01 · Product pages have no size or colour selection · `FIXED` (2026-11-11)

157 of 234 active products carry Square modifier groups (`Adult Size`, colour, etc.). The product page
renders **none of them**. The section is even labelled "Style / Size" but contains five identical
buttons:

```
Style / Size
Regular $40.00
Regular $40.00        ← five identical options, no S/M/L
Regular $40.00
Regular $40.00
Regular $40.00
Add to Cart — $40.00
```

Evidence: `product/?id=07db885e…` (Bella + Canvas tee — has `Adult Size: XXS…XXL+3`) renders zero
`select`/`fieldset`/`radiogroup` elements and no size tokens. The same product in `/customizer/` *does*
show the modifier groups.

Consequence: a customer cannot choose a size from the product page, and priced options (XXL +$3) are
unreachable. The line reaches the cart with no size, which becomes a fulfilment problem.

Where: the variant picker is `src/app/product/page.tsx:305` (flat `variants.map`). Modifiers are only
consumed by the customizer (`src/app/customizer/page.tsx`).

Action: render modifier groups on the PDP — single-select for `Adult Size`, multi-select for add-ons —
and pass them through as the customizer already does. This is the single highest-impact storefront fix.

### U-02 · Cart line reads "Price" instead of a variant · `FIXED` (2026-11-11)

The cart shows `Coffee Cup 15 oz / Price / $20.00` — the variant's placeholder name from the catalog
leaks into the customer's view. Same root cause as the audit's placeholder-variant finding; worth
suppressing a variant label when the catalog name is `Regular`/`Price`/`One Size`.

### U-03 · Cart drawer has no "Continue shopping" · `FIXED` (2026-11-11)

It has close / −  + / Remove / Checkout. Acceptable, but every mainstream cart offers a continue link.

### U-04 · Checkout has no terms acknowledgement and no legal links · `FIXED` (2026-11-11)

No `terms`/`privacy` string appears anywhere in `src/app/checkout/page.tsx`, and the checkout page has
no footer. A shopper pays without ever seeing the terms of sale, and there is no "I agree" line to
point at if a dispute arises. Add a short consent line with links under the Pay button.

## 2. Site chrome — missing footer and no way home

### U-05 · No footer on any page except the homepage · `FIXED` (2026-11-11, except /checkout and /customizer)

`<footer>` count per route: home **1**, every other route **0**. The footer carries the return policy,
payment methods, social link and the only Terms/Privacy links in the site — so 13 of 14 pages have no
legal, policy, or contact affordance at all.

Where: the footer is inlined in `src/app/(home)/page.tsx:118`, not in `PageLayout`
(`src/components/layout/page-layout.tsx`). Moving it into the layout fixes the whole site at once.

### U-06 · There is no link to the homepage · `FIXED` (2026-11-11)

`homeLinks: []` on `/shop/`. The nav's first slot is commented `{/* Home */}` and defaults to `/`, but
it renders `c.navigation.primary[0]` — which is now `{ label: "Shop", href: "/shop" }`. The intended
Home entry disappeared when the nav data changed, and no logo link replaced it. From `/shop`,
`/product`, or `/faq` there is no in-page route back to `/`.

Where: `src/components/layout/header-bar.tsx:78-87`. Fix: hard-code the home slot to `/`, move the
label to `Home` (or make it a logo link), and re-map the following slots.

### U-07 · "Login" sends customers to the admin console · `FIXED` (2026-11-11: /login)

The header's Login link is `/admin/login/`, which renders **"Admin Login — Animas Reflections CMS"**
with email/password and Google. There is no customer sign-in page, no create-account path, no
"forgot password", and the customer account lives at `/account/`.

Where: `src/components/layout/nav-auth.tsx`. Action: a `/login` route branded for customers (or
reused from `/account`), with password reset; keep `/admin/login` for staff.

### U-08 · Mobile header shows 10 items above the fold · `FIXED` (2026-11-11: one row of five + More, 80px → 45px)

Shop, Customizer, Cart, Our Story, Fundraising, FAQ, Contact, Search, Theme, Login wrap into two rows
and consume ~200px of a 390px viewport before any content. Trim to the 4-5 that matter and move the
rest into a menu.

## 3. Trust, policy and legal

### U-09 · Three different return policies · `P1`

| Source | Says |
| --- | --- |
| Home footer (`RETURN_POLICY`) | "All sales are final." |
| FAQ | "contact us within 5 days of receipt and we will make it right" |
| Terms of Sale §5 | "Returns are accepted only with prior written authorization…" |

A shopper reading two surfaces gets two answers, and "all sales are final" next to "we'll make it
right" is the kind of ambiguity that turns into a chargeback. Pick one policy, state it on a real
page, and have the other surfaces paraphrase it.

### U-10 · No shopper-facing Shipping or Returns pages · `P1`

There is no `/shipping` or `/returns` route. Shipping cost/turnaround and returns exist only inside
the 820-word Terms of Sale and two FAQ items. Standard practice — and what shoppers look for before
adding to cart — is a short Shipping & Returns page linked from the PDP, cart, and footer.

### U-11 · No physical business address anywhere · `P2`

The privacy policy says "or write to us at Durango, Colorado, USA", which is not an address. The
contact page lists phone, email and "Durango, Colorado, USA". Publishing a street address (or at
minimum a city + postal code) is expected for mail-order retail and is a trust signal at checkout.

### U-12 · Terms are stale and describe a payment method you don't take · `P2`

`TERMS_OF_SALE` is dated "Effective Date: March 2021" and §2 says payment methods include
**"payPal or other approved processors"**. Checkout is Square only (card, Apple Pay, Google Pay, Cash
App). Update the date and the method list.

### U-13 · Privacy policy predates the cart you just shipped · `P3`

It states only three kinds of storage — Firebase auth, Square fraud data, and the service worker —
but the cart now persists to `localStorage` (`animas-cart-v1`). Add one clause. It also names the site
as `animas-reflections-pwa.web.app` rather than the public domain.

### U-14 · No contact form, hours, or response expectation · `P3`

`/contact/` offers `tel:` and `mailto:` plus a location line. Workable, but a form (with a `subject`
that lands somewhere) and a "we reply within 1 business day" line are standard. There is also no
newsletter/email capture anywhere on the site.

## 4. Product content

### U-15 · Product descriptions are supplier spec dumps · `P2`

A typical PDP is 100-200 words, most of it fabric weight and blend tables copied from the blank
supplier ("52% Airlume combed and ring-spun cotton… Mineral Wash: 100%…"), opening with
"HELP SUPPORT THROUGH FAN BASED FUNDRAISING…". 46 active products have no description at all.
There is no size chart, no fit guidance, no turnaround line, and no reviews.

Minimum viable PDP for a print shop: what it is, sizing/fit, how the print behaves, production +
shipping estimate, returns link, and where the artwork comes from.

## 5. Findability (a user-facing defect even though it lives in `<head>`)

### U-16 · The site tells Google it lives somewhere else · `P1`

Every page emits `<link rel="canonical" href="https://www.animasreflections.com/…">`, and
`sitemap.xml` / `robots.txt` declare that host — but `www.animasreflections.com` is the **old
Cloudflare site**, where **14 of the 16 sitemap URLs return 404** (only `/` and `/custom/` exist):

```
200 | https://www.animasreflections.com/            | Home | Animas Reflections
404 | https://www.animasreflections.com/shop/       | 404 - Page Not Found
404 | https://www.animasreflections.com/about/      | 404 - Page Not Found
… 12 more 404s (customizer, services, fundraising, contact, faq, terms, privacy, the 3 keyword pages…)
```

So the new storefront canonicalises itself out of the index toward a domain that doesn't host it.
Where: `SITE_URL` in `src/lib/seo.ts:30`.

Either this is a not-yet-executed domain cutover (then the launch checklist needs "point the domain,
then flip `SITE_URL`"), or it is a live misconfiguration. Either way it should be an explicit
decision, documented — it is currently silent.

## 6. Accessibility (axe-core, WCAG 2.0/2.1 A + AA)

| Route | Violations | Detail |
| --- | --- | --- |
| home, product, faq, about, contact, fundraising, services, privacy, terms | 0 | clean |
| shop | 1 | `select-name` — sort and category `<select>`s have no accessible name |
| customizer | 2 (3 nodes) | `select-name` ×2, `color-contrast` ×1; also **no `<h1>`** on the page |
| search | 0 | — |
| checkout, account (empty states) | 0 | — |

Also good: every page has `lang="en"`, all images carry `alt`, a skip link is first in the tab order,
and no route overflows horizontally at 390px.

## 7. What already meets the standard

- Every public route returns 200 with a distinct, meaningful title; the 404 page returns a real 404
  with a "Back to Home" action.
- Search works (submit or Enter), updates `?q=`, and deep-links correctly — 234 → 18 results for
  "mug". Filters and sort are in the URL; the density picker persists.
- Cart: quantity stepper, remove, subtotal / shipping / total, empty state, and now persists across
  reloads.
- Free-shipping threshold is announced site-wide; checkout shows "Secured by Square", the accepted
  card brands, and states that tax is calculated by Square.
- PDPs emit Product JSON-LD; the site emits one WebSite + LocalBusiness `@graph`.
- No placeholder text, no lorem ipsum, no dead `#` links, no missing `alt` attributes anywhere in the
  crawl.

---

## 8. Suggested order

1. **U-01 sizes on PDP** — without it you cannot sell apparel correctly.
2. **U-05 footer in the layout** + **U-06 home link** — one change each, fixes 13 routes.
3. **U-09/U-10 one returns policy + real Shipping/Returns pages**, linked from PDP, cart, footer.
4. **U-07 customer login** with password reset; stop sending shoppers to the admin console.
5. **U-04 terms line at checkout**; **U-16 decide the canonical host** before any SEO work.
6. Content pass (U-15), then the P2/P3 polish.

---

## 9. Fix pass — 2026-11-11 (deployed)

| Item | What changed |
| --- | --- |
| U-01 | **Product pages render modifier groups.** `src/lib/modifier-selection.ts` decides when modifiers carry the choice (`hasGenericVariants`: all variant names in Regular/Price/One Size/Default/blank). When they do, the PDP renders one fieldset per `modifier.group` with toggle chips (+ text inputs; file modifiers link to the customizer), prices them with `resolveAddonPrice`, and puts them in `addons`, `selectedOptions` and `modifierInputs` exactly as the customizer does. Verified on the live catalog: the Bella+Canvas tee went from five identical "Regular $40" buttons to 7 groups, XXL +$3 → $43.00; products with real variants (`3 Inch / 4 Inch`) keep the picker. 157 active products carry modifiers; 154 take the new path. |
| U-02 | Placeholder variant names suppressed in the cart drawer **and** the Square line name (`isPlaceholderVariantName`). |
| U-04 | Checkout carries a consent line under Pay with links to Terms, Privacy and Contact. |
| U-05 | The footer moved into `PageLayout`, so every route that uses it has one (26-page export verified). `/checkout` and `/customizer` keep their own minimal chrome. |
| U-06 | Home is the first nav slot, hard-coded, with any CMS `/` entry filtered out so it cannot duplicate. |
| U-07 | New `/login/` customer page (email/password, Google, forgot-password via `sendPasswordReset`), `noindex`, nav Login points at it; `/admin/login` stays staff-only. |

Deployed: hosting at 2026-11-11. Gate: tsc 0 · lint 0 · **380 tests / 25 suites** · 26-page build,
`check-seo: OK — 26 pages, 16 sitemap URLs`.

Still open: U-03, U-08–U-16 (content, policy and SEO items — U-09's three return policies, U-10's
missing Shipping/Returns pages, U-11's address, U-12's stale Terms and U-16's canonical pointing at a
domain that does not serve the site yet are all **client content decisions**, not code).

---

## 10. Fresh verification — 2026-11-18 (build `01764ca`, deployed 22:47 UTC)

Re-ran every check above against the live site. The buy path is now genuinely usable end to end.

### Verified fixed

| Item | Evidence |
| --- | --- |
| **U-01 sizes on PDP** | `product/?id=07db885e…` now renders **7 modifier groups**; sizes read `Extra Small · Small · Medium · Large · Extra Large · XXL +$3.00 · XXXL +$3.00 · XXXXL +$5.00`. Upcharges visible and selectable. |
| **U-04 terms at checkout** | "By placing this order you agree to our Terms of Sale and Privacy Policy. Questions? Contact us." with working `/terms` and `/privacy` links. |
| **U-05 footer** | `<footer>` present on 12 of 14 crawled routes. Only `/customizer` and `/checkout` (standalone chrome) lack one. |
| **U-06 home link** | Nav is now `Home → /` first; `homeLinks: 1` on `/shop/`. |
| **U-07 customer login** | `/login/` — "Sign In", email + password, **Forgot password?**, Google, and a create-account line. `/admin/login` remains staff-only. |
| **U-08 mobile header** | Dock is a single **45px** row (was two rows ≈200px) with an overflow **More** menu. See the caveat below. |
| **Customizer H1** | Now `Customize your apparel` (was empty). |
| **U-02 cart label** | Cart line no longer shows the placeholder variant name. |

### New finding — the shop is now 16 products

`/shop/` reports **"Browse 16 products" / "Showing 16 of 16"**, all 16 with images. Live data:
**374 documents, 16 `active`, 358 `active: false`**. This is the launch-readiness unlisting, and it
works, but it is a large merchandising change that needs a deliberate decision rather than drift.

Why the 358 are hidden:

| Reason | Count | Note |
| --- | --- | --- |
| **Needs a photo** | **332** | Price, description and category are fine — only photography is missing. |
| No price (zero) | 23 | Mostly internal SKUs (should stay hidden) plus a few real items needing prices. |
| Sellable + image + description but hidden | 2 | Worth an admin look — they pass the checks I can compute. |
| Needs a description | 1 | "Hats". |

So the storefront is **not 16 products deep by nature — it is 332 photographs away from 348.** That
is a content task, not a code task, and it is the highest-leverage work available for revenue.

Related: hidden products now return **"Product Not Found"** on their PDP. Any previously shared or
indexed deep link to those 218 products is dead, so the unlisting should be paired with redirects or
a "no longer available — see similar" state if any of them were ever promoted.

### Still open (all previously reported)

- **U-09** three return policies still disagree (footer "all sales are final… we will make it right",
  FAQ "5 days", Terms "prior written authorization").
- **U-10** `/shipping/` and `/returns/` are still **404** — no shopper-facing policy pages.
- **U-11** no physical street address anywhere.
- **U-15** PDPs remain thin (170-387 words) with **no production time, shipping estimate, or returns
  line near the buy button**; descriptions are still supplier spec dumps.
- **U-16** canonical/sitemap still point at `www.animasreflections.com`, where 14 of 16 sitemap URLs
  404. Still the single biggest findability blocker.

### Accessibility, re-measured

| Route | Result |
| --- | --- |
| home, product, search, faq, about, contact, fundraising, services, privacy, terms | clean |
| **shop** | `select-name`, critical — the sort/category `<select>` (`.sm\:flex-row > select`) has no accessible name |
| **customizer** | `select-name`, critical — the size/product `<select>`; `color-contrast` — `.text-amber-500` at **2.14:1** on white (needs 4.5:1 at 12px) |

Both are one-line fixes (`aria-label` on the selects; darken the amber to ~`#b45309`-class).

### Mobile tap targets (U-08 caveat)

The single row is 45px tall, but the visible items measure **30-36px** wide by 36px tall — under the
44×44 practical minimum (Apple HIG / Material). Icon-only labels that narrow are hard to hit. Either
widen the targets or move the least-used items into **More** so the survivors get breathing room.

### Operational risk — do not rebuild locally yet

`src/lib/constants.ts` and the CI fallback now carry the **correct** Square Application ID
(`sq0idp-QAzY**Fz**…`), but **`.env.local` still holds the transposed one** (`sq0idp-QAzY**zF**…`).
Because the code reads `process.env.NEXT_PUBLIC_SQUARE_APP_ID || fallback`, a **local**
`npm run build && firebase deploy --only hosting` would inline the broken ID and kill checkout again.
CI is safe only if no repository Variable overrides the workflow fallback (not verifiable from here).
Fix `.env.local` before the next local deploy.

---

## 11. Round 3 verification — 2026-11-18 (`4be4353`, deployed 22:56 UTC)

This round added `/shipping`, `/returns`, customer signup, and shop product filters. Verified against
the live deploy.

### New and working

- **`/shipping/`** → 200, "Shipping Rates & Timing". It reads the same `config/site` values checkout
  uses ($1.00 sticker tier, $7.50 everything else, free over $100.00, US only, made-to-order lead
  time), so the page cannot drift from the charged amount. Footer links it.
- **`/returns/`** → 200, "Returns & Exchanges". Coherent policy: contact first for authorization,
  unused / original condition and packaging, custom and personalized items non-returnable except
  defect or wrong item. This is a real policy page, not a paragraph.
- **Customer signup** → the "Create an account" link toggles to a name + email + password form
  ("Create Account") plus Google signup. Works live.
- **Shop product filters** → a category/type `<select>` and "By Product Type" chips are functional;
  shop still lists 16 products.
- **Regressions clean** → checkout card form still initialises (no alerts), cart persists across
  reload, PDP sizes still render, footer now links Shipping and Returns.

### Residual and new issues

- **Footer still contradicts `/returns/`.** The footer's policy line is unchanged: "All sales are
  final. If you have any trouble… we will make it right." The new returns page allows authorised
  returns of unused items. Replace the footer paragraph with a link to `/returns/` so the two stop
  disagreeing (closes the remaining half of **U-09**).
- **Second unnamed `<select>` on `/shop`.** The new category filter ("All Products (16)") has no
  accessible name, so axe now reports **two** `select-name` violations on `/shop` (sort + category).
  Both are one `aria-label` away.
- **U-16 unchanged and now slightly larger.** The sitemap grew to **18 URLs** (added `/shipping`,
  `/returns`) but every URL still points at `www.animasreflections.com`, where they 404. The new
  pages are live on the PWA host but self-canonicalise to a domain that does not serve them.
- **`.env.local` still carries the transposed Square Application ID** (verified again this round).
  Local builds remain a checkout regression risk until it is corrected.

### Not touched this round (still open)

U-11 (street address), U-15 (PDP depth / no shipping-returns line near buy), customizer axe items,
mobile 30-36px tap targets, and from the fulfilment doc: F-02 order notification, F-05 address-2
field, F-06 print preview, F-07 guest upload.
