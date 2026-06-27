import type { createMika } from "@bnomei/emdash-mika/astro";

import { mikaTemplateCurrentCartItemCount } from "./cart.ts";

type MikaAstroContextInput = Parameters<typeof createMika>[0];

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

export function mikaTemplateCheckoutIdFromUrl(url: URL): string | null {
  return (
    url.searchParams.get("checkoutId") ??
    url.searchParams.get("checkout_id") ??
    url.searchParams.get("session_id")
  );
}
