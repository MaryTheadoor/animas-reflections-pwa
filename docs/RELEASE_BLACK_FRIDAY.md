# Black Friday Release Plan — 2026-11-11 → 2026-11-27

Goal: a site that takes real money, fulfils orders, and does not fall over on Black Friday
(Friday 2026-11-27). **Feature freeze is in effect.** Nothing from the migration roadmap lands
before launch — no Zustand, no XState, no Fabric/Konva, no Medusa. Those are post-launch work.

Code state at the start of this plan: `development` has 45 uncommitted changed files (security,
pricing, admin durability, storefront fixes), gate green (lint 0, tsc 0, 380 tests / 25 suites,
28-page build, SEO gate OK, functions compile clean). Live site runs the 2026-11-11 releases (`4becced` + the user-facing pass) — verify with the bundle hash before trusting any claim in these docs.

---

## Status at 2026-11-24 — supersedes §0–§2

Verified against `d82b86b` (hosting deployed and pushed to `origin/development`), the live
functions, and the live Firestore catalogue.

| Was blocking | Now |
|---|---|
| A real card can be charged (item 1) | **Unblocked and unproven.** `createSquareOrderAndPay` was IAM-private — anonymous calls returned a Google **403 HTML** page while sibling callables answered JSON. The Cloud Run service is now invoker-public and returns JSON `400 Order must contain at least one line item`, so the endpoint executes. **The canary purchase itself is still unrun; only a human can run it.** |
| Card form fails to initialise | **Fixed.** The Application ID was transposed in the repo (`sq0idp-QAzYzF…` for `sq0idp-QAzYFzF…`); corrected in `src/lib/constants.ts` and the rebuild workflow. Checkout card iframe now attaches in a real browser. |
| Security findings F-2…F-7 | **Fixed.** Headers + CSP Report-Only, cache fix, `squareDiagnostics` admin-gated, 200-char caps, `npm audit` down to 4 high root / 0 critical. See `docs/SECURITY_AUDIT.md`. |
| Tax and receipts | **Still client-side.** `health` reports `squareEnvironment: production` and `squareConfigured: true`, but whether the location has **taxes on** and **receipts on** cannot be settled from the code. Confirm in the Square Dashboard. |
| Products are sellable | **Partly.** All 231 active products carry a variant price, but **214 of the 231 have no photo** and 3 pairs are duplicates (§ new). The 9 unpriced and 10 zero-inventory items from §5 no longer appear as such — inventory is not stored per variant in the live schema. |
| Admin can sign in after the security change | **Verified.** `mary.theadoor.doctor@gmail.com` signs in and the product editor saves with server read-back. |

Gate at this commit: **442 tests / 29 suites**, lint 0, tsc 0, 28-page build, `check-seo: OK — 28 pages, 18 sitemap URLs`.

**The only thing between this and revenue is the canary purchase.** Sequence: cheapest item →
checkout → real card → confirm the order in the Square Dashboard *and* Admin → Orders (ship-to,
notes, `paymentId`) → refund in the Dashboard.

### New this pass — duplicates the merge tool cannot see

`Find duplicates` reports "No duplicates found" against the live catalogue, and it is wrong.
`findDuplicateGroups` requires an identical **name and variant signature**, so three pairs of
near-identical products stay live and split their photos, which is the "different picture on the
homepage than the product page" report:

| Product | Live copies | Photos |
|---|---|---|
| Coffee Cup 15 oz / 15 oz Coffee Mug | 2 (+1 unlisted "Coffee Mugs 15 oz") | 1 vs 5 |
| Adult Lightweight Hooded Sun Shirt UPF 44+ | 2 | 4 vs 5 |
| 4 in 1 Bluetooth Speaker Can Cooler | 2 | 0 vs 6 |

Do not merge these with the existing button: `mergeGroup` keeps only the **keeper's** variants, so a
pair whose variants differ would lose the other copy's variants. Fix the detector (name-level
"possible duplicates", advisory) and union variants in `mergeGroup` before using it on these.

### Category ids that point at nothing

Six active products carry `cat_animas_reflections`, `cat_dunphy_stock_fam`, `cat_durango_hockey`,
`cat_durango_roller_girls`, `cat_jordan_branch_music` or `cat_wood_signs` — underscores, where the
category documents use hyphens (`cat_animas-reflections`, …). Those products therefore match no
category filter. Reassign them in Admin; it is a data fix, not a code change.



---

## 0. What must be true for this to be a real launch

> Historical — written 2026-11-11 and kept so the original bar is traceable. The current
> state of every row is in the Status table above.

