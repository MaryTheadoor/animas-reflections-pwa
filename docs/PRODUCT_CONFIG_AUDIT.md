# Product configuration audit — the 16 listed products

**Run 2026-11-26** by loading every listed product in a real browser and reading its option
structure out of the DOM and out of Firestore. Method: the same rules the product page applies
(`hasGenericVariants`, `withoutVariantDuplicates`, `groupModifiers`), so what this lists is what a
shopper sees.

Trigger: the owner tried a live purchase and reported that options "don't make sense" and that
colour allows more than one selection even on products with photos.

## 1. The one defect that was code, not data — FIXED

The product page rendered **every** modifier group as a checkbox list. The comment said so:

> Every group is multi-select, exactly as the customizer renders it, because a toggle is what the
> cart can express as an add-on.

That reasoning is right for an add-on and wrong for a choice. Every listed product with options
therefore let a shopper order *"Please Select Color: Black, Red"*, *"Adult Size: Small, Large"*,
*"Please Select Design: Area 51, Blue Bird"* — and the cart stored all of it, because each modifier
already becomes a separate add-on line.

Square records this per modifier list (`selection_type: SINGLE | MULTIPLE`); the import never
carried it, so the distinction was lost at the door.

**Fix.** `ModifierGroup` gained `selectionType`, defaulted by `singleSelectByName` — a group whose
name mentions size, colour, design, logo, shape, style, placement, background, patch, fit,
material or length is a **single** choice; everything else stays multiple, so the change can only
narrow a choice, never widen one. `toggleSelection` replaces within a single group instead of
adding, and the UI now shows a radio and the words "choose one".

Verified live on `15 oz Coffee Mug`: clicking Blue then Red leaves **only Red** selected, where
before both were ticked. 7 new tests.

**Not yet done:** an explicit override per group in the admin, and importing Square's own
`selection_type` so a genuinely multi-choice group whose name looks like a choice ("Logo Options"
when several logos may be added) is not mistaken for single.

## 2. What is still wrong, and it is data

The 16 products were imported from Square with Square's modifier lists intact. Square lets a
merchant build a list called anything and hang 8 options off it, and that is exactly what was
imported — including duplicated dimensions and list names written for a human reader rather than
a shop.

| Product | What a shopper actually sees | Class |
|---|---|---|
| Bella + Canvas Unisex Jersey T-Shirt | Adult Size (8) · **Please Select Color (3)** · **Please Select Design (4)** · Add Name & Number To Back… (2) · Add Name Or Number Under Logo… (1) · **Logo Options (8)** · **Please Select Logo Design (9)** | redundant groups |
| Adult 9 oz. Supercotton Pullover Hood | Adult Size (8) · Logo Options (8) · Please Select Color (3) · Please Select Logo Design (9) · Please Select Design (4) · Please Select Logo Placement Option (3) | redundant groups |
| Adult Lightweight Hooded Sun Shirt UPF 44+ (1) | **Please Select Color (3)** · **Please Select Color Choice (4)** · Please Select Option Below (3) · Adult Size (8) · Logo Options (8) · Please Select Design (4) | duplicate dimension |
| The Yupoong 6089M Snapback | four **variant** colours (Grey/Black/Blue/Red) *and* four `colors` swatches for the same four | duplicate dimension |
| 4 Inch Slaps | 12 variants, most named "4 Inch Slaps 1 - 25 Unit Price" | price tiers as variants |
| Coffee Cup 15 oz · 3" Lace Ornament · 4 in 1 Speaker Cooler | one variant named **"Price"** | placeholder variant |
| 120 Piece Puzzle | one variant named **"Base Price"** | placeholder variant |
| Bella + Canvas · BBall Jersey · Sun Shirt · Pullover Hood · Drink Huggers · LITTLE STRANGER | four to six variants all named **"Regular"** | placeholder variant |
| Bella + Canvas (and others) | group named "Add Name & Number To Back, Sleeve, Pant, Slap, Flag,Chair, Frisbee" — a merged list with a missing space | garbled name |
| Sun Shirt (1) | group named **"Please Select Option Below"** | meaningless name |
| Custom Flag | a modifier group literally named `(none)` | garbled name |

