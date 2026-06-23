import {
  formatMikaMoney,
  formatMikaPrice,
  formatMikaSellable,
} from "@bnomei/emdash-mika/astro";
import type {
  CartDTO,
  PriceDTO,
  SellableDTO,
  SubscriptionDTO,
} from "@bnomei/emdash-mika/types";

export type MikaTemplateBadgeVariant = "success" | "warning" | "error" | "neutral";

export interface MikaTemplateProductVariantDisplay {
  readonly id: string;
  readonly label: string;
  readonly priceLabel: string;
  readonly fulfillmentLabel: string;
  readonly availabilityLabel: string;
  readonly available: boolean;
}

const statusLabels: Record<string, string> = {
  active: "Active",
  available: "In stock",
  backorder: "Backorder available",
  cancel_at_period_end: "Cancels at period end",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
  failed: "Failed",
  incomplete: "Incomplete",
  inactive: "Inactive",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  past_due: "Past due",
  pending: "Pending",
  ready: "Ready",
  refunded: "Refunded",
  revoked: "Revoked",
  running: "Running",
  trialing: "Trialing",
  unpaid: "Unpaid",
};

const successStatuses = new Set(["active", "available", "completed", "paid", "ready", "trialing"]);
const warningStatuses = new Set([
  "backorder",
  "cancel_at_period_end",
  "incomplete",
  "low_stock",
  "past_due",
  "pending",
  "running",
  "unpaid",
]);
const errorStatuses = new Set(["cancelled", "expired", "failed", "out_of_stock", "revoked"]);

export function mikaTemplateStatusLabel(status: string | undefined): string {
  if (!status) return "Unknown";
  return (
    statusLabels[status] ??
    status.replaceAll("_", " ").replace(/^\w/, (value) => value.toUpperCase())
  );
}

export function mikaTemplateStatusVariant(status: string | undefined): MikaTemplateBadgeVariant {
  if (!status) return "neutral";
  if (successStatuses.has(status)) return "success";
  if (warningStatuses.has(status)) return "warning";
  if (errorStatuses.has(status)) return "error";
  return "neutral";
}

