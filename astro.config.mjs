// @ts-check
/**
 * Local Node/Astro config: server output, SQLite + filesystem media, EmDash admin
 * with Mika actions provider and the template storefront plugin.
 */
import node from "@astrojs/node";
import react from "@astrojs/react";
import { actionsPlugin } from "@bnomei/emdash-actions";
import { createMikaActionsProviderConfig } from "@bnomei/emdash-mika/admin";
import { mikaPlugin } from "@bnomei/emdash-mika";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

const mikaActionProviderConfig = createMikaActionsProviderConfig();

/** @type {import("@bnomei/emdash-actions").ActionProviderConfig} */
const mikaActionProvider = {
  ...mikaActionProviderConfig,
  allowedTargetPluginIds: [...(mikaActionProviderConfig.allowedTargetPluginIds ?? [])],
};
const mikaTemplatePlugin = mikaPlugin({ entrypoint: "#mika-template-plugin" });

export default defineConfig({
  site: "http://localhost:4321",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    emdash({
      mcp: true,
      database: sqlite({
        url: "file:./.emdash/mika-template.sqlite",
      }),
      storage: local({
        directory: "./.emdash/uploads",
        baseUrl: "/_emdash/api/media/file",
      }),
      plugins: [
        /** @type {import("emdash").PluginDescriptor} */ (
          actionsPlugin({
            providers: [mikaActionProvider],
            size: "half",
          })
        ),
        /** @type {import("emdash").PluginDescriptor} */ (mikaTemplatePlugin),
      ],
      admin: {
        siteName: "Mika Actions Template",
      },
    }),
  ],
});
