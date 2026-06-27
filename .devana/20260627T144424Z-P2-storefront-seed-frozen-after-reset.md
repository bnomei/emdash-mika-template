DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:208,667-669,scripts/reset-fixture.mjs | Slug: storefront-seed-frozen-after-reset

# Storefront seed snapshot frozen at module import

## Finding

`const seed = readSeed()` runs once at module load. All storefront reads
(`products()`, `stockItems()`, `availabilityFor`, `accountFor`, etc.) use that
in-memory snapshot. `npm run fixture:reset` (`scripts/reset-fixture.mjs`) only
deletes and re-seeds SQLite; it does not reload the storefront seed constant.

## Violated Invariant Or Contract

After editing `seed/mika-actions.seed.json` and running `fixture:reset` without
restarting the dev server, storefront APIs should reflect the on-disk seed.
SQLite and storefront reads should not diverge from the updated file.

## Oracle

Edit seed `quantityOnHand` for `mira-clipboard-stock`, run `fixture:reset`, call
`api.stock.availability` without restart → must match new seed value, not import-time
snapshot.

## Counterexample

1. Dev server starts → `readSeed()` captures clipboard `quantityOnHand: 42`.
2. Edit seed file to `quantityOnHand: 100`; run `fixture:reset`.
3. Admin SQLite shows 100; `api.stock.availability` still returns
   `availableQuantity: 39` from frozen import snapshot.
4. Disk seed, SQLite, and storefront cache are three-way split until process restart.

## Why It Might Matter

Local development and demo resets appear successful while catalog, stock, and
account surfaces keep serving stale fixture data until the server restarts.

## Proof

Sequence: write path updates SQLite only → read path uses import-time `seed` →
no invalidation hook on reset.

## Counterevidence Checked

`grep readSeed` shows single import-time read. Tests spawn fresh processes with
re-import. Admin/storefront SQLite split is documented; this bug is stale JSON
relative to edited seed file on disk.

## Suggested Next Step

Reload seed on `fixture:reset` or lazy-read seed file per request; document
restart requirement if intentional.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `const seed = readSeed()` ran once at module import, so every
  storefront read used a frozen snapshot and editing the seed JSON + `fixture:reset` left disk/SQLite/
  storefront three-way split until restart. Replaced the constant with a lazy `seed()` accessor that
  caches by file path + mtime and reloads when either changes (via `statSync`), so on-disk edits are
  reflected on the next request without a restart. Added an `EMDASH_MIKA_TEMPLATE_SEED` env override for
  the seed path (also enables a safe test). Updated all accessors (`products()`, `stockItems()`, etc.) to
  `seed()`. A cross-process reload from the reset script isn't possible (separate process), but the
  mtime-based reload makes that unnecessary — `reset-fixture.mjs` (SQLite only) is unchanged. Added a test
  pointing the env at a temp seed: availability tracks 100→97 then 50→47 across an in-place edit (mtime
  bumped). `npm test` (32 passing), `tsc --noEmit`, and `npm run build` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:208,667-669,scripts/reset-fixture.mjs | P2 | storefront-seed-frozen-after-reset
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:208,667-669,scripts/reset-fixture.mjs - the storefront seed is now lazily read and reloaded on file (path/mtime) change, so edits + fixture:reset are reflected without a server restart.