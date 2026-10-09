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

`image-size` is updated to the patched 2.0.4 release. ICNS, JXL, and HEIF metadata
parsers remain disabled before EmDash handles media requests as defense in depth;
the dependency upgrade does not expand the template's accepted image formats.

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

- `@bnomei/emdash-mika` -> `vendor/bnomei-emdash-mika-0.2.0.tgz`

`@bnomei/emdash-actions` is installed from the public npm package.

This makes isolated builds, including Railway, independent of a sibling checkout
and private Git credentials. Refresh the archive from a local Mika checkout with
the command in `vendor/README.md`. A downstream application can instead use a
published Mika version or its own workspace link; the lifecycle helper only
builds Mika when the dependency points to a sibling `file:../` path.

## Browser Agent Testbed

The shared page shell enables WebMCP and optional ChatGPT annotations independently.
Use `<MikaKumoPage webmcp={false}>` for annotations only,
`annotations={false}` for WebMCP only, or `storefront={false}` for ordinary forms.
WebMCP uses async `document.modelContext.registerTool`; ChatGPT does not support
declarative HTML tools or iframe tools. Unsupported browsers keep human forms.
Annotation previews never submit forms or mutate the cart.

`src/lib/mika-storefront.ts` connects tools to the same fixture API as forms,
with atomic SQLite run claims in `mika_storefront_runs`. Checkout and subscription
reviews are rechecked against the original approved terms at the fixture mutation
boundary. Human confirmation is not an agent tool. Sign-in enables account tools
only after the explicit fixture magic-link POST (`template-login` after requesting
a link). `/account` shows an explicit guest form before that POST and exposes the
simulated link after requesting it. Any email opens the same seeded customer;
the other human account fixture pages remain demo data, not an authentication
boundary. This is not production authentication or email delivery.

Checkout status is passive. The success page offers an explicit **Simulate
payment — no charge** POST for the current session. A return URL does not prove
payment, and this fixture does not contact a payment provider. Production needs
durable commerce repositories, real authentication and verified provider events;
SQLite tool-run persistence does not make session snapshots atomic with provider
effects or concurrent webhooks. The production owner gate is unchanged.

The vendored 0.2.0 archive is an integration artifact supplied from uncommitted
Mika work, not a registry release. See `docs/testbed.md` for validation boundaries.

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

The experimental Cloudflare manifest uses Kumo 2.6.0 because
`@emdash-cms/cloudflare@1.2.0` requires that exact peer version; the validated
Node storefront uses Kumo 2.14.0. Cloudflare runtime compatibility is not implied
by the Node build or its dependency audit.

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

## Amp Orbs

`.agents/setup` installs Node 24 from `.nvmrc`, the npm version in
`package.json`, and locked dependencies, then seeds the local SQLite database
only if it does not exist. It preserves existing `.env` files and fixture data.
No production credentials are required or generated. The toolchain is available
in new login shells, including supervised services.

Amp snapshots the prepared environment. When setup runs again, it reuses
dependencies if the manifests, vendored packages, install patch, setup script,
and runtime still match. Delete `node_modules/.amp-setup-key` to force a clean
install on the next setup run. `.agents/resume` performs no installation or reset.

Run `amp orb services ensure` to start the supervised development server and
print its portal URL. Services are declared in `.amp/services.yaml`; setup does
not start background processes.

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
