# Animas Reflections PWA — Gap Analysis
## Generated: 2026-06-08 | Spec vs Implementation Audit

---

## COMPLETION SUMMARY

| Phase | Status | Progress |
|-------|--------|----------|
| 1. Workspace & Init | ✅ COMPLETE | 100% |
| 2. Square API Gateway | ✅ COMPLETE | 100% |
| 3. Customizer Component | 🟡 IN PROGRESS | ~70% |
| 4. Order Assembly & Checkout | 🟡 IN PROGRESS | ~80% |
| 5. Admin CMS Dashboard | 🟡 IN PROGRESS | ~85% |
| 6. PWA Optimization & Launch | 🔴 EARLY | ~40% |

---

## PHASE 1: Workspace & Init ✅
| Task | Status | Notes |
|------|--------|-------|
| 1.1 Git repo + dirs | ✅ Done | GitHub: MaryTheadoor/animas-reflections-pwa |
| 1.2 Firebase init | ✅ Done | Hosting + Functions + Firestore + Storage |
| 1.3 Framework + Tailwind | ✅ Done | Next.js 16.2.7, Tailwind CSS v4 |

---

## PHASE 2: Square API Gateway ✅
| Task | Status | Notes |
|------|--------|-------|
| 2.1 Cloud Functions + Square auth | ✅ Done | 6 functions deployed |
| 2.2 fetchSquareCatalog | ✅ Done | Filters ecom_visibility=VISIBLE |
| 2.3 Data validation / shielding | ✅ Done | Server-side only Square token |

---

## PHASE 3: Customizer Component 🟡
| Task | Status | Gap |
|------|--------|-----|
| 3.1 Main layout + viewport columns | ✅ Done | Front/back view switching works |
| 3.2 Multi-layered overlay assembly | 🟡 Partial | Drag/reposition/rotate/resize done. But: **print zones hardcoded** — not loaded from Firestore per-product. **Real product mockup images missing** (using hero-bg.jpg placeholder). mix-blend-mode overlay blending NOT verified |
| 3.3 File upload → Firebase Storage | ✅ Done | FileUpload component exists, uploads to storage |
| 3.4 Add-on state + cost calculation | ✅ Done | Cart context handles addons with $5 increments |

### Phase 3 Critical Gaps:
- ❌ **No product selector** in customizer — can't choose WHICH garment to customize
- ❌ **Print zone metadata NOT loaded from Firestore** — hardcoded constants
- ❌ **No Square modifier ID mapping** — customized items don't carry Square variation/modifier IDs into cart
- ❌ **Placeholder product images** — need real front/back/sleeve mockup photos of each garment type
- ❌ **Design library picker exists** but not verified end-to-end with Firestore designs catalog

---

## PHASE 4: Order Assembly & Checkout 🟡
| Task | Status | Gap |
|------|--------|-----|
| 4.1 Cart state (items + addons + shipping) | ✅ Done | Full reducer with addons, quantities, shipping tiers |
| 4.2 Square Web Payments SDK | ✅ Done | Card input rendered via Square SDK |
| 4.3 createSquareOrderAndPay function | ✅ Done | Cloud Function processes orders |

### Phase 4 Critical Gaps:
- ❌ **Customizer → Cart flow broken** — customizer doesn't push items with correct Square catalog variation IDs
- ❌ **Uploaded design URLs NOT attached to order line item notes** (spec requirement)
- ❌ **No order confirmation page** — after payment, no thank-you/summary page
- ❌ **No sandbox/production payment testing** — never run a real transaction through the pipeline
- ❌ **Shipping tier logic** — free threshold is $100 in admin default but the spec says $50; hardcoded SHIPPING constants may conflict with Firestore config

---

## PHASE 5: Admin CMS Dashboard 🟡
| Task | Status | Gap |
|------|--------|-----|
| 5.1 Secure route + Firebase Auth | ✅ Done | RequireAdmin + admin login page |
| 5.2 Visual config + text slots | ✅ Done | Color pickers, announcement, hero text, about body, shipping rates |
| 5.3 Design asset upload + management | ✅ Done | Upload → Firestore designs catalog, category assignment |

### Phase 5 Critical Gaps:
- ❌ **Site config NOT reactive** — Cindy's color/setting changes in admin save to Firestore but the frontend reads from hardcoded `content.ts` / `constants.ts` at build time. Changes require a rebuild + deploy to take effect.
- ❌ **No live preview** of config changes before saving
- ❌ **Orders tab** — reads last 50 Square orders. Needs verification with real data.
- ❌ **Users/Admins tabs** — basic CRUD exists but cannot add admins via email (Firestore rules may need updating)
- ❌ **Category manager** exists but relationship to Square category sync unclear

---

