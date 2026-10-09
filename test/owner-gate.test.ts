import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageSize } from "image-size";
import {
  DISABLED_IMAGE_TYPES,
  disableUnsafeImageParsers,
} from "../src/lib/image-parser-security.ts";
import {
  hasAuthenticatedBearerCredential,
  hasBearerCredential,
  hasValidOwnerCredential,
  ownerGatePolicy,
} from "../src/lib/owner-gate.ts";

describe("production owner gate", () => {
  it("keeps public storefront and media routes public", () => {
    assert.equal(ownerGatePolicy("/"), "public");
    assert.equal(ownerGatePolicy("/health"), "public");
    assert.equal(ownerGatePolicy("/_emdash/api/media/file/products/clipboard.webp"), "public");
  });

  it("leaves only the exact customer export endpoint to its session/token authorization", () => {
    assert.equal(ownerGatePolicy("/_emdash/api/plugins/mika/account/export/download"), "public");
    assert.equal(ownerGatePolicy("/_emdash/api/plugins/mika/account/export/download/extra"), "emdash");
    assert.equal(ownerGatePolicy("/_emdash/api/plugins/mika/account/export"), "emdash");
  });

  it("protects EmDash and Mika management routes", () => {
    assert.equal(ownerGatePolicy("/_emdash/admin"), "emdash");
    assert.equal(ownerGatePolicy("/_emdash/admin/setup"), "emdash");
    assert.equal(ownerGatePolicy("/_emdash/api/setup/status"), "emdash");
    assert.equal(ownerGatePolicy("/_emdash/api/content"), "emdash");
    assert.equal(ownerGatePolicy("/api/mika-action-contract.json"), "owner");
    assert.equal(ownerGatePolicy("/api/mika-webhook/stripe"), "owner");
  });

  it("accepts exact Basic credentials", () => {
    const valid = `Basic ${Buffer.from("bnomei:a long random password").toString("base64")}`;
    const wrongPassword = `Basic ${Buffer.from("bnomei:wrong").toString("base64")}`;
    const colonPassword = `Basic ${Buffer.from("bnomei:part:two").toString("base64")}`;

    assert.equal(hasValidOwnerCredential(valid, "bnomei", "a long random password"), true);
    assert.equal(hasValidOwnerCredential(wrongPassword, "bnomei", "a long random password"), false);
    assert.equal(hasValidOwnerCredential(colonPassword, "bnomei", "part:two"), true);
    assert.equal(hasValidOwnerCredential("Basic not-base64!", "bnomei", "secret"), false);
    assert.equal(hasValidOwnerCredential(null, "bnomei", "secret"), false);
  });

  it("only recognizes populated Bearer credentials", () => {
    assert.equal(hasBearerCredential("Bearer ec_pat_example"), true);
    assert.equal(hasBearerCredential("bearer ec_oat_example"), true);
    assert.equal(hasBearerCredential("Bearer "), false);
    assert.equal(hasBearerCredential("Basic abc"), false);
  });

  it("only accepts Bearer credentials that EmDash already authenticated", () => {
    const authorization = "Bearer ec_pat_example";

    assert.equal(hasAuthenticatedBearerCredential(authorization, undefined), false);
    assert.equal(hasAuthenticatedBearerCredential(authorization, []), true);
    assert.equal(hasAuthenticatedBearerCredential(authorization, ["content:read"]), true);
    assert.equal(hasAuthenticatedBearerCredential("Basic abc", ["admin"]), false);
  });
});

describe("image parser hardening", () => {
  it("retains the restricted formats after upgrading image-size", () => {
    assert.deepEqual(DISABLED_IMAGE_TYPES, ["heif", "icns", "jxl", "jxl-stream"]);
    disableUnsafeImageParsers();

    const icnsHeader = new TextEncoder().encode("icns\0\0\0\0");
    assert.throws(() => imageSize(icnsHeader), /disabled file type: icns/);
  });
});
