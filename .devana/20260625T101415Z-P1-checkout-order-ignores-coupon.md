DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:372,976-997,1201-1214 | Slug: checkout-order-ignores-coupon

# Checkout order total ignores applied coupon discount

## Finding

When a coupon is applied to the cart, `checkout.start` records the resulting order total from raw line prices only. The discount visible in `cartFor` is not applied to `checkoutOrders`.

## Violated Invariant Or Contract

The order total persisted at checkout must match the cart total the customer saw immediately before starting checkout (including coupon discount).

## Oracle

After `cart.applyCoupon({ code: "BUTTONWOOD10" })` with subtotal 1497, `checkout.start` then `account.get`: `order.total.amount` should equal cart total 1347 (10% discount).

## Counterexample

1. Cart subtotal 1497; `applyCoupon` sets `state.couponCode` → `cartFor` computes discount 150 → cart total 1347.
2. `checkout.start` calls `checkoutOrderSummary(orderId, lines)`.
3. `checkoutOrderSummary` sums `variant.amount * quantity` with no `state.couponCode` / `cartFor` participation.
4. Persisted order total remains 1497 while the cart showed 1347.

## Why It Might Matter

Order history, receipts, and account order tables show a higher total than the quoted checkout price, causing billing confusion in demos and any code consuming `checkoutOrders`.

## Proof

**Dataflow trace:** Discount applied only in `cartFor` / `cartQuote`; `checkoutOrderSummary` uses undiscounted line sums.

**Contract mismatch:** `checkout.preview` uses `cartQuote(cart)` (discounted) while order persistence uses `checkoutOrderSummary` (undiscounted).

## Counterevidence Checked

- Coupon is cleared after order creation (lines 374-375) but that does not explain the total mismatch at creation time.
- No other path recomputes order totals with coupon metadata.
- Tests verify coupon cart totals but do not assert checkout order totals after coupon application.

## Suggested Next Step

Build checkout order totals from `cartFor(state)` (or pass `state.couponCode` into `checkoutOrderSummary`) so persisted orders match quoted cart totals.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkoutOrderSummary` summed raw `variant.amount * quantity`
  and never consulted `state.couponCode`, so a coupon-discounted cart (e.g. subtotal 1497 → 1347 with
  BUTTONWOOD10) persisted an order total of 1497. Added an optional `couponCode` param to
  `checkoutOrderSummary` that applies the same `Math.round(subtotal * 0.1)` discount cartFor uses, and
  pass `state.couponCode` from `checkout.start` only for full-cart checkouts (buy-now sets
  `input.sellableId` and bypasses the cart coupon, unchanged). Subtotals already matched cartFor
  (`cartLine.total === variant.amount * quantity`), so totals now agree exactly. Added a test asserting
  the persisted account order total equals the discounted cart total. `npm test` (17 passing) and
  `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:372,976-997,1201-1214 | P1 | checkout-order-ignores-coupon
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:372,976-997,1201-1214 - checkout.start persisted order totals from raw line prices ignoring the coupon; now checkoutOrderSummary applies the cart coupon discount for full-cart checkouts so orders match quoted totals.