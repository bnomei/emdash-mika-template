DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:373-376 | Slug: checkout-clears-cart-early

# Cart checkout clears lines before payment completes

## Finding

For full-cart checkout (`checkout.start` without `sellableId`), the fixture clears `cartItems` and removes the applied coupon as soon as checkout starts, not when payment is confirmed or cancelled.

## Violated Invariant Or Contract

Cart contents should survive checkout abandonment; the cancel page tells users their cart is still available to review and retry.

## Oracle

After `checkout.start` for a cart checkout, if the buyer lands on `/checkout/cancel` without completing payment, `cart.get` should still return the pre-checkout lines.

## Counterexample

1. Cart holds items and optional coupon; user submits checkout.
2. `checkout.start` immediately runs `state.cartItems.clear()` and `state.couponCode = undefined` (lines 373-375).
3. User is redirected away and later opens `/checkout/cancel`.
4. `cancel.astro` copy: "Your cart is still the place to review quantities, apply a coupon…"
5. `cart.get` returns an empty cart.

## Why It Might Matter

Buyers who abandon or cancel checkout lose cart contents and must re-add items, contradicting on-page guidance and typical commerce flow expectations.

## Proof

**Control-flow trace:** `checkout.start` cart-mode branch clears cart before `persistSessionState` and before any payment outcome.

**Cross-entry mismatch:** `src/pages/checkout/cancel.astro:38` promises an intact cart; `checkout.start` empties it unconditionally.

## Counterevidence Checked

- Template stores checkout as `completed` immediately in session state, so the happy path always succeeds in this fixture.
- `test/mika-api.test.ts` asserts cart is empty right after `checkout.start` (encodes early clear, not cancel-page recovery).
- Buy-now checkout (`input.sellableId` set) does not clear the cart — only full-cart mode is affected.

## Suggested Next Step

Defer cart and coupon clearing until checkout reaches a terminal paid state, or restore cart lines when status remains `redirected`/`pending`/`cancelled`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkout.start` ran `cartItems.clear()` + `couponCode = undefined`
  for full-cart checkouts before any completion was observed, so a buyer who abandoned before reaching
  `/checkout/success` lost their cart while `/checkout/cancel` promised it was intact. Deferred the
  clear: `start` now records the checkout id in a new `pendingCartCheckouts` set (persisted in the
  session snapshot) instead of emptying the cart. The cart + coupon are cleared only when the checkout's
  completion is confirmed — `checkout.status` called with the request context (the success page path:
  `checkoutStatus` has `requiresRequestContext: true`, so the facade passes ctx). Buy-now checkouts set
  `input.sellableId`, are never recorded, and so never clear the cart (unchanged). Updated the checkout
  test to assert the cart survives `start` and empties only after a ctx-confirmed completion. The
  abandonment path (reaching `/checkout/cancel` without the completed checkout id) now preserves the
  cart. `npm test` (16 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:373-376 | P1 | checkout-clears-cart-early
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:373-376 - Full-cart checkout.start cleared the cart and coupon immediately; deferred clearing until the success page confirms completion so abandonment keeps the cart, matching the /checkout/cancel promise.