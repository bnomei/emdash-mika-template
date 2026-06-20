# emdash-mika-template

A tiny EmDash/Astro project for testing Mika admin actions in collection and JSON-model fields.

## Quick start

```sh
npm install
npm run fixture:reset
npm run dev
```

The local packages are linked with `file:../emdash-mika` and `file:../emdash-actions`. Rebuild those repos when their `dist` output changes.

Useful paths:

- `/_emdash/admin` for the EmDash admin UI.
- `/api/mika-action-contract.json` for the provider and manifest contract.
- `seed/mika-actions.seed.json` for collection fields that use `widget: "actions:button"`.
- `src/lib/mika-api.ts` for typed smoke admin action handlers.

See `docs/usage.md` for the collection field mapping.

The local native plugin entrypoint is `src/plugins/mika-template-plugin.ts`; it calls Mika `createPlugin({ api })` directly so function-based API overrides are not serialized through EmDash descriptor options.

Fixture details are in `docs/testbed.md`. Use `npm run fixture:reset` to recreate the local sqlite database from the seed.
