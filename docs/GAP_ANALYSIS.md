# Animas Reflections PWA — Gap Analysis

**Date:** 2026-07-22 (Session 6 refresh) | **Supersedes:** 2026-07-09 version
**Analysis against:** verified codebase state on `master` @ `70dd18a` (deployed) + `docs/BUSINESS_MODEL.md` + `docs/MASTER.md`

> This version was rewritten after a fresh code-level audit. Several items marked
> "open" in the 2026-07-09 version were found to be **already implemented**; those
> are corrected below. G-numbering preserved for continuity.

---

## 1. RESOLVED — Session 6 (2026-07-22)

| # | Item | Resolution |
|---|------|-----------|
| — | **Product save failed/hung** (user-reported) | **Root cause:** Firestore Web SDK rejects writes containing `undefined` field values. Fixed via shared `stripUndefined()` helper in `handleSave` + `handleDuplicate`. Also fixed empty `createdAt` on new products. **User-verified in live admin.** |
| — | **Design upload failed** ("live design-catalog errors") | Same `undefined` root cause (`description`/`tags` blank). Fixed via `stripUndefined()`. **User-verified.** |
| — | **Checkout double-charge risk** | `idempotencyKey` was regenerated per submit, defeating Square dedup. Now stable across retries (regenerated on total change, cleared on success). |
| G6 | Firestore composite index `orders/[customerEmail, createdAt desc]` | ✅ **Deployed** to production this session. |
| G11 | Per-variant inventory display | ✅ Confirmed **already implemented** in product list (inline `name:qty`). |
| G12 | Order pagination in admin | ✅ Confirmed **already implemented** (15/page with « » controls). |
| G16 | Offline indicator | ✅ Confirmed implemented (offline banner in header-bar). |
| G17 | Checkout retry | ✅ Addressed — retry exists (re-click re-tokenizes) and is now **safe** via idempotency fix. |
| — | Branching / recovery | ✅ `master` (stable) + `development` (working) model established on GitHub; documented in DEVELOPMENT.md. |

---

## 2. OPERATIONAL GAPS — need action, not code

| # | Gap | Impact | Action |
|---|-----|--------|--------|
| G1 | **Catalog needs rebuild** — initial Square sync ran but import was "messy" (grouping/data quality) | Storefront data imperfect | Re-run **Admin → Settings → Sync from Square**; review grouping; manual cleanup in Admin as needed |
| G2 | **End-to-end checkout untested** with a real card | Cannot confirm live payments | Run a small real purchase; verify Square order + Firestore mirror + confirmation page |
| G3 | **Square token env unverified** — `functions/.env` has `SQUARE_ACCESS_TOKEN` but prod-vs-sandbox unconfirmed | Sync/checkout hit wrong Square env | Confirm `SQUARE_ENVIRONMENT=production` + production token in `functions/.env`, then redeploy functions |
| G4 | **Products lack images after sync** | Product cards show placeholders | Upload via Admin → Images tab (or see G13 for automation) |
| G5 | **No blank mockup images** for customizer | Customizer falls back to product photo | Upload blank garment shots via Admin → Image Manager |

---

## 3. CODE GAPS — open, prioritized

### 3.1 High value
| # | Gap | Notes | Effort |
|---|-----|-------|--------|
| G13 | **Square→Storage image sync** — sync copies Square URLs but doesn't transfer files into Firebase Storage | Would resolve G4 automatically; medium complexity | Medium |

### 3.2 Medium
| # | Gap | Notes | Effort |
|---|-----|-------|--------|
| G14 | **JSON-LD on remaining routes** — currently layout + product page only | Add `BreadcrumbList`/page schema to other routes | Medium |
| G18 | **Admin Users tab detail** — shows limited info | Add email/created/order-count columns | Small |

---

## 4. PRE-LAUNCH CHECKLIST

| # | Item | Effort |
|---|------|--------|
| G15 | Lighthouse PWA audit (target 90+) | 1 session |
| G19 | Cross-browser testing (Chrome/Firefox/Safari/mobile) | 1 session |
| G20 | Domain DNS cutover (Square registrar → Firebase) | 15 min |
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

| Status | Count | Items |
|--------|-------|-------|
| ✅ Resolved (incl. Session 6) | 9 | product-save, design-upload, idempotency, G6, G11, G12, G16, G17, branching |
| 🔴 Operational (action needed) | 5 | G1–G5 |
| 🟡 Code — open | 3 | G13, G14, G18 |
| ⚪ Pre-launch | 6 | G15, G19–G23 |
| ⏸️ Future | 7 | G24–G30 |

---

## 7. RECOMMENDED NEXT STEPS

### Immediate (operational — biggest blockers to a working store)
1. **G3** — verify production Square token in `functions/.env`, redeploy functions.
2. **G1** — re-run "Sync from Square", review/clean the catalog grouping.
3. **G2** — one real end-to-end checkout to confirm the payment pipeline (also validates the new idempotency behavior).

### Then (code)
4. **G13** — Square→Storage image sync (removes the manual image-upload burden).
5. **G14** — JSON-LD on remaining routes.

### Before launch
6. Pre-launch checklist (G15, G19–G23), then **G20 DNS cutover**.

---

*Updated after Session 6 code-level audit. Refresh after each development session.*
