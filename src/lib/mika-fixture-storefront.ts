import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MikaApiOverrides, MikaRequestContext } from "@bnomei/emdash-mika/server";
import {
  mikaTemplateAvailabilityLabel,
  mikaTemplateAvailabilityStatus,
  mikaTemplateDeliveryLabel,
  mikaTemplateFulfillmentLabel,
  mikaTemplatePriceRangeLabel,
} from "./display.ts";
import {
  createCurrencyCode,
  createISODateTime,
  createMikaId,
  createProviderName,
  type CurrencyCode,
  type FulfillmentKind,
  type ISODateTime,
  type JsonObject,
  type MikaId,
  type PurchaseMode,
} from "@bnomei/emdash-mika/types";
import type {
  AccountDTO,
  AccountExportDTO,
  AccountExportDownloadDTO,
  AvailabilityDTO,
  CartDTO,
  CartLineDTO,
  CartQuoteDTO,
  CheckoutPreviewDTO,
  CheckoutSessionDTO,
  DownloadDTO,
  DownloadResolutionDTO,
  MikaApiResult,
  MoneyDTO,
  OrderInvoiceDTO,
  OrderSummaryDTO,
  PriceDTO,
  SellableDTO,
  SubscriptionDTO,
  VariantOptionValueDTO,
  WebhookReceiveDTO,
  WishlistDTO,
  WishlistItemDTO,
} from "@bnomei/emdash-mika/types";

interface SeedFile {
  readonly content?: Record<string, readonly SeedEntry[]>;
  readonly taxonomies?: readonly SeedTaxonomy[];
}

interface SeedTaxonomy {
  readonly name: string;
  readonly label: string;
  readonly labelSingular?: string;
  readonly hierarchical?: boolean;
  readonly collections?: readonly string[];
  readonly terms?: readonly SeedTaxonomyTerm[];
}

interface SeedTaxonomyTerm {
  readonly slug: string;
  readonly label: string;
  readonly description?: string;
}

interface SeedEntry {
  readonly id: string;
  readonly slug: string;
  readonly locale?: string;
  readonly data?: Record<string, unknown>;
  readonly taxonomies?: Record<string, readonly string[]>;
}

interface ProductVariant {
  readonly variantKey: string;
  readonly label: string;
  readonly sku?: string;
  readonly sellableId: string;
  readonly priceId: string;
  readonly stockItemId?: string;
  readonly providerPriceId?: string;
  readonly amount: number;
  readonly currency: string;
  readonly mode?: PurchaseMode;
  readonly fulfillmentKind?: FulfillmentKind;
  readonly interval?: "month" | "year";
  readonly intervalCount?: number;
  readonly sortOrder?: number;
}

export interface TemplateTaxonomyTermDisplay {
  readonly taxonomy: string;
  readonly slug: string;
  readonly label: string;
  readonly href: string;
}

export interface TemplateProductFilterTerm extends TemplateTaxonomyTermDisplay {
  readonly count: number;
  readonly active: boolean;
}

export interface TemplateProductFilterState {
  readonly categories: readonly TemplateProductFilterTerm[];
  readonly tags: readonly TemplateProductFilterTerm[];
  readonly activeCategory?: string;
  readonly activeTag?: string;
  readonly totalCount: number;
  readonly filteredCount: number;
}

interface TemplateProductSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly categories: readonly TemplateTaxonomyTermDisplay[];
  readonly tags: readonly TemplateTaxonomyTermDisplay[];
  readonly priceLabel: string;
  readonly fulfillmentLabel: string;
  readonly availabilityLabel: string;
  readonly availabilityStatus: string;
  readonly deliveryLabel: string;
  readonly variantCount: number;
}

export interface TemplateProductFilterInput {
  readonly category?: string | null;
  readonly tag?: string | null;
}

interface TemplateProductDetail extends TemplateProductSummary {
  readonly sellables: readonly SellableDTO[];
}

export interface TemplateAccountLicenseDTO {
  readonly id: MikaId;
  readonly title: string;
  readonly status: "active" | "revoked";
  readonly displayKeySuffix?: string;
  readonly orderId?: MikaId;
  readonly downloadHref?: string;
}

export interface TemplateAccountDownloadDTO extends DownloadDTO {
  readonly status: "ready" | "expired";
}

export interface TemplateAccountDTO extends AccountDTO {
  readonly licenses: readonly TemplateAccountLicenseDTO[];
  readonly downloads: readonly TemplateAccountDownloadDTO[];
}

interface TemplateWebhookReceiveInput {
  readonly signatureHeaderPresent?: boolean;
  readonly rawBodyLength?: number;
}

export interface TemplateWebhookReceiveDTO extends WebhookReceiveDTO {
  readonly fixture: {
    readonly provider: string;
    readonly providerEventId?: string;
    readonly eventType?: string;
    readonly rawBodyHash?: string;
    readonly rawBodyLength?: number;
    readonly signatureHeaderPresent: boolean;
    readonly signedWebhookMockBoundary: true;
  };
}

