# Build & Test Pipeline

Measured and reviewed **2026-10-13** on Node 22.23.3 (the version CI uses). Timings are from this
machine and will differ elsewhere; the *structure* findings are the point, not the seconds.

## What actually runs

**Local release**

| Step | Command | Measured |
|---|---|---|
| prebuild | `node scripts/fetch-seo-config.mjs` | 0.3 s (network) |
| prebuild | `node scripts/generate-og.mjs` | 0.5 s |
| build | `next build` (Turbopack; also typechecks) | ~35–70 s |
| postbuild | `node scripts/check-seo.mjs` | 0.3 s |
| hosting predeploy | `node scripts/check-seo.mjs` (added 2026-10-13) | 0.3 s |

**Standalone checks**

| Check | Command | Measured |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ~23 s |
| Lint | `npm run lint` (eslint) | ~40 s |
| Tests | `npm test` (jest + ts-jest) | ~7–11 s |
| All three | `npm run verify` (added 2026-10-13) | — |

**CI** (`.github/workflows/rebuild.yml`, what the admin's Publish button dispatches): `npm ci` →
`npm run build` → an `out/index.html` guard → hosting deploy on the `live` channel. **Nothing else.**

## Findings

### 1. The same type surface is verified three times per release

`next build` typechecks the root `tsconfig.json` (which includes every test file), ts-jest typechecks each
test file again, and `tsc --noEmit` checks the whole project a third time. Only the third is purely
additive — and it is the one that gives fast feedback without a build, so it stays. Not worth "fixing";
worth knowing the build is not your first typecheck.

### 2. No release path could fail on a test or a lint error (FIXED locally, see below)

`rebuild.yml` ran only `npm run build`; `npm run publish` is build + deploy. So the test suite (303 now) and a 40 s lint
pass could not stop a publish. `PROJECT_CONTEXT.md` asserted they "MUST pass" — a rule nobody was enforcing.

### 3. `jest --passWithNoTests` made the test gate vacuous (FIXED)

Verified both ways: a non-matching pattern exited **0** with the flag and **1** without. A gate that passes
when zero tests ran is worse than no gate, because it reads green.

### 4. `fetch-seo-config.mjs` fetches on every build, and cannot fail a build

The network call is unconditional; `[seo-config] unchanged` is decided *after* fetching, by comparing the
rendered snapshot to the file. Cost is ~0.3 s, so this is not a speed problem.

It is a **correctness** problem: when the fetch fails and a snapshot exists, the script logs
`keeping the committed snapshot` and exits 0. CI bakes SEO copy from that snapshot, so a network blip
makes Publish ship copy of unknown age with nothing failing. (A 404 on `config/seo` behaves the same way.)

Deliberately *not* proposed: a `git diff --exit-code` gate on the snapshot to catch drift. Firebase is the
intended source of truth, so the live document diverging from the committed snapshot is normal and correct —
that gate would block publishing every time someone edits SEO in the dashboard.

### 5. `og-image.png` is never validated

`generate-og.mjs` cannot fail the build (`process.exit(0)` unless `--strict`), and `check-seo.mjs` only
asserts the `og:image` tag is present and absolute — it never checks that `out/og-image.png` exists or is a
valid PNG. A missing share card would pass every gate.

In practice the regenerated PNG is **byte-identical** to the committed one, so the file is not a source of
spurious diffs, and the ~0.5 s cost is not worth gating on input changes.

### 6. Functions are compiled twice when following `build:all` then `firebase deploy`

`firebase.json` runs functions `lint` + `build` as its own `predeploy`, so `npm run build:all` beforehand
buys nothing. It also means functions are gated **only** by a full `firebase deploy` — the Publish button is
hosting-only, so a broken function build can sit on `development` unnoticed.

### 7. Hosting had no predeploy guard

`firebase deploy --only hosting` (and `npm run deploy:hosting`) uploaded whatever happened to be in `out/`,
including a stale or half-built export. Functions were always rebuilt; hosting never was.

### 8. `_backups/` was only excluded by `roots`

`jest.config.ts` had no `testPathIgnorePatterns`; the run stayed inside `src` purely because of
`roots: ["<rootDir>/src"]`. `_backups/pre-edit/` holds copies named `*__tests__-*.ts`.

## What changed on 2026-10-13

| Change | Why | Risk |
|---|---|---|
| `"test": "jest"` (dropped `--passWithNoTests`) | A zero-test run must fail | None observed; 20 suites match |
| `npm run typecheck`, `npm run verify` | There was no typecheck script at all; `verify` makes the pre-deploy checklist one command | None |
| `"engines": { "node": "22.x" }` + `.nvmrc` | Encodes the version whose absence cost a session (Known Issue #52) | npm warns rather than blocks |
| `firebase.json` hosting `predeploy: check-seo.mjs` | Every hosting deploy now verifies the export it is about to upload, so a stale `out/` cannot ship silently | A broken export now blocks a deploy — intended. CI is unaffected: the GitHub deploy action uploads directly and does not run `firebase.json` hooks |
| `testPathIgnorePatterns` | Makes the `_backups` exclusion explicit | None |

## Applied since the review (2026-10-16)

| Change | Verified by |
|---|---|
| `npm run verify` (lint + typecheck + tests) runs in `rebuild.yml` before the build | The step is in the workflow; the same command is green locally (303 tests, 2026-11-04) |
| `check-seo.mjs` asserts `out/og-image.png` exists and carries the PNG signature | Canary: with the file removed the gate fails with a precise message, and passes again when restored |
| `fetch-seo-config.mjs` emits a GitHub Actions `::warning::` when it falls back to the snapshot, and takes `--strict` to fail instead | Warning path unchanged in behaviour; `--strict` is opt-in and not wired into CI, because blocking a publish on a transient network error is a worse trade than a visible stale snapshot |
| `next` upgraded 16.2.7 → 16.3.8 | Audit: production findings 10 → 7, **critical cleared**. tsc, lint, the full suite (286 at the time), build (25 pages) and the SEO gate all green; dev server 200 on six routes with no errors in the log |

## Recommended, still open (needs a decision)

1. **Add `npm run verify` to `rebuild.yml` before the build.** This closes finding #2 — the largest
   remaining gap, and the one the docs already claimed was closed. *Why it needs your call:* it puts a
   failing test or lint error directly in the Publish button's path, so a red suite would stop publishing
   until fixed. That is the intent, and the suite is fast and green locally, but it changes your release
   procedure rather than just its internal quality.
2. **Make `check-seo.mjs` assert `out/og-image.png` exists and is a PNG** (§5). Small and safe; I left it
   out only because it was not part of the brief.
3. **Make `fetch-seo-config.mjs` fail loudly when it falls back** (§4) — or record the fallback in the build
   log so a stale publish is visible. The alternative (failing) trades a silent staleness bug for a publish
   blocked by a transient network error.
4. **Drop `build:all` before a full deploy** (§6), or make it the only place functions are built.
5. ~~**`npm audit`**: 10 production-only findings (1 critical in `next`).~~ **FIXED 2026-10-16:** `next` 16.3.8
   clears the critical; 7 production findings remain (1 low, 1 moderate, 5 high, all transitively in `firebase`).
