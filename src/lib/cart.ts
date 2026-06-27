/**
 * Astro layout helper for the template cart badge. Pages pass a `createMika` context;
 * this module loads the session cart through `mikaApiOverrides` and returns a line-quantity
 * total. Failures resolve to zero so headers never block on commerce errors.
 */
import { createMika } from "@bnomei/emdash-mika/astro";
import { mikaTemplateCartItemCount } from "./display.ts";
import { mikaApiOverrides } from "./mika-api.ts";

/** Line-quantity total for layout badges; returns 0 when the cart API is unavailable. */
export async function mikaTemplateCurrentCartItemCount(
  ctx: Parameters<typeof createMika>[0],
): Promise<number> {
  try {
    const Mika = createMika(ctx, { api: mikaApiOverrides });
    const cartResult = await Mika.cart.get();
    return cartResult.ok ? mikaTemplateCartItemCount(cartResult.data) : 0;
  } catch {
    return 0;
  }
}
