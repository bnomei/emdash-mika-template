// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { actionsPlugin } from "@bnomei/emdash-actions";
import { mikaPlugin } from "@bnomei/emdash-mika";
import { createMikaActionsProviderConfig } from "@bnomei/emdash-mika/admin";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

const mikaActionProviderConfig = createMikaActionsProviderConfig();

/** @type {import("@bnomei/emdash-actions").ActionProviderConfig} */
const mikaActionProvider = {
  ...mikaActionProviderConfig,
  allowedTargetPluginIds: [...(mikaActionProviderConfig.allowedTargetPluginIds ?? [])],
};
const mikaTemplatePlugin = mikaPlugin({ entrypoint: "#mika-template-plugin" });

export default defineConfig({
  site: "https://emdash-mika-template.example.workers.dev",
  output: "server",
  adapter: cloudflare(),
  integrations: [
    react(),
    emdash({
      mcp: true,
      database: d1({
        binding: "DB",
        session: "auto",
      }),
      storage: r2({
        binding: "MEDIA",
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
