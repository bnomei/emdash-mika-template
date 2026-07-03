# Mika Fixture Testbed

The seed is a resettable Buttonwood Lot-themed commerce data set for storefront pages
and EmDash admin action fields.

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
state in memory per session. It is deliberately small and replaceable; real apps
should wire `createMikaBackendApi()` or explicit `MikaApi` overrides to durable
repositories and provider adapters.

The webhook route is a signed-webhook mock boundary: it preserves provider
metadata and raw-body hash for smoke tests, but it does not verify provider
signatures or implement a real adapter.

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
