DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:381-393,1064-1082 | Slug: checkout-preview-buy-now-zero-quote

# checkout.preview omits buy-now lines from quote total

## Finding

`checkout.preview` builds `lines` from `checkoutLines(state, input.sellableId, …)` for
`mode`, but sets `quote: cartQuote(cart)` using only the session cart. On an empty
cart, a buy-now preview with `sellableId` reports `mode: "payment"` and
`status: "requires_confirmation"` while `quote.items` is empty and
`quote.total.amount` is zero. `checkout.start` with the same input charges the
full variant price.

## Violated Invariant Or Contract

`CheckoutPreviewDTO.quote` must represent the same checkout lines and total that
`checkout.start` will use for identical input. The template advertises
`checkout.preview` to agents in `src/pages/llms.txt.ts`.

## Oracle

Empty cart → `checkout.preview({ sellableId, priceId, quantity: 1 })` should
return `quote.items.length === 1` and `quote.total.amount === variant.amount`.
`checkout.start` with the same input creates a paid order at that amount
(`checkoutOrderSummary`).

## Counterexample

1. Empty session cart.
2. `checkout.preview(ctx, { sellableId: "sellable_bw_zine_workshop", priceId: "price_bw_zine_workshop", quantity: 1 })`.
3. `checkoutLines` yields one line (1099 cents); `checkoutMode(lines)` is `"payment"`.
4. `cartQuote(cartFor(state))` returns `items: []`, `total.amount: 0`.
5. `checkout.start` with the same input records order total 1099.

## Why It Might Matter

Agents or integrations calling `checkout.preview` before buy-now checkout can
authorize or display a zero-total quote while `checkout.start` charges full price.

## Proof

Control-flow trace: `checkoutLines` populates buy-now lines → `checkoutMode`
uses them → `cartQuote(cart)` ignores them and reads empty session cart only.

## Counterevidence Checked

Buy-now UI (`BuyNowForm.astro`) calls `checkout.start` only, not preview. No
in-repo page calls `checkout.preview` with `sellableId`. Excluded findings
cover cart checkout paths, not buy-now preview quote omission.

## Suggested Next Step

Build preview `quote` from `checkoutLines` (or merge buy-now lines into
`cartQuote`) so preview totals match `checkout.start`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkout.preview` derived `mode` from `checkoutLines` (which
  includes buy-now input lines) but built `quote` from `cartQuote(cartFor(state))` — the session cart
  only — so an empty-cart buy-now preview returned `quote.items: []` / `total: 0` while `checkout.start`
  charged the full variant price. Refactored `cartFor` to delegate to a new `cartFromLines(lines,
  couponCode)` and built the preview quote from the actual checkout lines: for buy-now (sellableId set)
  `cartFromLines(lines)` with no coupon (mirroring checkout.start, which doesn't apply the cart coupon to
  buy-now); for cart mode the existing session cart (with coupon). Added a test asserting the buy-now
  preview total (1099) equals the started order total. `npm test` (24 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:381-393,1064-1082 | P1 | checkout-preview-buy-now-zero-quote
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:381-393,1064-1082 - checkout.preview quoted only the session cart; now quotes the actual checkout lines (incl. buy-now) via cartFromLines so the preview total matches checkout.start.