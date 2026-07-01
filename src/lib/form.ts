/**
 * Compatibility wrappers for Mika Astro form helpers. New helper logic lives in
 * `@bnomei/emdash-mika/astro`; this module only pins template redirect fallbacks.
 */
import {
  mikaRedirectInputs as baseMikaRedirectInputs,
  type MikaRedirectInputsInput,
  type MikaRedirectInputsOptions,
} from "@bnomei/emdash-mika/astro";

import { mikaTemplateRoutes } from "./routes";

export { mikaHiddenInput, mikaReturnToInput } from "@bnomei/emdash-mika/astro";

/** Checkout/Buy-now bundle: success, cancel, and post-action return paths. */
export function mikaRedirectInputs(
  input: MikaRedirectInputsInput,
  options: MikaRedirectInputsOptions = {},
) {
  return baseMikaRedirectInputs(input, {
    successFallback: mikaTemplateRoutes.checkoutSuccess,
    cancelFallback: mikaTemplateRoutes.checkoutCancel,
    ...options,
  });
}
