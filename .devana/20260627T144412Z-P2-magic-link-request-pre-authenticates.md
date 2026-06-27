DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:421-425,434-436 | Slug: magic-link-request-pre-authenticates

# magicLink.request sets session email before verify

## Finding

`magicLink.request` immediately writes `state.accountEmail = input.email` and
persists the session. `account.get` then returns that email as the signed-in
customer without any `magicLink.verify` call. The two-step magic-link contract
(request → verify) is collapsed into the request step.

## Violated Invariant Or Contract

`magicLink.request` should only queue or send a link. Authenticated customer
identity should be established only after `magicLink.verify` succeeds.

## Oracle

After `magicLink.request({ email: "attacker@evil.test" })` and before verify,
`account.get().customer.email` must not equal the requested email (or must
remain unauthenticated).

## Counterexample

1. POST `actions.mika.magicLink.request` with `email=attacker@evil.test`.
2. Fixture sets and persists `state.accountEmail`.
3. User navigates to `/account` without opening a link or submitting verify.
4. `account.get()` returns `customer.email === "attacker@evil.test"`.

## Why It Might Matter

Anyone who can trigger a magic-link request form can impersonate any email in
the session-backed account UI before possession of a link is proven.

## Proof

Dataflow trace: email input → `magicLink.request` → `persistSessionState` →
`account.get` reads `state.accountEmail`. No verify gate between request and
account projection.

## Counterevidence Checked

Excluded `magic-link-return-to-dropped` covers post-verify redirect only.
`emptySessionState` pre-seeds a default email, but request overwrites it.
Template sends no real email, yet verify flow still exists implying two-step
semantics.

## Suggested Next Step

Defer `accountEmail` mutation until `magicLink.verify` succeeds; request should
only record a pending challenge token.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `magicLink.request` wrote `state.accountEmail = input.email` and
  persisted it, so `account.get` reflected the requested email (and the sign-in pages would show signed-in
  content) before any verify. Implemented the two-step contract: added a `pendingEmail` field
  (persisted in the snapshot); `request` now records only `state.pendingEmail` and does not touch
  `accountEmail`; `verify` establishes `accountEmail` from the verified challenge (`pendingEmail`, then a
  token-encoded email, then the default customer) and clears `pendingEmail`. Existing flow preserved
  (request mira.monday → verify → account mira.monday). Added a test: after request(attacker@evil) the
  pre-verify account is not the attacker, and identity is established only after verify. `npm test`
  (26 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:421-425,434-436 | P2 | magic-link-request-pre-authenticates
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:421-425,434-436 - magicLink.request set accountEmail immediately; now it records only a pendingEmail challenge and verify establishes identity, so account.get no longer reflects the requested email pre-verify.