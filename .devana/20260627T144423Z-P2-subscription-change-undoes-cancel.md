DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:472-488,1104-1111 | Slug: subscription-change-undoes-cancel

# subscription.change reactivates cancel_at_period_end

## Finding

`subscription.change` sets `state.subscriptionStatus = "active"`, identical to
`subscription.renew`. After `subscription.cancel` sets
`cancel_at_period_end`, calling `change` flips status back to `active` and
`accountFor` sets `cancelAtPeriodEnd: false`.

## Violated Invariant Or Contract

Upstream subscription lifecycle preserves `cancel_at_period_end` on `change`
actions; `change` must not implicitly renew a pending cancellation.

## Oracle

After `subscription.cancel`, `subscription.change({ subscriptionId, priceId })`
should leave `status: "cancel_at_period_end"` and `cancelAtPeriodEnd: true`.

## Counterexample

1. `subscription.cancel(ctx)` → `subscriptionStatus = "cancel_at_period_end"`.
2. `subscription.change(ctx, { subscriptionId: "sub_template_buttonwood_club", priceId: "..." })`
   → `subscriptionStatus = "active"`.
3. `account.get()` shows active subscription with `cancelAtPeriodEnd: false`.

## Why It Might Matter

Operators or customers using change-plan after scheduling cancellation unknowingly
undo cancel-at-period-end in session state.

## Proof

Two-step state transition on single session-level `subscriptionStatus` field;
`change` and `renew` handlers are identical.

## Counterevidence Checked

Test covers cancel → renew, not cancel → change. `AccountSubscriptions.astro`
hides change form by default (`showChangeAction = false`). Handlers ignore
`subscriptionId` validation.

## Suggested Next Step

Preserve `cancel_at_period_end` on `change`, or alias change to renew only when
explicitly intended.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `subscription.change` was identical to `renew`
  (`state.subscriptionStatus = "active"`), so changing plan after `cancel` flipped a pending
  `cancel_at_period_end` back to active (`accountFor` then reports `cancelAtPeriodEnd: false`). Changed it
  to preserve the existing lifecycle state — it no longer mutates `subscriptionStatus`, just returns the
  current account projection (a plan change shouldn't renew a scheduled cancellation). `renew` still
  explicitly reactivates. Added a test: cancel → change keeps `cancel_at_period_end` /
  `cancelAtPeriodEnd: true`. `npm test` (31 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:472-488,1104-1111 | P2 | subscription-change-undoes-cancel
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:472-488,1104-1111 - subscription.change no longer forces active; it preserves the lifecycle state so a pending cancel_at_period_end survives a plan change.