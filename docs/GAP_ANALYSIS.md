# Animas Reflections PWA — Gap Analysis

**Date:** 2026-08-06 (full refresh) | **Supersedes:** 2026-07-22 version
**Analysis against:** verified codebase state on `master` @ `d3751ea` (deployed) + `docs/MASTER.md`

> Refreshed ahead of a hardware reboot so all current gaps are captured in one place.
> G-numbering preserved for continuity; new work tracked with descriptive labels.

---

## 1. RESOLVED (as of 2026-08-06)

| # | Item | Resolution |
|---|------|-----------|
| — | **Product save failed/hung** | Firestore rejects `undefined` values — fixed with shared `stripUndefined()` helper. User-verified. |
| — | **Design upload failed** | Same `undefined` root cause — fixed. User-verified. |
| — | **Checkout double-charge risk** | Idempotency key stabilized across retries (regenerated on total change). |
| G3 | Production Square token | ✅ User confirmed production key active; functions use production env. |
| G6 | Firestore composite index (orders/customerEmail+createdAt) | ✅ Deployed. |
| G11 | Per-variant inventory display | ✅ Implemented. |
| G12 | Order pagination in admin | ✅ Implemented (15/page). |
| G14 | JSON-LD on routes | ✅ FAQPage + BreadcrumbList added (shop/product funnel). |
| G16 | Offline indicator | ✅ Implemented. |
| G17 | Checkout retry safety | ✅ Safe via idempotency fix. |
| G18 | Admin Users tab detail | ✅ Order counts, names, dates; `createdAt` recorded on first sign-in. |
| — | Branching / recovery | ✅ `master` (stable) + `development` (working) model. |
| — | Modular per-product add-ons | ✅ Standard toggles + editable prices + custom add-ons (3-state `productAddons`). |
| — | Single-design mode | ✅ Per-product `singleDesign` toggle (hides text tool). |
| — | Rich text descriptions | ✅ contentEditable toolbar (B/I/lists) + sanitized render. |
| — | Per-product shipping override | ✅ `shippingRate` on product; cart uses max(override, global tier). |
| — | Modular product attributes | ✅ `attributes` (backgroundColor, patchShape, borderStyle, customFields) shown as specs. |
| — | Customizable flag | ✅ `customizable` gates the "Customize This" button. |
| — | Design files to order + admin | ✅ Checkout sends `designUrl`; backend mirrors it; admin shows design files per order. |
| — | Color-variant mockups | ✅ `colorTints` overlay + `mockupImagesByColor` upgrade path; admin picker w/ live preview. |
| — | Shop By Design/Type toggle | ✅ Fixed dead-state `browseMode`; type filter added. |
| — | Product card stock badge | ✅ Fixed absolute-positioning bug. |
| — | Tile density control | ✅ 2–5 per row on shop + search (shared `DensityPicker`). |
| — | Storage cleanup on product delete | ✅ Delete now removes orphaned image files. |

---

## 2. OPERATIONAL GAPS — action needed (not code)

| # | Gap | Action |
|---|-----|--------|
| G2 | **End-to-end checkout untested** with a real card | Run a small real purchase; verify Square order + Firestore mirror + confirmation page. **Highest priority.** |
| G1 | **Catalog is a manual rebuild** — Square sync de-prioritized; products being entered by hand in Admin | Continue building the catalog manually; use per-product add-ons/attributes/color-tints as you go. |
| G4 | **Product images** — manual uploads per product via Admin → Images tab | Upload as you build each product (G13 automation deferred). |
| G5 | **Blank mockup images** for customizer | Upload light/white or transparent-PNG mockups (best for color-tint overlay). |

---

## 3. CODE GAPS — open, prioritized

### Low priority (deferred by user)
| # | Gap | Notes |
|---|-----|-------|
| G13 | **Square→Storage image sync** | Automates G4. Deferred while catalog is rebuilt manually. |

### Nice-to-have polish
| # | Gap | Notes |
|---|-----|-------|
| — | Print zone coordinate editor (visual) | Currently `printZones` set via data only — a visual admin editor would help. |
| — | Rich-text toolbar: headings + links | Current toolbar supports bold/italic/lists only. |

---

## 4. PRE-LAUNCH CHECKLIST

| # | Item | Effort |
|---|------|--------|
| G2 | Real end-to-end checkout test (see §2) | 30 min |
| G15 | Lighthouse PWA audit (target 90+) | 1 session |
| G19 | Cross-browser testing (Chrome/Firefox/Safari/mobile) | 1 session |
| G20 | Domain DNS cutover (animasreflections.com → Firebase Hosting) | 15 min |
| G21 | Analytics integration (Firebase Analytics / GA4) | 1 session |
| G22 | iOS Safari PWA install test | 30 min |
| G23 | Android Chrome PWA install test | 30 min |

---

## 5. FUTURE (deferred)

| # | Feature | Effort |
|---|---------|--------|
| G24 | Email notifications (order confirm, shipping) — SendGrid/Resend | Large |
| G25 | Band merch campaign landing-page builder | Large |
| G26 | Fundraising portal for organizers | Large |
| G27 | Push notifications (Web Push API) | Medium |
| G28 | Product reviews & ratings | Large |
| G29 | Multi-language (Spanish) | Large |
| G30 | Pseudo-3D fabric distortion in customizer | Large |

---

## 6. SUMMARY

| Status | Items |
|--------|-------|
| ✅ Resolved | 23 (all code-level gaps + robustness fixes + client-requested features) |
| 🔴 Operational (action) | G1, G2, G4, G5 |
| 🟡 Code — open | G13 (deferred), print-zone editor, rich-text links |
| ⚪ Pre-launch | G15, G19–G23 |
| ⏸️ Future | G24–G30 |

---

## 7. RECOMMENDED NEXT STEPS

1. **G2** — one real end-to-end checkout (validates idempotency + design-file capture + payment pipeline).
2. **G15** — Lighthouse audit; fix findings.
3. **G21** — analytics integration.
4. **G20** — DNS cutover once the above pass.
5. **G19/G22/G23** — cross-browser + PWA install verification.

---

*Updated 2026-08-06. Refresh after each development session.*