interface SessionCartItem {
  readonly lineId: MikaId;
  readonly sellableId: MikaId;
  readonly priceId?: MikaId;
  readonly quantity: number;
}

interface SessionWishlistItem {
  readonly itemId: MikaId;
  readonly sellableId: MikaId;
  readonly priceId?: MikaId;
  readonly addedAt: ISODateTime;
}

interface TemplateSessionState {
  readonly cartItems: Map<string, SessionCartItem>;
  readonly wishlistItems: Map<string, SessionWishlistItem>;
  readonly checkouts: Map<string, CheckoutSessionDTO>;
  readonly checkoutOrders: Map<string, OrderSummaryDTO>;
  couponCode?: string;
  accountEmail?: string;
  subscriptionStatus?: SubscriptionDTO["status"];
}

const seed = readSeed();
const sessionStates = new Map<string, TemplateSessionState>();
const defaultCurrency = createCurrencyCode("EUR");
const templateProvider = createProviderName("template");

export const mikaStorefrontApiOverrides = {
  catalog: {
    async sellables({ contentRef }) {
      const product = findProduct(contentRef.id);
      if (!product) return ok([]);

      return ok(productSellables(product));
    },
  },
  stock: {
    async availability({ sellableId }) {
      return ok(availabilityFor(createMikaId(sellableId)));
    },
  },
  cart: {
    async get(ctx) {
      return ok(cartFor(sessionState(ctx)));
    },
    async quote(ctx, input = {}) {
      const cart = cartFor(sessionState(ctx));
      return ok(cartQuote(cart, input.couponCode));
    },
    async add(ctx, input) {
      const state = sessionState(ctx);
      const variant = findVariantBySellable(input.sellableId, input.priceId);
      if (!variant) return fail("SELLABLE_NOT_FOUND", "Template sellable not found.", 404);

      const lineId = cartLineId(input.sellableId, input.priceId);
      const current = state.cartItems.get(lineId);
      const quantity = Math.max(1, input.quantity ?? 1) + (current?.quantity ?? 0);
      state.cartItems.set(lineId, {
        lineId: createMikaId(lineId),
        sellableId: input.sellableId,
        priceId: input.priceId,
        quantity,
      });

      return ok(cartFor(state));
    },
    async update(ctx, input) {
      const state = sessionState(ctx);
      const current = state.cartItems.get(input.lineId);
      if (!current) return fail("SELLABLE_NOT_FOUND", "Template cart line not found.", 404);

      state.cartItems.set(input.lineId, {
        ...current,
        quantity: Math.max(1, input.quantity),
      });

      return ok(cartFor(state));
    },
    async remove(ctx, input) {
      const state = sessionState(ctx);
      state.cartItems.delete(input.lineId);
      return ok(cartFor(state));
    },
    async merge(ctx) {
      return ok(cartFor(sessionState(ctx)));
    },
    async applyCoupon(ctx, input) {
      const state = sessionState(ctx);
      state.couponCode = input.code.trim().toUpperCase();
      return ok(cartFor(state));
    },
    async removeCoupon(ctx) {
      const state = sessionState(ctx);
      state.couponCode = undefined;
      return ok(cartFor(state));
    },
  },
  wishlist: {
    async get(ctx) {
      return ok(wishlistFor(sessionState(ctx)));
    },
    async add(ctx, input) {
      const state = sessionState(ctx);
      const variant = findVariantBySellable(input.sellableId, input.priceId);
      if (!variant) return fail("SELLABLE_NOT_FOUND", "Template sellable not found.", 404);

      const itemId = wishlistItemId(input.sellableId, input.priceId);
      state.wishlistItems.set(itemId, {
        itemId: createMikaId(itemId),
        sellableId: input.sellableId,
        priceId: input.priceId,
        addedAt: nowIso(),
      });

      return ok(wishlistFor(state));
    },
    async remove(ctx, input) {
      const state = sessionState(ctx);
      state.wishlistItems.delete(input.itemId);
      return ok(wishlistFor(state));
    },
    async moveToCart(ctx, input) {
      const state = sessionState(ctx);
      const item = state.wishlistItems.get(input.itemId);
      if (!item) return fail("SELLABLE_NOT_FOUND", "Template wishlist item not found.", 404);

      state.wishlistItems.delete(input.itemId);
      state.cartItems.set(cartLineId(item.sellableId, item.priceId), {
        lineId: createMikaId(cartLineId(item.sellableId, item.priceId)),
        sellableId: item.sellableId,
        priceId: item.priceId,
        quantity: Math.max(1, input.quantity ?? 1),
      });

      return ok(cartFor(state));
    },
    async saveForLater(ctx, input) {
      const state = sessionState(ctx);
      const item = state.cartItems.get(input.lineId);
      if (!item) return fail("SELLABLE_NOT_FOUND", "Template cart line not found.", 404);

      state.cartItems.delete(input.lineId);
      const itemId = wishlistItemId(item.sellableId, item.priceId);
      state.wishlistItems.set(itemId, {
        itemId: createMikaId(itemId),
        sellableId: item.sellableId,
        priceId: item.priceId,
        addedAt: nowIso(),
      });

      return ok(wishlistFor(state));
    },
    async merge(ctx) {
      return ok(wishlistFor(sessionState(ctx)));
    },
  },
  checkout: {
    async start(ctx, input = {}) {
      const state = sessionState(ctx);
      const lines = checkoutLines(state, input.sellableId, input.priceId, input.quantity);
      if (lines.length === 0) return fail("CHECKOUT_EMPTY", "Template checkout is empty.", 400);

      const checkoutId = createMikaId(`checkout_template_${Date.now().toString(36)}`);
      const orderId = createMikaId(`order_${checkoutId}`);
      const successPath = input.successPath ?? "/checkout/success";
      const separator = successPath.includes("?") ? "&" : "?";
      const redirectUrl = `${successPath}${separator}checkoutId=${encodeURIComponent(checkoutId)}`;
      const checkout: CheckoutSessionDTO = {
        id: checkoutId,
        status: "redirected",
        mode: checkoutMode(lines),
        provider: input.provider ?? templateProvider,
        redirectUrl,
        orderId,
      };
      state.checkouts.set(checkoutId, { ...checkout, status: "completed" });
      state.checkoutOrders.set(orderId, checkoutOrderSummary(orderId, lines));
      if (!input.sellableId) {
        state.cartItems.clear();
        state.couponCode = undefined;
      }

      return ok(checkout);
    },
    async preview(ctx, input = {}) {
      const cart = cartFor(sessionState(ctx));
      const lines = checkoutLines(sessionState(ctx), input.sellableId, input.priceId, input.quantity);
      const preview: CheckoutPreviewDTO = {
        id: createMikaId("preview_template"),
        status: cart.items.length > 0 || input.sellableId ? "requires_confirmation" : "unavailable",
        mode: checkoutMode(lines),
        provider: templateProvider,
        quote: cartQuote(cart),
        requiredProofs: [],
      };
      return ok(preview);
    },
    async status({ checkoutId }) {
      const seeded = seededCheckout(checkoutId);
      if (seeded) return ok(seeded);

      for (const state of sessionStates.values()) {
        const checkout = state.checkouts.get(checkoutId);
        if (checkout) return ok(checkout);
      }

      return fail("CHECKOUT_EXPIRED", "Template checkout not found.", 404);
    },
  },
  magicLink: {
    async request(ctx, input) {
      sessionState(ctx).accountEmail = input.email;
      return ok({ sent: true });
    },
    async verify(ctx, input) {
      const state = sessionState(ctx);
      state.accountEmail = input.token.includes("@") ? input.token : defaultCustomer().email;
      return ok(accountFor(state));
    },
  },
  account: {
    async get(ctx) {
      return ok(accountFor(sessionState(ctx)));
    },
    async export() {
      const requestedAt = nowIso();
      return ok({
        id: createMikaId("export_template"),
        status: "ready",
        requestedAt,
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
        downloadHref: "/download/download_panel_pack_mira",
      } satisfies AccountExportDTO);
    },
    async exportStatus() {
      return ok({
        id: createMikaId("export_template"),
        status: "ready",
        requestedAt: nowIso(),
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
        downloadHref: "/download/download_panel_pack_mira",
      } satisfies AccountExportDTO);
    },
    async exportDownload() {
      return ok({
        id: createMikaId("export_template"),
        href: "/download/download_panel_pack_mira",
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
      } satisfies AccountExportDownloadDTO);
    },
    async delete() {
      return ok({ requested: true });
    },
    async portal(_ctx, input = {}) {
      return ok({ redirectUrl: input.returnTo ?? "/account" });
    },
  },
  subscription: {
    async cancel(ctx) {
      const state = sessionState(ctx);
      state.subscriptionStatus = "cancel_at_period_end";
      return ok(accountFor(state));
    },
    async change(ctx) {
      const state = sessionState(ctx);
      state.subscriptionStatus = "active";
      return ok(accountFor(state));
    },
    async renew(ctx) {
      const state = sessionState(ctx);
      state.subscriptionStatus = "active";
      return ok(accountFor(state));
    },
  },
  download: {
    async resolve({ token }) {
      const download = downloads().find((entry) => downloadRef(entry)["downloadRef"] === token);
      if (!download) return fail("TOKEN_INVALID", "Template download token not found.", 404);

      return ok({
        title: stringValue(download.data?.["title"], download.slug),
        redirectUrl: `/template-downloads/${encodeURIComponent(token)}.txt`,
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
      } satisfies DownloadResolutionDTO);
    },
  },
  order: {
    async invoice(input) {
      return ok({
        orderId: input.orderId,
        href: `/account?invoice=${encodeURIComponent(input.orderId)}`,
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
      } satisfies OrderInvoiceDTO);
    },
  },
  webhook: {
    async receive(_ctx, input) {
      const fixtureInput = input as typeof input & TemplateWebhookReceiveInput;
      return ok({
        id: createMikaId(input.providerEventId ?? `webhook_${Date.now().toString(36)}`),
        status: "received",
        replayable: true,
        fixture: {
          provider: String(input.provider),
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          rawBodyHash: input.payloadHash,
          rawBodyLength: fixtureInput.rawBodyLength,
          signatureHeaderPresent: fixtureInput.signatureHeaderPresent ?? false,
          signedWebhookMockBoundary: true,
        },
      } satisfies TemplateWebhookReceiveDTO);
    },
  },
} satisfies MikaApiOverrides;

