# Status Sweep — 2026-10-06

Prepared for a client meeting. Purpose: one place that states what is live, what is
built but not live, what is broken or at risk, and what only the client can answer.

Scope: verified against the repository, the emitted build, and the live production
site on 2026-10-06. Branch `development` @ `7e71997`.

---

## 1. Headline: two divergent lines of work

The repository has **two lines of work that forked on 2026-08-25 (`b66bf3e`)** and
never rejoined. Both continued forward independently, and **both used session numbers
30–33 in `docs/DEVLOG.md`**, so the log cannot be read by number alone.

| | Line A — "SEO/CMS + a11y" | Line B — "Content & Theme + catalog tooling" |
|---|---|---|
| Branch | `development` (working tree) | `origin/master` |
| Commits since fork | **13** | **20** |
| Dates | 2026-09-16 → 2026-10-05 | 2026-09-08 → 2026-09-09 |
| Content | Nown S.I.T.E.S SEO, CMS-managed SEO, keyword landing pages, SEO gate, OG card, admin storage-claim fix, e-commerce re-scope proposal, **a11y contrast pass** | Auth/security unify + reusable colour library, CSV catalog import, server-side inventory enforcement, modifier groups, Help Hub, **Content & Theme editor (phases 1–3)**, visual print-zone editor, rich-text headings/links, `PROJECT_ANALYSIS.md` |
| Claims live? | Yes — and **verified live now** | Yes ("hosting deployed live", all 4 sessions) — **but verified NOT live now** |

### Which line is actually in production? Line A.

Verified by inspecting the live admin JS bundles on 2026-10-06:

- **Line A strings are present live:** `Keyword pages`, `Rebuild access`, `Thin content`,
  `Publish`; live `sitemap.xml` has Line A's 16 URLs; `/services/` and the three
  `/…-durango/` keyword pages return 200.
- **Line B strings are absent from every live bundle:** `Import your catalog from a CSV`,
  `Missing product name`, `Build the matrix`, `Heading font`, `isfeatured` → 0 hits
  across all 11 admin chunks.

**Consequence:** every feature Line B built is **not available in production today**,
despite its own log recording four separate "deployed live" verifications. Either those
deploys were later overwritten by Line A's deploys, or the claim was inaccurate.
It cannot be settled from the current state which happened — but the current fact is
unambiguous: **Line B's work is not live.**

---

## 2. What is live in production right now

Deployed 2026-10-06 from `development` @ `7e71997` (hosting only; no rules or functions
deploy in this pass).

- **26 static pages**, 20 route directories, incl. `/services/` hub + 3 CMS keyword landing pages
- CMS-managed SEO (Admin → SEO tab), `sitemap.xml`, `robots.txt`, generated OG share card
- Privacy Policy page (`/privacy`) with Square cookie disclosure + Colorado Privacy Act rights
- Accessibility pass: zoom enabled, visible focus rings, skip link, cart drawer dialog
  semantics + Escape + focus trap, customizer arrow-key repositioning, WCAG AA contrast
  across the palette
- 18 Cloud Functions deployed, all Gen 2, `us-central1`, Node 22 (**not** redeployed today)
- `health` endpoint live: `{"status":"ok","squareConfigured":true}`

**Deployed vs local today:** hosting deployed; `functions/`, `firestore.rules`,
`storage.rules` **unchanged** by this pass. Repo branch state: `development` pushed;
**local `master` could not be pushed — it has diverged from `origin/master`
(13 vs 20 commits), and I did not force-push.**

---

## 3. Blocking risk: the two lines cannot be merged naively

Merging `origin/master` into `development` touches **18 shared files** and contains at
least three places where Line B's version would **re-break something Line A fixed**.

| # | File | Line B | Line A (current, verified working) | Risk if merged naively |
|---|---|---|---|---|
| 1 | `storage.rules` | `firestore.exists(/config/admin)` | custom claim **or** bootstrap email list | Line A verified live that cross-service `firestore.exists()` returns **false for every path** → admin uploads would 403 again |
| 2 | `functions/src/index.ts` | **removed** `publishSite`, `savePublishToken`, `syncAdminClaims`, `syncMyAdminClaim`, and the `@animasreflections.com` wildcard | has all of them; the publish pipeline and admin claims depend on them | Admin → SEO → Publish stops working; admin claim minting stops |
| 3 | `src/app/globals.css` + theme | **editable theme system** (`src/lib/site-defaults.ts`, 12 tokens incl. `goldDeep`), hardcoded dark overrides **removed** from `globals.css` | Line A just added `gold-ink`, `on-gold`, `danger` tokens + dark remapping in `globals.css` | Two competing theme mechanisms; Line B's editable theme has no knowledge of Line A's new tokens (and vice versa) |

