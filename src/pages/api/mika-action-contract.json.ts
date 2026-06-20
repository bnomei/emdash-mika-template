import {
  createMikaActionsProviderConfig,
  createMikaAdminActionsManifest,
} from "@bnomei/emdash-mika/admin";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () => {
  return Response.json({
    provider: createMikaActionsProviderConfig(),
    manifest: createMikaAdminActionsManifest(),
  });
};
