# Mika Fixture Testbed

The seed is a resettable Buttonwood Lot-themed commerce data set for storefront pages
and EmDash admin action fields.

This fixture is representative rather than exhaustive; Mika's package tests own edge-case and contract coverage.

## Storefront Data

The storefront reads product, variant, and stock data from the seed:

- `products`: product title, description, commerce refs, and variant price data.
  `buttonwood-creator-bundle` demonstrates payment/download, monthly subscription,
  and license-key fulfillment prices.
- `stock_items`: stock policy, quantity on hand, reserved quantity, and low-stock threshold.
  The creator bundle includes available, low-stock, and out-of-stock rows.
- `checkout_sessions`: seeded checkout status examples for return pages.
- `customers`, `orders`, `entitlements`, `downloads`, `licenses`, and `emails`:
  account page fixture data.
- `webhooks`: fixture webhook references for admin replay and webhook smoke tests.

The fixture storefront API keeps cart, wishlist, checkout, coupon, and magic-link
state in Astro session snapshots with an in-process cache. Browser tools and forms
use this same state. Tool-run claims and recovery tombstones are persisted
atomically in the fixture SQLite database's `mika_storefront_runs` table.
Checkout status reads never complete payment; the human success page has an
explicit session-owned simulation POST. It is deliberately small and replaceable; real apps
should wire `createMikaBackendApi()` or explicit `MikaApi` overrides to durable
repositories and provider adapters.

The webhook route is a signed-webhook mock boundary: it preserves provider
metadata and raw-body hash for smoke tests, but it does not verify provider
signatures or implement a real adapter.

## Browser Integration Checks

`test/storefront.test.ts` covers mixed human/tool cart state, retry deduplication,
session isolation, account-tool authentication, stale checkout/subscription
reviews at the mutation boundary, passive status/cancellation preparation,
explicit simulated completion, and nested Action errors.

Native WebMCP requires a supporting browser; optional annotations require ChatGPT's
`document.oai.annotation`. Use the shared shell's independent `webmcp` and
`annotations` props to exercise each capability and the ordinary form fallback.
Preview/reset must never change submitted purchase controls or invoke mutations.
Real ChatGPT behavior cannot be inferred from an annotation API mock.

The fixture's session snapshots are not a transactional production commerce store.
Durable tool-run claims do not provide atomicity with provider calls, concurrent
webhooks, or overlapping session writes. No real money or email is involved.

Account export creation, polling, and downloading return `NOT_IMPLEMENTED` (501).
The package-owned HTTP download route is mounted against the live API, but this
fixture has no export artifact store or token issuer. It cannot validate a real
export-download journey; returning a sample file would misrepresent authorization.

## Admin Collections

Each collection has three entries unless noted otherwise.

- `products`: product catalog entries with variant arrays and `mika.catalog.syncEntry` buttons.
- `stock_items`: stock targets with `mika.stock.adjust` buttons.
- `customers`: fake customer/provider refs with `mika.entitlement.grant` buttons.
- `orders`: order targets with `mika.order.refund` and `mika.order.cancel` buttons.
- `checkout_sessions`: checkout/session references for order and webhook context.
- `webhooks`: event targets with `mika.webhook.replay` buttons.
- `entitlements`: entitlement targets with `mika.entitlement.revoke` buttons.
- `emails`: email targets with `mika.email.resend` buttons.
- `licenses`: license targets with `mika.license.revoke` buttons.
- `downloads`: order-line/entitlement targets with `mika.download.issue` buttons.

Dashboard actions remain available from the Mika action manifest: provider
health, provider sync, and expired reservation release.

## Reset

Stop the dev server before a full reset, then run:

```sh
npm run fixture:reset
```

That removes the local SQLite database files and reapplies
`seed/mika-actions.seed.json`.
