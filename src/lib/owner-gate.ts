import { createHash, timingSafeEqual } from "node:crypto";

/** Owner-gate behavior for a request path. */
export type OwnerGatePolicy = "public" | "owner" | "emdash";

/**
 * EmDash media files are part of the public storefront. Every other EmDash
 * route is management/API surface and must pass the owner gate. EmDash Bearer
 * credentials are accepted there because EmDash validates and scopes them.
 */
export function ownerGatePolicy(pathname: string): OwnerGatePolicy {
  if (pathname.startsWith("/_emdash/api/media/file/")) return "public";
  if (pathname === "/_emdash" || pathname.startsWith("/_emdash/")) return "emdash";

  if (pathname === "/api/mika-action-contract.json") return "owner";
  if (pathname === "/api/mika-webhook" || pathname.startsWith("/api/mika-webhook/")) {
    return "owner";
  }

  return "public";
}

/** True only for a non-empty Bearer credential; EmDash validates its value. */
export function hasBearerCredential(authorization: string | null): boolean {
  return /^Bearer\s+\S+$/i.test(authorization ?? "");
}

/**
 * Accept Bearer auth at the perimeter only after EmDash has resolved the token.
 * EmDash sets tokenScopes for authenticated API/OAuth tokens, including an
 * empty array, but leaves it undefined for public/setup routes and sessions.
 */
export function hasAuthenticatedBearerCredential(
  authorization: string | null,
  tokenScopes: string[] | undefined,
): boolean {
  return hasBearerCredential(authorization) && tokenScopes !== undefined;
}

/** Verify an HTTP Basic credential without directly comparing the secret. */
export function hasValidOwnerCredential(
  authorization: string | null,
  expectedUsername: string,
  expectedPassword: string,
): boolean {
  const match = /^Basic\s+(.+)$/i.exec(authorization ?? "");
  if (!match?.[1] || !expectedUsername || !expectedPassword) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return secureEqual(username, expectedUsername) && secureEqual(password, expectedPassword);
}

function secureEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
