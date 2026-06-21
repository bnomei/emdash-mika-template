# emdash-mika-template

A runnable Astro + EmDash storefront starter for Mika.

The template includes a Buttonwood Lot-themed fixture catalog, Kumo UI-backed
Mika product purchase forms, cart, wishlist, checkout returns, account/download
pages, agent-readable storefront metadata, and the existing EmDash admin action
testbed in one app.

## Quick Start

```sh
npm install
npm run fixture:reset
npm run dev
```

Useful paths:

- `/` for the product listing.
- `/products/mira-field-clipboard` for a Mika product page.
- `/products/buttonwood-creator-bundle` for download, subscription, license, and stock-state fixtures.
- `/cart`, `/wishlist`, `/account`, and `/account/magic-link` for customer flows.
- `/checkout/success?checkoutId=checkout_buttonwood_1001` for a seeded checkout status.
- `/download/download_panel_pack_mira` for a seeded download redirect.
- `/llms.txt` and `/.well-known/mika-agent.json` for agent-readable surfaces.
- `/_emdash/admin` for the EmDash admin UI and Mika action fields.
- `/api/mika-action-contract.json` for the admin action provider contract.

## Template Shape

The storefront files under `src/actions`, `src/components`, `src/lib/form.ts`,
`src/lib/routes.ts`, `src/styles/kumo.css`, and the copied customer pages are
intentionally close to `@bnomei/emdash-mika/templates/astro/*`. Keep reusable
behavior upstream in Mika, and keep this repository focused on a runnable host
app.

Kumo setup lives in:

- `src/components/MikaKumoPage.astro` for the shared Astro page shell.
- `src/styles/kumo.css` for the Kumo standalone stylesheet import and Mika
  token classes.
- `@cloudflare/kumo`, `@phosphor-icons/react`, `react`, and `react-dom` in
  `package.json`.

Host-specific pieces live here:

- `src/lib/mika-fixture-storefront.ts` provides the fixture storefront API.
- `src/lib/mika-api.ts` combines storefront fixture overrides with admin action
  fixture overrides.
- `src/pages/index.astro` and `src/pages/products/[slug].astro` are the host
  product listing/detail pages.
- `src/pages/api/mika-action-contract.json.ts` exposes the admin action provider
  smoke contract.
- `seed/mika-actions.seed.json` provides the resettable EmDash catalog, stock,
  customer, order, checkout, webhook, entitlement, email, license, and download
  fixture data.

The local native plugin entrypoint is `src/plugins/mika-template-plugin.ts`. It
calls Mika `createPlugin({ api })` directly so function-based API overrides are
not serialized through EmDash descriptor options.

## TODO: Replace Local Mika Link Before Public Release

This development checkout intentionally uses one local path dependency:

- `@bnomei/emdash-mika` -> `../emdash-mika`

`@bnomei/emdash-actions` is installed from the public npm package.

The lifecycle scripts run `npm run local:build` before dev, build, preview,
typecheck, test, and seed commands. Set
`EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD=1` only when you intentionally want to
use an already-built local Mika package.

This is a release blocker. Before publishing this repository as a public GitHub
template, replace the remaining `file:../emdash-mika` dependency in
`package.json` with a released npm version and remove the local Mika build
workaround if it is no longer needed.

## Verification

```sh
npm run typecheck
npm run test
npm run build
```

Use `npm run fixture:reset` whenever you want to recreate the local SQLite
database from the seed.
