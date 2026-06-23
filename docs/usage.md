# Mika Template Usage

This project is a runnable consumer for Mika storefront and admin-action flows.
It is meant to show how a host Astro + EmDash app wires Mika, without duplicating
the full reference docs from `@bnomei/emdash-mika`.

## Storefront Flow

The homepage lists products from `seed/mika-actions.seed.json`. Product detail
pages show purchasable formats, availability states, add-to-cart, buy-now,
wishlist, and JSON-LD structured data.

Key files:

- `src/pages/index.astro`: product listing and smoke-check links.
- `src/pages/products/[slug].astro`: host-owned product page.
- `src/actions/index.ts` and `src/actions/mika.ts`: Astro Actions wiring.
- `src/components/*.astro`: copied unstyled Mika storefront components.
- `src/lib/mika-fixture-storefront.ts`: fixture `MikaApi` overrides for catalog,
  stock, cart, wishlist, checkout, account, download, order, and webhook flows.
- `src/lib/mika-api.ts`: combines storefront and admin fixture APIs.

Useful storefront paths:

```txt
/
/products/mira-field-clipboard
/products/thirdbase-team-pennants
/products/junie-sidewalk-zine-kit
/products/buttonwood-creator-bundle
/cart
/wishlist
/account
/account/magic-link
/checkout/success?checkoutId=checkout_buttonwood_1001
/download/download_panel_pack_mira
/llms.txt
/.well-known/mika-agent.json
```

## Admin Action Testbed

The EmDash admin fixture remains available. Open `/_emdash/admin`, then inspect
the seeded Buttonwood Lot-themed collections.

Action fields are normal EmDash JSON fields with `widget: "actions:button"`:

- `mika_catalog_sync` runs `mika.catalog.syncEntry` and requires the saved entry target.
- `stock_adjust` runs `mika.stock.adjust` and reads `stockItemId` from the field value.
- `entitlement_grant` runs `mika.entitlement.grant` and reads customer context from the field value.
- `order_refund` and `order_cancel` run order provider actions and read `orderId` from the field value.
- `webhook_replay` runs `mika.webhook.replay` and reads `webhookId` from the field value.
- `entitlement_revoke` runs `mika.entitlement.revoke` and reads `entitlementId` or `entitlementKey` from the field value.
- `email_resend` runs `mika.email.resend` and reads `emailId` from the field value.
- `license_revoke` runs `mika.license.revoke` and reads `licenseId` from the field value.
- `download_issue` runs `mika.download.issue` and reads `orderId`, `entitlementId`, or `orderLineId` from the field value.

`/api/mika-action-contract.json` returns the provider config and Mika action
manifest that the actions plugin consumes.

`/api/mika-webhook/[provider]` is a signed-webhook fixture boundary. It records
the provider name, optional event id/type headers, whether a common signature
header was present, and the raw-body hash/length before handing the event to the
fixture API. It is not a Stripe, Paddle, or other provider adapter.

## Notifications And Email

This template uses fixture API overrides, so it does not send real transactional
email. A production host backend should wire Mika notification hooks in the
`createMikaBackendApi()` call and queue host-owned email work from those typed
intents.

Handle `magic_link.requested` and `order.confirmed` when the host wants to own
those emails completely; returning `{ handled: true }` suppresses Mika's
default magic-link or order-confirmation email. Other notification kinds are
hook-only today and should be routed to the host's mail, support, or ops queue
as needed.

For local browser testing, use
`/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` to create a dev admin
session.

## TODO: Replace Local Package Links Before Public Release

The template currently uses path dependencies for local development:

- `@bnomei/emdash-mika` -> `../emdash-mika`
- `@bnomei/emdash-actions` -> `../emdash-actions`

The template lifecycle scripts run `npm run local:build` before dev, build,
typecheck, test, preview, and seed commands so clean local checkouts do not
depend on stale ignored `dist` folders.

This is a release blocker. Before this repository becomes a public GitHub
template, replace those `file:../...` dependencies with released npm versions
and remove any local package build workaround that no longer applies.
