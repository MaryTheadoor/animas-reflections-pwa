# Animas Reflections PWA — Codebase Analysis & Project Outline

**Prepared:** after the auth/security + Content & Theme work merged to `master` (`42e294f`).
**Project:** `MaryTheadoor/animas-reflections-pwa` (private) · live: https://animas-reflections-pwa.web.app

---

## 1. Overview & Current Status

A headless e-commerce PWA for a Durango, CO custom apparel/merchandise shop. Next.js 16
(App Router, **static export**), TypeScript, Tailwind v4, Firebase (Hosting/Firestore/
Functions/Storage/Auth), Square Web Payments (payment-only), PWA (manifest + service worker).

**Phase status (see DEVLOG):** Core storefront, catalog, customizer, checkout, admin CMS,
**auth/security hardening**, **inventory**, **CSV import**, **modifier groups**, **Help hub**,
and **Content & Theme editor** (phases 1–3) are done and **deployed live**. The catalog
architecture (2026-08) made **Firestore the master catalog** (Square = payment only).

**Health (verified):** `tsc` 0 · `lint` 0 (1 pre-existing unused-directive warning) ·
**tests 124/124** (11 suites) · **build 22/22** static routes · functions build clean.

---

## 2. Architecture

**Routes (`src/app`):** `/`, `/shop`, `/product?id=`, `/customizer?product=&color=`,
`/checkout`, `/order-confirmation`, `/search`, `/account`, `/admin` (+`/admin/login`),
`/about`, `/contact`, `/custom`, `/faq`, `/fundraising`, `/terms`, `/privacy`,
`/biscuit-hockey`, `/im-ok-r-u`, `/not-found`.

**Data flow:** Client components read Firestore via hooks → `CatalogProvider`
(products/categories, one read/session), `SiteConfigProvider` (`config/site`: theme,
content, catalog options, addons, customer fields, shipping), `AuthProvider`, `CartProvider`.
All catalog/content is client-fetched (static export → hydrates then applies overrides).

**Firestore model:** `products/`, `categories/` (parentId hierarchy), `designs/`,
`config/site`, `config/admin` (admin allowlist), `users/{uid}`, `orders/`
(`order_<squareOrderId>` + `customerEmailLower`), `customers/{uid}/addresses`.

**Cloud Functions (14, Node 22, us-central1):** `createSquareOrderAndPay` (server-side
price recompute from Firestore + Square charge + Firestore mirror; rejects out-of-stock),
`createSquareProduct`, `fetchRecentOrders`, `fetchCustomerOrders`, `updateOrderTracking`,
`fetch/saveSiteConfig`, `saveAdminEmails`, customer address/profile CRUD, `health`.

**Auth/roles:** Firebase (email/password + Google). **Admin = `config/admin` allowlist only**
+ a server `BOOTSTRAP_ADMIN_EMAIL` (env) for first setup. Client `isUserAdmin` + server
`requireAdmin()` + Firestore/Storage rules all use the allowlist (the earlier
`@animasreflections.com` wildcard was removed).

**Theme/content system:** `config/site.theme` drives light+dark palette CSS vars (injected);
`config/site.content` is an override layer over `src/lib/content.ts` snapshots
(`site-config-context` → `useSiteConfig`/`useSiteContent`/`useSiteConfigRefresh`).

---

## 3. Feature Inventory (done → deployed)

**Storefront:** catalog grid (browse/search/sort/density), product detail (variants, color
mockups by color, personalization, JSON-LD), interactive **customizer** (drag/resize/rotate,
design library, add-ons, text/file inputs), dynamic checkout customer fields + **server-side
pricing**, order confirmation, account (orders/addresses/profile), fuzzy search.

**Admin CMS:** products (variants matrix, options, add-ons/modifier groups, colors +
color-library, images/color-images, attributes, designs, per-product shipping, SEO),
categories (hierarchy), Settings (catalog options, addons, customer fields, theme),
designs, images, orders, users, admins, **CSV catalog import** + template, **Help hub**
(searchable guide + tutorials), **Content & Theme** (Theme light/dark + Copy page-by-page
editor with wireframes, structured lists, per-field reset, SEO fields, help shortcut).

**Security/robustness:** config-allowlist admin gate (client+functions+rules), server-side
pricing/price-recompute, `stripUndefined()` on writes, DOMPurify sanitization, URL-synced
shop/search filters, normalized order emails, PWA install + offline banner.

---

## 4. Strengths

- Clean split: Firestore catalog (source of truth) + Square payment-only; server re-derives
  all prices (never trusts client amounts).
