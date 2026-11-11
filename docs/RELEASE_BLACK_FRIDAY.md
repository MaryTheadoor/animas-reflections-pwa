# Black Friday Release Plan — 2026-11-11 → 2026-11-27

Goal: a site that takes real money, fulfils orders, and does not fall over on Black Friday
(Friday 2026-11-27). **Feature freeze is in effect.** Nothing from the migration roadmap lands
before launch — no Zustand, no XState, no Fabric/Konva, no Medusa. Those are post-launch work.

Code state at the start of this plan: `development` has 45 uncommitted changed files (security,
pricing, admin durability, storefront fixes), gate green (lint 0, tsc 0, 328 tests / 22 suites,
25-page build, SEO gate OK, functions compile clean). Live site is running `e6850d9` (2026-10-16).

---

## 0. What must be true for this to be a real launch

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
      (lint 0 · tsc 0 · **328 tests / 22 suites** · 25-page build, SEO gate OK · functions compile clean)
- [ ] Commit the change set on `development` and tag `rc-blackfriday-1` (owner: me, needs your go-ahead)
- [ ] Client: fix the 9 unpriced active products (set a price or deactivate) — list in §5
- [ ] Client: restock or accept the 10 zero-inventory items (§5)
- [ ] Client: confirm Square location has **taxes on**, **receipts on**, and that the access token in
      `functions/.env` is the **production** token (`SQUARE_ENVIRONMENT=production`)

## 2. Deploy + prove it (Nov 13–14, low-traffic window)

Order matters — functions and rules before hosting.

```bash
firebase deploy --only firestore:rules,storage     # storage.rules changed (upload caps)
firebase deploy --only functions                    # pricing, auth, tax, inventory
firebase deploy --only hosting                      # the 25-page static export
```

Then, in this order:

1. `GET https://us-central1-animas-reflections-pwa.cloudfunctions.net/health` →
   `squareEnvironment` must be **production** and `squareConfigured` **true**.
2. Admin sign-in → edit a product → **"Saved and confirmed by the server at …"** → open the
   product in a fresh session.
3. **Canary purchase**: cheapest real product, real card, ship to the shop address.
   Verify: order in Square Dashboard, order in Admin → Orders, receipt email arrives, inventory
   (if tracked) decremented, and the charged amount = items + shipping + tax.
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

- **Nov 23:** final freeze. No deploys except a hotfix.
- **Nov 24:** re-run the smoke list; confirm Square Dashboard notifications fire; print the
  cutoffs.
- **Nov 25–26:** monitor. Check Admin → Orders at open, midday, close; reconcile against Square.
- **Nov 27:** on call. Watch: failed payments (Square Dashboard), orders without receipts, stock
  hitting zero on tracked items, and the cart's shipping threshold behaviour near $100.

**Do not deploy on Nov 27** unless the site is down and you are rolling back.

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
