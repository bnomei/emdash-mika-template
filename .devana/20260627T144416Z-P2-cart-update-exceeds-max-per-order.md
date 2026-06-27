DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:254-265,807-822,src/lib/display.ts:99-116 | Slug: cart-update-exceeds-max-per-order

# cart.update ignores availability maxPerOrder server-side

## Finding

`cart.update` only clamps with `Math.max(1, input.quantity)` and never reads
`availability.maxPerOrder`. The UI sets an HTML `max` attribute, but the API
accepts arbitrarily large quantities. `mikaTemplateCartCheckoutIssues` flags
over-max lines at checkout time only.

## Violated Invariant Or Contract

Cart line quantity must respect `availability.maxPerOrder`, the same bound used
for checkout blockers.

## Oracle

For a line with `maxPerOrder: 39`, `cart.update({ lineId, quantity: 100 })`
should fail or clamp to 39.

## Counterexample

1. Clipboard mini: `availableQuantity: 39`, `maxPerOrder: 39`.
2. `cart.add` qty 1, then `cart.update` qty 100 → `ok`, persisted qty 100.
3. `cart.get` returns line `quantity: 100` with inflated subtotal/total.
4. Checkout form disables submit via `checkoutIssues`, but cart display stays wrong.

## Why It Might Matter

Tampered POST or direct API calls inflate cart totals and item counts; checkout
is blocked but cart state misrepresents inventory.

## Proof

Control-flow trace: `cart.update` → no `availabilityFor` read → `cartFor` serves
over-max quantity; `mikaTemplateCartCheckoutIssues` only gates checkout UI.

## Counterevidence Checked

Excluded `checkout-bypasses-stock` is checkout-only. HTML `max` is client-side
only. `Math.max(1, …)` prevents zero, not over-max.

## Suggested Next Step

Clamp or reject `cart.update` quantities above `availability.maxPerOrder`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `cart.update` only did `Math.max(1, input.quantity)` and never read
  availability, so a direct/tampered update persisted e.g. qty 100 on a line with maxPerOrder 39. Added a
  `maxPerOrderFor(sellableId)` helper (reads `availabilityFor().maxPerOrder`, positive only) and clamped
  `cart.update` to it (`Math.min(requested, maxPerOrder)`), matching the bound the checkout blockers use.
  Untracked lines (no maxPerOrder) are not clamped. Chose clamp over reject to match the HTML `max`
  attribute UX (the oracle allows either). Added a test: update to 100 clamps to 39 with no checkout
  issues. (cart.add accumulation is a separate path the report did not scope; left unchanged.) `npm test`
  (29 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:254-265,807-822,src/lib/display.ts:99-116 | P2 | cart-update-exceeds-max-per-order
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:254-265,807-822,src/lib/display.ts:99-116 - cart.update accepted quantities above maxPerOrder; now clamps server-side to availability.maxPerOrder.