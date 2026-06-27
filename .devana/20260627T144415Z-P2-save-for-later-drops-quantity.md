DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:331-346,315-326 | Slug: save-for-later-drops-quantity

# saveForLater discards cart line quantity on round-trip

## Finding

`wishlist.saveForLater` copies only `sellableId`, `priceId`, and `addedAt` into
the wishlist item; cart line `quantity` is dropped. `wishlist.moveToCart` then
defaults missing quantity to 1, shrinking multi-quantity cart lines.

## Violated Invariant Or Contract

Moving a cart line to the wishlist and back must preserve purchasable quantity.

## Oracle

Cart line `quantity: 5` → `saveForLater` → `moveToCart` (no quantity) → cart
line quantity remains 5.

## Counterexample

1. `cart.add({ sellableId, priceId, quantity: 5 })` → line qty 5.
2. `saveForLater({ lineId })` deletes cart line; wishlist item has no quantity.
3. `moveToCart({ itemId })` sets `quantity: Math.max(1, input.quantity ?? 1)` → 1.

## Why It Might Matter

"Save for later" silently reduces units the customer intended to keep; totals and
item counts drop without warning.

## Proof

State transition trace: `SessionWishlistItem` type omits quantity; `saveForLater`
never stores it; `moveToCart` defaults to 1.

## Counterevidence Checked

Excluded `wishlist-movetocart-overwrites-qty` covers overwrite when a cart line
already exists, not quantity loss on save/restore. Test at `mika-api.test.ts:345-366`
never round-trips quantity.

## Suggested Next Step

Store quantity on wishlist items or pass cart quantity through `saveForLater`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `SessionWishlistItem` had no quantity, so `saveForLater` dropped
  the cart line quantity and `moveToCart` defaulted to 1, shrinking a 5-unit line to 1 on a round-trip.
  Added an optional `quantity` to `SessionWishlistItem` (persisted via the snapshot), `saveForLater` now
  stores `item.quantity`, and `moveToCart` restores it (`input.quantity ?? item.quantity ?? 1`, still
  merged with any existing cart line per the prior moveToCart fix). Directly-added wishlist items keep
  quantity undefined → default 1 on move (unchanged). Added a round-trip test (add 5 → saveForLater →
  moveToCart without quantity → 5). `npm test` (28 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:331-346,315-326 | P2 | save-for-later-drops-quantity
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:331-346,315-326 - saveForLater dropped cart quantity; wishlist items now carry quantity so a save/restore round-trip preserves units.