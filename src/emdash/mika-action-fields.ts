/**
 * Reusable EmDash field definitions for Mika admin action buttons.
 *
 * Each export is a JSON field with `widget: "actions:button"` wired to a Mika
 * provider action. Drop into collection schemas or reference when authoring seed
 * data for the admin action testbed.
 */
import {
  createMikaActionButtonOptions,
  createMikaCatalogSyncActionButtonOptions,
  createMikaStockAdjustActionButtonOptions,
} from "@bnomei/emdash-mika/admin";

/** Catalog product field that runs `mika.catalog.syncEntry` for the saved entry. */
export const mika_catalog_syncField = {
  slug: "mika_catalog_sync",
  label: "Sync commerce",
  type: "json",
  widget: "actions:button",
  options: createMikaCatalogSyncActionButtonOptions(),
} as const;

/** Stock item field that runs `mika.stock.adjust` using `stockItemId` from the field value. */
export const mikaStockAdjustField = {
  slug: "stock_adjust",
  label: "Adjust stock",
  type: "json",
  widget: "actions:button",
  options: createMikaStockAdjustActionButtonOptions(),
} as const;

/** Customer field that runs `mika.entitlement.grant` from customer context in the field value. */
export const mikaEntitlementGrantField = {
  slug: "entitlement_grant",
  label: "Grant entitlement",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.entitlement.grant"),
} as const;

/** Order field that runs `mika.order.refund` using `orderId` from the field value. */
export const mikaOrderRefundField = {
  slug: "order_refund",
  label: "Refund order",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.order.refund"),
} as const;

/** Order field that runs `mika.order.cancel` using `orderId` from the field value. */
export const mikaOrderCancelField = {
  slug: "order_cancel",
  label: "Cancel order",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.order.cancel"),
} as const;

/** Webhook field that runs `mika.webhook.replay` using `webhookId` from the field value. */
export const mikaWebhookReplayField = {
  slug: "webhook_replay",
  label: "Replay webhook",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.webhook.replay"),
} as const;

/** Entitlement field that runs `mika.entitlement.revoke` from `entitlementId` or `entitlementKey`. */
export const mikaEntitlementRevokeField = {
  slug: "entitlement_revoke",
  label: "Revoke entitlement",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.entitlement.revoke"),
} as const;

/** Email field that runs `mika.email.resend` using `emailId` from the field value. */
export const mikaEmailResendField = {
  slug: "email_resend",
  label: "Resend email",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.email.resend"),
} as const;

/** License field that runs `mika.license.revoke` using `licenseId` from the field value. */
export const mikaLicenseRevokeField = {
  slug: "license_revoke",
  label: "Revoke license",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.license.revoke"),
} as const;

/** Download field that runs `mika.download.issue` from `orderId`, `entitlementId`, or `orderLineId`. */
export const mikaDownloadIssueField = {
  slug: "download_issue",
  label: "Issue download",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.download.issue"),
} as const;