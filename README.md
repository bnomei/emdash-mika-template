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
- `/api/mika-action-contract.json` for the owner-protected admin action provider contract.

In production, EmDash and the Mika management endpoints have a separate HTTP
Basic owner gate in front of EmDash's own passkey/session, role, token-scope,
and CSRF checks. Public storefront pages and EmDash media files do not pass
through the owner gate. If either owner-gate variable is missing, protected
routes fail closed with `503`.

The currently unpatched `image-size` ICNS, JXL, and HEIF denial-of-service
advisories are mitigated at runtime by disabling those metadata parsers before
EmDash handles a media request. Remove the mitigation only after EmDash ships a
fixed `image-size` release.

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

## Mika Package

This deployable template carries Mika as a vendored npm package archive:

- `@bnomei/emdash-mika` -> `vendor/bnomei-emdash-mika-0.1.0.tgz`

`@bnomei/emdash-actions` is installed from the public npm package.

This makes isolated builds, including Railway, independent of a sibling checkout
and private Git credentials. Refresh the archive from a local Mika checkout with
the command in `vendor/README.md`. A downstream application can instead use a
published Mika version or its own workspace link; the lifecycle helper only
builds Mika when the dependency points to a sibling `file:../` path.

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

## Railway Deployment

The checked-in `Dockerfile` and `railway.json` deploy the Node 24/Astro variant.
Attach one persistent volume at `/data`; it stores the SQLite database, media
uploads, and server-side sessions. The production start script seeds the demo
fixture only when the database does not exist, so restarts do not reset data.

Before exposing the service, set these Railway service variables:

```text
EMDASH_OWNER_USERNAME=<your private username>
EMDASH_OWNER_PASSWORD=<a long random password>
EMDASH_ENCRYPTION_KEY=<output of npx emdash secrets generate>
EMDASH_SITE_URL=https://mika-demo.bnomei.com
```

Generate the owner password locally with `openssl rand -base64 32`. Keep both
secrets only in Railway; do not put their values in this repository. Then add
the custom domain `mika-demo.bnomei.com`, install the DNS records Railway
returns, and wait for the domain and TLS certificate to become active.

Open `https://mika-demo.bnomei.com/_emdash/admin` and first satisfy the owner
gate, then complete EmDash setup and register your passkey. The owner gate
protects the setup wizard too, closing the first-visitor account-takeover
window. Keep the service at one replica because the deployment uses one SQLite
database and filesystem sessions on one attached volume.
