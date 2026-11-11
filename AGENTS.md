<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Live site defects — read before storefront, checkout, catalog, or orders work

`docs/LIVE_SITE_AUDIT.md` is the verified list of defects on the deployed site (last audited
2026-11-11 against build `502de0c`). Read it before changing the storefront, customizer, checkout, or
catalog, and update its status markers as you fix things. The P0 items are revenue blockers.

`docs/ORDER_FULFILLMENT_AND_SQUARE.md` maps the payment path end to end and records what does and does
not survive to fulfilment. Read it before touching `createSquareOrderAndPay`, `pricing.ts`, the order
mirror, or Admin → Orders.

`docs/USER_FACING_REVIEW.md` is the storefront review against e-commerce norms (item IDs `U-nn`):
product-page sizes, the missing footer, the customer login, policy consistency, and an axe-core
accessibility baseline. Read it before working on any public page.

Three traps from those audits that change how you test:

- **Checkout cannot complete right now.** The card form fails to initialise and
  `pci-connect.squareup.com/payments/hydrate` returns 401 for **every** hostname, so it is not a domain
  allowlist issue. The server token, environment and location are verified correct
  (`squareDiagnostics`); the unverified element is the Application ID. A green build proves nothing
  here — verify any checkout change by watching a real Payment-SDK init in a browser.
- **The cart now persists** in `localStorage` under `animas-cart-v1` (`src/lib/cart-storage.ts`), so it
  survives reloads, new tabs and a direct link to `/checkout/`. That also means a leftover test cart
  will follow you into every page — clear it before testing an empty-cart or fresh-checkout flow.
- **The deployed backend matches `HEAD` as of `0798391`.** Verify that before trusting any claim in
  these docs about what is live.

Most of the storefront's visual problems are **data**, not code: 217 of 234 active products have no
image, 54 are $1.00 design records, and no product is marked `featured`. Deactivating them is a
Firestore/CMS change, not a code change — see the `DATA` items.
