DEVANA-FINDING: v1
Priority: P0 | Confidence: high | Security-sensitive: yes | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:843-857,940-946 | Slug: anonymous-shared-session-key

# Anonymous visitors share one in-memory storefront session

## Finding

When Astro session storage has no persisted snapshot yet, unrelated anonymous browsers on the same Node process reuse the same in-memory session bucket (`template-browser-session`). Cart, wishlist, checkout, and account-email mutations from one visitor can appear on another visitor's first request.

## Violated Invariant Or Contract

Storefront fixture state must be isolated per browser/session (`docs/testbed.md`: cart, wishlist, checkout, and magic-link state are "in memory per session").

## Oracle

Two distinct anonymous request contexts with empty `ctx.session.get("mika-template-storefront")` must not read or mutate each other's cart lines.

## Counterexample

1. Visitor A (no `customerId`, no `mika_template_session` cookie, empty Astro session) calls `cart.add` for a clipboard variant.
2. `persistSessionState` writes into `sessionStates.set("template-browser-session", stateA)`.
3. Visitor B opens the site with a fresh Astro session; `readStoredSessionState` returns `undefined`.
4. `sessionState` skips hydration and returns `sessionStates.get("template-browser-session")` — Visitor A's cart.
5. Visitor B sees A's items; a later `persistSessionState` in B can persist A's cart into B's Astro session storage.

## Why It Might Matter

Cross-visitor cart and checkout leakage in dev/demo hosting, corrupted purchases, and accidental account-email binding on shared infrastructure.

## Proof

**Dataflow trace:** `templateSessionKey` → constant `"template-browser-session"` when no cookie/customer/test id → `sessionState` empty-storage branch → shared `sessionStates` Map entry.

**Counterexample value:** Two `createMika(Astro)` contexts with different Astro session cookies and no persisted snapshot.

## Counterevidence Checked

- `mika_template_session` cookie is parsed but never set anywhere in the repo.
- Astro `ctx.sessionId` (`session.sessionID`) is ignored unless it starts with `template-test-`.
- Per-browser Astro `ctx.session.set` isolates after first successful persist, but the empty-storage path still reads the shared Map first.
- Unit tests use `sessionId: "template-test-*"` or in-memory-only contexts, avoiding production anonymous partitioning.

## Suggested Next Step

Partition `templateSessionKey` on Astro `sessionId` or set/read a dedicated `mika_template_session` cookie, and initialize a fresh `emptySessionState()` when no stored snapshot exists instead of reusing a global fallback Map entry.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `templateSessionKey` only honored `ctx.sessionId` when it
  started with `template-test-`, so real anonymous Astro browsers (whose `ctx.sessionId` is the
  per-browser `session.sessionID`) fell through to the shared `"template-browser-session"` constant
  and shared one in-memory bucket. Fixed by partitioning anonymous visitors on any present
  `ctx.sessionId` (`session:<id>`) ahead of the cookie/constant fallbacks. The existing test
  "keeps anonymous cart state across Astro action and page contexts" had encoded the buggy
  behavior (two *different* session ids sharing a cart); corrected it to model one browser with a
  single session id, and added "isolates anonymous cart state between distinct browser sessions"
  to prove cross-browser isolation. `npm test` (16 passing) and `tsc --noEmit` both green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:843-857,940-946 | P0 | anonymous-shared-session-key
DEVANA-SUMMARY: Status=fixed | P0 high src/lib/mika-fixture-storefront.ts:843-857,940-946 - Anonymous visitors without persisted Astro session snapshots shared one in-memory session key, leaking cart and checkout state across browsers on the same process. Fixed by partitioning on the Astro per-browser session id.