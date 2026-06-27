/**
 * Cloudflare Workers runtime entry: Astro SSR handler plus EmDash sandbox
 * `PluginBridge` for edge plugin execution.
 */
import handler from "@astrojs/cloudflare/entrypoints/server";

export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

export default handler;
