# Square Online vs this catalogue — parity report

**Run 2026-11-26** against `https://www.animasreflections.com` (its `sitemap.xml`) and the live
Firestore catalogue at 374 products. Companion data: `docs/square-parity-2026-11-26.csv`, one row
per Square product, with its match in this catalogue, whether it is listed, how many photos it
has here, and whether a photo was recoverable from the Square page.

## Headline: the product data is already ~96% here. Photography is the blocker.

| | Count |
|---|---|
| Product URLs in Square's sitemap | 452 |
| Unique Square products (44 slugs appear under several ids) | **334** |
| Square products already present in this catalogue | **320** (288 with an exact slug match) |
| Square products with no counterpart here | **14** — of which about 6 are real gaps (§3) |
| Products in this catalogue | 374 |
| Listed here today | **16** |

So "are we launching with the same inventory?" is answered in two halves:

- **Catalogue coverage: yes.** Almost everything Square sells exists in Firestore already, with
  prices, variants, descriptions, categories and Square variation ids.
- **Sellable presentation: no.** Of the 320 matched products, **309 have no photo**, and only 9 of
  them are currently listed. The 16 listed products are the ones that pass the strict readiness
  rule.

## 1. Why the shop is 16 products and not 320

Not missing data — missing images. The launch-readiness rule (`src/lib/product-readiness.ts`)
refuses to show a product with no photo, and the 2026-11-24 unlist therefore hid 215 products.
Everything hidden is editable and one click from returning.

| Blocker among the 231 that were listed | Count |
|---|---|
| no photo | 214 |
| no category (warning, not a blocker) | 250 |
| little or no description | 47 |
| $1 design record | 55 |
| no sellable price | 9 |
| out of stock | 10 |
| duplicate-looking name | 2 |

## 2. Recovering the photos from Square

Every Square product page carries at least one product photo in its `og:image` meta tag, so the
photography for most of the 309 is **already published** — it does not need shooting.

The crawl is rate-limited, though. A first pass at 8 concurrent requests drew **375 HTTP 429s out
of 452**; a polite sequential retry stalled after a handful of pages. Only 24 pages yielded an
image before the site stopped answering.

Three ways forward, in order of how little they cost:

1. **Square Dashboard → Items → Export.** The item library export carries an image URL column.
   One file, no rate limit, every product, and it is the same export the catalogue was originally
   built from. This is the recommended route.
2. **A slow crawl** (1 request every 2–3 seconds, ~15–20 minutes, off-peak) of the sitemap's 334
   unique products. Viable, but it is scraping her shop and depends on the CDN staying friendly.
3. **Photograph the gaps** later; not needed for parity, since Square already has them.

Either way the images arrive as URLs, and this site renders an image URL directly, so they can be
applied without re-uploading — though a copy in Firebase Storage is the durable choice, since a
Square CDN link dies when Square Online is turned off.

## 3. The 14 Square products with no counterpart

All 14 were checked by name against the catalogue. Most are naming differences, not gaps.

**Already covered here, under a different name (4):**

| Square | Here |
|---|---|
| `yupoong-6089m-wool-blend-snapback` | The Yupoong 6089M Wool Blend Snapback With Patch (listed) |
| `gwr-hockey-sweater-aka-jersey-copy` | Little Stranger Hockey Sweater AKA Jersey — note the `-copy`, a Square duplicate |
| `50-x-60-woven-blanket` | Shrooming Stranger 50 x 60" Woven Blanket |
| `car-flag` | Deluxe 2 Sided Car Flag With Pole |

**A size or colour variant of something we carry (3):**

| Square | Nearest here | Difference |
|---|---|---|
| `110-piece-puzzle` | 120 Piece Puzzle (listed) | piece count |
| `2-5-slap` | 2 Inch Slaps / Slaps AKA Stickers | 2.5" size |
| `12-x-4-custom-banner-4-groomets` | 6 x 2' Custom Banner 4 Groomets, 2' x 4' Banner With Groomets | 12x4 size |

**Genuine gaps — Square sells these and the catalogue has nothing equivalent (5–7):**

| Square | Note |
|---|---|
| `11-x-17-custom-24lb-poster` | no poster product at all |
| `wooden-dugout-kit` | nothing similar |
| `2-line-name-drop` | nothing similar |
| `2024-4th-annual-danger-durango-invitational-t-shirt` | a 2024 event shirt — may be deliberately retired |
| `giant-walking-robots-bic-lighter` | we carry five Bic Lighters, not this design |
| `marble-white-bella-canvas-star-waker-t-shirt` | a specific colourway/design on the Bella + Canvas blank |
| `snap-back-hat` | ambiguous — may be the generic version of the Yupoong |

**Recommendation:** add the poster and the dugout kit if she still sells them, treat the 2024 event
shirt as retired unless she says otherwise, and confirm the two Bic/tee designs. That is a
short list, and none of it blocks a launch.

## 4. What this means for a Cyber Monday launch

The catalogue is ready; the presentation is not. Two honest options:

- **Launch with the 16** (today's state). True to the readiness rule, nothing looks broken, and the
  shop is very thin — 14 of the 16 are Little Stranger.
- **Recover the photos from Square (route 1 above), apply them, and relist.** This is the only path
  that reaches parity with the Square site before Monday, and it needs no new photography. It
  requires the item export, plus a way to attach images in bulk — which is the import work in
  `docs/CATALOG_IMPORT.md`.

The bulk-attach step is the reason the import's image handling matters now: attaching 300 images
one product at a time through the admin is the single largest piece of manual work in the way.
