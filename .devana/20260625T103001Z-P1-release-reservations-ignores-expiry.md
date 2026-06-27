DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-api.ts:332-372 | Slug: release-reservations-ignores-expiry

# releaseExpiredReservations releases every reservation, never checks expiry

## Finding

`admin.releaseExpiredReservations` is supposed to release only *expired* stock
reservations as of `input.now`. The implementation reads `input.now`
(line 333) but only uses it as a `lastReleasedAt` label. The release loop's
sole gate is `if (quantityReserved <= 0) continue;` (line 341). Every stock row
with a positive `quantityReserved` is unconditionally reset to
`quantityReserved: 0` and its `availableQuantity` inflated to the full on-hand
quantity, regardless of whether any reservation has expired.

## Violated Invariant Or Contract

An operation named `releaseExpiredReservations` that accepts a `now` timestamp
must release only reservations whose hold has expired as of `now`. Non-expired
(active) reservations must remain reserved.

## Oracle

- The method name plus the `now` parameter establish `now` as the expiry
  cutoff.
- The canonical implementation in the dependency
  `../emdash-mika/src/storage/repositories.ts` (`releaseExpiredReservations`)
  selects only reservation events where `expires_at IS NOT NULL AND
  expires_at <= now` and releases exactly those. That is the source-of-truth
  contract this fixture is standing in for.

## Counterexample

Invoke `releaseExpiredReservations({ now: "2000-01-01T00:00:00.000Z" })` (a
cutoff far in the past, so nothing should qualify as expired). Every seeded
stock item with a reservation is still zeroed:

- `stock_bw_clip_mini` quantityReserved 3 → 0
- `stock_bw_pennant_rain` quantityReserved 6 → 0
- `stock_bw_zine_workshop` quantityReserved 1 → 0
- `stock_bw_sunday_club` quantityReserved 1 → 0

The action reports `releasedReservations: 11` across 4 stock items even though
the requested cutoff predates any reservation.

## Why It Might Matter

An operator running "release expired reservations" expecting only stale holds
to be freed instead frees *all* active holds. Each released reservation raises
the persisted `availableQuantity` (line 354), so reserved-but-unpaid stock
becomes purchasable again — an inventory-integrity defect that enables
overselling. Because the write is persisted to the SQLite fixture DB, the bad
state survives the request.

## Proof

Control-flow trace (`src/lib/mika-api.ts:332-366`):
- Line 333: `now = String(input.now ?? currentISODateTime())` — read once.
- Lines 337-341: loop over every stock row; only filter is
  `quantityReserved <= 0`.
- Lines 351-355: `quantityReserved: 0`, `availableQuantity: Math.max(0,
  quantityOnHand)` written for every remaining row.
- Lines 357-358: `now` used only as `lastReleasedAt`.
- No `expiresAt`/`expires_at`/`reservedUntil` is read anywhere in the function;
  the seed `quantities` objects carry no expiry field, so the override has no
  data to honor the "expired" contract yet still reports a release.

## Counterevidence Checked

- Confirmed `input.now` is never compared against any reservation timestamp
  (grepped the whole method body) — it is purely a label.
- Confirmed the seed stock `quantities` objects
  (`seed/mika-actions.seed.json:854-857` etc.) contain only `quantityOnHand`,
  `quantityReserved`, `lowStockThreshold` — no per-reservation expiry, so even
  an expiry-aware variant would have nothing to compare; the override does not
  attempt the comparison and releases all.
- Distinct from `order-refund-exceeds-total`; this is the reservation-release
  action.

## Suggested Next Step

Gate the release on a real expiry timestamp (add an `expiresAt`/`reservedUntil`
to the reservation fixture data and skip rows whose expiry is after
`input.now`), or rename/limit the action so it cannot silently release active
holds.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: the release loop's only gate was `quantityReserved <= 0`; `input.now`
  was used solely as a `lastReleasedAt` label, so every active hold was zeroed and `availableQuantity`
  inflated regardless of cutoff. Per the suggested next step, added a `reservedUntil` expiry to each
  reserved stock item's `quantities` in the seed (clip_mini, pennant_rain, zine_workshop, sunday_club; all
  `2026-06-24T12:00:00.000Z`) and gated the release on it, mirroring the canonical storage contract
  (`expires_at IS NOT NULL AND expires_at <= now`): skip rows with no `reservedUntil` or whose
  `reservedUntil > now` (ISO-8601 UTC lexical compare). Updated the release-all test to pass an explicit
  `now` after expiry (clock-independent; still releases 11 across 4 items) and added the report's
  counterexample test (`now: 2000-01-01` releases 0 and leaves clipboard reserved at 3). `npm test`
  (22 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-api.ts:332-372 | P1 | release-reservations-ignores-expiry
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-api.ts:332-372 - releaseExpiredReservations released every active reservation; now seeds a reservedUntil expiry and releases only holds with reservedUntil <= now, preventing oversell.
