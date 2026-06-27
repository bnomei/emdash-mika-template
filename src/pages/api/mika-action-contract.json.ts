/**
 * Route: `GET /api/mika-action-contract.json`
 * Admin action provider config and manifest for Mika Astro Actions integration.
 * Boundary: read-only JSON contract; no mutation or auth enforcement in this route.
 */
import {
  createMikaActionsProviderConfig,
  createMikaAdminActionsManifest,
} from "@bnomei/emdash-mika/admin";
import type { APIRoute } from "astro";

export const prerender = false;

/** Returns the Mika actions provider config and admin actions manifest. */
export const GET: APIRoute = () => {
  return Response.json({
    provider: createMikaActionsProviderConfig(),
    manifest: createMikaAdminActionsManifest(),
  });
};
