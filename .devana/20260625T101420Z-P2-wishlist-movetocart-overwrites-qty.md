DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:315-327,236-243 | Slug: wishlist-movetocart-overwrites-qty

# moveToCart overwrites existing cart quantity instead of merging

## Finding

When the same sellable/price line already exists in the cart, `wishlist.moveToCart` replaces the cart quantity with the move quantity instead of merging like `cart.add` does.

## Violated Invariant Or Contract

Moving a wishlist item into the cart should not reduce an existing cart line's quantity; `cart.add` accumulates quantities for the same line key.

## Oracle

Cart holds quantity 5 for sellable S; `moveToCart({ itemId, quantity: 2 })` for the same variant should yield cart quantity 7 (additive) or documented replace semantics — not 2 with 3 units lost.

## Counterexample

1. `cart.add({ sellableId: S, priceId: P, quantity: 5 })` → cart line quantity 5.
2. `wishlist.add({ sellableId: S, priceId: P })`.
3. `wishlist.moveToCart({ itemId, quantity: 2 })`.
4. `state.cartItems.set(cartLineId(S,P), { quantity: Math.max(1, 2) })` → cart quantity becomes **2**, not 7.

## Why It Might Matter

Silent quantity loss when a product exists in both cart and wishlist, producing incorrect totals and checkout lines.

## Proof

**State transition mismatch:** `cart.add` uses `Math.max(1, input.quantity) + (current?.quantity ?? 0)`; `moveToCart` assigns `quantity: Math.max(1, input.quantity ?? 1)` with no read of existing line quantity.

**Counterexample value:** Existing cart qty 5, move qty 2.

## Counterevidence Checked

- `saveForLater` removes the cart line first, so that path cannot hit this conflict.
- Existing test (`wishlist-flow`) only moves into an empty cart.
- `WishlistList.astro` is the caller for `moveToCart`.

## Suggested Next Step

Align `moveToCart` with `cart.add` merge semantics when `cartLineId` already exists in `state.cartItems`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `moveToCart` did `cartItems.set(lineId, { quantity: Math.max(1, qty) })`
  with no read of the existing line, so moving a wishlist item for a sellable already in the cart replaced
  (e.g. cart 5 + move 2 → 2, losing 3) instead of merging like `cart.add`. Now reads the existing line
  quantity and adds (`Math.max(1, qty) + existing`), matching cart.add. Added a test asserting cart 5 +
  move 2 → 7. `npm test` (21 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:315-327,236-243 | P2 | wishlist-movetocart-overwrites-qty
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:315-327,236-243 - wishlist.moveToCart replaced an existing cart line quantity; now merges additively with the existing line like cart.add.