Also both lines edited `devlog.md`, `PROJECT_CONTEXT.md`, `product-manager.tsx`,
`auth-context.tsx`, `product/page.tsx`, `admin/page.tsx`, and 8 page files.

**Recommendation:** treat reconciliation as a deliberate, tested task on its own branch —
not a merge commit. Sequence: (1) branch off `development`; (2) merge `origin/master`
resolving the three items above **in favour of Line A's verified behaviour**, then
re-add Line B's features on top; (3) re-verify the theme system actually applies Line A's
new tokens; (4) full lint/test/build + live admin smoke test before it reaches `master`.

---

## 4. Outstanding issues

### 4.1 Launch blockers (P0)

| ID | Issue | Note |
|---|---|---|
| G2 | **Checkout has never been tested end-to-end with a real card** | Open since Session 12. Also the only way to settle §4.2 item 1. Highest priority. |
| G1 | Real catalog is still a manual rebuild | Who populates it, and when? |
| G4 | Product images are manual per-product uploads | |
| G5 | Blank mockup images for the customizer | |
| G15 | Lighthouse PWA audit (target 90+) | Never run |
| G20 | DNS cutover `animasreflections.com` → Firebase Hosting | Currently on Square Online |
| G21 | Analytics integration | Adding it would require revisiting cookie consent |
| G19 / G22 / G23 | Cross-browser, iOS Safari PWA install, Android Chrome PWA install | Never run |

### 4.2 Commercially critical — verify before launch

1. **Is live checkout charging real cards, or is it still on Square sandbox?**
   `src/lib/constants.ts:22-23` falls back to `"sandbox"`, and `functions/src/index.ts:23`
   defaults the server param to `"sandbox"` too. `.env.local` and `functions/.env` do set
   the Square keys, but their values are in secrets files and were **not** read.
   The `health` endpoint returns only `squareConfigured:true`, which does not reveal the
   environment. **Cannot be determined from outside — must be verified.** The G2 test is
   the way to do it.
2. **20 npm audit findings** — 1 **critical** (`next@16.2.7`), 7 high (`firebase`,
   `sharp`, `postcss`, `source-map-js`), 3 moderate, 1 low. Production-only view:
   10 findings. `next@16.3.x` upgrade clears the critical.
3. **Domain inconsistency in published legal copy** — `src/lib/seo.ts:30` uses
   `https://www.animasreflections.com`, but `src/lib/content.ts:291` (Terms §10) and
   `:314` (Privacy "Who We Are") both reference `https://animas-reflections-pwa.web.app`.
   Also inconsistent with the pending DNS cutover.
4. **Terms §2 advertises PayPal**, but checkout is Square-only
   (`PAYMENT_METHODS` at `src/lib/content.ts:359-368` has no PayPal).

### 4.3 Accessibility

- **Dark-mode counterpart audit** — open since Session 14 and still unstarted. The
  contrast pass fixed the light palette and prevented dark regressions, but dark mode
  has never had its own audit.
- `_webbridge/contrast.py` (the audit script) has a stale colour list — it predates
  `gold-ink`, `on-gold`, and `danger`.

### 4.4 Code quality / tech debt

- `product-manager.tsx` is ~1.8k lines — flagged for splitting by both lines independently
- ~15 non-test `console.*` statements in `src/` and `functions/src/`
- `functions/lib/` holds **stale compiled orphans** for deleted modules (`sync.js`,
  `product-pipeline.js`)
- Order pagination is hardcoded (`admin` `PER_PAGE = 15`)
- Per-variant inventory: Line B added **reject-only** enforcement server-side
  (out-of-stock variants are refused at checkout) but **no stock decrement** — selling
  does not reduce stock, so overselling is not prevented
- `SQUARE_ENV` is exported but never consumed anywhere in `src/` — dead code
- Hardcoded admin fallback email at `src/lib/constants.ts:18`

### 4.5 Documentation debt

