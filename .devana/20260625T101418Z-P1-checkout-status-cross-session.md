DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: yes | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:395-417 | Slug: checkout-status-cross-session

# Checkout status resolves across unrelated sessions

## Finding

After the current session lookup misses, `checkout.status` scans every entry in the process-global `sessionStates` Map and returns the first matching checkout. Any holder of a dynamic `checkoutId` can read another visitor's checkout metadata without session binding.

## Violated Invariant Or Contract

Checkout status for runtime-created checkouts should be scoped to the session that created them; the success page defines a `binding_mismatch` status for failed verification but the fixture never emits it.

## Oracle

Session B must not resolve a `checkoutId` created only in session A when B lacks A's session context.

## Counterexample

1. Session A runs `checkout.start` → `checkoutId = checkout_template_<ts>`, stored under A's session key.
2. Session B opens `/checkout/success?checkoutId=checkout_template_<ts>` (or calls `checkout.status({ checkoutId })` without request context).
3. Current-session lookup misses in B.
4. Global loop `for (const state of sessionStates.values())` returns A's checkout (`status`, `orderId`, `redirectUrl`, `provider`).

## Why It Might Matter

Checkout IDs appear in URLs, referrers, and logs. Cross-session lookup exposes order IDs and completion state to unrelated visitors on the same process.

## Proof

**Control-flow trace:** `isRequestContextInput` false for bare `checkoutId` string → skip caller session → iterate all `sessionStates`.

**Counterexample value:** Known `checkoutId` from another session's `redirectUrl`.

## Counterevidence Checked

- Seeded checkout IDs (`checkout_buttonwood_1001`) are intentionally public fixture data (README, tests).
- When a full `MikaRequestContext` is passed, lookup is session-scoped first (lines 407-409).
- Checkout IDs embed timestamps, reducing guessability but not eliminating IDOR when the URL is shared.

## Suggested Next Step

Remove the global `sessionStates.values()` fallback for dynamic checkouts, or require a session-bound status token as in production Mika backends.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: after the session-scoped lookup missed, `checkout.status` looped
  over the process-global `sessionStates` Map and returned the first matching checkout, so any holder of
  a leaked dynamic `checkoutId` (URLs/referrers/logs) could read another session's status/orderId/redirect.
  Removed the `for (const state of sessionStates.values())` fallback; dynamic checkouts now resolve only
  via the creating session's context (the real success page always passes ctx — `checkoutStatus` has
  `requiresRequestContext: true`). Seeded public checkout ids still resolve through `seededCheckout`,
  unchanged. Updated the checkout test (a bare `{ checkoutId }` lookup now 404s) and added a cross-session
  isolation test (session B cannot resolve session A's checkout; the owner still can). `npm test`
  (20 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:395-417 | P1 | checkout-status-cross-session
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:395-417 - checkout.status scanned all in-memory sessions; removed the global fallback so dynamic checkout ids resolve only within the creating session, closing the cross-session IDOR.