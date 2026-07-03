/**
 * Route: `POST /api/mika-webhook/:provider`
 * Payment-provider webhook ingress with payload hashing and provider event metadata.
 * Boundary: delegates verification and handling to Mika; responds with JSON status from `webhook.receive`.
 */
import { createHash } from "node:crypto";
import { createMika } from "@bnomei/emdash-mika/astro";
import { createProviderName, type WebhookReceiveInput } from "@bnomei/emdash-mika/types";
import type { APIRoute } from "astro";
import { mikaApiOverrides } from "../../../lib/mika-api";

export const prerender = false;

/** Accepts a provider webhook POST and returns the Mika receive result as JSON. */
export const POST: APIRoute = async ({ params, request, url }) => {
  const provider = params["provider"];
  if (!provider) return new Response("Missing provider.", { status: 400 });

  const Mika = createMika({ request, url }, { includeWebhook: true, api: mikaApiOverrides });
  const rawBody = await request.clone().arrayBuffer();
  const payloadHash = "sha256:" + createHash("sha256").update(Buffer.from(rawBody)).digest("hex");
  const eventType = request.headers.get("x-event-type");
  const providerEventId = request.headers.get("x-provider-event-id");
  const receiveInput: WebhookReceiveInput = {
    provider: createProviderName(provider),
    payloadHash,
    ...(eventType ? { eventType } : {}),
    ...(providerEventId ? { providerEventId } : {}),
  };
  const result = await Mika.webhook.receive(receiveInput);

  return Response.json(result, { status: result.status });
};
