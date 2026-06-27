DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:273-275 | Slug: cart-merge-ignores-source-session

# cart.merge ignores sourceSessionId input

## Finding

The `cart.merge` override accepts only `ctx` and never reads `input`. It returns
the caller's current cart with no lookup of `input.sourceSessionId` and no line
union. Upstream Mika `cart.merge` merges guest cart lines into the authenticated
cart when `sourceSessionId` is provided.

## Violated Invariant Or Contract

`cart.merge(ctx, { sourceSessionId })` must merge the open cart from the source
session into the caller's cart (quantities combined per line).

## Oracle

Guest session A has cart lines → session B calls `cart.merge({ sourceSessionId: A })`
→ B's cart contains A's lines.

## Counterexample

1. `sessionStates` for key A holds cart items.
2. `cart.merge(ctxB, { sourceSessionId: "A" })` returns `ok` with B's unchanged cart.
3. No source session lookup or `mergeCartLines` equivalent runs.

## Why It Might Matter

Login or session-upgrade flows that rely on `cart.merge` silently drop guest cart
contents in this template host.

## Proof

State trace: source session populated → merge on destination → destination cart
identical to pre-merge. Contract mismatch with Mika API `mergeCartInputSchema`.

## Counterevidence Checked

No template UI calls `cart.merge` today; bug is latent until a host wires
guest-to-auth handoff. Handler signature omits `input` parameter entirely.

## Suggested Next Step

Implement source-session cart lookup and line merge per upstream backend
semantics.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `cart.merge` took only `ctx` and returned the caller's cart
  unchanged, ignoring `input.sourceSessionId`. Implemented the merge: read `input.sourceSessionId`,
  resolve the source state via a new `findSourceSessionState` (accepts a raw session id — resolved to the
  `session:`/`customer:`/`user:` in-memory key — or an exact key), and union its open cart lines into the
  caller's cart with quantities combined per line (matching cart.add). No-op when the source is missing or
  is the caller. Added a test: a source session with panel_pack x2 merges into a dest holding pennant_rain
  x1, yielding both lines with panel_pack at qty 2. Note: merge is additive and does not clear the source
  (cross-session Astro-snapshot persistence isn't available from the caller's ctx); acceptable for this
  latent, UI-unused path. `npm test` (30 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:273-275 | P1 | cart-merge-ignores-source-session
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:273-275 - cart.merge now resolves input.sourceSessionId and unions the source session's cart lines into the caller's cart.