| # | Requirement | State / owner |
|---|---|---|
| 1 | A real card can be charged, and a real refund can be issued | **Not yet proven.** Needs a live canary purchase — client card + `mary.theadoor.doctor@gmail.com` CLI login |
| 2 | Sales tax is actually collected | Backend now compares totals pre-tax and mirrors `tax`; **Square location settings must have taxes on** — client confirms in Square Dashboard |
| 3 | The customer gets a receipt | `buyerEmailAddress` now sent to Square; **receipts must be enabled on the Square location** — client confirms |
| 4 | The shop is told when an order lands | Square Dashboard app notifications on the Square account (client enables) + Admin → Orders. No email integration this cycle |
| 5 | Admins can still sign in after the security change | `requireAdmin` now requires a **verified** email. Confirm the admin account is Google sign-in or has clicked the verification email |
| 6 | Products are sellable | 225 of 234 active products have a price; **9 active ones have none and will be refused at checkout**; 10 tracked-inventory variants sit at 0 |
| 7 | Customers reach the right domain | Decide: launch on `animas-reflections-pwa.web.app`, or cut `animasreflections.com` over from Square Online |

---

## 1. This week — ship the release candidate (Nov 11–13)

- [x] Freeze features; fix only launch blockers
- [x] Tax-aware order verification; Square buyer email on payments; checkout discloses that tax is added by Square
- [x] Checkout blocks Pay until `config/site` resolves — paying against fallback shipping rates (stickers $3 vs live $1) would make `expectedTotal` diverge and the server would refuse the order
- [x] `npm run verify`, `npm run build`, `cd functions && npm run build` — all green
      (lint 0 · tsc 0 · **442 tests / 29 suites** · 28-page build, SEO gate OK · functions compile clean)
- [x] Commit the change set on `development` and tag `rc-blackfriday-1`
- [x] Client: fix the 9 unpriced active products — every active product now carries a variant price
- [ ] Client: decide the 214 photo-less active products (unlist, or photograph) — the shop shows
      all 231 today, so 214 cards render without an image
- [ ] Client: confirm Square location has **taxes on**, **receipts on**, and that the access token in
      `functions/.env` is the **production** token (`SQUARE_ENVIRONMENT=production`)

## 2. Deploy + prove it — DONE 2026-11-11, canary outstanding

Order matters — functions and rules before hosting.

```bash
firebase deploy --only firestore:rules,storage     # storage.rules changed (upload caps)
firebase deploy --only functions                    # pricing, auth, tax, inventory
firebase deploy --only hosting                      # the 28-page static export
```

**Deployed:** `d82b86b` at the last pass, pushed to `origin/development`; the earlier release was
`502de0c` (tag `rc-blackfriday-1`). Rules released, functions deployed, hosting released.
Verification completed:

1. ✅ `GET .../health` → `{"squareConfigured":true,"squareEnvironment":"production"}`
2. ✅ Frontend: `/`, `/shop/`, `/product/`, `/checkout/`, `/admin/login/`, `/search/`, `/services/`
   all 200 with correct `<title>`; unknown URL returns **404**; deployed chunks contain the new
   strings (tax disclosure, "Saved and confirmed by the server", "Uncategorised")
3. ✅ Rules (anonymous, REST): `config/admin` 403, `orders` 403, `secrets/githubPublish` 403,
   `products` 200, `config/site` 200, `product_photos` 200
4. ✅ **Admin sign-in → save → fresh session** — confirmed signed in as
   `mary.theadoor.doctor@gmail.com`, product editor saves with server read-back
5. ✅ `createSquareOrderAndPay` is reachable: anonymous POST returns JSON
   `400 Order must contain at least one line item` (it returned a **403 HTML** page while the Cloud
   Run service required authentication)
6. ⬜ **Canary purchase + refund** — needs a real card, in a **real browser**. Do not judge the card
   form from headless Chrome: it blocks the third-party cookies Square's PCI iframe needs, which
   looks exactly like a credential fault. `squareDiagnostics?locationId=L6VCX130RHYQR` reports the
   server side is healthy (production token, 1 location, and it matches the build), so a failure in a
   real browser points at the application's Web Payments configuration in the Square Developer
   Dashboard — not at the token or the location id.

Remaining check: 6. Everything else below is done or needs no signed-in human.

1. `GET https://us-central1-animas-reflections-pwa.cloudfunctions.net/health` →
   `squareEnvironment` must be **production** and `squareConfigured` **true**.
2. Admin sign-in → edit a product → **"Saved and confirmed by the server at …"** → open the
   product in a fresh session.
3. **Canary purchase**: cheapest real product, real card, ship to the shop address.
   Verify: order in Square Dashboard, order in Admin → Orders, receipt email arrives, and the
   charged amount = items + shipping + tax. Inventory is not stored per variant in the live
   schema, so there is no stock decrement to check.
