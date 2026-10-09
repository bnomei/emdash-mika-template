/**
 * Astro Actions server registry for the template host.
 *
 * Binds Mika storefront actions to the fixture API overrides in `src/lib/mika-api.ts`
 * so cart, checkout, wishlist, and account flows exercise the same local SQLite data
 * as the EmDash admin action testbed.
 */
import { createMikaActions } from "./mika";
import { mikaApiOverrides } from "../lib/mika-api";
import { createMikaStorefrontActions } from "@bnomei/emdash-mika/storefront-actions";
import { storefrontOptions } from "../lib/mika-storefront";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { createMikaRequestContext } from "@bnomei/emdash-mika/server";
import { simulateTemplatePayment } from "../lib/mika-fixture-storefront";

/** Server action tree registered with Astro (`actions` integration). */
export const server = {
  mika: createMikaActions({ api: mikaApiOverrides }),
  mikaStorefront: createMikaStorefrontActions(storefrontOptions),
  simulatePayment: defineAction({
    accept: "form",
    input: z.object({ checkoutId: z.string().min(1).max(200) }),
    handler: async ({ checkoutId }, ctx) => {
      if (ctx.request.headers.get("origin") !== ctx.url.origin) throw new ActionError({ code: "FORBIDDEN", message: "Invalid origin." });
      await ctx.session?.get("mika.customerId");
      return simulateTemplatePayment(createMikaRequestContext({ request: ctx.request, url: ctx.url, session: ctx.session }), checkoutId);
    },
  }),
};
