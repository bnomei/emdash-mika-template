DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:491-500,1156-1172 | Slug: expired-download-still-resolves

# Expired download tokens still resolve to files

## Finding

Downloads marked `fixture_status: "expired"` in the seed are shown as expired in the account UI, but `download.resolve` and `GET /download/[token]` still return a successful redirect to the public asset.

## Violated Invariant Or Contract

Expired or revoked download tokens must not grant file retrieval; account download status and the download entry point must agree.

## Oracle

Seed row `nell-archive-download` (`downloadRef: download_archive_nell`, `fixture_status: "expired"`, `expiresAt: 2026-06-01`) must fail resolution while account lists it as expired.

## Counterexample

1. `account.get()` returns `downloads[].status === "expired"` for `download_archive_nell`; `AccountDownloads.astro` hides the download link.
2. `GET /download/download_archive_nell` calls `Mika.download.resolve("download_archive_nell")`.
3. `download.resolve` matches only `downloadRef === token` and returns `redirectUrl: /template-downloads/download_archive_nell.txt`.
4. The route redirects to the existing file under `public/template-downloads/`.

## Why It Might Matter

Users (or anyone with the token URL) can retrieve files the account surface explicitly marks as unavailable, breaking entitlement/expiry semantics.

## Proof

**Cross-entry mismatch:** `downloadSummary` maps `fixture_status === "expired"` to `status: "expired"`; `download.resolve` never reads `fixture_status` or `download_issue.expiresAt`.

**Control-flow trace:** `[token].ts` redirects whenever `result.ok` without an expiry gate.

## Counterevidence Checked

- `licenseSummary` skips expired downloads when linking licenses, but that does not gate `download.resolve`.
- `test/mika-api.test.ts` asserts resolve succeeds for all seeded tokens including expired ones (documents current behavior, not a guard).
- No middleware or route-level expiry check outside the fixture override.

## Suggested Next Step

Reject `download.resolve` when `fixture_status === "expired"` or `expiresAt` is in the past, and add a matching test that expects failure for `download_archive_nell`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `download.resolve` matched only on `downloadRef === token` and
  never consulted `fixture_status`, so `download_archive_nell` (fixture_status "expired") still
  returned a 200 redirect to the public asset while `downloadSummary` reported it expired in the
  account UI. `downloadResolve` runs with `requiresRequestContext: false`, so `resolve` has no ctx/now;
  gated it on the same deterministic `fixture_status === "expired"` condition the account surface uses,
  returning `fail("TOKEN_EXPIRED", ..., 410)` so `/download/[token]` responds 410 Gone. Seed downloads
  are only "ready" or "expired", so this fully covers expiry without a non-deterministic now-based
  comparison. Updated the resolve loop test to expect 410 for expired tokens (was asserting success for
  all). `npm test` (16 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:491-500,1156-1172 | P1 | expired-download-still-resolves
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:491-500,1156-1172 - Expired seed downloads were labeled expired in account UI but still resolved and redirected via /download/[token]. Fixed by rejecting resolve for fixture_status === "expired" with 410.