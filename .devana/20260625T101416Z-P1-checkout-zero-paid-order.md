DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:353-372,1064-1082,1237-1246 | Slug: checkout-zero-paid-order

# Checkout completes zero-total paid orders for invalid sellable/price pairs

## Finding

`checkout.start` with a `sellableId` does not validate that the sellable and `priceId` resolve to a catalog variant. A mismatched pair produces a paid order with `total.amount === 0`.

## Violated Invariant Or Contract

Checkout must reject non-resolvable sellable/price combinations, matching `cart.add` which returns `SELLABLE_NOT_FOUND` when the variant is missing.

## Oracle

`checkout.start({ sellableId: "sellable_bw_clip_mini", priceId: "price_bw_clip_standard" })` must fail because that price does not belong to the sellable.

## Counterexample

1. `cart.add` with the same mismatched pair returns `SELLABLE_NOT_FOUND`.
2. `checkout.start` with the pair: `checkoutLines` always emits one line when `sellableId` is truthy.
3. `findVariantBySellable` returns `undefined` for the mismatch.
4. `checkoutOrderSummary` uses `variant?.amount ?? 0` → total 0.
5. Response is `ok` with `status: "redirected"`; stored order has `status: "paid"`, `paymentStatus: "paid"`, `total.amount: 0`.

## Why It Might Matter

Buy-now and direct action calls can create completed paid orders with no revenue and no catalog line, bypassing the validation present on add-to-cart.

## Proof

**Control-flow trace:** `checkout.start` checks only `lines.length === 0`; no call to `findVariantBySellable` before persisting the order.

**Counterexample value:** Valid `sellableId` with wrong `priceId` for that sellable.

## Counterevidence Checked

- When `priceId` is omitted and `sellableId` is unique in seed data, `findVariantBySellable` still resolves — failure is specific to invalid pairs.
- `BuyNowForm.astro` posts both fields from the product form; a tampered POST can supply mismatched values.
- No stock or availability gate at checkout either (separate finding).

## Suggested Next Step

Validate every checkout line with `findVariantBySellable` before creating the session/order; fail with `SELLABLE_NOT_FOUND` when any line lacks a variant.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkout.start` only guarded `lines.length === 0` and never
  resolved variants, so a buy-now POST with a valid sellable but a price belonging to another sellable
  produced a `status: "paid"` order with `total.amount === 0` (`checkoutOrderSummary` uses
  `variant?.amount ?? 0`). Added a guard that rejects with `SELLABLE_NOT_FOUND` (404) when any checkout
  line fails `findVariantBySellable`, mirroring `cart.add`. Added a test asserting the mismatched pair
  is rejected and no zero-total order is recorded. `npm test` (18 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:353-372,1064-1082,1237-1246 | P1 | checkout-zero-paid-order
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:353-372,1064-1082,1237-1246 - checkout.start accepted invalid sellable/price pairs and recorded a zero-total paid order; now validates every line with findVariantBySellable and fails with SELLABLE_NOT_FOUND.