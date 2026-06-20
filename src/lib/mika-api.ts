/// <reference types="node" />

import { createRequire } from "node:module";
import { join } from "node:path";
import { createMikaApi, type MikaApiOverrides } from "@bnomei/emdash-mika/server";
import { createISODateTime } from "@bnomei/emdash-mika/types";
import type {
  AdminActionResultDTO,
  MikaApiResult,
  MikaId,
  ProviderHealthDTO,
  ProviderName,
} from "@bnomei/emdash-mika/types";

type JsonRecord = Record<string, unknown>;
type FixtureValue = string | number | null;
type FixtureRow = {
  id: string;
  locale: string | null;
  [column: string]: unknown;
};
type SqliteRunResult = { changes: number };
type SqliteStatement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): SqliteRunResult;
};
type SqliteDatabase = {
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const nodeRequire = createRequire(import.meta.url);
const Database = nodeRequire("better-sqlite3") as new (
  path: string,
  options?: { fileMustExist?: boolean },
) => SqliteDatabase;

const fixtureTables = {
  downloads: "ec_downloads",
  emails: "ec_emails",
  entitlements: "ec_entitlements",
  licenses: "ec_licenses",
  orders: "ec_orders",
  products: "ec_products",
  stockItems: "ec_stock_items",
  customers: "ec_customers",
  webhooks: "ec_webhooks",
} as const;

function ok<TData>(data: TData, status = 200): MikaApiResult<TData> {
  return { ok: true, status, data };
}

function mikaId(value: string): MikaId {
  return value as MikaId;
}

function providerName(value: string): ProviderName {
  return value as ProviderName;
}

function completed(
  id: string,
  message: string,
  affected: Record<string, number> = {},
): MikaApiResult<AdminActionResultDTO> {
  return actionResult("completed", id, message, affected);
}

function failed(
  id: string,
  message: string,
  affected: Record<string, number> = {},
): MikaApiResult<AdminActionResultDTO> {
  return actionResult("failed", id, message, affected);
}

function actionResult(
  status: AdminActionResultDTO["status"],
  id: string,
  message: string,
  affected: Record<string, number>,
): MikaApiResult<AdminActionResultDTO> {
  return ok({ id: mikaId(id), status, message, affected });
}

function actionId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36);
}

function currentISODateTime(): string {
  return new Date().toISOString();
}

export function fixtureDatabasePath(): string {
  return process.env.EMDASH_MIKA_TEMPLATE_DB ?? join(process.cwd(), ".emdash/mika-template.sqlite");
}

function withFixtureDb<T>(run: (db: SqliteDatabase) => T): T {
  const db = new Database(fixtureDatabasePath(), { fileMustExist: true });
  try {
    return run(db);
  } finally {
    db.close();
  }
}

function fixtureRows(db: SqliteDatabase, table: string): FixtureRow[] {
  return db
    .prepare(`select * from ${table} where deleted_at is null order by id`)
    .all() as FixtureRow[];
}

function updateFixtureRow(
  db: SqliteDatabase,
  table: string,
  rowId: string,
  changes: Record<string, FixtureValue>,
  now: string,
): number {
  const columns = Object.keys(changes);
  if (columns.length === 0) return 0;

  const assignments = columns.map((column) => `${column} = ?`).join(", ");
  const values = columns.map((column) => changes[column]);
  return db
    .prepare(
      `update ${table} set ${assignments}, updated_at = ?, version = coalesce(version, 0) + 1 where id = ?`,
    )
    .run(...values, now, rowId).changes;
}

function readJsonObject(value: unknown): JsonRecord {
  const parsed = readJson(value);
  return isJsonRecord(parsed) ? parsed : {};
}

