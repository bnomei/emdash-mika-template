DEVANA-FINDING: v1
DEVANA-STATE: duplicate | P2 | high | security=yes
DEVANA-KEY: src/lib/mika-fixture-storefront.ts:467-469 | account-portal-open-redirect

# account.portal echoes unsanitized returnTo into the /account redirect (open redirect)

## Finding

The template's `account.portal` override returns the caller-supplied `returnTo`
verbatim as the redirect target:

```ts
// src/lib/mika-fixture-storefront.ts:467-469
async portal(_ctx, input = {}) {
  return ok({ redirectUrl: input.returnTo ?? "/account" });
},
```

`src/pages/account.astro:18-20` then redirects to that value with no further
checking:

```ts
const portalResult = Astro.getActionResult(actions.mika.account.portal);
if (portalResult?.data?.redirectUrl) {
  return Astro.redirect(portalResult.data.redirectUrl);
}
```

Because `returnTo` is never constrained to a same-origin path on this code
path, a request that submits `returnTo=https://evil.example/login` produces a
302 to an attacker-controlled origin. This is the same defect class already
filed for `checkout.start` `successPath`, but at a separate entry point
(`account.portal` -> `account.astro`) that needs its own fix.

## Violated Invariant Or Contract

A server-issued redirect derived from client input must resolve to a
same-origin path. The upstream default handler this override replaces enforces
exactly that: `createAccountPortalSession` builds its return URL through
`accountPortalReturnUrl` -> `safeRequestReturnPath` -> `mikaSafeReturnPath`
(`@bnomei/emdash-mika/src/api/backend.ts:1484,3157-3161`,
`src/api/redirect-policy.ts`), which rejects `//`, backslashes, dot-segments,
non-http(s) schemes, and cross-origin targets. The override drops that guard.

## Oracle

- Neighboring implementation / source of truth: the default `account.portal`
  handler sanitizes `returnTo` via `mikaSafeReturnPath` before returning a
  redirect URL (`backend.ts:781`, `3157-3161`). The override must not weaken
  that contract.
- Action input schema does not compensate: `accountPortal` validates with
  `returnToInputSchema = z.object({ returnTo: optionalStringSchema })`
  (`src/api/operations.ts:797-808`, `src/api/validation.ts:157-159`) — an
  optional trimmed string with no origin/path restriction.

## Counterexample

1. A victim is induced to submit the `actions.mika.account.portal` form (the
   form exists at `account.astro:76-79`) with body `returnTo=https://evil.example/login`.
   The server-rendered hidden input is sanitized, but the action endpoint
   accepts an arbitrary posted `returnTo` (schema is a plain string).
2. The override runs: `redirectUrl = "https://evil.example/login"`.
3. On the subsequent render, `account.astro:18-20` calls
   `Astro.redirect("https://evil.example/login")` -> 302
   `Location: https://evil.example/login`.

## Why It Might Matter

Reachable open redirect from a trusted storefront origin. Useful for phishing
hand-offs and OAuth/redirect-chain abuse where the victim trusts the shop
domain. Security-sensitive; mirrors the already-filed `successPath` open
redirect but via the account/billing-portal flow.

## Proof

Contract mismatch + dataflow trace: forged action POST `returnTo`
(`account.astro` form) -> `returnToInputSchema` (no sanitization,
validation.ts:157) -> override echoes raw value
(`mika-fixture-storefront.ts:468`) -> `Astro.redirect` sink
(`account.astro:19`) -> cross-origin navigation. The replaced default handler
(`backend.ts:781` + `mikaSafeReturnPath`) documents the intended same-origin
constraint the override violates.

## Counterevidence Checked

- "The action layer sanitizes `returnTo` first." Ruled out: `returnToInputSchema`
  uses `optionalStringSchema` (raw string); `mikaSafeReturnPath` is only invoked
  inside the default `createAccountPortalSession`, and the template override
  replaces it. In `backend.ts:781-782` the namespace is
  `{ ..., portal: createAccountPortalSession..., ...input.overrides?.account }`,
  so the override's `portal` shadows the sanitizing default.
- "`mikaReturnToInput`/`mikaSafeReturnTo` (form.ts:12-14) protects it." Ruled
  out: that only sanitizes the default value rendered into the hidden input on
  the server; it does not run when the action receives a forged POST body.
- "`Astro.redirect` rejects absolute URLs." Ruled out: `Astro.redirect(string)`
  sets `Location` to any value, including a cross-origin `https://` URL.
- Distinct from the filed `checkout-success-path-open-redirect`
  (`mika-fixture-storefront.ts:358-362`, `checkout.start`): this is a different
  override, sink, and entry point (`account.portal` -> `account.astro:19`) and
  requires a separate fix.

## Suggested Next Step

Route the override's `returnTo` through the same same-origin guard used by the
default handler (e.g. `mikaSafeReturnTo` / `mikaSafeReturnPath`, as `form.ts`
already does for hidden inputs) before returning it as `redirectUrl`, or fall
back to `/account` whenever the value is not a safe local path.

## Status Notes

- 2026-06-27: open by Devana. Static source inspection; override-vs-default
  contract confirmed in `@bnomei/emdash-mika/src/api/backend.ts:781` and
  `redirect-policy.ts`. Counterexample value `returnTo=https://evil.example/login`.
- 2026-06-27: duplicate of P2 `account-portal-return-to-open-redirect`
  (20260627T144411Z) — same override, same location (467-469), same defect and fix.
  Already resolved: `account.portal` now returns
  `mikaSafeReturnTo(input.returnTo, { fallback: "/account" })`, collapsing off-origin/
  protocol-relative values to `/account` while same-origin paths pass. Verified in source
  (the override is sanitized) and covered by the test "sanitizes account.portal returnTo into a
  same-origin redirect" (`returnTo=https://evil.example/phish` -> `/account`). No further code
  change required; `npm test` (32 passing) and `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:467-469 | account-portal-open-redirect
DEVANA-SUMMARY: Status=duplicate | P2 high src/lib/mika-fixture-storefront.ts:467-469 - duplicate of account-portal-return-to-open-redirect; the account.portal override is already sanitized with mikaSafeReturnTo, closing the open redirect.
