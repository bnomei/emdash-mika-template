DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:353-379 | Slug: checkout-bypasses-stock

# Checkout API bypasses stock and max-per-order guards

## Finding

The storefront computes checkout blockers for out-of-stock and over-limit quantities in `mikaTemplateCartCheckoutIssues` and disables the checkout form in the UI, but `checkout.start` never enforces the same rules server-side.

## Violated Invariant Or Contract

Checkout must not complete when any cart line is `out_of_stock` or exceeds `maxPerOrder`, consistent with the cart/checkout UI contract.

## Oracle

If `mikaTemplateCartCheckoutIssues(cart)` is non-empty for a cart, `checkout.start(ctx)` for that cart must return a failure (4xx).

## Counterexample

1. `cart.add` for `sellable_bw_lettering_license` (seeded `out_of_stock`, `availableQuantity: 0`) succeeds.
2. `mikaTemplateCartCheckoutIssues(cart)` returns `"Buttonwood Creator Bundle - Lettering Brush Pro License is no longer available."` (covered in `test/mika-api.test.ts`).
3. `CheckoutForm.astro` disables submit when `checkoutIssues.length > 0`.
4. Direct `checkout.start(ctx)` with the same cart returns `ok: true` and creates a paid order — only `lines.length === 0` is checked.

## Why It Might Matter

Any client that posts the checkout action directly (or a buy-now path without UI guards) can complete purchases for unavailable inventory.

## Proof

**Cross-entry mismatch:** Presentation layer (`display.ts`, `CheckoutForm.astro`) enforces availability; `checkout.start` has no equivalent validation on `checkoutLines`.

**Control-flow trace:** `checkout.start` → `checkoutLines` → persist paid order without `availabilityFor` checks.

## Counterevidence Checked

- `cart.add` intentionally allows OOS lines so the UI can show blockers — server checkout should be the enforcement point.
- Buy-now UI disables OOS options at selection time but API `checkout.start({ sellableId, ... })` also skips stock checks.
- Empty cart correctly returns `CHECKOUT_EMPTY`.

## Suggested Next Step

Mirror `mikaTemplateCartCheckoutIssues` (or equivalent) inside `checkout.start` and fail before persisting checkout/order state.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkout.start` only guarded `lines.length === 0`, so a direct
  checkout for an out-of-stock cart line (e.g. `sellable_bw_lettering_license`, availableQuantity 0)
  still created a paid order despite `mikaTemplateCartCheckoutIssues` and `CheckoutForm.astro` blocking
  it. Added `isCheckoutLineBlocked` (mirrors the UI rule via `availabilityFor`: out_of_stock, or
  quantity > maxPerOrder) and a guard in `checkout.start` that fails with `CHECKOUT_UNAVAILABLE` (409)
  before persisting any checkout/order. Verified all test sellables that reach checkout are in stock at
  the quantities used (clip_mini 39, zine_workshop 8, panel_pack 12, sunday_club 1), so existing flows
  still pass. Missing-stock-record handling is tracked separately (P2 missing-stock-record-forced-out-of-stock);
  this guard stays consistent with whatever availabilityFor reports. Added an out-of-stock checkout
  rejection test. `npm test` (19 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:353-379 | P1 | checkout-bypasses-stock
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:353-379 - checkout.start completed paid orders for out-of-stock/over-limit cart lines; now mirrors mikaTemplateCartCheckoutIssues server-side and fails with CHECKOUT_UNAVAILABLE before persisting.