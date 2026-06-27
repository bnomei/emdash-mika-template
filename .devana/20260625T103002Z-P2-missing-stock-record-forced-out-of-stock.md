DEVANA-FINDING: v1
Priority: P2 | Confidence: medium | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:807-823 | Slug: missing-stock-record-forced-out-of-stock

# Missing stock record treated as zero stock, forcing active variants out_of_stock

## Finding

`availabilityFor` looks up a stock item by `sellableId`
(`stockItems().find((entry) => stockRef(entry)["sellableId"] === sellableId)`,
line 808). When no stock row matches, `stock` is `undefined`, `quantities`
falls back to `{}`, and `quantityOnHand`/`quantityReserved` coerce to `0`
(lines 809-811). `availableQuantity` becomes `0` and the status is set to
`"out_of_stock"` (line 818). A sellable that simply has *no* stock record is
thus reported as sold out instead of untracked/available.

## Violated Invariant Or Contract

A sellable with no stock-tracking record should be treated as untracked
(available), not as having zero on-hand. The display layer encodes exactly this
expectation: `mikaTemplateAvailabilityLabel` maps a missing/`"untracked"`
status to "Available now" (`src/lib/display.ts:140,144`), and
`mikaTemplateProductVariantDisplays` only blocks purchase when
`status === "out_of_stock"` (`src/lib/display.ts:244`).

## Oracle

- Neighboring implementation: `display.ts:140` reads
  `sellable.availability?.status ?? "untracked"` and `display.ts:144` lists
  `"untracked"`/`"manual"` as available — the helpers were written to treat an
  absent availability status as available.
- Seed convention: the intentionally sold-out variant `sellable_bw_lettering_license`
  is given an explicit stock row with `quantityOnHand: 0`
  (`seed/mika-actions.seed.json:957-970`). Deliberate out-of-stock is modeled by
  a zero-quantity row, not by omitting the row — so omitted rows are not meant
  to signal sold out.

## Counterexample

`sellableId = "sellable_bw_clip_standard"` (the "Field clipboard" variant,
amount 799, active). It declares `stockItemId: "stock_bw_clip_standard"`
(`seed/mika-actions.seed.json:620`) but no `stock_items` row with that
`sellableId` exists. `availabilityFor` finds nothing →
`status: "out_of_stock"`, `maxPerOrder: undefined`. The variant renders as
unavailable and surfaces as a "no longer available" checkout issue
(`display.ts:105`), so a customer cannot buy it.

## Why It Might Matter

Six of the twelve catalog sellables have no stock row and are all forced to
`out_of_stock`: `sellable_bw_clip_standard`, `sellable_bw_clip_bundle`,
`sellable_bw_pennant_extra`, `sellable_bw_pennant_home`,
`sellable_bw_zine_archive`, `sellable_bw_zine_starter`. Two of these
(`pennant_home`, `zine_starter`) are the products' primary `commerce_ref`
sellables (`seed/mika-actions.seed.json:659,721`). Active, priced offerings are
shown as sold out and blocked from add-to-cart/checkout.

## Proof

Dataflow trace:
- `productSellables` sets `availability: availabilityFor(sellableId)` for every
  variant (`src/lib/mika-fixture-storefront.ts:790`) and `active: true`
  unconditionally (line 785).
- `availabilityFor` (lines 808-818): no matching stock row → `quantities = {}`
  → `quantityOnHand = numberValue(undefined) = 0` → `availableQuantity =
  Math.max(0, 0 - 0) = 0` → `status: "out_of_stock"`.
- Seed cross-check: variant `sellableId`s
  (`seed/mika-actions.seed.json` product `variants[]`) number 12, but
  `stock_items` rows (lines 841-980) cover only 6 sellableIds, leaving the 6
  listed above unmatched.

## Counterevidence Checked

- Verified the 6 unmatched sellables are `active: true` with real prices
  (799/1399/299/etc.), so they are genuinely listed in the catalog yet flagged
  out_of_stock.
- Verified the 6 sellables that DO have rows (e.g. download `panel_pack`,
  on-hand 12) prove stock tracking is not limited to physical goods, so a
  missing row is not an intentional "digital = available" shortcut.
- `numberValue` correctly reads JSON-numeric quantities for tracked rows, so the
  defect is specifically the missing-record-as-zero path, not number coercion.

## Suggested Next Step

In `availabilityFor`, distinguish "no stock record" from "record with zero
on-hand" — return an untracked/available status (or `availability: undefined`)
when no row matches — or add the missing `stock_items` rows for the six
sellables so tracked availability is intentional.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: with no matching stock row, `availabilityFor` fell through to
  `quantities = {}` → on-hand/reserved 0 → `out_of_stock`, forcing 6 active priced sellables (incl.
  primary variants clip_standard/pennant_home/zine_starter) to sold out. `AvailabilityStatus` includes
  `"untracked"`, and the display layer already treats a missing status as untracked/available. Added an
  early return `{ sellableId, status: "untracked" }` when no stock row exists, so absent rows no longer
  block purchase while explicit zero-quantity rows (e.g. lettering_license) still report out_of_stock.
  This also unblocks add-to-cart/checkout for these sellables (the report 6 `isCheckoutLineBlocked` guard
  only blocks `out_of_stock`/over-limit, so untracked passes). Added assertions that clip_standard and
  clip_bundle report `untracked`. `npm test` (22 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:807-823 | P2 | missing-stock-record-forced-out-of-stock
DEVANA-SUMMARY: Status=fixed | P2 medium src/lib/mika-fixture-storefront.ts:807-823 - availabilityFor treated a missing stock record as zero on-hand; now returns status "untracked" (available) when no row matches, while explicit zero-quantity rows remain out_of_stock.