4. **Refund the canary in Square Dashboard.** Confirm the refund is visible where you would look
   on a normal day.
5. Unauthenticated upload must still fail (storage rules); a customer upload must still succeed.

If any of 1–5 fails: `firebase hosting:rollback` (or redeploy the previous `out/`) and stop.

## 3. Make it a shop, not just a checkout (Nov 14–18)

- [ ] Black Friday offer, done as **price edits in Admin** — there are no discount codes in the
      product. A promo-code feature is post-launch.
- [ ] Announcement bar copy (Admin → Content & Theme): the offer, the shipping cutoff
      ("order by Nov 18 for delivery before Dec 6"), and the last day for local pickup
- [ ] `/faq` + `/terms`: production time, shipping window, returns, and the tax line
- [ ] Mobile pass on a real phone: shop → product → customizer → cart → checkout → pay
- [ ] Seeded smoke test of 5–10 representative products (multi-colour, modifier add-ons,
      embroidery, a sticker-only cart) through to the payment form — no charge needed if the
      order total is read from the confirm panel

## 4. Domain + comms (Nov 18–20, client decision)

Two viable paths:

- **A — launch on `animas-reflections-pwa.web.app`.** Zero DNS risk; announce that URL. Cut over
  after Black Friday. Lowest risk, weakest brand trust.
- **B — cut `animasreflections.com` over now.** Square Online must be pointed away (or left
  serving `/` with a redirect), DNS TTL lowered 48h in advance, and the SSL cert reissued by
  Firebase. Do it by **Nov 18** so a failure still leaves a week to fix.
  Recommended if the brand URL matters for the campaign; otherwise A.

Either way: keep the Square Online site live-but-redirected for at least two weeks after cutover,
and put the old order-history question to bed (customer accounts/orders do not migrate).

## 5. Data fixes the client must make (blocking checkout for those items)

Active, unpriced (checkout refuses them): Quarter Zip Pullover Style · 3" Dunphy Stock FAM Slap ·
Grey Youth Short Sleeve (1) · Black DLC Logo · Glass Ornament 4" Tall · Grey Zip Up Hoodie ·
Hoodie Unisex · Hoodie Unisex Grey Durango Roller Girls.

Tracked inventory at 0 (show as out of stock): 7 resin/jewelry pendants, 2 lanyards
("Limited Edition Only 15 Available" — likely sold out), 1 Aspen Leaf necklace. Restock or hide.

## 6. Black Friday week (Nov 23–27)

- **Nov 23 (Mon):** final freeze. No deploys except a hotfix.
- **Nov 24 (Tue, today):** canary purchase + refund; confirm Square taxes and receipts are on;
  decide the 214 photo-less products; re-run the smoke list; print the cutoffs.
- **Nov 25 (Wed):** Black Friday prices in Admin (there are no coupon codes), announcement bar
  copy, first invite wave to the early-access list, mobile pass on a real phone.
- **Nov 26 (Thu):** quiet. No deploys after the morning.
- **Nov 27 (Fri):** on call. Watch failed payments in the Square Dashboard, orders without
  receipts, and the cart's shipping threshold behaviour near $100.
- **Nov 28–30:** fix only what stops a sale; revert the sale prices on Monday.

**Do not deploy on Nov 27** unless the site is down and you are rolling back.

### Early-access framing

The risk to plan around is not a login wall — it is that real orders find what a scripted pass
cannot. Announce the site as **early access**, with a standing ask for bug reports. The footer
feedback link (`mailto:AnimasReflections@gmail.com?subject=Website%20feedback`) already routes
those to the same inbox as everything else, so no new tooling is needed for launch week.

Say plainly, in the announcement and on the order confirmation, that the site is new: a customer
who is told to expect a rough edge reports it, and the same customer who hits one unexpectedly
tells everyone else instead.


## 7. Rollback

1. Hosting: `firebase hosting:rollback` (previous release) — fast, no rebuild.
2. Functions: redeploy the previous commit's `functions/` (`git checkout <tag> -- functions && cd functions && npm run build && firebase deploy --only functions`).
3. Rules: `firebase deploy --only firestore:rules,storage` from the tagged commit.
4. Nothing in this cycle changes the data model, so a code rollback does not orphan data.

## 8. Known gaps accepted for launch

- No promo/discount codes (use price edits).
- No automated order email to the shop (Square notifications + Admin → Orders).
- Refunds are processed in Square Dashboard; the Firestore mirror keeps `status: PENDING`.
- Analytics not installed; no cookie-consent decision yet.
- Order confirmation page trusts the client's `?status=` — it is cosmetic, not proof of payment.
- The `/account` page lists orders by the account's email; guest orders are not shown.
