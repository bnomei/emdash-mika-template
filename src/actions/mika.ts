/**
 * Mika Astro Actions entry for this host.
 *
 * Re-exports the package factory and types so `index.ts` can pass host-specific
 * `MikaApiOverrides` without forking action definitions upstream.
 */
export {
  /** Builds the typed Mika action tree for Astro server actions. */
  createMikaActions,
  type MikaActionName,
  type MikaActions,
  type MikaActionsOptions,
} from "@bnomei/emdash-mika/astro-actions";
