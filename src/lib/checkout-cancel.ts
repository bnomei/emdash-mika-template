/**
 * View-model for the checkout cancel page. Provider redirects may attach checkout
 * identifiers under different query names; this module normalizes them, calls Mika's
 * cancel API when possible, and returns a live cart count for the landing page.
 */
import { createMika } from "@bnomei/emdash-mika/astro";
import { createMikaId } from "@bnomei/emdash-mika/types";
import type { CheckoutSessionDTO } from "@bnomei/emdash-mika/types";

import { mikaTemplateCurrentCartItemCount } from "./cart.ts";
import { mikaApiOverrides } from "./mika-api.ts";

type MikaAstroContextInput = Parameters<typeof createMika>[0];

/** Props contract for `checkout/cancel.astro`. */
export interface MikaTemplateCheckoutCancelView {
  readonly checkoutId: string | null;
  readonly token?: string;
  readonly status: CheckoutSessionDTO["status"] | "missing";
  readonly orderId?: string;
  readonly lookupError?: string;
  readonly cartItemCount: number;
}

export async function mikaTemplateCheckoutCancelView(
  ctx: MikaAstroContextInput,
): Promise<MikaTemplateCheckoutCancelView> {
  const checkoutId = mikaTemplateCheckoutIdFromUrl(ctx.url);
  const token = ctx.url.searchParams.get("token") ?? undefined;
  const Mika = createMika(ctx, { api: mikaApiOverrides });
  const result = checkoutId
    ? await Mika.checkout.cancel({ checkoutId: createMikaId(checkoutId), token })
    : null;
  const checkout = result?.ok ? result.data : null;

  return {
    checkoutId,
    token,
    status: !checkoutId ? "missing" : (checkout?.status ?? "expired"),
    orderId: checkout?.orderId,
    lookupError: result && !result.ok ? result.error.message : undefined,
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
