DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:513-516 | Slug: invoice-href-wrong-page

# order.invoice href targets a page that does not handle invoices

## Finding

`order.invoice` returns `href: /account?invoice=<orderId>`, but only `/account/orders` reads the `invoice` query parameter and renders invoice UI. The orders page banner uses the API href directly, sending users to the wrong destination.

## Violated Invariant Or Contract

`order.invoice` must return a URL where the host actually handles the invoice deep link.

## Oracle

After `Mika.order.invoice(orderId)`, following `data.href` must land on a page that reads `?invoice=` and shows invoice content.

## Counterexample

1. User opens `/account/orders?invoice=order_buttonwood_1001`.
2. `orders.astro` calls `Mika.order.invoice` and renders banner link `href={invoiceResult.data.href}`.
3. API returns `/account?invoice=order_buttonwood_1001`.
4. `account.astro` never reads `invoice` — user sees account overview with no invoice UI.

## Why It Might Matter

Broken invoice deep links from the orders page banner; inconsistent behavior because `AccountOrders.astro` table links correctly use `/account/orders?invoice=…`.

## Proof

**Contract mismatch:** API href `/account?invoice=…` vs page handler on `/account/orders` only (`orders.astro:22-23,44-47`).

**Cross-entry mismatch:** Same orders surface mixes working table links and broken API banner links.

## Counterevidence Checked

- `test/mika-api.test.ts` asserts href shape `/account?invoice=…` (API contract only, not page routing).
- `account.astro` has no `searchParams.get("invoice")` handling.

## Suggested Next Step

Change `order.invoice` to return `/account/orders?invoice=…` (or teach `/account` to forward/handle the parameter).

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `order.invoice` returned `/account?invoice=<id>`, but only
  `src/pages/account/orders.astro:22` reads `searchParams.get("invoice")` — the `/account` index never
  does, so the orders-page banner link (`href={invoiceResult.data.href}`) landed on the account overview
  with no invoice UI. Changed the href to `/account/orders?invoice=<id>` so the deep link targets the
  page that handles it (consistent with the working table links). Updated the two invoice href
  assertions in the test. `npm test` (21 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:513-516 | P2 | invoice-href-wrong-page
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:513-516 - order.invoice returned /account?invoice= but only /account/orders handles it; href now points to /account/orders?invoice=.