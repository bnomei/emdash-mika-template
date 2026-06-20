import { createMikaApi, type MikaApiOverrides } from "@bnomei/emdash-mika/server";
import { createISODateTime } from "@bnomei/emdash-mika/types";
import type {
  AdminActionResultDTO,
  MikaApiResult,
  MikaId,
  ProviderHealthDTO,
  ProviderName,
} from "@bnomei/emdash-mika/types";

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
  return ok({ id: mikaId(id), status: "completed", message, affected });
}

function actionId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36);
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
      return completed(actionId("provider_sync"), "Template provider sync completed for " + target + ".", {
        syncedEntries: contentRef ? 1 : 0,
      });
    },

    async stockAdjust(input) {
      return completed(actionId("stock_adjust"), "Template stock adjustment completed.", {
        stockItems: input.stockItemId ? 1 : 0,
        quantityDelta: input.quantityDelta,
      });
    },

    async releaseExpiredReservations() {
      return completed(actionId("stock_release"), "Template reservation release completed.", {
        releasedReservations: 0,
      });
    },

    async webhookReplay(input) {
      return completed(actionId("webhook_replay"), "Template webhook replay queued.", {
        webhooks: input.webhookId ? 1 : 0,
      });
    },

    async orderRefund(input) {
      return completed(actionId("order_refund"), "Template order refund accepted.", {
        orders: input.orderId ? 1 : 0,
        refundAmount: input.amount ?? 0,
      });
    },

    async orderCancel(input) {
      return completed(actionId("order_cancel"), "Template order cancellation accepted.", {
        orders: input.orderId ? 1 : 0,
      });
    },

    async entitlementGrant(input) {
      return completed(actionId("entitlement_grant"), "Template entitlement grant completed.", {
        entitlements: input.entitlementKey ? 1 : 0,
      });
    },

    async entitlementRevoke(input) {
      return completed(actionId("entitlement_revoke"), "Template entitlement revoke completed.", {
        entitlements: input.entitlementId || input.entitlementKey ? 1 : 0,
      });
    },

    async emailResend(input) {
      return completed(actionId("email_resend"), "Template email resend queued.", {
        emails: input.emailId ? 1 : 0,
      });
    },

    async licenseRevoke(input) {
      return completed(actionId("license_revoke"), "Template license revoke completed.", {
        licenses: input.licenseId ? 1 : 0,
      });
    },

    async downloadIssue(input) {
      return completed(actionId("download_issue"), "Template download issue completed.", {
        downloads: input.orderId || input.entitlementId || input.orderLineId ? 1 : 0,
      });
    },
  },
} satisfies MikaApiOverrides;

export const api = createMikaApi(mikaApiOverrides);
