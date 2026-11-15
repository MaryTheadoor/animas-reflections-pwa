# Product Readiness — 2026-11-14

Snapshot of which products are fit to show publicly, under one shared rule
(`src/lib/product-readiness.ts`). The rule is enforced in **Admin → Products → Launch readiness**:
it previews what would be hidden, writes only after confirmation, and confirms every write against
the server.

Full row-by-row data: `docs/product-readiness-2026-11-14.csv` (377 products).

## The catalogue as it stands

| | |
| --- | --- |
| Products total | **377** |
| Listed (active) | **234** |
| Already unlisted | **143** |
| **Strict rule** (photo + copy + price + stock) | **16 ready · 218 to unlist** |
| **Hard-blockers rule** (price/duplicate/stock/design-record only) | **159 ready · 75 to unlist** |

The gap between the two is almost entirely **missing photos**. That is the whole decision: strict
respects "only fully configured products" but leaves a 16-item shop; hard-blockers keeps 159 items
visible and accepts the placeholder tile while photos are uploaded.

## Blockers among the 234 listed

| Blocker | Products |
| --- | --- |
| No photo of any kind (gallery, front mockup, or per-colour front) | **217** |
| $1 design record, not merchandise (all variants ≤ $1.01) | **55** |
| Description shorter than 20 characters | **47** |
| Tracked stock all at zero | **10** |
| No sellable price at all | **9** |
| Duplicate-looking name (`(1)`, "Copy of", "Test") | **2** |

Warnings (do not hide the product): **119** have no category; **1** has an implausible size
surcharge (`Zip Up Hoodie (1)`: XXL +$17, XXXL +$25).

## Recommended sequence

1. **Before launch, use the hard-blockers rule.** It removes the products that would take money for
   something unfinished — unpriced, $1 design records, duplicates, sold out — and keeps the catalogue
   browsable. Expected: 159 listed, 75 unlisted.
2. **Fix the 9 unpriced products** (list below) and merge the 2 duplicates; those are quick.
3. **Photograph by category, not product.** The Product Photos library applies one blank's photos to
   every product of that blank; with 217 missing images that is the only tractable path.
4. **Switch to the strict rule** once photos and copy are in. Nothing is deleted by either rule —
   unlisted products stay editable and republish with the "Publish N ready" button.

### The 9 unpriced products

Quarter Zip Pullover Style · 3" Dunphy Stock FAM Slap · Grey Youth Short Sleeve (1) · Black DLC Logo ·
Glass Ornament 4" Tall · Grey Zip Up Hoodie · Hoodie Unisex · Hoodie Unisex Grey Durango Roller Girls

### The 10 out-of-stock products

The seven resin/jewellery pendants, two "Limited Edition Only 15 Available" lanyards, and the Aspen
Leaf necklace — all tracked at zero.

## Reproducing this

The CSV was produced read-only from the public catalogue with the same predicates as the library.
The living tool is the admin panel; there is deliberately no second copy of the rule in a script,
because two copies of a policy drift.
