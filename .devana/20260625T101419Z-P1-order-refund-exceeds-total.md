DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-api.ts:422-476 | Slug: order-refund-exceeds-total

# Order refund accepts amounts greater than order total

## Finding

`admin.orderRefund` persists any positive `input.amount` without capping it at the order's `total_amount`. Refunds larger than the order total are stored and reported as successful.

## Violated Invariant Or Contract

Refund amount must not exceed the order total; excess refunds should fail rather than corrupt fixture payment state.

## Oracle

`orderRefund({ orderId: "order_buttonwood_1001", amount: 1000 })` on an order with `total_amount: 499` must return `failed`, not `completed`.

## Counterexample

1. Seed order `order-buttonwood-1001` has `total_amount: 499`.
2. `admin.orderRefund({ orderId: "order_buttonwood_1001", amount: 1000, reason: "fixture_refund" })`.
3. Handler sets `refundAmount = 1000`, `refundStatus = "refunded"` (because `1000 >= 499`), updates SQLite `payment_status` to `"refunded"`.
4. Returns `completed` with `affected.refundAmount: 1000`.

## Why It Might Matter

Admin fixture rows and any UI reading refund amounts can show over-refunded orders, breaking reconciliation demos and teaching incorrect refund semantics.

## Proof

**Control-flow trace:** `refundAmount = input.amount ?? ...` with no `refundAmount <= totalAmount` guard before `updateFixtureRow`.

**Counterexample value:** `amount: totalAmount + 1`.

## Counterevidence Checked

- Missing order correctly returns `failed`.
- Partial refunds below total work as intended (`amount: 499` test path).
- Storefront `account.get` reads seed JSON, not SQLite — pollution is in admin DB until reset, but the mutator contract is still violated.

## Suggested Next Step

Reject refunds where `refundAmount > totalAmount` (and optionally where cumulative refunds would exceed total).

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid (bug real; one oracle detail off — order-buttonwood-1001's seed
  `total_amount` is 1298, not 499). `admin.orderRefund` persisted any positive `input.amount` with no
  cap, marking it "refunded" whenever `amount >= total`. Added a guard: when `refundAmount > totalAmount`
  the row is left untouched and the action returns `failed` ("...exceeds the order total."). A no-amount
  refund still defaults to the full `totalAmount` (not over), and partial refunds below total are
  unchanged. Cumulative-refund overflow is tracked separately (P2 order-refund-no-cumulative-total) and
  intentionally not handled here. Added an over-total rejection assertion (amount 100000) verifying the
  order is not marked refunded. `npm test` (20 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-api.ts:422-476 | P1 | order-refund-exceeds-total
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-api.ts:422-476 - admin.orderRefund accepted refund amounts above the order total; now rejects refundAmount > totalAmount with a failed result instead of persisting an over-refund.