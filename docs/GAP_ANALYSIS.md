# Animas Reflections PWA — Gap Analysis

**Date:** 2026-07-09 | **Analysis against:** `docs/BUSINESS_MODEL.md` + `docs/MASTER.md`

---

## 1. GAPS — IMPLEMENTED BUT NOT DEPLOYED/VERIFIED

| # | Gap | Impact | Action |
|---|-----|--------|--------|
| G1 | **Square sync never run on production** — current products lack Square IDs, images, proper grouping | Checkout fails for all synced products | Run "Sync from Square" from admin dashboard |
| G2 | **End-to-end checkout untested** | Cannot process real payments until verified | Test with Square production card |
| G3 | **Functions .env uses sandbox token** | Sync and checkout fail if token misconfigured | Verify production token is active in Square Developer Console |

---

## 2. GAPS — IMPLEMENTED BUT WITH KNOWN ISSUES

| # | Gap | Impact | Action |
|---|-----|--------|--------|
| G4 | **Products have zero images after sync** — sync function doesn't download Square product images to Firebase Storage | All product cards show placeholder initials | Run sync, then upload images manually via Admin → Images tab |
| G5 | **No mockup images (blank product shots)** — all products fall back to product photo as customizer base | Customizer shows product photo instead of blank garment | Upload blank product shots via Admin → Image Manager |
| G6 | **Firestore composite index missing** — `[customerEmail, createdAt desc]` on `orders/` | `fetchCustomerOrders` will fail at scale | Add via Firebase Console |
| G7 | **Color was mismatched** (#8400FF vs #1E4D4F) | Purple UI elements mixed with teal | ✅ Fixed in commit `9b2364c` |
| G8 | **Customizer type assertions missing sideL/sideR** | Runtime error when using side views | ✅ Fixed in commit `9b2364c` |
| G9 | **sync.ts ManagedProduct out of sync with shared types** | Fields lost on sync | ✅ Fixed in commit `9b2364c` |
| G10 | **Admin designs stored in single catalog doc** (old format) | Doesn't scale; no per-design metadata | ✅ Fixed — individual docs in `designs/` collection (commit `4bc9507`) |

---

## 3. GAPS — PLANNED BUT NOT IMPLEMENTED

### 3.1 High Priority

| # | Gap | Plan | Effort |
|---|-----|------|--------|
| G11 | **Inventory count per-variant display** in admin product list | Show per-variant stock next to variant names | Small |
| G12 | **Order pagination** in admin orders tab | Add page controls for orders beyond 30 | Small |
| G13 | **Product images not synced from Square** — images download from Square during sync but aren't written to Firestore | Enable image download in sync pipeline | Medium |

### 3.2 Medium Priority

| # | Gap | Plan | Effort |
|---|-----|------|--------|
| G14 | **JSON-LD on all routes** — currently only layout + product page have it | Add `WebSite`, `Organization`, `BreadcrumbList` to remaining routes | Medium |
| G15 | **Lighthouse PWA audit** — no score data | Run audit, fix issues to target 90+ | Medium |
| G16 | **Service worker offline strategy** — cache-first but no offline indicator | Add "You're offline" banner when no network | Small |
| G17 | **Error recovery on checkout** — no retry for failed payments | Add "Try Again" button with card re-tokenization | Medium |
| G18 | **Admin Users section** — reads Firestore users/ but shows limited info | Add email, created date, order count | Small |

### 3.3 Pre-Launch

| # | Gap | Plan | Effort |
|---|-----|------|--------|
| G19 | **Cross-browser testing** (Chrome, Firefox, Safari, mobile) | Manual testing on 4 browsers + iOS/Android | Medium |
| G20 | **Domain DNS cutover** from Square registrar to Firebase Hosting | Point animasreflections.com to Firebase | Small |
| G21 | **Analytics integration** (Firebase Analytics or GA4) | Add analytics SDK, track page views and conversions | Medium |
| G22 | **iOS Safari PWA install test** | Install on iPhone, verify manifest, icons, standalone mode | Small |
| G23 | **Android Chrome PWA install test** | Install on Android, verify everything | Small |

### 3.4 Future (Deferred)

| # | Gap | Plan | Effort |
|---|-----|------|--------|
| G24 | Email notifications (order confirm, shipping) | Integrate SendGrid or Resend | Large |
| G25 | Band merch campaign landing pages | Template-based page builder | Large |
| G26 | Fundraising portal for organizers | Self-service dashboard | Large |
| G27 | Push notifications (Web Push API) | Order status updates via service worker | Medium |
| G28 | Product reviews and ratings | User-generated content system | Large |
| G29 | Multi-language support | Spanish option for Durango market | Large |
| G30 | Pseudo-3D fabric distortion | Canvas-based mesh warp of design overlay | Large |

---

## 4. GAP SUMMARY

### By Priority

| Priority | Count | Items |
|----------|-------|-------|
| Operational (deploy/verify) | 3 | G1-G3 |
| Implemented with issues | 3 | G4-G6 (G7-G10 fixed) |
| High — not implemented | 3 | G11-G13 |
| Medium — not implemented | 5 | G14-G18 |
| Pre-Launch | 5 | G19-G23 |
| Future | 7 | G24-G30 |

### By Status

| Status | Count |
|--------|-------|
| Fixed this session | 4 (G7-G10) |
| Needs operational action | 3 (G1-G3) |
| Needs implementation | 8 (G11-G18) |
| Pre-launch checklist | 5 (G19-G23) |
| Deferred indefinitely | 7 (G24-G30) |

---

## 5. RECOMMENDED NEXT STEPS

### Immediate (Next Session)
1. **G1**: Run "Sync from Square" from admin dashboard → populates Firestore with proper data
2. **G11**: Add inventory per-variant display to admin product list
3. **G12**: Add order pagination to admin

### Before Launch
4. **G2**: End-to-end checkout test with Square production card
5. **G4**: Upload product images via admin Image Manager
6. **G5**: Upload blank mockup images for customizer
7. **G15**: Lighthouse audit + PWA optimization
8. **G20**: DNS cutover

---

*This gap analysis should be updated after each development session.*
