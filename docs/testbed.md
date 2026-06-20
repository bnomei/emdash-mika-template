# Mika fixture test bed

The seed is a resettable peanut-themed commerce data set for clicking Mika actions from EmDash content entries.

## Collections

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

Dashboard actions remain available from the Mika action manifest: provider health, provider sync, and expired reservation release.

## Reset

Stop the dev server before a full reset, then run:

```sh
npm run fixture:reset
```

That removes the local sqlite database files and reapplies `seed/mika-actions.seed.json`.
