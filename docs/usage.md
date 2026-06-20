# Mika action field usage

This project is a minimal consumer for testing Mika actions inside EmDash collection entries.

## Local package links

The template uses path dependencies:

- `@bnomei/emdash-mika` -> `../emdash-mika`
- `@bnomei/emdash-actions` -> `../emdash-actions`

The template lifecycle scripts run `npm run local:build` before dev, build, typecheck, test, preview, and seed commands so clean local checkouts do not depend on stale ignored `dist` folders. Set `EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD=1` only when you intentionally want to skip that preflight.

## Run

```sh
npm install
npm run seed:apply
npm run dev
```

Open `/_emdash/admin`, then inspect the seeded peanut-themed collections.

## Action fields in the seed

The action fields are normal EmDash JSON fields with `widget: "actions:button"`:

- `mika_catalog_sync` runs `mika.catalog.syncEntry` and requires the saved entry target.
- `stock_adjust` runs `mika.stock.adjust` and reads `stockItemId` from the field value.
- `entitlement_grant` runs `mika.entitlement.grant` and reads customer context from the field value.
- `order_refund` and `order_cancel` run order provider actions and read `orderId` from the field value.
- `webhook_replay` runs `mika.webhook.replay` and reads `webhookId` from the field value.
- `entitlement_revoke` runs `mika.entitlement.revoke` and reads `entitlementId` or `entitlementKey` from the field value.
- `email_resend` runs `mika.email.resend` and reads `emailId` from the field value.
- `license_revoke` runs `mika.license.revoke` and reads `licenseId` from the field value.
- `download_issue` runs `mika.download.issue` and reads `orderId`, `entitlementId`, or `orderLineId` from the field value.

The current Mika API overrides in `src/lib/mika-api.ts` are a resettable fixture adapter. They mutate the local SQLite seed rows so admin action buttons have visible effects; replace the admin overrides with your real provider/repository-backed implementation when this becomes an integration app.

## Contract check

`/api/mika-action-contract.json` returns the provider config and Mika action manifest that the actions plugin consumes.

For agent/browser testing, use `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` to create a local dev admin session.

The local native plugin entrypoint is `src/plugins/mika-template-plugin.ts`; it calls Mika `createPlugin({ api })` directly so function-based API overrides are not serialized through EmDash descriptor options.

The broader resettable fixture layout is documented in `docs/testbed.md`.
