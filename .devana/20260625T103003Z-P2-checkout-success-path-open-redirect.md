DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: yes | Status: fixed
Location: src/lib/mika-fixture-storefront.ts:358-362 | Slug: checkout-success-path-open-redirect

# checkout.start builds redirect from unsanitized successPath (open redirect)

## Finding

The `checkout.start` override takes `input.successPath` and concatenates it raw
into the redirect URL: `redirectUrl = ${successPath}${separator}checkoutId=...`
(lines 360-362). The storefront pages then `Astro.redirect(redirectUrl)`
(`src/pages/cart.astro:22`, `src/pages/products/[slug].astro:27`). Because the
fixture override replaces the package backend, the backend's origin-sanitizer
for `successPath` never runs, so an attacker-supplied absolute URL becomes the
redirect target.

## Violated Invariant Or Contract

A post-checkout redirect target must remain same-origin (an origin-relative
path). The template establishes this contract at form-render time via
`mikaSafeReturnTo`/`mikaRedirectInputs` (`src/lib/form.ts:22-25`), and the
package's real backend re-enforces it on submit.

## Oracle

Differential against the dependency's default backend
(`../emdash-mika/src/api/backend.ts:6464-6468`): `checkoutSuccessTarget`
sanitizes `checkoutInput.successPath` with `safeRequestReturnPath(...)` before
building the redirect. The fixture override omits that call, so its raw use of
`successPath` is the deviation from the source-of-truth behavior.

## Counterexample

Submit a POST to the Astro action `mika.checkout.start` with form field
`successPath=https://evil.example/login` (or `successPath=//evil.example`).
- Input validation `optionalStringSchema`
  (`../emdash-mika/src/api/validation.ts:66-69`) only does
  `trim().min(1)` — no origin check.
- `normalizeCheckoutStartActionInput`
  (`../emdash-mika/src/api/operations.ts:428-439`) forwards
  `successPath: input.successPath` verbatim.
- The operation dispatch calls the merged override
  (`../emdash-mika/src/api/operations.ts:298-321`) with that raw input.
- Override builds `redirectUrl = "https://evil.example/login?checkoutId=..."`.
- `cart.astro:22` runs `Astro.redirect("https://evil.example/login?...")` →
  victim is sent off-site after "completing" checkout.

## Why It Might Matter

A crafted checkout link/form redirects the buyer to an attacker origin under the
guise of the store's checkout-success flow — a phishing/credential-harvesting
open redirect. The render-time `mikaSafeReturnTo` sanitizer creates a false
sense of safety: the value is sanitized when written into the hidden input but
read back raw on POST, and the server-side guard that would catch it is bypassed
by the override.

## Proof

Dataflow trace (untrusted form field → redirect sink):
- Source: `successPath` form field on the checkout action.
- Validation: `optionalStringSchema` = `z.preprocess(emptyToUndefined,
  z.string().trim().min(1).optional())` — trim only.
- Forward: `normalizeCheckoutStartActionInput` returns `successPath:
  input.successPath` unchanged.
- Sink construction: `src/lib/mika-fixture-storefront.ts:360-362`
  (`successPath = input.successPath ?? "/checkout/success"`; raw string
  interpolation).
- Redirect sink: `src/pages/cart.astro:22` and
  `src/pages/products/[slug].astro:27` call `Astro.redirect(redirectUrl)`.
- Contract mismatch: `safeRequestReturnPath` exists only inside
  `backend.ts` (`checkoutSuccessTarget`, the default handler), which the
  override supplants.

## Counterevidence Checked

- Confirmed `optionalStringSchema` performs no origin/path validation (only
  trim + non-empty).
- Confirmed the operation dispatch invokes
  `api.checkout.start(ctx, input)` directly with normalized input; no shared
  pre-dispatch sanitization of `successPath`.
- Confirmed `safeRequestReturnPath` is defined/used only in `backend.ts`, not in
  the operations/normalization layer, so the override path skips it.
- Distinct from `magic-link-return-to-dropped` (different entrypoint and field).

## Suggested Next Step

Sanitize `input.successPath` in the override before building `redirectUrl`
(reuse `mikaSafeReturnTo`/the package's return-path policy with an
origin-relative fallback), and apply the same to `cancelPath` if it is ever
used for redirects.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `checkout.start` interpolated `input.successPath` raw into
  `redirectUrl`, and because the fixture override replaces the package backend, the backend's
  `safeRequestReturnPath` origin guard never ran — so `successPath=https://evil.example/login` or
  `//evil.example` became the `Astro.redirect` target from cart/product checkout (open redirect).
  Now the override sanitizes via `mikaSafeReturnTo(input.successPath, { fallback: "/checkout/success" })`
  (the same return-path policy used at render time) before building the redirect, collapsing any
  off-origin/protocol-relative value to the same-origin fallback. `mikaSafeReturnTo` (from
  `@bnomei/emdash-mika/astro`) is node-safe (astro.ts has only a type-only `astro` import); confirmed
  by the test suite and a full `astro build`. cancelPath is not used to build a redirect in the override,
  so no change needed there. Added a test asserting both attack vectors collapse to `/checkout/success`.
  `npm test` (23 passing), `tsc --noEmit`, and `npm run build` all green.

DEVANA-KEY: src/lib/mika-fixture-storefront.ts:358-362 | P2 | checkout-success-path-open-redirect
DEVANA-SUMMARY: Status=fixed | P2 high src/lib/mika-fixture-storefront.ts:358-362 - checkout.start interpolated an unsanitized successPath into the redirect; now sanitized with mikaSafeReturnTo to an origin-relative path, closing the open redirect.
