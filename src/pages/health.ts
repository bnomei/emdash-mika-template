import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
