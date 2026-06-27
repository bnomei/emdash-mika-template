DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-api.ts:436-457 | Slug: order-refund-no-cumulative-total

# Repeated partial orderRefund never reaches refunded status

## Finding

`orderRefund` compares only the current call's `refundAmount` to `totalAmount`
when choosing status. It overwrites `order_ref.refundAmount` each call instead of
accumulating. Two partial refunds that sum to the order total still end as
`partially_refunded` with only the last slice stored.

## Violated Invariant Or Contract

When cumulative refunded amount reaches order total, status must become
`refunded`, not remain `partially_refunded` with the last refund amount only.

## Oracle

Order total 499. `orderRefund({ amount: 200 })` then `orderRefund({ amount: 299 })`
must end as `payment_status: "refunded"` with cumulative refund 499.

## Counterexample

1. First refund 200 → `partially_refunded`, stored `refundAmount: 200`.
2. Second refund 299 → `299 >= 499` is false → still `partially_refunded`;
   stored `refundAmount: 299` (overwrites 200); `refundCount: 2`.
3. Economically fully refunded; fixture reports partial.

## Why It Might Matter

Admin refund ledger and payment status disagree with actual refunded totals;
downstream tooling trusting `payment_status` misclassifies fully refunded orders.

## Proof

Multi-step state machine: per-call status compare + overwrite of `refundAmount`
without summing prior refunds despite incrementing `refundCount`.

## Counterevidence Checked

Excluded `order-refund-exceeds-total` is single over-max refund. `refundCount`
increments imply multi-refund awareness but no cumulative sum exists.

## Suggested Next Step

Accumulate `refundAmount` across calls and set `refunded` when cumulative ≥
total.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `orderRefund` compared only the current slice to total and
  overwrote `order_ref.refundAmount` each call, so two partials summing to the total stayed
  `partially_refunded` with only the last slice stored. Now `order_ref.refundAmount`/`order_refund.amount`
  hold the cumulative refunded total: read `priorRefunded`, compute `cumulativeRefunded = prior + thisRefund`,
  set status `refunded` when cumulative >= total. The over-total guard now checks cumulative (so the report-8
  single-shot case still rejects), the zero/negative guard checks the slice, a bare (no-amount) refund now
  covers the remaining balance (`total - prior`), and `order_refund.lastRefundAmount` keeps the per-call
  slice. Added a test: refund 800 then 299 on order 1003 (total 1099) ends `refunded` with cumulative
  refundAmount 1099. Existing single 499 partial on 1001 (total 1298) still `partially_refunded`.
  `npm test` (29 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-api.ts:436-457 | P2 | order-refund-no-cumulative-total
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-api.ts:436-457 - orderRefund now accumulates refundAmount across calls and marks the order refunded once the cumulative refunded total reaches the order total.