- Consistent admin gating across client/functions/rules.
- Content editor makes site copy + brand theme publisher-editable without redeploys.
- Static-export + PWA with JSON-LD for SEO baseline.

## 5. Tech debt / risks to watch

- **SEO crawlability limit:** content/theme is client-fetched against a **static export**, so
  runtime-edited copy is in hydrated JS, not the initial static HTML. Static HTML uses
  `content.ts`/`globals.css` defaults. Edits to SEO/copy mostly affect the live DOM/browser,
  not the first-load HTML. (Google can still render JS, but this is the main SEO caveat.)
- **Large components:** `product-manager.tsx` (~1.8k lines) should be split into sub-components.
- **`console.*`:** ~15 non-test `console.log/warn/error` left in src/functions — review/convert
  to a logger or remove.
- **Dual-source copy:** `content.ts` (defaults) + `config/site.content` (overrides) — must keep
  the merge (`mergeContent`) in sync; a field added to `content.ts` needs a schema/default entry.
- **Functions dep versions:** `firebase-functions@6` is flagged outdated (breaking changes on
  upgrade); `next@16.2.7` has 3 frontend vulns (upgrade to 16.3.x flagged). No TODO markers left.
- **Nav dock** uses fixed links/icons (editable labels for Home/Shop/About only).

---

## 6. Roadmap & To-Do List

### 🔴 P0 — Launch-blocking / operational (from GAP_ANALYSIS + this session)
- [ ] **G2 — Real end-to-end checkout test** with a real card (Square production). Validates
      idempotency, server pricing, design-file capture, Firestore mirror. *Highest priority.*
- [ ] **G1 — Populate the real catalog** in Admin (Firestore master; products entered by hand).
- [ ] **G4/G5 — Product images + blank mockup images** via Admin → Images/Image Manager.
- [ ] **G15 — Lighthouse PWA audit** (target 90+); fix findings.
- [ ] **G20 — DNS cutover** `animasreflections.com` → Firebase Hosting.
- [ ] **G21 — Analytics** (Firebase Analytics / GA4) integration.
- [ ] **G19/G22/G23 — Cross-browser (Chrome/Firefox/Safari/mobile) + PWA install tests.**

### 🟠 P1 — Product & commerce polish
- [ ] **Print-zone visual editor** in Admin (currently `printZones` via data only).
- [ ] **Rich-text toolbar** headings + links (currently bold/italic/lists).
- [ ] **Email notifications** (order confirm, shipping) — SendGrid/Resend (G24, large).
- [ ] **Promo / discount codes** + **tax handling**.
- [ ] **Per-variant payouts** (Square payment split / per-item profit).
- [ ] **Reviews & ratings** (G28).

### 🟢 P2 — Future / growth (from GAP_ANALYSIS §5)
- [ ] **Push notifications** (Web Push API, G27) · **Band-merch campaign builder** (G25) ·
      **Fundraising organizer portal** (G26) · **Multi-language (Spanish)** (G29) ·
      **Pseudo-3D fabric distortion** in customizer (G30) · **Square→Storage image sync** (G13).

### 🔧 P3 — Code health (tech debt)
- [ ] Split `product-manager.tsx` into focused sub-components.
- [ ] Review/remove the ~15 `console.*` statements (logger or remove).
- [ ] Add unit tests for `functions/src/pricing.ts`, checkout line-items, customizer logic,
      and the copy/theme merge (currently 124 tests incl. csv/theme).
- [ ] Upgrade `firebase-functions` (v6 → latest, mindful of breaking changes) and
      `next` (16.2.7 → 16.3.x) to clear vulns.
- [ ] Document/own the `content.ts` ↔ `content-schema.ts` merge contract (dual-source).

---

## 7. Suggested sequence

1. **G2 checkout smoke test** (validates the highest-risk path end-to-end) then **G20 DNS**.
2. **Lighthouse (G15) + cross-browser/PWA (G19/G22/G23)** — quick wins, then **Analytics (G21)**.
3. Feed catalog data + images (G1/G4/G5) continuously in parallel.
4. After launch: P1 commerce polish (email, promo/tax), then P2 growth ideas.
5. Interleave P3 code-health items (split product-manager, logger cleanup, coverage, upgrades).

---

*Sources: `docs/GAP_ANALYSIS.md`, `docs/PROJECT_CONTEXT.md`, `docs/DEVLOG.md`,
`docs/THEME_EDITOR.md`, plus the verified codebase state at `42e294f`.*
