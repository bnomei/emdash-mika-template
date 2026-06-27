DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:504-517,src/pages/account/orders.astro:22-47 | Slug: order-invoice-missing-order-succeeds

# order.invoice succeeds for non-existent order ids

## Finding

`order.invoice` only checks that `orderId` is non-empty. Any string returns
`ok` with an invoice `href` and `expiresAt`. `account/orders.astro` shows an
"Invoice ready" banner whenever `invoiceResult?.ok` for the `?invoice=` query
param, including fabricated ids.

## Violated Invariant Or Contract

`order.invoice` should fail with `ORDER_NOT_FOUND` when the order does not exist.
Callers treat `result.ok` as proof the invoice is ready.

## Oracle

`order.invoice("order_does_not_exist")` must return `ok: false`.
`/account/orders?invoice=order_does_not_exist` must not show "Invoice ready."

## Counterexample

1. User opens `/account/orders?invoice=order_does_not_exist`.
2. `order.invoice` returns `ok` with `href: "/account?invoice=order_does_not_exist"`.
3. Page renders success banner and link for an order that was never created.

## Why It Might Matter

Misleading invoice-ready UI for bogus deep links; distinct from excluded
`invoice-href-wrong-page` (wrong href target, not missing validation).

## Proof

Caller/callee mismatch: API always succeeds for truthy `orderId`; page trusts
`ok` without cross-checking `account.orders`.

## Counterevidence Checked

Test only covers real seeded id `order_buttonwood_1001`. No order catalog lookup
in fixture override.

## Suggested Next Step

Look up order in seed/session checkout orders before returning invoice DTO; fail
when not found.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `order.invoice` only checked `orderId` non-empty, so any string
  returned an invoice DTO and `orders.astro` rendered an "Invoice ready" banner for fabricated
  `?invoice=` ids. Added a `seededOrderIds()` helper (order_ref.orderId across seeded orders) and now
  verify the order exists — seeded, or in the session's `checkoutOrders` when invoked with a request
  context (orderInvoice has requiresRequestContext: true) — before returning the DTO; otherwise
  `fail("ORDER_NOT_FOUND", ..., 404)`. Real ids (string and `{orderId}` forms) still succeed. Added a
  test: `order.invoice("order_does_not_exist")` returns ok:false/404. `npm test` (29 passing) and
  `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:504-517,src/pages/account/orders.astro:22-47 | P2 | order-invoice-missing-order-succeeds
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:504-517,src/pages/account/orders.astro:22-47 - order.invoice now validates the order exists (seeded or session checkout order) and fails with ORDER_NOT_FOUND for bogus ids.