# Security Audit — 2026-11-19

Live targets: `https://animas-reflections-pwa.web.app`, Firestore/Storage/Auth REST,
`https://us-central1-animas-reflections-pwa.cloudfunctions.net/*`. Repo at commit
`e404107` (branch `development`). Method: anonymous black-box probes against the
**deployed** rules and functions, deployed-bundle secret scan, tracked-file secret
scan, code review of the money path, and `npm audit` for root and `functions/`.
No accounts created, no documents written, no orders placed, no cards charged.

## Verdict

No exploitable confidentiality or integrity hole found. Deployed Firestore rules
(13/13 probes), Storage rules (6/6), admin-function gating (5/5), payment
price re-derivation, and secret hygiene all pass. One **high-severity functional**
finding (`createSquareOrderAndPay` IAM), two medium/low hardening items, and a
dependency backlog follow.

## PASS — verified against production

| Area | Evidence |
| --- | --- |
| Firestore rules | `config/admin` and `secrets/githubPublish` anonymously unreadable (403); `config/site`/`config/seo`/`products`/`designs`/`product_photos` public; `orders`/`users`/`customers` 403; default-deny read AND anonymous create both 403. The gotcha-#2 `config/admin` leak has not regressed. |
| Storage rules | `products/`, `designs/`, `product-photos/` anonymously listable (public by design); `uploads/` 403; anonymous upload to `products/` and to the bucket root both 403. Endpoint note: rule probes must use `firebasestorage.googleapis.com/v0/b/animas-reflections-pwa.firebasestorage.app/o` (the `.appspot.com` bucket and `firestoraged` host both 404). |
| Admin function gating | `saveSiteConfig`, `fetchRecentOrders`, `savePublishToken`, `syncMyAdminClaim` all reject anonymous callers with `PERMISSION_DENIED`; `requireAdmin` additionally requires a **verified** email. `fetchSiteConfig` public by design. |
| Payment integrity | `createSquareOrderAndPay` re-derives every price/add-on/shipping from Firestore (`deriveOrder`), rejects `expectedTotal` divergence >2¢, validates line count (≤50), `sourceId`, and `idempotencyKey` before any Square call. Empty payload is rejected before Square is contacted. |
| Customer data isolation | `fetchCustomerOrders` keys off `request.auth.token.email` (not client-writable `users/{uid}`); addresses/profiles require auth and are uid-scoped. |
| Secret hygiene | Tracked files: only a `github_pat_...` **placeholder** string. `.env*` ignored, `functions/.env` holds the Square production token. Deployed JS bundles (16 files + inline) contain only the Firebase web key, Square App ID, and Location ID — no `EAAA…` token, no PATs, no private keys. |
| Auth | Email-enumeration protection ON: password reset for a random unknown address returns 200, not `EMAIL_NOT_FOUND`. |
| Hosting | HSTS (`includeSubDomains; preload`); true 404s for unknown URLs (no soft-404 rewrite); `sw.js` `no-cache`; JS assets `immutable`. |
| XSS posture | Rich-text descriptions render via `DOMPurify.sanitize` (default mode — the 2026 DOMPurify `IN_PLACE` criticals do not apply); cards/search use `stripTags`; JSON-LD escapes `<`. |

## Findings

### F-1 · HIGH (functional, revenue) — `createSquareOrderAndPay` denies guest callers at the IAM level

An unauthenticated POST to the callable returns Google's frontend **403 HTML**
("Your client does not have permission…"), not the callable protocol's JSON error
that every sibling function returns. The deployed function therefore lacks the
`allUsers` invoker binding while the code comment says "this endpoint is
unauthenticated" and checkout has **no sign-in gate** — guests cannot pay even
after the Square card-form 401 (LIVE_SITE_AUDIT P0) is fixed. This is
fail-closed (no data exposure), but it is an independent second checkout blocker.

**Fix:** `gcloud functions add-iam-policy-binding createSquareOrderAndPay
--region=us-central1 --member=allUsers --role=roles/cloudfunctions.invoker`
(or redeploy the function with the CLI and answer "allow unauthenticated"), then
re-probe: anonymous POST should return the callable JSON error
("Order must contain at least one line item"), not HTML.

### F-2 · MEDIUM (hardening) — no CSP or standard security headers on hosting

`X-Frame-Options`/frame-ancestors, `X-Content-Type-Options`, `Referrer-Policy`,
and `Permissions-Policy` are absent; no CSP. HSTS is present (Firebase default).
A static storefront lowers the practical risk, but clickjacking and MIME-sniffing
protection are cheap: add a `headers` block to `firebase.json` (start CSP in
`Content-Security-Policy-Report-Only` to tune it against the Next.js bundle).

### F-3 · LOW — homepage served with `cache-control: max-age=3600`

`/` does not match the `**/*.@(html|json)` glob (the URL has no `.html`), so the
must-revalidate rule misses it and Firebase's default 1h applies — content edits
(up to and including emergency unlisting) can lag an hour. Add an explicit
source for `/` and `**/` alongside the extension globs.

