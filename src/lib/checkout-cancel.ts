/**
 * View-model for the checkout cancel page. Provider redirects may attach checkout
 * identifiers under different query names; this module normalizes them and pairs the
 * cancelled status with a live cart count so the page can confirm the basket survived.
 */
import type { createMika } from "@bnomei/emdash-mika/astro";

import { mikaTemplateCurrentCartItemCount } from "./cart.ts";

type MikaAstroContextInput = Parameters<typeof createMika>[0];

/** Props contract for `checkout/cancel.astro`. */
export interface MikaTemplateCheckoutCancelView {
  readonly checkoutId: string | null;
  readonly status: "cancelled";
  readonly cartItemCount: number;
}

export async function mikaTemplateCheckoutCancelView(
  ctx: MikaAstroContextInput,
): Promise<MikaTemplateCheckoutCancelView> {
  return {
    checkoutId: mikaTemplateCheckoutIdFromUrl(ctx.url),
    status: "cancelled",
    cartItemCount: await mikaTemplateCurrentCartItemCount(ctx),
  };
}

/** Accepts `checkoutId`, `checkout_id`, or `session_id` — common provider spellings. */
export function mikaTemplateCheckoutIdFromUrl(url: URL): string | null {
  return (
    url.searchParams.get("checkoutId") ??
    url.searchParams.get("checkout_id") ??
    url.searchParams.get("session_id")
  );
}
