import {
  createMikaActionButtonOptions,
  createMikaCatalogSyncActionButtonOptions,
  createMikaStockAdjustActionButtonOptions,
} from "@bnomei/emdash-mika/admin";

export const mika_catalog_syncField = {
  slug: "mika_catalog_sync",
  label: "Sync commerce",
  type: "json",
  widget: "actions:button",
  options: createMikaCatalogSyncActionButtonOptions(),
} as const;

export const mikaStockAdjustField = {
  slug: "stock_adjust",
  label: "Adjust stock",
  type: "json",
  widget: "actions:button",
  options: createMikaStockAdjustActionButtonOptions(),
} as const;

export const mikaEntitlementGrantField = {
  slug: "entitlement_grant",
  label: "Grant entitlement",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.entitlement.grant"),
} as const;

export const mikaOrderRefundField = {
  slug: "order_refund",
  label: "Refund order",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.order.refund"),
} as const;

export const mikaOrderCancelField = {
  slug: "order_cancel",
  label: "Cancel order",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.order.cancel"),
} as const;

export const mikaWebhookReplayField = {
  slug: "webhook_replay",
  label: "Replay webhook",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.webhook.replay"),
} as const;

export const mikaEntitlementRevokeField = {
  slug: "entitlement_revoke",
  label: "Revoke entitlement",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.entitlement.revoke"),
} as const;

export const mikaEmailResendField = {
  slug: "email_resend",
  label: "Resend email",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.email.resend"),
} as const;

export const mikaLicenseRevokeField = {
  slug: "license_revoke",
  label: "Revoke license",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.license.revoke"),
} as const;

export const mikaDownloadIssueField = {
  slug: "download_issue",
  label: "Issue download",
  type: "json",
  widget: "actions:button",
  options: createMikaActionButtonOptions("mika.download.issue"),
} as const;