### The five classes, in order of how much damage they do

1. **Redundant overlapping groups** (4 products). Three different "pick a design/logo" groups on
   one shirt. A shopper cannot tell which one to use, and the cart records two.
2. **The same dimension offered twice** (Yupoong colours; "Color" and "Color Choice"). The variant
   picker and the swatches fight, and `effectiveColor` has to guess which one the photo follows.
3. **Placeholder variants** (10 products). "Regular", "Price", "Base Price" render as buttons that
   say nothing. `hasGenericVariants` hides the picker in most cases, so this is often invisible —
   which is worse, because it means the price and the size come from different places.
4. **Price tiers modelled as variants** (4 Inch Slaps). Twelve buttons where five quantity breaks
   are meant; the buttons cannot be understood from their labels.
5. **Group names that were written as instructions to a human** ("Please Select…", "…Please Type
   Below"). They read as shouts on a shop page.

## 3. Fix roadmap

### Now (before Monday)
- **Done:** single vs multiple choice groups (the only true bug).
- **Data, ~2 hours of admin work on 16 products:** delete the redundant design/logo groups so each
  product has exactly one design choice and (optionally) one logo choice; collapse "Color" +
  "Color Choice" into one; rename `(none)` and "Please Select Option Below". None of this needs
  code, and `docs/PRODUCT_READINESS.md` already flags the products.
- **Decide the variant model.** Either real variants (Size × Colour from `variants` with real
  option dimensions) or modifiers, not both. The CSV import already builds variant dimensions from
  labels like "L / Navy", so a corrected sheet fixes this in bulk.

### Next (the remaining 300+ products)
1. **Import Square's `selection_type`** so single/multiple comes from the source of truth rather
   than a name heuristic, and add a per-group override in the editor.
2. **A one-off normaliser** that cleans imported data mechanically: drop a group whose options are
   all already variant names; merge "Color"/"Colour"/"Color Choice"; strip a leading "Please
   Select " from group names; flag a group named `(none)`.
3. **Editor guard rails**: warn when a product has two groups whose options overlap by more than
   half, when a variant name is a placeholder, and when a group has one option (a single-option
   group is always a data error).
4. **Then bulk-apply blanks and relist** — `docs/SQUARE_PARITY.md` §2, which is blocked on the
   Square item export, not on code.

## 4. On automating this with an agent

The owner's instinct — "Cindy uploads photos with tags and writes plain-English product intent, the
agent does the rest" — is the right shape for the 300 products, with one hard boundary.

**What is safe to automate, and it is most of the tedium:**

- Renaming groups ("Please Select Color" → "Color"), stripping "Please Type Below", merging
  duplicate dimensions, deleting empty groups. These are mechanical, reversible transformations of
  a product document, and the rule set can be tested exactly like `singleSelectByName` was.
- Attaching photos: the library already groups by blank, and `setsForProduct` already picks the
  right blank for a product type and category. Tagging a photo with its blank, view, colour and
  category is enough for the agent to fill every product of that type — that part is **already
  built** and needs no AI at all.
- Building variants from a description ("this hoodie comes in black, navy and grey, S to 2XL at
  $42, 2XL +$3") — a model is genuinely good at this, and it produces a *proposal* a human
  approves.

**What must not be automated unattended:** prices, and which design belongs to which product.
Both are money. A reviewer approving a diff, not an agent writing directly, is the boundary — the
same preview-then-apply pattern the bulk tools already use.

**Shape that fits what exists:** an `proposeProductFixes` callable that returns a *diff per
product* (fields changed, reason, confidence), rendered in Admin → Products as a review list with
Accept / Edit / Skip. It writes nothing. Cindy's plain-English intent and her photo tags become the
input; the approve step stays hers.

That is a real feature, not a research project — but it should be built **after** Monday, because
the 16 listed products need human judgement on what they are meant to sell, and no agent can
supply that.

The read-only assistant in `docs/AI_ASSISTANT_FEASIBILITY.md` is the right v1 for "she is stuck,
answer from the docs"; this proposal is v2 for "do the repetitive part for her". They share the
knowledge pack and neither writes.
