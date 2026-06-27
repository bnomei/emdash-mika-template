DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:276-280,976-997 | Slug: apply-coupon-accepts-any-code

# cart.applyCoupon discounts any non-empty code

## Finding

`cart.applyCoupon` only trims and uppercases `input.code` before storing it.
`cartFor` applies a 10% discount whenever `state.couponCode` is truthy, with no
whitelist or validation. Invalid codes produce the same discount as `BUTTONWOOD10`.

## Violated Invariant Or Contract

Only valid coupon codes should change cart totals. Invalid codes should fail or
leave totals unchanged.

## Oracle

`cart.applyCoupon({ code: "NOTAREALCODE" })` on a cart with subtotal 998 must
not reduce total to 898.

## Counterexample

1. Cart subtotal 998 (two items from test setup).
2. `applyCoupon(ctx, { code: "NOTAREALCODE" })` returns `ok`.
3. `cartFor` applies `Math.round(subtotalAmount * 0.1)` → total 898.
4. `cart.astro:50` shows "Discount applied."

## Why It Might Matter

Customers can obtain discounts with arbitrary strings; checkout order totals
already ignore coupons (separate finding), but cart display and quote paths
still show reduced totals.

## Proof

Dataflow trace: `applyCoupon` stores any code → `cartFor` unconditional 10%
discount on truthy `couponCode`.

## Counterevidence Checked

No code whitelist in override. Test uses `BUTTONWOOD10` but does not assert
invalid codes fail. Empty codes rejected upstream by `requiredStringSchema`.

## Suggested Next Step

Validate coupon codes against a fixture allowlist or reject unknown codes in
`applyCoupon`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `applyCoupon` only trimmed/uppercased the code and `cartFor`
  applied a flat 10% whenever `couponCode` was truthy, so any non-empty string discounted the cart.
  Added a `templateCouponCodes` allowlist ({BUTTONWOOD10}) and a `validCouponCode` helper. `applyCoupon`
  now rejects unknown codes with `fail("COUPON_INVALID", ..., 422)` and only persists a valid code; the
  `cart.quote` preview path also runs the code through `validCouponCode` so an unknown code previews no
  discount. `cartFor`/`cartFromLines` already only discount when `couponCode` is set, which is now always
  a validated code. Added assertions: NOTAREALCODE is rejected (422), leaves the cart at 1497 with no
  coupon, and quotes no discount; BUTTONWOOD10 still discounts to 1347. `npm test` (27 passing) and
  `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:276-280,976-997 | P2 | apply-coupon-accepts-any-code
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:276-280,976-997 - applyCoupon accepted any code; now validated against a fixture allowlist (reject unknown with 422) and the quote path ignores invalid codes.