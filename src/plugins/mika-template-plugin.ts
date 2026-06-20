import { createPlugin as createMikaPlugin, type MikaCreatePluginOptions } from "@bnomei/emdash-mika";
import { mikaApiOverrides } from "../lib/mika-api";

export function createPlugin(options: MikaCreatePluginOptions = {}) {
  return createMikaPlugin({
    ...options,
    api: {
      ...mikaApiOverrides,
      ...options.api,
      admin: {
        ...mikaApiOverrides.admin,
        ...options.api?.admin,
      },
    },
  });
}

export default createPlugin;
