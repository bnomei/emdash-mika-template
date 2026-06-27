DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: yes | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:467-469,src/pages/account.astro:17-19 | Slug: account-portal-return-to-open-redirect

# account.portal echoes unsanitized returnTo into Astro.redirect

## Finding

The `account.portal` fixture override returns `{ redirectUrl: input.returnTo ?? "/account" }`
without same-origin sanitization. `account.astro` redirects to
`portalResult.data.redirectUrl` on any successful portal action. Forms render
sanitized `returnTo` via `mikaReturnToInput`, but the API override does not
re-enforce that contract on the POST body.

## Violated Invariant Or Contract

Billing-portal redirect targets must stay same-origin. Render-time forms use
`mikaSafeReturnTo` (`src/lib/form.ts:12-14`); the server-side portal handler
must not echo attacker-controlled absolute URLs into `Astro.redirect`.

## Oracle

`account.portal({ returnTo: "https://evil.example/phish" })` must not produce an
off-site `redirectUrl` consumed by `account.astro:19`.

## Counterexample

1. POST `actions.mika.account.portal` with `returnTo=https://evil.example/phish`
   (tampered hidden field or crafted action request).
2. Fixture returns `{ redirectUrl: "https://evil.example/phish" }`.
3. Victim loads `/account`; `Astro.redirect` sends them off-site.

## Why It Might Matter

Open redirect from a trusted storefront domain can be used in phishing chains.
Distinct from the known `checkout.start` `successPath` issue (different action
and entrypoint).

## Proof

Dataflow trace: untrusted `returnTo` POST field → `account.portal` override →
`portalResult.data.redirectUrl` → `Astro.redirect` sink. No `mikaSafeReturnTo`
in override or page redirect handler.

## Counterevidence Checked

Legitimate HTML forms embed sanitized `returnTo`. No middleware re-sanitizes
portal results. Excluded `checkout-success-path-open-redirect` covers checkout
only. Astro action CSRF may limit exploitability but does not sanitize the URL.

## Suggested Next Step

Apply `mikaSafeReturnTo` (or equivalent) inside `account.portal` before
returning `redirectUrl`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence
prefix. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes
below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `account.portal` returned `{ redirectUrl: input.returnTo ?? "/account" }`
  raw, and `account.astro` redirects to it — so a tampered `returnTo=https://evil.example/phish` produced
  an off-site redirect from the trusted domain. Same class as the checkout successPath issue (different
  action/entry point). Sanitized with `mikaSafeReturnTo(input.returnTo, { fallback: "/account" })` (already
  imported for the checkout fix), collapsing off-origin values to `/account` while same-origin paths pass.
  Added a test covering the off-site vector and a same-origin path. `npm test` (25 passing) and
  `tsc --noEmit` green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:467-469,src/pages/account.astro:17-19 | P2 | account-portal-return-to-open-redirect
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:467-469,src/pages/account.astro:17-19 - account.portal echoed raw returnTo into the redirect; now sanitized with mikaSafeReturnTo to an origin-relative path.