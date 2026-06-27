DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: yes | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:427-431 | Slug: magic-link-verify-email-impersonation

# magicLink.verify accepts arbitrary email-shaped tokens

## Finding

`magicLink.verify` sets `state.accountEmail` to `input.token` whenever the token
contains `@`, with no lookup, expiry, or binding to a prior `magicLink.request`.
Any email-shaped string becomes the session identity.

## Violated Invariant Or Contract

Verified session identity must come from a validated magic-link token tied to
`magicLink.request`, not from any string containing `@`.

## Oracle

`magicLink.verify({ token: "attacker@evil.test" })` without a matching request
must not set `account.customer.email` to the attacker value.

## Counterexample

1. Fresh session (or after request for a different email).
2. `magicLink.verify(ctx, { token: "attacker@evil.test" })` succeeds.
3. `account.get()` returns `customer.email === "attacker@evil.test"`.
4. No token store, expiry, or request binding is consulted.

## Why It Might Matter

Authentication bypass: arbitrary email impersonation in account surfaces that
trust `account.get` identity (orders, downloads, subscriptions UI).

## Proof

Control-flow trace: `input.token.includes("@")` branch copies token directly to
`accountEmail` → `accountFor` projects it as customer email.

## Counterevidence Checked

Test uses opaque `template-login` token (maps to default customer), not an `@`
branch. `account/magic-link.astro` auto-posts URL `?token=` into verify form.
No server-side token validation exists in this repo.

## Suggested Next Step

Validate verify tokens against a stored, expiring challenge created by
`magicLink.request`; reject email-shaped tokens without a match.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed (paired with P2 magic-link-request-pre-authenticates). Confirmed valid: `verify`
  copied any `@`-containing token straight to `accountEmail` with no lookup/binding, so
  `verify({ token: "attacker@evil.test" })` impersonated that email. Verify now requires BOTH a pending
  challenge from `magicLink.request` (`state.pendingEmail`) AND the presented token to equal the canonical
  fixture token (`templateMagicLinkToken = "template-login"`); otherwise it returns
  `fail("MAGIC_LINK_INVALID", ..., 401)`. On success it signs in the requested (pending) email and clears
  the challenge. This removes the email-shaped-token branch entirely, so identity can only come from a
  requested-then-verified challenge. Existing request→verify(template-login) flow still works. Added a
  test: a forged email token and the canonical token without a request both 401 and leave the account
  un-impersonated. `npm test` (27 passing), `tsc --noEmit`, and `npm run build` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:427-431 | P1 | magic-link-verify-email-impersonation
DEVANA-SUMMARY: Status=fixed | P1 high src/lib/mika-fixture-storefront.ts:427-431 - magicLink.verify accepted any @-token as identity; now requires a pending request challenge plus the canonical fixture token, rejecting forged tokens with 401.