export function mikaTemplateDateLabel(isoDate: string | undefined): string {
  if (!isoDate) return "Not set";
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function mikaTemplatePlural(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function mikaTemplateCartItemCount(cart: CartDTO | null | undefined): number {
  return cart?.items.reduce((total, line) => total + line.quantity, 0) ?? 0;
}

export function mikaTemplateCartCheckoutIssues(cart: CartDTO | null | undefined): readonly string[] {
  if (!cart?.items.length) return [];

  const issues: string[] = [];
  for (const line of cart.items) {
    const status = line.availability?.status;
    if (status === "out_of_stock") {
      issues.push(`${line.title} is no longer available.`);
      continue;
    }

    const maxPerOrder = line.availability?.maxPerOrder;
    if (typeof maxPerOrder === "number" && maxPerOrder > 0 && line.quantity > maxPerOrder) {
      issues.push(`${line.title} has ${maxPerOrder} available for this order.`);
    }
  }

  return issues;
}

export function mikaTemplatePriceRangeLabel(sellables: readonly SellableDTO[]): string {
  const prices = activePrices(sellables).toSorted((a, b) => a.amount - b.amount);
  const first = prices[0];
  const last = prices.at(-1);
  if (!first || !last) return "Price unavailable";
  if (first.id === last.id || (first.amount === last.amount && first.currency === last.currency)) {
    return formatMikaPrice(first);
  }

  return `${formatMikaMoney(first)} - ${formatMikaMoney(last)}`;
}

export function mikaTemplateFulfillmentLabel(sellables: readonly SellableDTO[]): string {
  const labels = uniqueStrings(activePrices(sellables).map(mikaTemplateFulfillmentKindLabel));
  return labels.length > 0 ? humanJoin(labels) : "Fulfillment after checkout";
}

export function mikaTemplateAvailabilityLabel(sellables: readonly SellableDTO[]): string {
  const activeSellables = sellables.filter((sellable) => sellable.active);
  if (activeSellables.length === 0) return "Unavailable";

  const statuses = activeSellables.map((sellable) => sellable.availability?.status ?? "untracked");
  if (statuses.every((status) => status === "out_of_stock")) return "Unavailable";
  if (statuses.some((status) => status === "low_stock")) return "Limited availability";
  if (statuses.some((status) => status === "backorder")) return "Backorder available";
  if (statuses.some((status) => ["available", "manual", "untracked"].includes(status))) {
    return "Available now";
  }

  return "Check availability";
}

export function mikaTemplateAvailabilityStatus(sellables: readonly SellableDTO[]): string {
  const label = mikaTemplateAvailabilityLabel(sellables);
  if (label === "Unavailable") return "out_of_stock";
  if (label === "Limited availability") return "low_stock";
  if (label === "Backorder available") return "backorder";
  return "available";
}

export function mikaTemplateDeliveryLabel(sellables: readonly SellableDTO[]): string {
  const kinds = uniqueStrings(activePrices(sellables).map(fulfillmentKindKey));
  if (kinds.length === 0) return "Delivery after checkout";
  if (kinds.length > 1) return "Delivered through your account";

  switch (kinds[0]) {
    case "subscription":
      return "Access starts after checkout";
    case "license":
      return "License issued after checkout";
    case "entitlement":
      return "Account access after checkout";
    case "external":
      return "Seller-coordinated delivery";
    case "none":
      return "Account confirmation after checkout";
    case "download":
    default:
      return "Download after checkout";
  }
}

export function mikaTemplateProductIncludedLabels(
  sellables: readonly SellableDTO[],
): readonly string[] {
  return mikaTemplateProductVariantDisplays(sellables).map(
    (variant) => `${variant.label}: ${variant.fulfillmentLabel}, ${variant.priceLabel}`,
  );
}

export function mikaTemplateProductDeliveryNotes(sellables: readonly SellableDTO[]): readonly string[] {
  const kinds = uniqueStrings(activePrices(sellables).map(fulfillmentKindKey));
  const notes = new Set<string>();

  for (const kind of kinds) {
    switch (kind) {
      case "subscription":
        notes.add("Subscription access is added to your account when checkout completes.");
        break;
      case "license":
        notes.add("License records appear in your account with the key suffix only.");
        break;
      case "entitlement":
        notes.add("Account access is enabled after checkout confirmation.");
        break;
      case "external":
        notes.add("The seller will coordinate any external delivery steps after checkout.");
        break;
      case "none":
        notes.add("Your account records the purchase confirmation.");
        break;
      case "download":
      default:
        notes.add("Downloads are available from your account after checkout.");
        break;
    }
  }

  if (notes.size === 0) notes.add("Fulfillment details appear in your account after checkout.");
  notes.add("Order receipts and invoices stay available from the Orders page.");
  return [...notes];
}

export function mikaTemplateProductTrustNotes(): readonly string[] {
  return [
    "Sold by Buttonwood Lot Press.",
    "Checkout returns to this shop with your order status and next steps.",
    "Account pages keep orders, downloads, subscriptions, and licenses separate.",
  ];
}

export function mikaTemplateProductVariantDisplays(
  sellables: readonly SellableDTO[],
): readonly MikaTemplateProductVariantDisplay[] {
  return sellables
    .filter((sellable) => sellable.active)
    .map((sellable) => {
      const price = firstActivePrice(sellable);
      const status = sellable.availability?.status ?? "untracked";
      return {
        id: sellable.id,
        label: formatMikaSellable(sellable),
        priceLabel: price ? formatMikaPrice(price) : "Price unavailable",
        fulfillmentLabel: price ? mikaTemplateFulfillmentKindLabel(price) : "Unavailable",
        availabilityLabel: mikaTemplateStatusLabel(status),
        available: status !== "out_of_stock" && Boolean(price),
      };
    });
}

export function mikaTemplateFulfillmentKindLabel(price: PriceDTO): string {
  switch (fulfillmentKindKey(price)) {
    case "subscription":
      return "Subscription";
    case "license":
      return "License";
    case "entitlement":
      return "Account access";
    case "external":
      return "Seller delivery";
    case "none":
      return "Purchase record";
    case "download":
    default:
      return "Download";
  }
}

export function mikaTemplateSubscriptionPeriodLabel(subscription: SubscriptionDTO): string {
  if (!subscription.currentPeriodEnd) return "No renewal date set";
  const date = mikaTemplateDateLabel(subscription.currentPeriodEnd);
  return subscription.cancelAtPeriodEnd ? `Ends ${date}` : `Renews ${date}`;
}

function activePrices(sellables: readonly SellableDTO[]): readonly PriceDTO[] {
  return sellables
    .filter((sellable) => sellable.active)
    .flatMap((sellable) => sellable.prices.filter((price) => price.active));
}

function firstActivePrice(sellable: SellableDTO): PriceDTO | undefined {
  return sellable.prices.find((price) => price.active);
}

function fulfillmentKindKey(price: PriceDTO): string {
  if (price.mode === "subscription") return "subscription";
  return price.fulfillmentKind;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

function humanJoin(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
