DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-api.ts:478-523 | Slug: order-cancel-overwrites-refunded

# orderCancel overwrites refunded order payment status

## Finding

`admin.orderCancel` unconditionally sets `fixture_status: "cancelled"` and
`payment_status: "cancelled"` with no guard on the order's current refund or
payment state. A prior full refund can be clobbered by a subsequent cancel.

## Violated Invariant Or Contract

Cancelling an already-refunded order must not succeed silently or overwrite
`payment_status: "refunded"` / `"partially_refunded"`.

## Oracle

After `orderRefund` on `order_buttonwood_1001`, `orderCancel` on the same order
should return `failed`, not `completed`.

## Counterexample

1. `orderRefund({ orderId: "order_buttonwood_1001", amount: 499 })` → refunded.
2. `orderCancel({ orderId: "order_buttonwood_1001" })` → `completed`.
3. Row now `payment_status: "cancelled"`, `fixture_status: "cancelled"`; refund
   metadata remains but terminal status is wrong.

## Why It Might Matter

Admin fixture rows end in inconsistent terminal states; operators cannot trust
payment_status after mixed refund/cancel actions.

## Proof

Admin mutator chain on SQLite fixture row with no status precondition check.

## Counterevidence Checked

Test cancels `order_buttonwood_1002` without prior refund. Missing order returns
failed. No branch on existing `payment_status` or `fixture_status`.

## Suggested Next Step

Reject cancel when order is already refunded/cancelled, or preserve refunded
terminal status.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `orderCancel` unconditionally wrote `fixture_status`/`payment_status`
  = "cancelled" with no precondition, so cancelling an already-refunded order clobbered its terminal state.
  Added a precondition check: if `payment_status` is `refunded`/`partially_refunded`/`cancelled` or
  `fixture_status` is `cancelled`, the closure returns a `conflict` and the action returns `failed`
  ("...cannot be cancelled after it was refunded or cancelled.") without mutating the row. The closure
  result is now `{ updated, conflict }` to distinguish not-found from conflict. Existing cancel of order
  1002 (paid/fulfilled, non-terminal) still completes. Added a test: cancelling refunded order 1001 fails
  and leaves it `partially_refunded`. `npm test` (29 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-api.ts:478-523 | P2 | order-cancel-overwrites-refunded
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-api.ts:478-523 - orderCancel now rejects orders already refunded/partially refunded/cancelled instead of overwriting their terminal payment status.