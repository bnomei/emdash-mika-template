DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-api.ts:436-458 | Slug: order-refund-zero-marks-partial

# orderRefund with amount 0 marks order partially_refunded

## Finding

`admin.orderRefund` treats explicit `amount: 0` as a real refund amount. Because
`0 >= totalAmount` is false, it sets `payment_status` and `fixture_status` to
`partially_refunded` and returns `completed`, despite zero economic refund.

## Violated Invariant Or Contract

A zero-amount refund must not mutate payment status to `partially_refunded`; it
should no-op or fail.

## Oracle

On paid order `order_buttonwood_1001` (`total_amount: 499`),
`orderRefund({ orderId, amount: 0 })` must not set `payment_status:
partially_refunded` with `refundAmount: 0`.

## Counterexample

1. `refundAmount = input.amount ?? …` → `0` (explicit zero is not nullish).
2. `refundStatus = 0 >= 499 ? "refunded" : "partially_refunded"` → partially_refunded.
3. SQLite row updated; handler returns `completed`.

## Why It Might Matter

Admin operators can accidentally or maliciously mark orders partially refunded
with no money returned, corrupting fixture payment state.

## Proof

Boundary value `amount: 0` + status transition trace in `orderRefund` handler.

## Counterevidence Checked

Excluded `order-refund-exceeds-total` covers upper bound only. No
`refundAmount <= 0` guard. Test uses `amount: 499` only.

## Suggested Next Step

Reject `amount <= 0` or skip status mutation when refund amount is zero.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed (lower-bound complement to P1 order-refund-exceeds-total). Confirmed valid: an explicit
  `amount: 0` is not nullish, so `refundAmount` stayed 0 and `0 >= total` was false → status flipped to
  `partially_refunded` with a `completed` result despite no money refunded. Added a `refundAmount <= 0`
  guard returning `failed` ("...must be a positive amount.") without mutating the row, alongside the
  existing over-total guard. A no-amount refund still defaults to the full total (positive), unaffected.
  Added an assertion that `amount: 0` fails and does not mark the order partially_refunded. `npm test`
  (29 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-api.ts:436-458 | P2 | order-refund-zero-marks-partial
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-api.ts:436-458 - orderRefund accepted amount 0 and persisted partially_refunded; now rejects refundAmount <= 0 with a failed result and no status change.