export function templateProductSummaries(
  filters: TemplateProductFilterInput = {},
): readonly TemplateProductSummary[] {
  return products().map(templateProductSummary).filter((product) => productMatchesFilters(product, filters));
}

export function templateProductFilters(filters: TemplateProductFilterInput = {}): TemplateProductFilterState {
  const summaries = products().map(templateProductSummary);
  const filteredProducts = summaries.filter((product) => productMatchesFilters(product, filters));
  const activeCategory = normalizeFilterSlug(filters.category);
  const activeTag = normalizeFilterSlug(filters.tag);

  return {
    categories: productFilterTerms("category", summaries, activeCategory),
    tags: productFilterTerms("tag", summaries, activeTag),
    activeCategory,
    activeTag,
    totalCount: summaries.length,
    filteredCount: filteredProducts.length,
  };
}

export function templateProductBySlug(slug: string): TemplateProductDetail | undefined {
  const product = products().find((entry) => entry.slug === slug || entry.id === slug);
  if (!product) return undefined;

  return {
    ...templateProductSummary(product),
    sellables: productSellables(product),
  };
}

function templateProductSummary(product: SeedEntry): TemplateProductSummary {
  const sellables = productSellables(product);
  return {
    id: product.id,
    slug: product.slug,
    title: stringValue(product.data?.["title"], product.slug),
    description: stringValue(product.data?.["description"], ""),
    href: `/products/${product.slug}`,
    categories: productTaxonomyTerms(product, "category"),
    tags: productTaxonomyTerms(product, "tag"),
    priceLabel: mikaTemplatePriceRangeLabel(sellables),
    fulfillmentLabel: mikaTemplateFulfillmentLabel(sellables),
    availabilityLabel: mikaTemplateAvailabilityLabel(sellables),
    availabilityStatus: mikaTemplateAvailabilityStatus(sellables),
    deliveryLabel: mikaTemplateDeliveryLabel(sellables),
    variantCount: sellables.length,
  };
}

