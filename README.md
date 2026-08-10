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

The storefront files under `src/actions`, `src/components`, `src/lib/account.ts`,
`src/lib/cart.ts`, `src/lib/display.ts`, `src/lib/form.ts`, `src/lib/routes.ts`,
`src/pages`, and `src/styles/kumo.css` are intentionally close to
`@bnomei/emdash-mika/templates/astro/*`. Keep reusable behavior upstream in
Mika, and keep this repository focused on a runnable host app.

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
calls Mika `createMikaPlugin({ api })` from `@bnomei/emdash-mika/server` so
function-based API overrides are not serialized through EmDash descriptor
options.

## Local Mika Development Link

This development checkout intentionally uses one local path dependency:

- `@bnomei/emdash-mika` -> `../emdash-mika`

`@bnomei/emdash-actions` is installed from the public npm package.

The lifecycle scripts run `npm run local:build` before dev, build, preview,
typecheck, test, and seed commands. Set
`EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD=1` only when you intentionally want to
use an already-built local Mika package.

This sibling link is intentional for Mika development and does not block using
this repository as a minimal runnable starter. Mika's release proof installs the
candidate tarball into a disposable copy of the starter. Broader contract and
edge-case coverage belongs to Mika's package tests and public docs. A downstream application should
choose a published Mika version or its own workspace link and only keep the
local build workaround when it uses sibling development.

## Experimental Cloudflare Variant Files

The default checkout is the Node.js variant: `@astrojs/node`, SQLite via
`better-sqlite3`, and local filesystem uploads.

Cloudflare Workers support is sketched as inactive variant files in the same
tree:

- `package.cf.json` replaces the Node adapter and SQLite dependency with
  `@astrojs/cloudflare`, `@emdash-cms/cloudflare`, Worker types, and `wrangler`.
- `astro.config.cf.mjs` swaps EmDash storage from SQLite/local files to D1/R2
  bindings.
- `wrangler.cf.jsonc` declares the D1, R2, Worker Loader, and compatibility
  bindings.
- `worker.cf.ts` exports the Astro Cloudflare handler and EmDash plugin
  bridge.

To try the Cloudflare variant manually:

```sh
cp package.cf.json package.json
cp astro.config.cf.mjs astro.config.mjs
cp wrangler.cf.jsonc wrangler.jsonc
cp worker.cf.ts src/worker.ts
npm install
wrangler d1 create emdash-mika-template
```

Then update `wrangler.jsonc` with the real D1 database ID before deploying:

```sh
npm run deploy
```

This is intentionally not wired to a Cloudflare deploy button yet. The one-click
deploy flow expects real `package.json`, `astro.config.mjs`, `wrangler.jsonc`,
and `src/worker.ts` files at the target path, so these `.cf` files are a
low-maintenance variant sketch until we decide whether to generate a dedicated
Cloudflare folder.

## Verification

```sh
npm run typecheck
npm run test
npm run build
```

Use `npm run fixture:reset` whenever you want to recreate the local SQLite
database from the seed.
