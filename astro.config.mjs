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
import { defineConfig, sessionDrivers } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

const mikaActionProviderConfig = createMikaActionsProviderConfig();
const databaseUrl = process.env.EMDASH_DATABASE_URL ?? "file:./.emdash/mika-template.sqlite";
const storageDirectory = process.env.EMDASH_STORAGE_DIRECTORY ?? "./.emdash/uploads";
const sessionDirectory = process.env.EMDASH_SESSION_DIRECTORY ?? "./.emdash/sessions";
const siteUrl = process.env.EMDASH_SITE_URL ?? "http://localhost:4321";

/** @type {import("@bnomei/emdash-actions").ActionProviderConfig} */
const mikaActionProvider = {
  ...mikaActionProviderConfig,
  allowedTargetPluginIds: [...(mikaActionProviderConfig.allowedTargetPluginIds ?? [])],
};
const mikaTemplatePlugin = mikaPlugin({ entrypoint: "#mika-template-plugin" });

export default defineConfig({
  site: siteUrl,
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { host: "0.0.0.0" },
  session: {
    driver: sessionDrivers.fsLite({ base: sessionDirectory }),
  },
  integrations: [
    react(),
    emdash({
      mcp: true,
      database: sqlite({
        url: databaseUrl,
      }),
      storage: local({
        directory: storageDirectory,
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
