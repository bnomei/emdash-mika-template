import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let api;
let db;
let tempDir;

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "emdash-mika-template-"));
  const dbPath = join(tempDir, "mika-template.sqlite");
  const seed = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/emdash/dist/cli/index.mjs"),
      "seed",
      join(root, "seed/mika-actions.seed.json"),
      "-d",
      dbPath,
      "--uploads-dir",
      join(tempDir, "uploads"),
      "--on-conflict",
      "update",
    ],
    { cwd: root, encoding: "utf8" },
  );

  if (seed.status !== 0) {
    throw new Error(seed.stderr || seed.stdout || "Fixture seed failed.");
  }

  process.env.EMDASH_MIKA_TEMPLATE_DB = dbPath;
  db = new Database(dbPath);
  ({ api } = await import("../src/lib/mika-api.ts"));
});

after(() => {
  db?.close();
  if (tempDir) rmSync(tempDir, { force: true, recursive: true });
  delete process.env.EMDASH_MIKA_TEMPLATE_DB;
});

describe("Mika template action overrides", { concurrency: false }, () => {
  it("lets customer grant buttons resolve entitlement keys from row values", () => {
    const seed = JSON.parse(readFileSync(join(root, "seed/mika-actions.seed.json"), "utf8"));
    const customers = seed.collections.find((collection) => collection.slug === "customers");
    const grantField = customers.fields.find((field) => field.slug === "entitlement_grant");

    assert.equal(grantField.options.action, "mika.entitlement.grant");
    assert.equal(grantField.options.payload?.entitlementKey, undefined);
    assert.equal(
      seed.content.customers[0].data.entitlement_grant.entitlementKey,
      "peanut_recipe_club",
    );
  });

  it("syncs product fixture state for entry-scoped provider sync", async () => {
    const result = await api.admin.providerSync({
      contentRef: {
        collection: "products",
        id: idBySlug("ec_products", "crunchy-peanut-butter"),
        locale: "en",
      },
      scope: "entry",
    });

    assertCompleted(result);
    assert.equal(result.data.affected.syncedEntries, 1);
    assert.equal(
      jsonBySlug("ec_products", "crunchy-peanut-butter", "commerce_ref").providerStatus,
      "synced",
    );
    assert.equal(
      jsonBySlug("ec_products", "crunchy-peanut-butter", "mika_catalog_sync").syncCount,
      1,
    );
  });

  it("adjusts stock and rejects negative stock mutations", async () => {
    const result = await api.admin.stockAdjust({
      quantityDelta: 5,
      reason: "fixture_adjustment",
      stockItemId: "stock_pb_250",
    });

    assertCompleted(result);
    assert.equal(
      jsonBySlug("ec_stock_items", "peanut-butter-250g-stock", "quantities").quantityOnHand,
      47,
    );

    const before = jsonBySlug("ec_stock_items", "peanut-oil-500ml-stock", "quantities");
    const failed = await api.admin.stockAdjust({
      quantityDelta: -999,
      reason: "fixture_adjustment",
      stockItemId: "stock_po_500",
    });

    assert.equal(failed.ok, true);
    assert.equal(failed.data.status, "failed");
    assert.equal(
      jsonBySlug("ec_stock_items", "peanut-oil-500ml-stock", "quantities").quantityOnHand,
      before.quantityOnHand,
    );
  });

  it("releases stock reservations across fixture rows", async () => {
    const result = await api.admin.releaseExpiredReservations();

    assertCompleted(result);
    assert.equal(result.data.affected.releasedReservations, 10);
    const peanutButterQuantities = jsonBySlug(
      "ec_stock_items",
      "peanut-butter-250g-stock",
      "quantities",
    );
    assert.equal(peanutButterQuantities.quantityReserved, 0);
    assert.equal(peanutButterQuantities.availableQuantity, 47);
    assert.equal(
      jsonBySlug("ec_stock_items", "honey-roast-stock", "quantities").quantityReserved,
      0,
    );
  });

  it("mutates webhook and order fixture statuses", async () => {
    assertCompleted(
      await api.admin.webhookReplay({ webhookId: "webhook_peanut_refund_failed_1002" }),
    );
    assert.equal(rowBySlug("ec_webhooks", "refund-failed-1002").fixture_status, "replayed");

    const refund = await api.admin.orderRefund({
      amount: 499,
      orderId: "order_peanut_1001",
      reason: "fixture_refund",
    });
    assertCompleted(refund);
    assert.equal(rowBySlug("ec_orders", "order-peanut-1001").payment_status, "partially_refunded");

    assertCompleted(
      await api.admin.orderCancel({
        orderId: "order_peanut_1002",
        reason: "fixture_cancel",
      }),
    );
    assert.equal(rowBySlug("ec_orders", "order-peanut-1002").fixture_status, "cancelled");
  });

  it("mutates customer, entitlement, email, license, and download fixtures", async () => {
    const grant = await api.admin.entitlementGrant({
      customerId: "customer_ada_shell",
      entitlementKey: "peanut_recipe_club",
    });
    assertCompleted(grant);
    assert.equal(grant.data.affected.entitlements, 1);
    assert.deepEqual(
      jsonBySlug("ec_customers", "ada-shell", "customer_ref").entitlementKeys,
      ["peanut_recipe_club"],
    );
    assert.equal(jsonBySlug("ec_entitlements", "ada-recipe-club", "entitlement_ref").grantCount, 1);

    assertCompleted(
      await api.admin.entitlementRevoke({
        entitlementId: "ent_peanut_wholesale_ben",
        reason: "fixture_revoke",
      }),
    );
    assert.equal(
      rowBySlug("ec_entitlements", "ben-wholesale-portal").fixture_status,
      "revoked",
    );

    assertCompleted(await api.admin.emailResend({ emailId: "email_download_1002" }));
    assert.equal(rowBySlug("ec_emails", "download-email-1002").fixture_status, "queued");

    assertCompleted(
      await api.admin.licenseRevoke({
        licenseId: "license_wholesale_ben",
        reason: "fixture_revoke",
      }),
    );
    assert.equal(rowBySlug("ec_licenses", "ben-wholesale-license").fixture_status, "revoked");

    assertCompleted(
      await api.admin.downloadIssue({
        entitlementId: "ent_peanut_archive_cora",
        orderId: "order_peanut_1003",
        orderLineId: "line_po_500",
      }),
    );
    assert.equal(rowBySlug("ec_downloads", "cora-oil-sheet-download").fixture_status, "issued");
  });
});

function assertCompleted(result) {
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "completed");
}

function row(table, id) {
  const value = db.prepare(`select * from ${table} where id = ?`).get(id);
  assert.ok(value, `Expected ${table}/${id} to exist.`);
  return value;
}

function rowBySlug(table, slug) {
  const value = db.prepare(`select * from ${table} where slug = ?`).get(slug);
  assert.ok(value, `Expected ${table}/${slug} to exist.`);
  return value;
}

function idBySlug(table, slug) {
  return rowBySlug(table, slug).id;
}

function jsonBySlug(table, slug, column) {
  return JSON.parse(rowBySlug(table, slug)[column]);
}
