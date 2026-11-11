<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Live site defects — read before storefront, checkout, or catalog work

`docs/LIVE_SITE_AUDIT.md` is the verified list of defects on the deployed site (last audited
2026-11-11 against build `502de0c`). Read it before changing the storefront, customizer, checkout, or
catalog, and update its status markers as you fix things. The P0 items are revenue blockers.

Two traps from that audit that change how you test:

- **Checkout cannot complete right now.** `pci-connect.squareup.com/payments/hydrate` returns 401 for
  the deployed hostname, so `card()` throws and the payment form never renders. A green build proves
  nothing here — verify any checkout change by watching a real Payment-SDK init in a browser.
- **The cart is memory-only** (`src/context/cart-context.tsx`). A reload, a new tab, or a direct link
  to `/checkout/` empties it, so a flow that works when clicked through will look broken when driven
  by URL. Do not assume cart contents survive navigation while testing.

Most of the storefront's visual problems are **data**, not code: 217 of 234 active products have no
image, 54 are $1.00 design records, and no product is marked `featured`. Deactivating them is a
Firestore/CMS change, not a code change — see the `DATA` items.