| Doc | Problem |
|---|---|
| `docs/GAP_ANALYSIS.md` | **2 months stale** (refreshed 2026-08-06). Predates all SEO/CMS + a11y work. |
| `docs/PROJECT_STATUS_REPORT.md` | **Counts wrong:** claims 48 tests (actual **109**), 14 functions (actual **18**), 22 pages (actual **26**), and says "clean on master" (actually dirty `development`) |
| `docs/SCOPE.md` | **Counts wrong:** 14 functions (actual 18), 4 test suites (actual 9), 8 admin tabs (actual **9** — SEO tab missing), and cites `USE_SYNTHETIC` in the wrong file (`useCatalog.ts`; it lives in `catalog-context.tsx:20`) |
| `docs/DEVLOG.md` | **Session numbers 30–33 collide** between the two lines |
| `docs/ECOMMERCE_RESCOPE.md` | Accurate; it is a proposal, not implemented |
| `_webbridge/contrast.py` | Stale colour list (see 4.3) |

### 4.6 Long-standing operational

- `scripts/backup-commit.ps1` is unusable (CRLF stderr handling) — plain `git` is the workaround
- Untracked 230 MB `animas-reflections-pwa.zip` in the repo root
- `npm run build` regenerates `src/lib/seo-content.generated.ts` with **LF** into a CRLF
  repo, leaving the tree permanently dirty after every build (content is identical;
  line endings only)

---

## 5. Questions for the client

Grouped so the meeting can be short. Items marked ★ block work that is already built.

### A. Business facts (needed for schema, contact page, legal copy)

1. ★ **Street address and ZIP** for the shop? Needed for the LocalBusiness schema
   (currently omitted rather than invented) and the Contact page.
2. **Opening hours** — or is it appointment-only / online-only?
3. Is there a **physical location** customers visit, or is it online + local pickup?
4. ★ **Which social accounts are official?** `SITE.socials` lists **Instagram only**, but the
   fundraising page lists **Facebook and Instagram**. Which, and what handles?
5. Confirm the **phone (970-769-2779) and email** on the site are the right public contacts.

### B. Catalog and brand taxonomy

6. ★★ **"Biscuit Hockey" — a brand/collection, or a product category?** This has been
   carried as an open question since Session 16 (~8 sessions). It blocks the browse-by
   taxonomy.
7. **Full list of brands/collections** she wants the "By Design / Brand" browse to show.
8. Which products should be the **6 homepage featured** items?
9. Does she have **product photos** ready, or does every item need shot/uploaded (G4/G5)?

### C. Content and legal

10. ★ **Approve the Privacy Policy draft?** (It is live now; written from the stack facts —
    Firebase + Square, no analytics.)
11. **Is the Terms of Sale still accurate?** It is dated March 2021. Any changes to
    returns, shipping, or the FOB-origin terms?
12. **PayPal** is advertised in Terms §2 but the checkout only takes Square — keep or remove?
13. **Which search terms** would she most want to rank for? Three keyword pages exist as
    proof (embroidery, t-shirt printing, corporate apparel) — what else?
    e.g. "Durango hoodies", "school spirit wear", "team uniforms"?
14. Fundraising page: confirm the **50/50 profit split** wording and whether any partner
    organizations should be named.

### D. Commerce decisions

15. ★ **Checkout direction:** keep the current on-site card form, or move to
    **Square-hosted checkout** (per `docs/ECOMMERCE_RESCOPE.md`)? Trade-offs are written
    up in that doc.
16. **Can we run one real card transaction** to prove checkout end-to-end (G2) and confirm
    whether the site is currently live or on sandbox? This is the single highest-value
    verification outstanding.
17. Are products **print-on-demand**, or is there **real stock** to track? This decides
    whether per-variant inventory is worth finishing (Line B built it, but nothing
    decrements stock).
18. Are **orders mirrored into Firestore** wanted for the admin Orders tab, or is the
    Square Dashboard enough?

### E. Operations

19. ★ **Who populates the real catalog**, and by when (G1)?
20. ★ **Approval to delete stale test data:** duplicate empty product docs + the
    "test 31" product, from Patch 5.
21. **Which emails need admin access?** (Managed in Admin → Admins.)

---

## 6. Suggested immediate sequence

1. Get answers to ★ items in §5 — several unblock already-built work.
2. Run the G2 real-card test — settles §4.2 item 1 and the checkout direction question.
3. Reconcile the two lines on a dedicated branch, per §3 — before any further feature work.
4. Refresh `GAP_ANALYSIS.md`, `PROJECT_STATUS_REPORT.md`, and `SCOPE.md` to match reality.
5. Then the remaining launch tasks: G15, G19/G22/G23, G20, G21.
