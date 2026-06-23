import { createMika } from "@bnomei/emdash-mika/astro";
import { mikaTemplateCartItemCount } from "./display";
import { mikaApiOverrides } from "./mika-api";

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
