DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:1114-1121 | Slug: entitlement-expired-mapped-active

# Expired seed entitlements are returned as active in account.get

## Finding

`accountFor` maps entitlement `fixture_status` to DTO `status` with only a revoked check. Seed rows marked `fixture_status: "expired"` are projected as `status: "active"`.

## Violated Invariant Or Contract

`EntitlementDTO.status` includes `"expired"`; seed entitlement `entitlements:nell-notebook-archive` is explicitly `fixture_status: "expired"`.

## Oracle

`account.get()` entitlement key `buttonwood_notebook_archive` should have `status: "expired"`, not `"active"`.

## Counterexample

1. Seed row `entitlements:nell-notebook-archive` has `"fixture_status": "expired"` and key `buttonwood_notebook_archive`.
2. `accountFor` maps `status: entry.data?.fixture_status === "revoked" ? "revoked" : "active"`.
3. `account.get()` returns that entitlement with `status: "active"`.

## Why It Might Matter

API consumers and future account UI treating entitlements as active when the fixture data marks them expired; inconsistent with `downloadSummary` which correctly handles `"expired"`.

## Proof

**Contract mismatch:** Same seed file uses `fixture_status: "expired"` for downloads (handled in `downloadSummary`) and entitlements (not handled in `accountFor`).

**Counterexample value:** `entitlements:nell-notebook-archive` seed row.

## Counterevidence Checked

- Account UI does not render entitlements today (`AccountOverview.astro`); bug is visible via `account.get()` and any `EntitlementDTO` consumer.
- `expiresAt` from seed ref is passed through but `status` remains `"active"`.

## Suggested Next Step

Map `fixture_status === "expired"` to `status: "expired"` in the entitlement projection, mirroring download handling.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: the `accountFor` entitlement projection mapped only
  `fixture_status === "revoked"`, defaulting everything else (including `"expired"`) to `"active"`, so
  `entitlements:nell-notebook-archive` (key `buttonwood_notebook_archive`, fixture_status expired)
  surfaced as active. `EntitlementDTO.status` allows `"expired"`. Added an `entitlementStatus` helper
  (revoked → revoked, expired → expired, else active) mirroring `downloadSummary`, and imported
  `EntitlementDTO` for the return type. Added an assertion that the expired entitlement projects
  `status: "expired"`. `npm test` (21 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:1114-1121 | P2 | entitlement-expired-mapped-active
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:1114-1121 - accountFor mapped expired seed entitlements to active; now projects fixture_status expired as EntitlementDTO status expired.