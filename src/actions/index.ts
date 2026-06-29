/**
 * Astro Actions server registry for the template host.
 *
 * Binds Mika storefront actions to the fixture API overrides in `src/lib/mika-api.ts`
 * so cart, checkout, wishlist, and account flows exercise the same local SQLite data
 * as the EmDash admin action testbed.
 */
import { createMikaActions } from "./mika";
import { mikaApiOverrides } from "../lib/mika-api";

/** Server action tree registered with Astro (`actions` integration). */
export const server = {
  mika: createMikaActions({ api: mikaApiOverrides }),
};