function readJsonArray(value: unknown): unknown[] {
  const parsed = readJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function readJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson(value: JsonRecord | readonly unknown[]): string {
  return JSON.stringify(value);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string"))];
}

function rowMatchesContentRef(row: FixtureRow, contentRef: { id: string; locale?: string }) {
  return row.id === contentRef.id && (!contentRef.locale || row.locale === contentRef.locale);
}

function findRowByJson(
  db: SqliteDatabase,
  table: string,
  columns: readonly string[],
  predicate: (values: Record<string, JsonRecord>, row: FixtureRow) => boolean,
): FixtureRow | undefined {
  return fixtureRows(db, table).find((row) => {
    const values = Object.fromEntries(
      columns.map((column) => [column, readJsonObject(row[column])]),
    );
    return predicate(values, row);
  });
}

function matchJsonId(
  values: Record<string, JsonRecord>,
  columns: readonly string[],
  key: string,
  expected: unknown,
): boolean {
  if (!expected) return false;
  return columns.some((column) => values[column]?.[key] === expected);
}

export const mikaApiOverrides = {
  admin: {
    async providerHealth(input = {}): Promise<MikaApiResult<ProviderHealthDTO>> {
      return ok({
        provider: providerName(input.provider ?? "template"),
        ok: true,
        capabilities: ["product_sync", "stock_sync"],
        checkedAt: createISODateTime(new Date().toISOString()),
      });
    },

    async providerSync(input = {}) {
      const contentRef = input.contentRef;
      const target = contentRef
        ? contentRef.collection + ":" + contentRef.id
        : input.scope ?? "dashboard";
      const now = currentISODateTime();

      const syncedEntries = withFixtureDb((db) => {
        const rows = fixtureRows(db, fixtureTables.products).filter((row) =>
          contentRef ? rowMatchesContentRef(row, contentRef) : true,
        );
        for (const row of rows) {
          const sync = readJsonObject(row["mika_catalog_sync"]);
          const commerceRef = readJsonObject(row["commerce_ref"]);
          const syncCount = numberValue(sync["syncCount"]) + 1;
          updateFixtureRow(
            db,
            fixtureTables.products,
            row.id,
            {
              commerce_ref: writeJson({
                ...commerceRef,
                providerStatus: "synced",
                lastSyncedAt: now,
              }),
              mika_catalog_sync: writeJson({
                ...sync,
                provider: input.provider ?? sync["provider"] ?? "template",
                lastSyncedAt: now,
                lastSyncMode: input.mode ?? "dry_run",
                lastSyncScope: input.scope ?? (contentRef ? "entry" : "all"),
                syncCount,
              }),
            },
            now,
          );
        }
        return rows.length;
      });

      if (contentRef && syncedEntries === 0) {
        return failed(
          actionId("provider_sync"),
          "No template product matched " + target + ".",
          { syncedEntries: 0 },
        );
      }

      return completed(
        actionId("provider_sync"),
        "Template provider sync completed for " + target + ".",
        { syncedEntries },
      );
    },

    async stockAdjust(input) {
      const now = currentISODateTime();
      const result = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.stockItems,
          ["stock_ref", "stock_adjust"],
          (values) =>
            matchJsonId(values, ["stock_ref", "stock_adjust"], "stockItemId", input.stockItemId),
        );
        if (!row) return { updated: false, nextQuantity: 0 };

        const quantities = readJsonObject(row["quantities"]);
        const stockAdjust = readJsonObject(row["stock_adjust"]);
        const quantityOnHand = numberValue(quantities["quantityOnHand"]);
        const quantityReserved = numberValue(quantities["quantityReserved"]);
        const nextQuantity = quantityOnHand + input.quantityDelta;
        if (nextQuantity < 0) {
          return { updated: false, nextQuantity, found: true };
        }

        updateFixtureRow(
          db,
          fixtureTables.stockItems,
          row.id,
          {
            quantities: writeJson({
              ...quantities,
              quantityOnHand: nextQuantity,
              availableQuantity: Math.max(0, nextQuantity - quantityReserved),
            }),
            stock_adjust: writeJson({
              ...stockAdjust,
              quantityOnHand: nextQuantity,
              lastAdjustedAt: now,
              lastQuantityDelta: input.quantityDelta,
              lastReason: input.reason ?? "fixture_adjustment",
            }),
          },
          now,
        );
        return { updated: true, nextQuantity };
      });

      if (!result.updated) {
        return failed(
          actionId("stock_adjust"),
          result.found
            ? "Template stock adjustment would make quantity negative."
            : "No template stock item matched " + input.stockItemId + ".",
          { stockItems: 0, quantityDelta: input.quantityDelta },
        );
      }

      return completed(actionId("stock_adjust"), "Template stock adjustment completed.", {
        stockItems: 1,
        quantityDelta: input.quantityDelta,
        quantityOnHand: result.nextQuantity,
      });
    },

    async releaseExpiredReservations(input = {}) {
      const now = String(input.now ?? currentISODateTime());
      const released = withFixtureDb((db) => {
        let stockItems = 0;
        let releasedReservations = 0;
        for (const row of fixtureRows(db, fixtureTables.stockItems)) {
          const quantities = readJsonObject(row["quantities"]);
          const stockAdjust = readJsonObject(row["stock_adjust"]);
          const quantityReserved = numberValue(quantities["quantityReserved"]);
          if (quantityReserved <= 0) continue;

          stockItems += 1;
          releasedReservations += quantityReserved;
          updateFixtureRow(
            db,
            fixtureTables.stockItems,
            row.id,
            {
              quantities: writeJson({
                ...quantities,
                quantityReserved: 0,
              }),
              stock_adjust: writeJson({
                ...stockAdjust,
                lastReleasedAt: now,
                lastReleasedQuantity: quantityReserved,
              }),
            },
            now,
          );
        }
        return { releasedReservations, stockItems };
      });

      return completed(actionId("stock_release"), "Template reservation release completed.", {
        releasedReservations: released.releasedReservations,
        stockItems: released.stockItems,
      });
    },

    async webhookReplay(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.webhooks,
          ["webhook_ref", "webhook_replay"],
          (values) =>
            matchJsonId(values, ["webhook_ref", "webhook_replay"], "webhookId", input.webhookId),
        );
        if (!row) return false;

        const webhookRef = readJsonObject(row["webhook_ref"]);
        const webhookReplay = readJsonObject(row["webhook_replay"]);
        const replayCount = numberValue(webhookRef["replayCount"]) + 1;
        updateFixtureRow(
          db,
          fixtureTables.webhooks,
          row.id,
          {
            fixture_status: "replayed",
            webhook_ref: writeJson({
              ...webhookRef,
              replayCount,
              replayedAt: now,
            }),
            webhook_replay: writeJson({
              ...webhookReplay,
              lastReplayedAt: now,
              replayCount,
            }),
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(actionId("webhook_replay"), "No template webhook matched " + input.webhookId + ".", {
          webhooks: 0,
        });
      }

      return completed(actionId("webhook_replay"), "Template webhook replay queued.", {
        webhooks: input.webhookId ? 1 : 0,
      });
    },

    async orderRefund(input) {
      const now = currentISODateTime();
      const result = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.orders,
          ["order_ref", "order_refund"],
          (values) => matchJsonId(values, ["order_ref", "order_refund"], "orderId", input.orderId),
        );
        if (!row) return { updated: false, refundAmount: input.amount ?? 0 };

        const orderRef = readJsonObject(row["order_ref"]);
        const orderRefund = readJsonObject(row["order_refund"]);
        const refundAmount = input.amount ?? numberValue(orderRefund["amount"], numberValue(row["total_amount"]));
        updateFixtureRow(
          db,
          fixtureTables.orders,
          row.id,
          {
            fixture_status: "refunded",
            order_ref: writeJson({
              ...orderRef,
              refundedAt: now,
              refundAmount,
              refundReason: input.reason ?? orderRefund["reason"] ?? "fixture_refund",
              refundCount: numberValue(orderRef["refundCount"]) + 1,
            }),
            order_refund: writeJson({
              ...orderRefund,
              amount: refundAmount,
              lastRefundedAt: now,
              lastRefundAmount: refundAmount,
              lastReason: input.reason ?? orderRefund["reason"] ?? "fixture_refund",
            }),
            payment_status: "refunded",
          },
          now,
        );
        return { updated: true, refundAmount };
      });

      if (!result.updated) {
        return failed(actionId("order_refund"), "No template order matched " + input.orderId + ".", {
          orders: 0,
          refundAmount: result.refundAmount,
        });
      }

      return completed(actionId("order_refund"), "Template order refund accepted.", {
        orders: 1,
        refundAmount: result.refundAmount,
      });
    },

    async orderCancel(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.orders,
          ["order_ref", "order_cancel"],
          (values) => matchJsonId(values, ["order_ref", "order_cancel"], "orderId", input.orderId),
        );
        if (!row) return false;

        const orderRef = readJsonObject(row["order_ref"]);
        const orderCancel = readJsonObject(row["order_cancel"]);
        updateFixtureRow(
          db,
          fixtureTables.orders,
          row.id,
          {
            fixture_status: "cancelled",
            order_cancel: writeJson({
              ...orderCancel,
              lastCancelledAt: now,
              lastReason: input.reason ?? orderCancel["reason"] ?? "fixture_cancel",
            }),
            order_ref: writeJson({
              ...orderRef,
              cancelledAt: now,
              cancelReason: input.reason ?? orderCancel["reason"] ?? "fixture_cancel",
              cancelCount: numberValue(orderRef["cancelCount"]) + 1,
            }),
            payment_status: "cancelled",
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(actionId("order_cancel"), "No template order matched " + input.orderId + ".", {
          orders: 0,
        });
      }

      return completed(actionId("order_cancel"), "Template order cancellation accepted.", {
        orders: 1,
      });
    },

    async entitlementGrant(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.customers,
          ["customer_ref", "entitlement_grant"],
          (values) => {
            const customerId = input.customerId;
            const email = input.email?.toLowerCase();
            return (
              matchJsonId(values, ["customer_ref", "entitlement_grant"], "customerId", customerId) ||
              (email
                ? ["customer_ref", "entitlement_grant"].some(
                    (column) =>
                      optionalString(values[column]?.["email"])?.toLowerCase() === email,
                  )
                : false)
            );
          },
        );
        if (!row) return false;

        const customerRef = readJsonObject(row["customer_ref"]);
        const entitlementGrant = readJsonObject(row["entitlement_grant"]);
        const entitlementKeys = uniqueStrings([
          ...readJsonArray(customerRef["entitlementKeys"]),
          input.entitlementKey,
        ]);
        updateFixtureRow(
          db,
          fixtureTables.customers,
          row.id,
          {
            customer_ref: writeJson({
              ...customerRef,
              entitlementKeys,
              entitlementGrantCount: numberValue(customerRef["entitlementGrantCount"]) + 1,
              lastEntitlementGrantedAt: now,
              lastEntitlementKey: input.entitlementKey,
            }),
            entitlement_grant: writeJson({
              ...entitlementGrant,
              entitlementKey: input.entitlementKey,
              lastGrantedAt: now,
              lastExpiresAt: input.expiresAt,
            }),
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(
          actionId("entitlement_grant"),
          "No template customer matched the entitlement grant target.",
          { customers: 0, entitlements: 0 },
        );
      }

      return completed(actionId("entitlement_grant"), "Template entitlement grant completed.", {
        customers: 1,
        entitlements: input.entitlementKey ? 1 : 0,
      });
    },

    async entitlementRevoke(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.entitlements,
          ["entitlement_ref", "entitlement_revoke"],
          (values) => {
            if (
              matchJsonId(
                values,
                ["entitlement_ref", "entitlement_revoke"],
                "entitlementId",
                input.entitlementId,
              )
            ) {
              return true;
            }

            if (!input.entitlementKey) return false;
            const ref = values["entitlement_ref"];
            if (ref?.["entitlementKey"] !== input.entitlementKey) return false;
            return !input.customerId || ref["customerId"] === input.customerId;
          },
        );
        if (!row) return false;

        const entitlementRef = readJsonObject(row["entitlement_ref"]);
        const entitlementRevoke = readJsonObject(row["entitlement_revoke"]);
        updateFixtureRow(
          db,
          fixtureTables.entitlements,
          row.id,
          {
            entitlement_ref: writeJson({
              ...entitlementRef,
              revokedAt: now,
              revokeReason: input.reason ?? entitlementRevoke["reason"] ?? "fixture_revoke",
            }),
            entitlement_revoke: writeJson({
              ...entitlementRevoke,
              lastRevokedAt: now,
              lastReason: input.reason ?? entitlementRevoke["reason"] ?? "fixture_revoke",
            }),
            fixture_status: "revoked",
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(
          actionId("entitlement_revoke"),
          "No template entitlement matched the revoke target.",
          { entitlements: 0 },
        );
      }

      return completed(actionId("entitlement_revoke"), "Template entitlement revoke completed.", {
        entitlements: 1,
      });
    },

    async emailResend(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.emails,
          ["email_ref", "email_resend"],
          (values) => matchJsonId(values, ["email_ref", "email_resend"], "emailId", input.emailId),
        );
        if (!row) return false;

        const emailRef = readJsonObject(row["email_ref"]);
        const emailResend = readJsonObject(row["email_resend"]);
        const resendCount = numberValue(emailRef["resendCount"]) + 1;
        updateFixtureRow(
          db,
          fixtureTables.emails,
          row.id,
          {
            email_ref: writeJson({
              ...emailRef,
              resendCount,
              resentAt: now,
            }),
            email_resend: writeJson({
              ...emailResend,
              lastQueuedAt: now,
              resendCount,
            }),
            fixture_status: "queued",
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(actionId("email_resend"), "No template email matched " + input.emailId + ".", {
          emails: 0,
        });
      }

      return completed(actionId("email_resend"), "Template email resend queued.", {
        emails: 1,
      });
    },

    async licenseRevoke(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.licenses,
          ["license_ref", "license_revoke"],
          (values) =>
            matchJsonId(values, ["license_ref", "license_revoke"], "licenseId", input.licenseId),
        );
        if (!row) return false;

        const licenseRef = readJsonObject(row["license_ref"]);
        const licenseRevoke = readJsonObject(row["license_revoke"]);
        updateFixtureRow(
          db,
          fixtureTables.licenses,
          row.id,
          {
            fixture_status: "revoked",
            license_ref: writeJson({
              ...licenseRef,
              revokedAt: now,
              revokeReason: input.reason ?? licenseRevoke["reason"] ?? "fixture_revoke",
            }),
            license_revoke: writeJson({
              ...licenseRevoke,
              lastRevokedAt: now,
              lastReason: input.reason ?? licenseRevoke["reason"] ?? "fixture_revoke",
            }),
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(actionId("license_revoke"), "No template license matched " + input.licenseId + ".", {
          licenses: 0,
        });
      }

      return completed(actionId("license_revoke"), "Template license revoke completed.", {
        licenses: 1,
      });
    },

    async downloadIssue(input) {
      const now = currentISODateTime();
      const updated = withFixtureDb((db) => {
        const row = findRowByJson(
          db,
          fixtureTables.downloads,
          ["download_ref", "download_issue"],
          (values) =>
            matchJsonId(values, ["download_ref", "download_issue"], "orderLineId", input.orderLineId) ||
            matchJsonId(values, ["download_ref", "download_issue"], "entitlementId", input.entitlementId) ||
            matchJsonId(values, ["download_ref", "download_issue"], "orderId", input.orderId),
        );
        if (!row) return false;

        const downloadRef = readJsonObject(row["download_ref"]);
        const downloadIssue = readJsonObject(row["download_issue"]);
        const issueCount = numberValue(downloadRef["issueCount"]) + 1;
        updateFixtureRow(
          db,
          fixtureTables.downloads,
          row.id,
          {
            download_ref: writeJson({
              ...downloadRef,
              issueCount,
              issuedAt: now,
              expiresAt: input.expiresAt ?? downloadIssue["expiresAt"],
            }),
            download_issue: writeJson({
              ...downloadIssue,
              lastIssuedAt: now,
              lastExpiresAt: input.expiresAt ?? downloadIssue["expiresAt"],
              issueCount,
            }),
            fixture_status: "issued",
          },
          now,
        );
        return true;
      });

      if (!updated) {
        return failed(
          actionId("download_issue"),
          "No template download matched the issue target.",
          { downloads: 0 },
        );
      }

      return completed(actionId("download_issue"), "Template download issue completed.", {
        downloads: 1,
      });
    },
  },
} satisfies MikaApiOverrides;

export const api = createMikaApi(mikaApiOverrides);