### F-4 · LOW — `squareDiagnostics` is an unauthenticated paid-API trigger

Each hit performs a Square `locations.list` with the production token. It leaks
nothing (booleans + an already-public location id), but an anonymous caller can
burn Square quota / function invocations. Consider admin-gating it now that the
checkout diagnosis is done, or rate-limiting.

### F-5 · LOW — `saveCustomerAddress` accepts unbounded strings

Auth-scoped and uid-namespaced, but no field-length caps; a signed-in user can
store ~1MB address docs repeatedly. Add per-field caps (e.g. 200 chars).

### F-6 · INFO — admin email ships in the client bundle

`NEXT_PUBLIC_ADMIN_EMAIL` (mary.theadoor.doctor@gmail.com) is compiled into the
deployed JS — a targeted-phishing vector. It gates UI only (all real checks are
server-side), so this is acceptable, but it could be dropped in favour of
`config/admin` + the admin claim, which the code already supports.

### F-7 · INFO (dependencies) — `npm audit` backlog

Root (runtime): 8 vulns — 2 critical (`dompurify` IN_PLACE XSS variants — **not
applicable**, we use default-mode sanitize; `next` image-optimization RCE/Server
Actions DoS — **not applicable** to a static export with no server runtime),
5 high (`@grpc/grpc-js` ×2 via `@firebase/firestore*`, `source-map-js`,
`firebase`), 1 moderate. `functions/` (runtime): 17 vulns — 1 critical
(`proxy-addr` IPv4-mapped IPv6 spoofing — low impact on Cloud Run direct
ingress), 6 high (`axios`, `@fastify/busboy`, `body-parser`, `follow-redirects`,
`form-data`, `@grpc/grpc-js`). None is a demonstrated exploit path today; run
`npm audit fix` in both trees and re-run the verification gate when convenient.

## Reproducing the probes

All probes were plain `fetch` from Node (no Firebase SDK): Firestore REST with
`cache: 'no-store'` ( Firestore REST GETs can otherwise be cache-served);
Storage REST against `firebasestorage.googleapis.com`; callable POSTs of
`{"data": …}` with `content-type: application/json`; bundle scan downloads every
`<script src>` from `/`, `/checkout/`, `/admin/` and greps for
`EAAA…`/PAT/private-key/API-key patterns. Session artifacts:
`C:\Users\AmosA\Projects\.tmp-animas-security\` (not committed).

---

## Fix pass — 2026-11-19

Independent re-probe of F-1 confirmed it exactly: `createSquareOrderAndPay` answers an anonymous POST
with Google's **403 HTML**, while a sibling callable returns `{"error":{"message":"Authentication
required","status":"PERMISSION_DENIED"}}`. It is an IAM/invoker problem, not application code.

| Finding | State |
| --- | --- |
| **F-1** `createSquareOrderAndPay` invoker binding | **OPEN — needs the project owner.** `gcloud` is not installed on this machine and the IAM change requires an authenticated owner. Run:<br>`gcloud functions add-invoker-policy-binding createSquareOrderAndPay --region=us-central1 --member=allUsers`<br>(Console alternative: Cloud Functions → createSquareOrderAndPay → Permissions → add `allUsers` as Cloud Functions Invoker.) Re-probe: an anonymous POST must return the callable JSON error, not HTML. |
| **F-2** missing security headers / CSP | **FIXED** — `firebase.json` now serves `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that disables camera/mic/geolocation/payment/usb, and `Content-Security-Policy-Report-Only` covering self, Square's SDK/PCI hosts, Google APIs and Firebase Storage. Verified live on `/` and `/shop/`. |
| **F-3** homepage cached for an hour | **FIXED** — a catch-all `**` rule sets `public, max-age=0, must-revalidate`, so `/` and every directory URL are included. Verified live: `/` now returns `max-age=0, must-revalidate`. |
| **F-4** `squareDiagnostics` open to anonymous callers | **FIXED** — the endpoint now verifies a Firebase ID token (`Authorization: Bearer …`), requires a verified email and accepts only the `admin` claim, a `config/admin` entry or the bootstrap address. Verified live: anonymous → `403 {"error":"Admin access required"}`. |
| **F-5** unbounded customer strings | **FIXED** — `saveCustomerAddress` and `saveCustomerProfile` reject any string field over 200 characters. |
| **F-6** admin email in the bundle | **Accepted** — it gates UI only; every real check is server-side. Dropping it is a later tidy-up, not a launch item. |
| **F-7** dependency backlog | **IMPROVED** — `npm audit fix` in both trees: root **8 → 4 high, no criticals**; `functions/` **17 → 11 moderate, no criticals**. The remainder requires breaking upgrades (`next`, `firebase`, `axios`, `grpc-js`); schedule that after Black Friday with a full gate, not during freeze. |

Gate after the pass: tsc 0 · lint 0 · 440 tests / 29 suites · 28-page build, SEO OK · functions compile clean.
Deployed: functions + hosting.
