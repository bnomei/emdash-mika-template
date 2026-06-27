DEVANA-FINDING: v1
Priority: P2 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/pages/account/magic-link.astro:22-24,36-39 | Slug: magic-link-return-to-dropped

# Magic-link verify always redirects to /account

## Finding

Protected account pages pass per-page `returnTo` values into magic-link request forms, but after successful verify the magic-link page always redirects to `/account`, discarding where the user started.

## Violated Invariant Or Contract

After sign-in, the user should return to the protected page they initiated sign-in from (`returnTo` on request forms).

## Oracle

Sign-in initiated on `/account/orders` with `returnTo=/account/orders` must land back on `/account/orders` after verify.

## Counterexample

1. User requests magic link from `/account/orders` with hidden `returnTo=/account/orders` (`orders.astro:35-36`).
2. User opens `/account/magic-link?token=…` and submits verify.
3. `magic-link.astro` line 23: `return Astro.redirect(mikaTemplateRoutes.account)` on success.
4. Verify form hardcodes `returnTo` to `/account` (line 38), and `magicLink.request` does not persist `returnTo` in session.

## Why It Might Matter

Users signing in from orders, downloads, licenses, or subscriptions pages are sent to the generic account overview instead of the page they were trying to access.

## Proof

**Dataflow trace:** Per-page `returnTo` on request forms → not stored in fixture session → verify success hard-redirect to `/account`.

**Cross-entry mismatch:** `AccountSignInPanel` / `MagicLinkForm` accept `returnTo`; verify completion ignores it.

## Counterevidence Checked

- `magicLink.verify` fixture override returns account data only, no redirect metadata.
- `mikaSafeReturnTo` is used on request forms but not on verify redirect path.

## Suggested Next Step

Preserve `returnTo` from the request step (session or hidden verify field) and redirect to that safe path after successful verify.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed valid: `magic-link.astro` hard-redirected to `mikaTemplateRoutes.account`
  on verify success (line 23) and hardcoded the verify form's hidden `returnTo` to `/account` (line 38),
  discarding the per-page `returnTo` that protected entry points (orders/downloads/licenses/subscriptions
  via AccountSignInPanel) supply. Now the page derives `returnTo` from the magic-link URL query param,
  validated through `mikaSafeReturnTo` (fallback `/account`), and uses it for the verify-success redirect,
  the verify form hidden field, and the request MagicLinkForm. The query string survives the Astro action
  POST (same page URL), so a link like `/account/magic-link?token=...&returnTo=/account/orders` returns the
  user to `/account/orders`. `mikaSafeReturnTo` keeps it open-redirect safe. No fixture API change needed;
  the real backend already embeds returnTo in the magic-link email. Verified with `npm run build`
  (page compiles) and `npm test` (21 passing).

DEVANA-KEY: src/pages/account/magic-link.astro:22-24,36-39 | P2 | magic-link-return-to-dropped
DEVANA-SUMMARY: Status=fixed | P2 high src/pages/account/magic-link.astro:22-24,36-39 - Magic-link verify hardcoded a /account redirect; now threads a mikaSafeReturnTo-validated returnTo from the magic-link URL through verify and the forms.