## PHASE 6: PWA Optimization & Launch 🔴
| Task | Status | Gap |
|------|--------|-----|
| 6.1 manifest.json + offline caching | ✅ Done | SW fixed for dev mode, works in production |
| 6.2 JSON-LD structured data | 🟡 Partial | Organization + WebSite JSON-LD done. Missing: **Product JSON-LD** on product detail pages, **BreadcrumbList** JSON-LD |
| 6.3 Sandbox checkout testing | ❌ Not done | Zero transaction testing |
| 6.4 Domain config + production deploy | ❌ Not done | 5 commits unpushed. Not deployed to Firebase Hosting. Square domain DNS not pointed. |

### Phase 6 Critical Gaps:
- ❌ **Product JSON-LD** — spec requires per-product Schema.org Product blocks for AI/voice agent scraping
- ❌ **BreadcrumbList JSON-LD** — for navigation context
- ❌ **Offline strategy not tested** — SW caches 6 routes, but what about dynamic product pages?
- ❌ **No install prompt** — PWA "Add to Home Screen" not triggered
- ❌ **No analytics** — no Google Analytics, no Firebase Analytics
- ❌ **No error monitoring** — no Sentry or equivalent

---

## CROSS-CUTTING GAPS

### Content & SEO
- ❌ Social links in JSON-LD `sameAs` is empty array — should include Instagram (`cjfuss.animasreflections`)
- ❌ No sitemap.xml generation
- ❌ No robots.txt in public/ (though metadata robots tag exists)
- ❌ Product pages lack meta descriptions per product
- ❌ Image alt text may not be dynamic per product

### Design System
- ❌ Square brand colors (purple #9d689d, sage #9dbd73) from live site NOT used — current palette uses Teal/Gold/Cream which differs from Cindy's actual brand
- ❌ Square fonts (Recoleta, Vesper Libre) — Vesper Libre loaded but Recoleta not (custom font, needs license)
- ❌ Dark mode exists but brand spec doesn't define dark palette

### Data & Sync
- ❌ `USE_SYNTHETIC = false` but Firestore `products` collection may be empty — needs sync from Square
- ❌ Category hierarchy in content.ts doesn't match ALL 27 Square categories (missing some sub-categories)
- ❌ No automated Square→Firestore sync schedule — sync is manual via admin button

### Fundraising & Sub-Brands
- 🟡 Fundraising page exists but payment flow untested
- 🟡 Biscuit Hockey + I'M OK R U sub-brand pages exist but are thin (need content from Square)
- ❌ No "Dunphy Stock FAM" dedicated page despite being in featured categories
- ❌ No "GREEN BUDDHA" dedicated page
- ❌ No "Women In Aviation" dedicated page
- ❌ No "ET Art" dedicated page

### Mobile / PWA Experience
- 🟡 Nav dock works on mobile but needs testing on real devices
- ❌ Touch gesture support on customizer not verified (pinch-zoom, two-finger rotate)
- ❌ No splash screen customization beyond manifest

---

## PRIORITY ORDER (Recommended)

### 🔴 BLOCKERS (Can't launch without)
1. **Site config reactivity** — admin changes must take effect without rebuild
2. **Customizer → Cart → Checkout flow** — complete the pipeline with real Square IDs
3. **Payment testing** — at least one sandbox transaction end-to-end
4. **Production deploy** — push commits, deploy to Firebase, configure DNS

### 🟡 HIGH (Degraded experience)
5. **Product JSON-LD** — for SEO and AI agent discovery
6. **Real product mockup images** — replace hero-bg.jpg placeholders
7. **Print zone metadata in Firestore** — per-product coordinate maps
8. **Order confirmation page** — post-payment UX
9. **Firestore product sync** — populate products collection from Square
10. **Brand color/font alignment** — match live Square site (#9d689d / Recoleta)

### 🟢 MEDIUM (Polish)
11. Sitemap.xml + robots.txt
12. Sub-brand pages (Dunphy Stock FAM, GREEN BUDDHA, etc.)
13. Instagram social link in JSON-LD + footer
14. BreadcrumbList JSON-LD
15. PWA install prompt
16. Analytics integration

### ⚪ LOW (Nice-to-have)
17. Live admin preview of config changes
18. Automated Square→Firestore sync schedule
19. Email notifications for orders
20. Touch gesture support on customizer
21. Dark mode brand palette refinement

---

## TECH DEBT
- 5 unpushed commits
- Nav dock position: fragile fixed-wrapper pattern, must not regress
- Square BigInt conversion: priceMoney.amount → Number() — fragile, must maintain
- Synthetic data toggle: flip between test/prod carefully
- serviceWorker: dev mode disables SW, production enables — ensure this doesn't break deploy