function productMatchesFilters(
  product: TemplateProductSummary,
  filters: TemplateProductFilterInput,
): boolean {
  const category = normalizeFilterSlug(filters.category);
  const tag = normalizeFilterSlug(filters.tag);
  const categoryMatches = !category || product.categories.some((term) => term.slug === category);
  const tagMatches = !tag || product.tags.some((term) => term.slug === tag);
  return categoryMatches && tagMatches;
}

function productFilterTerms(
  taxonomyName: string,
  productsForCounts: readonly TemplateProductSummary[],
  activeSlug: string | undefined,
): readonly TemplateProductFilterTerm[] {
  const counts = new Map<string, number>();
  for (const product of productsForCounts) {
    const terms = taxonomyName === "category" ? product.categories : product.tags;
    for (const term of terms) counts.set(term.slug, (counts.get(term.slug) ?? 0) + 1);
  }

  return taxonomyTerms(taxonomyName)
    .map((term) => ({
      ...taxonomyTermDisplay(taxonomyName, term.slug),
      count: counts.get(term.slug) ?? 0,
      active: activeSlug === term.slug,
    }))
    .filter((term) => term.count > 0);
}

function productTaxonomyTerms(
  product: SeedEntry,
  taxonomyName: string,
): readonly TemplateTaxonomyTermDisplay[] {
  const slugs = product.taxonomies?.[taxonomyName] ?? [];
  return slugs.map((slug) => taxonomyTermDisplay(taxonomyName, slug));
}

function taxonomyTermDisplay(taxonomyName: string, slug: string): TemplateTaxonomyTermDisplay {
  const term = taxonomyTerm(taxonomyName, slug);
  return {
    taxonomy: taxonomyName,
    slug,
    label: term?.label ?? titleFromSlug(slug),
    href: taxonomyHref(taxonomyName, slug),
  };
}

function taxonomyTerm(taxonomyName: string, slug: string): SeedTaxonomyTerm | undefined {
  return taxonomyTerms(taxonomyName).find((term) => term.slug === slug);
}

