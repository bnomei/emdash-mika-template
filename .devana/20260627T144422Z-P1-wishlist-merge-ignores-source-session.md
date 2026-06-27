DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:348-350 | Slug: wishlist-merge-ignores-source-session

# wishlist.merge ignores sourceSessionId input

## Finding

The `wishlist.merge` override accepts only `ctx` and never reads `input`. It
returns the caller's current wishlist with no source-session lookup or item
union. Upstream Mika merges wishlist items from `sourceSessionId` when set.

## Violated Invariant Or Contract

`wishlist.merge(ctx, { sourceSessionId })` must merge items from the source
session wishlist into the caller's wishlist.

## Oracle

Guest wishlist A has items → session B calls `wishlist.merge({ sourceSessionId: A })`
→ B's wishlist includes A's items.

## Counterexample

1. Source session wishlist populated.
2. `wishlist.merge(ctxB, { sourceSessionId: "A" })` returns unchanged B wishlist.
3. No merge or source status update occurs.

## Why It Might Matter

Guest-to-authenticated wishlist handoff loses saved items when hosts call the
documented merge API.

## Proof

State trace plus contract mismatch: handler is read-through with no `input`
parameter.

## Counterevidence Checked

No in-repo callers of `wishlist.merge`. Upstream backend defines merge behavior
with `sourceSessionId`.

## Suggested Next Step

Implement source-session wishlist lookup and item union per upstream semantics.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection (sibling of
  cart-merge-ignores-source-session).
- 2026-06-27: fixed. Confirmed valid: `wishlist.merge` took only `ctx` and returned the caller's wishlist
  unchanged. Implemented the merge using the same `findSourceSessionState` resolver as the cart fix: union
  the source session's wishlist items into the caller's wishlist, keyed by `wishlistItemId` (sellable+price)
  so existing items aren't duplicated, preserving each item's `addedAt`/`quantity`. No-op when the source is
  missing or is the caller. Added a test: a source session wishlist (pennant_rain) merges into an empty dest
  wishlist. `npm test` (31 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:348-350 | P1 | wishlist-merge-ignores-source-session
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:348-350 - wishlist.merge now resolves input.sourceSessionId and unions the source session's wishlist items into the caller's wishlist.