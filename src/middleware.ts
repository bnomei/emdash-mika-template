import { defineMiddleware } from "astro:middleware";
import { disableUnsafeImageParsers } from "./lib/image-parser-security";
import {
  hasAuthenticatedBearerCredential,
  hasValidOwnerCredential,
  ownerGatePolicy,
} from "./lib/owner-gate";

const OWNER_REALM = "Mika Demo Admin";

// This runs when the server middleware module loads, before any media request
// can reach EmDash's image metadata parser.
disableUnsafeImageParsers();

/**
 * Defense-in-depth around the EmDash management plane.
 *
 * EmDash still performs its own passkey/session authorization, role checks,
 * token scoping, and CSRF validation after this middleware lets a request
 * through. These credentials are an independent perimeter secret.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const policy = ownerGatePolicy(url.pathname);
  if (policy === "public") return next();

  const authorization = request.headers.get("authorization");

  // Only accept Bearer auth after EmDash has resolved the token and populated
  // tokenScopes. Public setup/auth routes skip EmDash token validation, so an
  // arbitrary Bearer string must never bypass the owner credential there.
  if (
    policy === "emdash" &&
    hasAuthenticatedBearerCredential(authorization, context.locals.tokenScopes)
  ) {
    return next();
  }

  const username = process.env.EMDASH_OWNER_USERNAME?.trim() ?? "";
  const password = process.env.EMDASH_OWNER_PASSWORD ?? "";

  if (!username || !password) {
    if (import.meta.env.DEV) return next();
    return protectedResponse(
      "Backend access is not configured.",
      503,
      "Owner credentials must be set before management access is available.",
    );
  }

  if (!hasValidOwnerCredential(authorization, username, password)) {
    return protectedResponse("Authentication required.", 401);
  }

  return next();
});

function protectedResponse(message: string, status: number, logMessage?: string): Response {
  if (logMessage) console.error(`[owner-gate] ${logMessage}`);

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  if (status === 401) {
    headers.set("WWW-Authenticate", `Basic realm="${OWNER_REALM}", charset="UTF-8"`);
  }

  return new Response(message, { status, headers });
}