function taxonomyTerms(taxonomyName: string): readonly SeedTaxonomyTerm[] {
  return seed.taxonomies?.find((taxonomy) => taxonomy.name === taxonomyName)?.terms ?? [];
}

function taxonomyHref(taxonomyName: string, slug: string): string {
  const param = taxonomyName === "category" ? "category" : taxonomyName === "tag" ? "tag" : taxonomyName;
  return `/?${param}=${encodeURIComponent(slug)}`;
}

function normalizeFilterSlug(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readSeed(): SeedFile {
  return JSON.parse(readFileSync(join(process.cwd(), "seed/mika-actions.seed.json"), "utf8")) as SeedFile;
}

function ok<TData>(data: TData, status = 200): MikaApiResult<TData> {
  return { ok: true, status, data };
}

function fail<TData>(
  code: MikaApiResult<never> extends infer _ ? string : never,
  message: string,
  status: number,
): MikaApiResult<TData> {
  return {
    ok: false,
    status,
    error: {
      code: code as never,
      message,
    },
  };
}

function products(): readonly SeedEntry[] {
  return seed.content?.["products"] ?? [];
}

function stockItems(): readonly SeedEntry[] {
  return seed.content?.["stock_items"] ?? [];
}

function customers(): readonly SeedEntry[] {
  return seed.content?.["customers"] ?? [];
}

function orders(): readonly SeedEntry[] {
  return seed.content?.["orders"] ?? [];
}

function entitlements(): readonly SeedEntry[] {
  return seed.content?.["entitlements"] ?? [];
}

function downloads(): readonly SeedEntry[] {
  return seed.content?.["downloads"] ?? [];
}

function licenses(): readonly SeedEntry[] {
  return seed.content?.["licenses"] ?? [];
}

function checkoutSessions(): readonly SeedEntry[] {
  return seed.content?.["checkout_sessions"] ?? [];
}

function findProduct(idOrSlug: string): SeedEntry | undefined {
  return products().find((entry) => entry.id === idOrSlug || entry.slug === idOrSlug);
}

function productVariants(product: SeedEntry): readonly ProductVariant[] {
  const value = product.data?.["variants"];
  if (!Array.isArray(value)) return [];

  return value
    .filter(isProductVariant)
    .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function isProductVariant(value: unknown): value is ProductVariant {
  if (!isRecord(value)) return false;
  return (
    typeof value["variantKey"] === "string" &&
    typeof value["label"] === "string" &&
    typeof value["sellableId"] === "string" &&
    typeof value["priceId"] === "string" &&
    typeof value["amount"] === "number" &&
    typeof value["currency"] === "string"
  );
}

function productSellables(product: SeedEntry): readonly SellableDTO[] {
  const variants = productVariants(product);
  const hasMultipleVariants = variants.length > 1;
  const groupOption = variantGroupOption(variants);
  const groups = hasMultipleVariants
    ? [
        {
          option: groupOption,
          label: groupOption === "fulfillment" ? "Format" : "Size",
          values: variants.map((variant) => variantOption(variant, groupOption)),
        },
      ]
    : [];

  return variants.map((variant) => {
    const sellableId = createMikaId(variant.sellableId);
    const interval = billingInterval(variant.interval);
    const price: PriceDTO = {
      id: createMikaId(variant.priceId),
      sellableId,
      amount: variant.amount,
      currency: createCurrencyCode(variant.currency),
      mode: purchaseMode(variant.mode),
      fulfillmentKind: fulfillmentKind(variant.fulfillmentKind),
      active: true,
      ...(interval ? { interval } : {}),
      ...(interval && variant.intervalCount ? { intervalCount: variant.intervalCount } : {}),
    };

    return {
      id: sellableId,
      contentRef: {
        collection: "products",
        id: product.id,
        locale: product.locale,
      },
      sku: variant.sku,
      title: `${stringValue(product.data?.["title"], product.slug)} - ${variant.label}`,
      active: true,
      variantKey: variant.variantKey,
      variantOptions: hasMultipleVariants ? [variantOption(variant, groupOption)] : [],
      variantGroups: groups,
      prices: [price],
      availability: availabilityFor(sellableId),
    };
  });
}

function variantGroupOption(variants: readonly ProductVariant[]): string {
  return variants.some((variant) => variant.mode || variant.fulfillmentKind) ? "fulfillment" : "size";
}

function variantOption(variant: ProductVariant, option = "size"): VariantOptionValueDTO {
  return {
    option,
    value: variant.variantKey,
    label: variant.label,
  };
}

function availabilityFor(sellableId: MikaId): AvailabilityDTO {
  const stock = stockItems().find((entry) => stockRef(entry)["sellableId"] === sellableId);
  const quantities = isRecord(stock?.data?.["quantities"]) ? stock.data["quantities"] : {};
  const quantityOnHand = numberValue(quantities["quantityOnHand"]);
  const quantityReserved = numberValue(quantities["quantityReserved"]);
  const lowStockThreshold = numberValue(quantities["lowStockThreshold"], 5);
  const availableQuantity = Math.max(0, quantityOnHand - quantityReserved);
  const lowStock = availableQuantity > 0 && availableQuantity <= lowStockThreshold;

  return {
    sellableId,
    status: availableQuantity <= 0 ? "out_of_stock" : lowStock ? "low_stock" : "available",
    availableQuantity,
    maxPerOrder: availableQuantity > 0 ? availableQuantity : undefined,
    lowStock,
  };
}

function stockRef(entry: SeedEntry): Record<string, unknown> {
  return isRecord(entry.data?.["stock_ref"]) ? entry.data["stock_ref"] : {};
}

function downloadRef(entry: SeedEntry): Record<string, unknown> {
  return isRecord(entry.data?.["download_ref"]) ? entry.data["download_ref"] : {};
}

function defaultCustomer(): { readonly id: MikaId; readonly email: string; readonly name: string } {
  const entry = customers()[0];
  const ref = isRecord(entry?.data?.["customer_ref"]) ? entry.data["customer_ref"] : {};
  return {
    id: createMikaId(stringValue(ref["customerId"], "customer_mira_monday")),
    email: stringValue(ref["email"], "mira.monday@example.test"),
    name: stringValue(entry?.data?.["title"], "Mira Monday"),
  };
}

function sessionState(ctx: MikaRequestContext): TemplateSessionState {
  const key = ctx.sessionId ?? ctx.customerId ?? ctx.userId ?? "template-session";
  let state = sessionStates.get(String(key));
  if (!state) {
    state = {
      cartItems: new Map(),
      wishlistItems: new Map(),
      checkouts: new Map(),
      checkoutOrders: new Map(),
      accountEmail: defaultCustomer().email,
    };
    sessionStates.set(String(key), state);
  }
  return state;
}

function cartFor(state: TemplateSessionState): CartDTO {
  const items = [...state.cartItems.values()].map(cartLine).filter((line): line is CartLineDTO => Boolean(line));
  const subtotalAmount = items.reduce((sum, item) => sum + item.total.amount, 0);
  const discountAmount = state.couponCode ? Math.round(subtotalAmount * 0.1) : 0;
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);

  return {
    id: createMikaId("cart_template"),
    status: "open",
    currency: defaultCurrency,
    items,
    coupon: state.couponCode
      ? {
          code: state.couponCode,
          label: "Buttonwood 10% discount",
          discount: money(discountAmount),
        }
      : undefined,
    subtotal: money(subtotalAmount),
    discount: discountAmount > 0 ? money(discountAmount) : undefined,
    total: money(totalAmount),
  };
}

function cartLine(item: SessionCartItem): CartLineDTO | undefined {
  const variant = findVariantBySellable(item.sellableId, item.priceId);
  if (!variant) return undefined;
  const amount = variant.amount * item.quantity;

  return {
    id: item.lineId,
    sellableId: item.sellableId,
    priceId: item.priceId,
    title: productVariantTitle(variant),
    sku: variant.sku,
    variantOptions: [variantOption(variant, variantGroupOptionForVariant(variant))],
    quantity: item.quantity,
    unitAmount: money(variant.amount, createCurrencyCode(variant.currency)),
    subtotal: money(amount, createCurrencyCode(variant.currency)),
    total: money(amount, createCurrencyCode(variant.currency)),
    availability: availabilityFor(item.sellableId),
  };
}

function cartQuote(cart: CartDTO, couponCode?: string): CartQuoteDTO {
  const discountAmount = couponCode && !cart.discount ? Math.round(cart.subtotal.amount * 0.1) : (cart.discount?.amount ?? 0);
  return {
    id: createMikaId("quote_template"),
    cartId: cart.id,
    status: "valid",
    currency: cart.currency,
    items: cart.items,
    subtotal: cart.subtotal,
    discount: discountAmount > 0 ? money(discountAmount, cart.currency) : undefined,
    total: money(Math.max(0, cart.subtotal.amount - discountAmount), cart.currency),
    coupon: couponCode
      ? {
          code: couponCode,
          label: "Buttonwood 10% discount",
          discount: money(discountAmount, cart.currency),
        }
      : cart.coupon,
  };
}

function wishlistFor(state: TemplateSessionState): WishlistDTO {
  return {
    id: createMikaId("wishlist_template"),
    items: [...state.wishlistItems.values()].map(wishlistItem).filter((item): item is WishlistItemDTO => Boolean(item)),
  };
}

function wishlistItem(item: SessionWishlistItem): WishlistItemDTO | undefined {
  const variant = findVariantBySellable(item.sellableId, item.priceId);
  if (!variant) return undefined;

  return {
    id: item.itemId,
    sellableId: item.sellableId,
    priceId: item.priceId,
    title: productVariantTitle(variant),
    sku: variant.sku,
    variantOptions: [variantOption(variant, variantGroupOptionForVariant(variant))],
    addedAt: item.addedAt,
    availability: availabilityFor(item.sellableId),
  };
}

function checkoutLines(
  state: TemplateSessionState,
  sellableId?: MikaId,
  priceId?: MikaId,
  quantity?: number,
): readonly SessionCartItem[] {
  if (sellableId) {
    return [
      {
        lineId: createMikaId(cartLineId(sellableId, priceId)),
        sellableId,
        priceId,
        quantity: Math.max(1, quantity ?? 1),
      },
    ];
  }

  return [...state.cartItems.values()];
}

function checkoutMode(lines: readonly SessionCartItem[]): PurchaseMode {
  return lines.some((line) => findVariantBySellable(line.sellableId, line.priceId)?.mode === "subscription")
    ? "subscription"
    : "payment";
}

function accountFor(
  state: TemplateSessionState,
  subscriptionStatus: SubscriptionDTO["status"] = state.subscriptionStatus ?? "active",
): TemplateAccountDTO {
  const customer = defaultCustomer();
  const email = state.accountEmail ?? customer.email;

  return {
    customer: {
      id: customer.id,
      email,
      name: customer.name,
    },
    orders: [...state.checkoutOrders.values(), ...orders().map(orderSummary)],
    subscriptions: [
      {
        id: createMikaId("sub_template_buttonwood_club"),
        title: "Buttonwood Sunday Strip Club",
        status: subscriptionStatus,
        currentPeriodEnd: createISODateTime("2026-07-20T12:00:00.000Z"),
        cancelAtPeriodEnd: subscriptionStatus === "cancel_at_period_end",
        providerActions: ["portal", "cancel", "renew", "change"],
      },
    ],
    entitlements: entitlements().map((entry) => {
      const ref = isRecord(entry.data?.["entitlement_ref"]) ? entry.data["entitlement_ref"] : {};
      return {
        key: stringValue(ref["entitlementKey"], entry.slug),
        status: entry.data?.["fixture_status"] === "revoked" ? "revoked" : "active",
        source: "manual",
        expiresAt: maybeIso(ref["expiresAt"]),
      };
    }),
    downloads: downloads().map(downloadSummary),
    licenses: licenses().map(licenseSummary),
  };
}

function licenseSummary(entry: SeedEntry): TemplateAccountLicenseDTO {
  const ref = isRecord(entry.data?.["license_ref"]) ? entry.data["license_ref"] : {};
  const status = entry.data?.["fixture_status"] === "revoked" ? "revoked" : "active";
  const displayKeySuffix = stringValue(ref["displayKeySuffix"], "");
  const orderId = stringValue(ref["orderId"], "");
  const entitlementId = stringValue(ref["entitlementId"], "");
  const matchingDownload = downloads().find((download) => {
    const downloadReference = downloadRef(download);
    return (
      download.data?.["fixture_status"] !== "expired" &&
      stringValue(downloadReference["entitlementId"], "") === entitlementId
    );
  });
  const matchingDownloadRef = matchingDownload ? downloadRef(matchingDownload) : undefined;
  const downloadToken = matchingDownloadRef
    ? stringValue(matchingDownloadRef["downloadRef"], "")
    : "";

  return {
    id: createMikaId(stringValue(ref["licenseId"], entry.id)),
    title: stringValue(entry.data?.["title"], entry.slug),
    status,
    displayKeySuffix: displayKeySuffix || undefined,
    orderId: orderId ? createMikaId(orderId) : undefined,
    downloadHref: downloadToken ? `/download/${downloadToken}` : undefined,
  };
}

function downloadSummary(entry: SeedEntry): TemplateAccountDownloadDTO {
  const ref = downloadRef(entry);
  const issue = isRecord(entry.data?.["download_issue"]) ? entry.data["download_issue"] : {};
  const token = stringValue(ref["downloadRef"], entry.slug);
  const status = entry.data?.["fixture_status"] === "expired" ? "expired" : "ready";
  const fallbackExpiresAt =
    status === "expired"
      ? createISODateTime("2026-06-01T12:00:00.000Z")
      : createISODateTime("2026-07-20T12:00:00.000Z");

  return {
    id: createMikaId(token),
    title: stringValue(entry.data?.["title"], entry.slug),
    href: `/download/${token}`,
    expiresAt: maybeIso(issue["expiresAt"]) ?? fallbackExpiresAt,
    status,
  };
}

function orderSummary(entry: SeedEntry): OrderSummaryDTO {
  const ref = isRecord(entry.data?.["order_ref"]) ? entry.data["order_ref"] : {};
  const fixtureStatus = stringValue(entry.data?.["fixture_status"], "");
  const paymentStatus = stringValue(entry.data?.["payment_status"], "");
  return {
    id: createMikaId(stringValue(ref["orderId"], entry.id)),
    orderNumber: stringValue(ref["orderNumber"], entry.slug),
    status:
      fixtureStatus === "cancelled"
        ? "cancelled"
        : fixtureStatus === "pending"
          ? "pending"
          : paymentStatus === "partially_refunded"
            ? "partially_refunded"
            : "paid",
    paymentStatus:
      paymentStatus === "partially_refunded"
        ? "partially_refunded"
        : paymentStatus === "pending"
          ? "unpaid"
          : "paid",
    total: money(numberValue(entry.data?.["total_amount"])),
    createdAt: createISODateTime("2026-06-20T12:00:00.000Z"),
    invoiceUrl: `/account/orders?invoice=${encodeURIComponent(stringValue(ref["orderId"], entry.id))}`,
  };
}

function checkoutOrderSummary(orderId: MikaId, lines: readonly SessionCartItem[]): OrderSummaryDTO {
  const totalAmount = lines.reduce((sum, line) => {
    const variant = findVariantBySellable(line.sellableId, line.priceId);
    return sum + (variant?.amount ?? 0) * line.quantity;
  }, 0);

  return {
    id: orderId,
    orderNumber: orderId.replace(/^order_checkout_template_/, "TEMPLATE-").toUpperCase(),
    status: "paid",
    paymentStatus: "paid",
    total: money(totalAmount),
    createdAt: nowIso(),
    invoiceUrl: `/account/orders?invoice=${encodeURIComponent(orderId)}`,
  };
}

function seededCheckout(checkoutId: string): CheckoutSessionDTO | undefined {
  const entry = checkoutSessions().find((candidate) => {
    const ref = isRecord(candidate.data?.["checkout_ref"]) ? candidate.data["checkout_ref"] : {};
    return ref["checkoutId"] === checkoutId || ref["providerCheckoutId"] === checkoutId;
  });
  if (!entry) return undefined;

  const ref = isRecord(entry.data?.["checkout_ref"]) ? entry.data["checkout_ref"] : {};
  const paid = entry.data?.["provider_status"] === "paid";
  return {
    id: createMikaId(stringValue(ref["checkoutId"], checkoutId)),
    status: paid ? "completed" : "pending",
    mode: "payment",
    provider: createProviderName(stringValue(ref["provider"], "template")),
    redirectUrl: stringValue(entry.data?.["redirect_url"], ""),
    orderId: createMikaId("order_buttonwood_1001"),
  };
}

function findVariantBySellable(sellableId: MikaId, priceId?: MikaId): ProductVariant | undefined {
  for (const product of products()) {
    const variant = productVariants(product).find(
      (candidate) =>
        candidate.sellableId === sellableId && (!priceId || candidate.priceId === priceId),
    );
    if (variant) return variant;
  }

  return undefined;
}

function productForVariant(variant: ProductVariant): SeedEntry | undefined {
  return products().find((product) =>
    productVariants(product).some(
      (candidate) =>
        candidate.sellableId === variant.sellableId && candidate.priceId === variant.priceId,
    ),
  );
}

function productVariantTitle(variant: ProductVariant): string {
  const product = productForVariant(variant);
  const productTitle = product ? stringValue(product.data?.["title"], "") : "";
  return productTitle ? `${productTitle} - ${variant.label}` : variant.label;
}

function variantGroupOptionForVariant(variant: ProductVariant): string {
  const product = productForVariant(variant);
  return product ? variantGroupOption(productVariants(product)) : "size";
}

function priceRangeLabel(variants: readonly ProductVariant[]): string {
  if (variants.length === 0) return "";
  const currency = createCurrencyCode(variants[0]?.currency ?? "EUR");
  const prices = variants.map((variant) => variant.amount);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
}

function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
}

function money(amount: number, currency: CurrencyCode = defaultCurrency): MoneyDTO {
  return { amount, currency };
}

function cartLineId(sellableId: MikaId, priceId?: MikaId): string {
  return `line_${sellableId}_${priceId ?? "default"}`;
}

function wishlistItemId(sellableId: MikaId, priceId?: MikaId): string {
  return `wish_${sellableId}_${priceId ?? "default"}`;
}

function nowIso(): ISODateTime {
  return createISODateTime(new Date().toISOString());
}

function maybeIso(value: unknown): ISODateTime | undefined {
  return typeof value === "string" ? createISODateTime(value) : undefined;
}

function purchaseMode(value: unknown): PurchaseMode {
  return value === "subscription" ? "subscription" : "payment";
}

function fulfillmentKind(value: unknown): FulfillmentKind {
  return value === "none" ||
    value === "entitlement" ||
    value === "download" ||
    value === "license" ||
    value === "external"
    ? value
    : "download";
}

function billingInterval(value: unknown): PriceDTO["interval"] {
  return value === "month" || value === "year" ? value : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function templateSeedForTests() {
  return {
    sessionStates,
    products: products(),
    stockItems: stockItems(),
  };
}
