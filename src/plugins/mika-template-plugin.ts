/**
 * Native EmDash plugin entrypoint for this template.
 *
 * Registered via `mikaPlugin({ entrypoint: "#mika-template-plugin" })` so
 * function-based `MikaApiOverrides` merge at runtime instead of serializing
 * through the plugin descriptor.
 */
import { createPlugin as createMikaPlugin, type MikaCreatePluginOptions } from "@bnomei/emdash-mika";
import type { MikaApiOverrides } from "@bnomei/emdash-mika/server";
import { mikaApiOverrides } from "../lib/mika-api";

/**
 * Creates the Mika plugin with template fixture API defaults.
 *
 * Host `options.api` overrides are shallow-merged per namespace on top of
 * `mikaApiOverrides` from `src/lib/mika-api.ts`.
 */
export function createPlugin(options: MikaCreatePluginOptions = {}) {
  return createMikaPlugin({
    ...options,
    api: mergeMikaApiOverrides(mikaApiOverrides, options.api),
  });
}

function mergeMikaApiOverrides(
  base: MikaApiOverrides,
  overrides: MikaApiOverrides | undefined,
): MikaApiOverrides {
  const merged: Record<string, unknown> = {
    ...base,
    ...overrides,
  };

  for (const namespace of new Set([...Object.keys(base), ...Object.keys(overrides ?? {})])) {
    const baseNamespace = base[namespace as keyof MikaApiOverrides] as object | undefined;
    const overrideNamespace = overrides?.[namespace as keyof MikaApiOverrides] as object | undefined;
    merged[namespace] = {
      ...baseNamespace,
      ...overrideNamespace,
    };
  }

  return merged as MikaApiOverrides;
}

export default createPlugin;