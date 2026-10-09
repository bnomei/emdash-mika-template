/**
 * Seed-json fixture implementing the Mika storefront API surface. Session state drives
 * cart, wishlist, checkout, and account flows; catalog reads come from `seed/mika-actions.seed.json`.
 * Exported overrides plug into `mika-api.ts`; catalog helpers feed product listing and detail pages.
 */
import { readFileSync, statSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { mikaSafeReturnTo } from "@bnomei/emdash-mika/astro";
import type { MikaApiOverrides, MikaRequestContext } from "@bnomei/emdash-mika/server";
import type { LicenseDocument } from "@bnomei/emdash-mika/types/documents";
import {
  mikaTemplateAvailabilityLabel,
  mikaTemplateAvailabilityStatus,
  mikaTemplateDeliveryLabel,
  mikaTemplateFulfillmentLabel,
  mikaTemplatePriceRangeLabel,
} from "./display.ts";
import {
  createCartId,
  createCheckoutSessionId,
  createCurrencyCode,
  createISODateTime,
  createMikaId,
  createOrderId,
  createPriceId,
  createProviderName,
  createSellableId,
  type CheckoutSessionId,
  type CurrencyCode,
  type FulfillmentKind,
  type ISODateTime,
  type JsonObject,
  type MikaId,
  type OrderId,
  type PriceId,
  type PurchaseMode,
  type SellableId,
} from "@bnomei/emdash-mika/types";
import type {
  AccountDTO,
  AvailabilityDTO,
  CartDTO,
  CartLineDTO,
  CartQuoteDTO,
  CheckoutPreviewDTO,
  CheckoutSessionDTO,
  DownloadDTO,
  DownloadResolutionDTO,
  EntitlementDTO,
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

/** Optional category/tag slugs for catalog listing and filter UI. */
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
  readonly orderId?: OrderId;
  readonly downloadHref?: string;
}

export interface TemplateAccountDownloadDTO extends DownloadDTO {
  readonly status: "ready" | "expired";
}

export interface TemplateAccountDTO extends AccountDTO {
  readonly licenses: readonly TemplateAccountLicenseDTO[];
  readonly downloads: readonly TemplateAccountDownloadDTO[];
}

export interface TemplateWebhookReceiveDTO extends WebhookReceiveDTO {
  readonly fixture: {
    readonly provider: string;
    readonly providerEventId?: string;
    readonly eventType?: string;
    readonly rawBodyHash?: string;
    readonly signedWebhookMockBoundary: true;
  };
}

interface SessionCartItem {
  readonly lineId: MikaId;
  readonly sellableId: SellableId;
  readonly priceId?: PriceId;
  readonly quantity: number;
}

interface SessionWishlistItem {
  readonly itemId: MikaId;
  readonly sellableId: SellableId;
  readonly priceId?: PriceId;
  readonly addedAt: ISODateTime;
  readonly quantity?: number;
}

interface TemplateSessionState {
  readonly cartItems: Map<string, SessionCartItem>;
  readonly wishlistItems: Map<string, SessionWishlistItem>;
  readonly checkouts: Map<string, CheckoutSessionDTO>;
  readonly checkoutOrders: Map<string, OrderSummaryDTO>;
  readonly pendingCartCheckouts: Set<string>;
  couponCode?: string;
  accountEmail?: string;
  pendingEmail?: string;
  subscriptionStatus?: SubscriptionDTO["status"];
  subscriptionPriceId?: string;
}

interface TemplateSessionStateSnapshot {
  readonly cartItems?: readonly SessionCartItem[];
  readonly wishlistItems?: readonly SessionWishlistItem[];
  readonly checkouts?: readonly CheckoutSessionDTO[];
  readonly checkoutOrders?: readonly OrderSummaryDTO[];
  readonly pendingCartCheckouts?: readonly string[];
  readonly couponCode?: string;
  readonly accountEmail?: string;
  readonly pendingEmail?: string;
  readonly subscriptionStatus?: SubscriptionDTO["status"];
  readonly subscriptionPriceId?: string;
}

const sessionStates = new Map<string, TemplateSessionState>();
const defaultCurrency = createCurrencyCode("EUR");
const templateProvider = createProviderName("template");
const templateSessionStorageKey = "mika-template-storefront";
const templateMagicLinkToken = "template-login";
const templateCouponCodes = new Set(["BUTTONWOOD10"]);

function validCouponCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toUpperCase();
  return templateCouponCodes.has(normalized) ? normalized : undefined;
}

/** Mika API overrides for catalog, cart, checkout, account, and webhook fixture handlers. */
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
      return ok(availabilityFor(createSellableId(sellableId)));
    },
  },
  cart: {
    async get(ctx) {
      return ok(cartFor(await sessionState(ctx)));
    },
    async quote(ctx, input = {}) {
      const cart = cartFor(await sessionState(ctx));
      return ok(cartQuote(cart, validCouponCode(input.couponCode)));
    },
    async add(ctx, input) {
      const state = await sessionState(ctx);
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
      await persistSessionState(ctx, state);

      return ok(cartFor(state));
    },
    async update(ctx, input) {
      const state = await sessionState(ctx);
      const current = state.cartItems.get(input.lineId);
      if (!current) return fail("SELLABLE_NOT_FOUND", "Template cart line not found.", 404);

      const maxPerOrder = maxPerOrderFor(current.sellableId);
      const requested = Math.max(1, input.quantity);
      state.cartItems.set(input.lineId, {
        ...current,
        quantity: maxPerOrder === undefined ? requested : Math.min(requested, maxPerOrder),
      });
      await persistSessionState(ctx, state);

      return ok(cartFor(state));
    },
    async remove(ctx, input) {
      const state = await sessionState(ctx);
      state.cartItems.delete(input.lineId);
      await persistSessionState(ctx, state);
      return ok(cartFor(state));
    },
    async merge(ctx, input) {
      const state = await sessionState(ctx);
      const sourceSessionId = input?.sourceSessionId;
      const source = sourceSessionId ? findSourceSessionState(String(sourceSessionId)) : undefined;
      if (source && source !== state) {
        for (const item of source.cartItems.values()) {
          const lineId = cartLineId(item.sellableId, item.priceId);
          const existing = state.cartItems.get(lineId)?.quantity ?? 0;
          state.cartItems.set(lineId, {
            lineId: createMikaId(lineId),
            sellableId: item.sellableId,
            priceId: item.priceId,
            quantity: existing + item.quantity,
          });
        }
        await persistSessionState(ctx, state);
      }
      return ok(cartFor(state));
    },
    async applyCoupon(ctx, input) {
      const code = validCouponCode(input.code);
      if (!code) return fail("COUPON_INVALID", "Template coupon code is not valid.", 422);
      const state = await sessionState(ctx);
      state.couponCode = code;
      await persistSessionState(ctx, state);
      return ok(cartFor(state));
    },
    async removeCoupon(ctx) {
      const state = await sessionState(ctx);
      state.couponCode = undefined;
      await persistSessionState(ctx, state);
      return ok(cartFor(state));
    },
  },
  wishlist: {
    async get(ctx) {
      return ok(wishlistFor(await sessionState(ctx)));
    },
    async add(ctx, input) {
      const state = await sessionState(ctx);
      const variant = findVariantBySellable(input.sellableId, input.priceId);
      if (!variant) return fail("SELLABLE_NOT_FOUND", "Template sellable not found.", 404);

      const itemId = wishlistItemId(input.sellableId, input.priceId);
      state.wishlistItems.set(itemId, {
        itemId: createMikaId(itemId),
        sellableId: input.sellableId,
        priceId: input.priceId,
        addedAt: nowIso(),
      });
      await persistSessionState(ctx, state);

      return ok(wishlistFor(state));
    },
    async remove(ctx, input) {
      const state = await sessionState(ctx);
      state.wishlistItems.delete(input.itemId);
      await persistSessionState(ctx, state);
      return ok(wishlistFor(state));
    },
    async moveToCart(ctx, input) {
      const state = await sessionState(ctx);
      const item = state.wishlistItems.get(input.itemId);
      if (!item) return fail("SELLABLE_NOT_FOUND", "Template wishlist item not found.", 404);

      state.wishlistItems.delete(input.itemId);
      const lineId = cartLineId(item.sellableId, item.priceId);
      const existingQuantity = state.cartItems.get(lineId)?.quantity ?? 0;
      const moveQuantity = input.quantity ?? item.quantity ?? 1;
      state.cartItems.set(lineId, {
        lineId: createMikaId(lineId),
        sellableId: item.sellableId,
        priceId: item.priceId,
        quantity: Math.max(1, moveQuantity) + existingQuantity,
      });
      await persistSessionState(ctx, state);

      return ok(cartFor(state));
    },
    async saveForLater(ctx, input) {
      const state = await sessionState(ctx);
      const item = state.cartItems.get(input.lineId);
      if (!item) return fail("SELLABLE_NOT_FOUND", "Template cart line not found.", 404);

      state.cartItems.delete(input.lineId);
      const itemId = wishlistItemId(item.sellableId, item.priceId);
      state.wishlistItems.set(itemId, {
        itemId: createMikaId(itemId),
        sellableId: item.sellableId,
        priceId: item.priceId,
        addedAt: nowIso(),
        quantity: item.quantity,
      });
      await persistSessionState(ctx, state);

      return ok(wishlistFor(state));
    },
    async merge(ctx, input) {
      const state = await sessionState(ctx);
      const sourceSessionId = input?.sourceSessionId;
      const source = sourceSessionId ? findSourceSessionState(String(sourceSessionId)) : undefined;
      if (source && source !== state) {
        for (const item of source.wishlistItems.values()) {
          const itemId = wishlistItemId(item.sellableId, item.priceId);
          if (!state.wishlistItems.has(itemId)) {
            state.wishlistItems.set(itemId, {
              itemId: createMikaId(itemId),
              sellableId: item.sellableId,
              priceId: item.priceId,
              addedAt: item.addedAt,
              quantity: item.quantity,
            });
          }
        }
        await persistSessionState(ctx, state);
      }
      return ok(wishlistFor(state));
    },
  },
  checkout: {
    async start(ctx, input = {}) {
      const state = await sessionState(ctx);
      if (ctx.storefrontReview && !sameReview(ctx.storefrontReview, checkoutReview(state, input))) {
        return fail("REVIEW_CHANGED", "Checkout terms changed. Review again.", 409);
      }
      const lines = checkoutLines(state, input.sellableId, input.priceId, input.quantity);
      if (lines.length === 0) return fail("CHECKOUT_EMPTY", "Template checkout is empty.", 400);
      if (lines.some((line) => !findVariantBySellable(line.sellableId, line.priceId))) {
        return fail("SELLABLE_NOT_FOUND", "Template sellable not found.", 404);
      }
      if (lines.some((line) => isCheckoutLineBlocked(line))) {
        return fail("CHECKOUT_UNAVAILABLE", "Template checkout has unavailable lines.", 409);
      }

      const checkoutId = createCheckoutSessionId(`checkout_template_${Date.now().toString(36)}`);
      const statusToken = `token_${checkoutId}`;
      const orderId = createOrderId(`order_${checkoutId}`);
      const successPath = mikaSafeReturnTo(input.successPath, { fallback: "/checkout/success" });
      const redirectUrl = checkoutRedirectUrl(successPath, checkoutId, statusToken);
      const checkout: CheckoutSessionDTO = {
        id: checkoutId,
        status: "redirected",
        mode: checkoutMode(lines),
        provider: input.provider ?? templateProvider,
        redirectUrl,
        statusToken,
        orderId,
      };
      state.checkouts.set(checkoutId, checkout);
      state.checkoutOrders.set(
        orderId,
        checkoutOrderSummary(orderId, lines, input.sellableId ? undefined : state.couponCode),
      );
      if (!input.sellableId) {
        state.pendingCartCheckouts.add(String(checkoutId));
      }
      await persistSessionState(ctx, state);

      return ok(checkout);
    },
    async preview(ctx, input = {}) {
      const state = await sessionState(ctx);
      const cart = cartFor(state);
      const lines = checkoutLines(state, input.sellableId, input.priceId, input.quantity);
      if (lines.some((line) => !findVariantBySellable(line.sellableId, line.priceId))) {
        return fail("SELLABLE_NOT_FOUND", "Template sellable not found.", 404);
      }
      if (lines.some((line) => isCheckoutLineBlocked(line))) {
        return fail("CHECKOUT_UNAVAILABLE", "Template checkout has unavailable lines.", 409);
      }
      const quoteCart = input.sellableId ? cartFromLines(lines) : cart;
      const preview: CheckoutPreviewDTO = {
        id: createMikaId("preview_template"),
        status: cart.items.length > 0 || input.sellableId ? "requires_confirmation" : "unavailable",
        mode: checkoutMode(lines),
        provider: templateProvider,
        quote: cartQuote(quoteCart),
        requiredProofs: [],
      };
      return ok(preview);
    },
    async status(ctxOrInput, input) {
      const { checkoutId, token } = checkoutLookupInput(ctxOrInput, input);
      if (!checkoutId) return fail("CHECKOUT_EXPIRED", "Template checkout not found.", 404);
      const seeded = seededCheckout(checkoutId);
      if (seeded) return ok(seeded);

      if (isRequestContextInput(ctxOrInput)) {
        const state = await sessionState(ctxOrInput);
        const checkout = state.checkouts.get(checkoutId);
        if (checkout) return ok(checkout);
      }

      const tokenMatch = token ? findCheckoutState(checkoutId, token) : undefined;
      if (tokenMatch) return ok(tokenMatch.checkout);

      return fail("CHECKOUT_EXPIRED", "Template checkout not found.", 404);
    },
    async cancel(ctxOrInput, input) {
      const { checkoutId, token } = checkoutLookupInput(ctxOrInput, input);
      if (!checkoutId) return fail("CHECKOUT_EXPIRED", "Template checkout not found.", 404);
      const seeded = seededCheckout(checkoutId);
      if (seeded) return ok(seeded);

      if (isRequestContextInput(ctxOrInput)) {
        const state = await sessionState(ctxOrInput);
        const checkout = state.checkouts.get(checkoutId);
        if (checkout) {
          const cancelled = cancelCheckout(state, checkout);
          await persistSessionState(ctxOrInput, state);
          return ok(cancelled);
        }
      }

      const tokenMatch = token ? findCheckoutState(checkoutId, token) : undefined;
      if (tokenMatch) return ok(cancelCheckout(tokenMatch.state, tokenMatch.checkout));

      return fail("CHECKOUT_EXPIRED", "Template checkout not found.", 404);
    },
  },
  magicLink: {
    async request(ctx, input) {
      const state = await sessionState(ctx);
      state.pendingEmail = input.email;
      await persistSessionState(ctx, state);
      return ok({ sent: true });
    },
    async verify(ctx, input) {
      const state = await sessionState(ctx);
      if (!state.pendingEmail || input.token !== templateMagicLinkToken) {
        return fail("MAGIC_LINK_INVALID", "Template magic link is invalid or expired.", 401);
      }
      state.accountEmail = state.pendingEmail;
      state.pendingEmail = undefined;
      await persistSessionState(ctx, state);
      await ctx.session?.set("mika.customerId", defaultCustomer().id);
      return ok(accountFor(state));
    },
  },
  account: {
    async get(ctx) {
      return ok(accountFor(await sessionState(ctx)));
    },
    async export() {
      return fail("NOT_IMPLEMENTED", "Account exports require a real export backend; this fixture does not generate artifacts.", 501);
    },
    async exportStatus() {
      return fail("NOT_IMPLEMENTED", "Account export status is unavailable in this fixture.", 501);
    },
    async exportDownload() {
      return fail("NOT_IMPLEMENTED", "Account export delivery is unavailable in this fixture.", 501);
    },
    async delete() {
      return ok({ requested: true });
    },
    async portal(_ctx, input = {}) {
      return ok({ redirectUrl: mikaSafeReturnTo(input.returnTo, { fallback: "/account" }) });
    },
  },
  subscription: {
    async cancel(ctx, input) {
      const state = await sessionState(ctx);
      if (!validSubscriptionReview(ctx, state, "cancel", input)) return fail("REVIEW_CHANGED", "Subscription terms changed. Review again.", 409);
      state.subscriptionStatus = "cancel_at_period_end";
      await persistSessionState(ctx, state);
      return ok(accountFor(state));
    },
    async change(ctx, input) {
      const state = await sessionState(ctx);
      if (!validSubscriptionReview(ctx, state, "change", input)) return fail("REVIEW_CHANGED", "Subscription terms changed. Review again.", 409);
      const target = products().flatMap(productVariants).find((variant) => variant.priceId === input.priceId && variant.mode === "subscription");
      if (!target) return fail("PRICE_NOT_FOUND", "Subscription price unavailable.", 404);
      state.subscriptionPriceId = target.priceId;
      await persistSessionState(ctx, state);
      return ok(accountFor(state));
    },
    async renew(ctx, input) {
      const state = await sessionState(ctx);
      if (!validSubscriptionReview(ctx, state, "renew", input)) return fail("REVIEW_CHANGED", "Subscription terms changed. Review again.", 409);
      state.subscriptionStatus = "active";
      await persistSessionState(ctx, state);
      return ok(accountFor(state));
    },
  },
  download: {
    async resolve({ token }) {
      return resolveTemplateDownload(token);
    },
    async confirm({ token }) {
      return resolveTemplateDownload(token);
    },
  },
  order: {
    async invoice(ctxOrInput, input) {
      const orderId =
        typeof input === "string"
          ? createOrderId(input)
          : (input?.orderId ??
            (typeof ctxOrInput === "string"
              ? createOrderId(ctxOrInput)
              : (ctxOrInput as { readonly orderId?: OrderId }).orderId));
      if (!orderId) return fail("ORDER_NOT_FOUND", "Template order not found.", 404);
      const sessionOrders = isRequestContextInput(ctxOrInput)
        ? (await sessionState(ctxOrInput)).checkoutOrders
        : undefined;
      if (!seededOrderIds().has(String(orderId)) && !sessionOrders?.has(String(orderId))) {
        return fail("ORDER_NOT_FOUND", "Template order not found.", 404);
      }
      return ok({
        orderId,
        href: `/account/orders?invoice=${encodeURIComponent(orderId)}`,
        expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
      } satisfies OrderInvoiceDTO);
    },
  },
  webhook: {
    async receive(_ctx, input) {
      return ok({
        id: createMikaId(input.providerEventId ?? `webhook_${Date.now().toString(36)}`),
        status: "received",
        replayable: true,
        fixture: {
          provider: String(input.provider),
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          rawBodyHash: input.payloadHash,
          signedWebhookMockBoundary: true,
        },
      } satisfies TemplateWebhookReceiveDTO);
    },
  },
} satisfies MikaApiOverrides;

/** Product cards for the index page, optionally filtered by taxonomy slugs. */
export function templateProductSummaries(
  filters: TemplateProductFilterInput = {},
): readonly TemplateProductSummary[] {
  return products()
    .map(templateProductSummary)
    .filter((product) => productMatchesFilters(product, filters));
}

/** Filter sidebar state: term counts, active slugs, and filtered vs total product counts. */
export function templateProductFilters(
  filters: TemplateProductFilterInput = {},
): TemplateProductFilterState {
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

/** Product detail payload by slug or id, including variant sellables. */
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
  return seed().taxonomies?.find((taxonomy) => taxonomy.name === taxonomyName)?.terms ?? [];
}

function taxonomyHref(taxonomyName: string, slug: string): string {
  const param =
    taxonomyName === "category" ? "category" : taxonomyName === "tag" ? "tag" : taxonomyName;
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

function seedPath(): string {
  return (
    process.env["EMDASH_MIKA_TEMPLATE_SEED"] ?? join(process.cwd(), "seed/mika-actions.seed.json")
  );
}

function readSeed(): SeedFile {
  return JSON.parse(readFileSync(seedPath(), "utf8")) as SeedFile;
}

let seedCache: { path: string; mtimeMs: number; value: SeedFile } | undefined;

function seed(): SeedFile {
  const path = seedPath();
  let mtimeMs: number;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return seedCache?.value ?? readSeed();
  }
  if (!seedCache || seedCache.path !== path || seedCache.mtimeMs !== mtimeMs) {
    seedCache = { path, mtimeMs, value: readSeed() };
  }
  return seedCache.value;
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
  return seed().content?.["products"] ?? [];
}

function stockItems(): readonly SeedEntry[] {
  return seed().content?.["stock_items"] ?? [];
}

function customers(): readonly SeedEntry[] {
  return seed().content?.["customers"] ?? [];
}

function orders(): readonly SeedEntry[] {
  return seed().content?.["orders"] ?? [];
}

function entitlements(): readonly SeedEntry[] {
  return seed().content?.["entitlements"] ?? [];
}

function downloads(): readonly SeedEntry[] {
  return seed().content?.["downloads"] ?? [];
}

function licenses(): readonly SeedEntry[] {
  return seed().content?.["licenses"] ?? [];
}

function checkoutSessions(): readonly SeedEntry[] {
  return seed().content?.["checkout_sessions"] ?? [];
}

function findProduct(idOrSlug: string): SeedEntry | undefined {
  return products().find((entry) => entry.id === idOrSlug || entry.slug === idOrSlug);
}

function productVariants(product: SeedEntry): readonly ProductVariant[] {
  const value = product.data?.["variants"];
  if (!Array.isArray(value)) return [];

  return value.filter(isProductVariant).toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
    const sellableId = createSellableId(variant.sellableId);
    const interval = billingInterval(variant.interval);
    const price: PriceDTO = {
      id: createPriceId(variant.priceId),
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
  return variants.some((variant) => variant.mode || variant.fulfillmentKind)
    ? "fulfillment"
    : "size";
}

function variantOption(variant: ProductVariant, option = "size"): VariantOptionValueDTO {
  return {
    option,
    value: variant.variantKey,
    label: variant.label,
  };
}

function availabilityFor(sellableId: SellableId): AvailabilityDTO {
  const stock = stockItems().find((entry) => stockRef(entry)["sellableId"] === sellableId);
  if (!stock) {
    return { sellableId, status: "untracked" };
  }
  const quantities = isRecord(stock.data?.["quantities"]) ? stock.data["quantities"] : {};
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

export function templateCustomer() {
  return defaultCustomer();
}

export function templateLicenseDocuments(customerId: MikaId): LicenseDocument[] {
  if (customerId !== defaultCustomer().id) return [];
  return licenses().map((entry) => {
    const summary = licenseSummary(entry);
    const timestamp = createISODateTime("2026-01-01T00:00:00.000Z");
    return {
      id: summary.id,
      type: "license",
      schemaVersion: 1,
      customerId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: summary.status as "active" | "revoked",
      record: {
        id: summary.id,
        licenseKeyHash: "fixture-no-key",
        displayKeySuffix: summary.displayKeySuffix ?? "",
        status: summary.status as "active" | "revoked",
        createdAt: timestamp,
      },
    };
  });
}

/** Deliberate fixture-only human POST effect. A return URL or a status read never proves payment. */
export async function simulateTemplatePayment(ctx: MikaRequestContext, checkoutId: string) {
  const state = await sessionState(ctx);
  const checkout = state.checkouts.get(createCheckoutSessionId(checkoutId));
  if (!checkout) return fail("CHECKOUT_EXPIRED", "Checkout does not belong to this session.", 404);
  return ok(await completeCheckout(ctx, state, checkout));
}

type Review = NonNullable<MikaRequestContext["storefrontReview"]>;

/** Capture and enforce against the same fixture state; never replace the approved terms. */
export async function captureTemplateReview(
  ctx: MikaRequestContext,
  tool: string,
  input: Record<string, unknown>,
): Promise<Review> {
  const state = await sessionState(ctx);
  if (tool === "checkout.start") return checkoutReview(state, input);
  return subscriptionReview(state, tool.split(".")[1] as "cancel" | "change" | "renew", input);
}

function checkoutReview(state: TemplateSessionState, input: Record<string, unknown>): Review {
  const lines = checkoutLines(
    state,
    input.sellableId as SellableId | undefined,
    input.priceId as PriceId | undefined,
    input.quantity as number | undefined,
  );
  const cart = cartFromLines(lines, input.sellableId ? undefined : state.couponCode);
  return {
    kind: "checkout",
    provider: createProviderName(String(input.provider ?? templateProvider)),
    mode: checkoutMode(lines),
    lines: lines.map((line) => {
      const variant = findVariantBySellable(line.sellableId, line.priceId);
      const product = products().find((product) =>
        productVariants(product).some((item) => item.sellableId === line.sellableId),
      );
      if (!variant || !product) throw new Error("Unavailable checkout line");
      return {
        sellableId: line.sellableId,
        priceId: line.priceId,
        contentRef: { collection: "products", id: product.id },
        title: productVariantTitle(variant),
        quantity: line.quantity,
        unitAmount: variant.amount,
        currency: createCurrencyCode(variant.currency),
        mode: variant.mode ?? "payment",
        fulfillmentKind: fulfillmentKind(variant.fulfillmentKind),
        ...(variant.providerPriceId ? { providerPriceId: variant.providerPriceId } : {}),
        ...(variant.interval
          ? { interval: variant.interval, intervalCount: variant.intervalCount ?? 1 }
          : {}),
      };
    }),
    subtotal: cart.subtotal,
    total: cart.total,
    ...(cart.discount ? { discount: cart.discount } : {}),
    ...(state.couponCode && !input.sellableId
      ? { coupon: { label: state.couponCode, rate: 0.1 } }
      : {}),
  };
}

function subscriptionReview(
  state: TemplateSessionState,
  action: "cancel" | "change" | "renew",
  input: Record<string, unknown>,
): Review {
  const subscription = accountFor(state).subscriptions.find(
    (item) => item.id === input.subscriptionId,
  );
  const matchesCurrent = (variant: ProductVariant) =>
    variant.mode === "subscription" &&
    (!state.subscriptionPriceId || variant.priceId === state.subscriptionPriceId);
  const product = products().find((product) => productVariants(product).some(matchesCurrent));
  const variant = product && productVariants(product).find(matchesCurrent);
  if (!subscription || !product || !variant) throw new Error("Subscription unavailable");
  const snapshot = (variant: ProductVariant, product: SeedEntry) => ({
    content: { collection: "products", id: product.id },
    sellableId: createSellableId(variant.sellableId),
    priceId: createPriceId(variant.priceId),
    titleSnapshot: productVariantTitle(variant),
    variantOptions: [],
    unitAmount: variant.amount,
    currency: createCurrencyCode(variant.currency),
    mode: variant.mode ?? ("payment" as PurchaseMode),
    fulfillmentKind: fulfillmentKind(variant.fulfillmentKind),
    ...(variant.interval
      ? { interval: variant.interval, intervalCount: variant.intervalCount ?? 1 }
      : {}),
  });
  const targetProduct =
    action === "change"
      ? products().find((product) =>
          productVariants(product).some(
            (variant) => variant.priceId === input.priceId && variant.mode === "subscription",
          ),
        )
      : undefined;
  const target =
    targetProduct &&
    productVariants(targetProduct).find((variant) => variant.priceId === input.priceId);
  if (action === "change" && !target) throw new Error("Subscription price unavailable");
  return {
    kind: "subscription",
    action,
    subscription: {
      id: subscription.id,
      customerId: defaultCustomer().id,
      provider: templateProvider,
      providerSubscriptionId: undefined,
      providerPriceId: variant.providerPriceId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
      sellable: snapshot(variant, product),
    },
    ...(target && targetProduct
      ? { target: snapshot(target, targetProduct), providerPriceId: target.providerPriceId }
      : {}),
  };
}

function validSubscriptionReview(
  ctx: MikaRequestContext,
  state: TemplateSessionState,
  action: "cancel" | "change" | "renew",
  input: Record<string, unknown>,
): boolean {
  return (
    !ctx.storefrontReview ||
    sameReview(ctx.storefrontReview, subscriptionReview(state, action, input))
  );
}

function sameReview(approved: Review, current: Review): boolean {
  // Session serialization drops undefined optional fields; compare the persisted representation.
  return isDeepStrictEqual(
    JSON.parse(JSON.stringify(approved)),
    JSON.parse(JSON.stringify(current)),
  );
}

async function sessionState(ctx: MikaRequestContext): Promise<TemplateSessionState> {
  const key = templateSessionKey(ctx);
  const stored = await readStoredSessionState(ctx);
  if (stored) {
    const state = stateFromSnapshot(stored);
    sessionStates.set(key, state);
    return state;
  }

  let state = sessionStates.get(String(key));
  if (!state) {
    state = emptySessionState();
    sessionStates.set(String(key), state);
  }
  return state;
}

async function persistSessionState(
  ctx: MikaRequestContext,
  state: TemplateSessionState,
): Promise<void> {
  sessionStates.set(templateSessionKey(ctx), state);

  try {
    await ctx.session?.set(templateSessionStorageKey, snapshotFromState(state));
  } catch {
    // Astro session storage may be unavailable in direct unit tests.
  }
}

async function readStoredSessionState(
  ctx: MikaRequestContext,
): Promise<TemplateSessionStateSnapshot | undefined> {
  try {
    const stored = await ctx.session?.get<TemplateSessionStateSnapshot>(templateSessionStorageKey);
    return isRecord(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function emptySessionState(): TemplateSessionState {
  return {
    cartItems: new Map(),
    wishlistItems: new Map(),
    checkouts: new Map(),
    checkoutOrders: new Map(),
    pendingCartCheckouts: new Set(),
    accountEmail: defaultCustomer().email,
  };
}

function stateFromSnapshot(snapshot: TemplateSessionStateSnapshot): TemplateSessionState {
  return {
    cartItems: new Map(
      (snapshot.cartItems ?? []).map((item) => [
        String(item.lineId),
        {
          lineId: createMikaId(String(item.lineId)),
          sellableId: createSellableId(String(item.sellableId)),
          priceId: item.priceId ? createPriceId(String(item.priceId)) : undefined,
          quantity: Math.max(1, numberValue(item.quantity, 1)),
        },
      ]),
    ),
    wishlistItems: new Map(
      (snapshot.wishlistItems ?? []).map((item) => [
        String(item.itemId),
        {
          itemId: createMikaId(String(item.itemId)),
          sellableId: createSellableId(String(item.sellableId)),
          priceId: item.priceId ? createPriceId(String(item.priceId)) : undefined,
          addedAt: createISODateTime(stringValue(item.addedAt, nowIso())),
          quantity:
            item.quantity === undefined ? undefined : Math.max(1, numberValue(item.quantity, 1)),
        },
      ]),
    ),
    checkouts: new Map(
      (snapshot.checkouts ?? []).map((checkout) => [String(checkout.id), checkout]),
    ),
    checkoutOrders: new Map(
      (snapshot.checkoutOrders ?? []).map((order) => [String(order.id), order]),
    ),
    pendingCartCheckouts: new Set(snapshot.pendingCartCheckouts ?? []),
    couponCode: snapshot.couponCode,
    accountEmail: snapshot.accountEmail ?? defaultCustomer().email,
    pendingEmail: snapshot.pendingEmail,
    subscriptionStatus: snapshot.subscriptionStatus,
    subscriptionPriceId: snapshot.subscriptionPriceId,
  };
}

function snapshotFromState(state: TemplateSessionState): TemplateSessionStateSnapshot {
  return {
    cartItems: [...state.cartItems.values()],
    wishlistItems: [...state.wishlistItems.values()],
    checkouts: [...state.checkouts.values()],
    checkoutOrders: [...state.checkoutOrders.values()],
    pendingCartCheckouts: [...state.pendingCartCheckouts],
    couponCode: state.couponCode,
    accountEmail: state.accountEmail,
    pendingEmail: state.pendingEmail,
    subscriptionStatus: state.subscriptionStatus,
    subscriptionPriceId: state.subscriptionPriceId,
  };
}

function findSourceSessionState(sourceSessionId: string): TemplateSessionState | undefined {
  return (
    sessionStates.get(sourceSessionId) ??
    sessionStates.get(`session:${sourceSessionId}`) ??
    sessionStates.get(`customer:${sourceSessionId}`) ??
    sessionStates.get(`user:${sourceSessionId}`)
  );
}

function templateSessionKey(ctx: MikaRequestContext): string {
  if (ctx.customerId) return `customer:${ctx.customerId}`;
  if (ctx.userId) return `user:${ctx.userId}`;
  if (ctx.sessionId?.startsWith("template-test-")) return ctx.sessionId;
  if (ctx.sessionId) return `session:${ctx.sessionId}`;
  const cookie = templateSessionCookie(ctx);
  if (cookie) return cookie;

  return "template-browser-session";
}

function templateSessionCookie(ctx: MikaRequestContext): string | undefined {
  const cookie = ctx.request?.headers.get("cookie");
  if (!cookie) return undefined;

  const match = cookie.match(/(?:^|;\s*)mika_template_session=([^;]+)/);
  if (!match?.[1]) return undefined;

  try {
    return `cookie:${decodeURIComponent(match[1])}`;
  } catch {
    return undefined;
  }
}

function isRequestContextInput(value: unknown): value is MikaRequestContext {
  return (
    isRecord(value) &&
    !("checkoutId" in value) &&
    ("request" in value ||
      "url" in value ||
      "session" in value ||
      "sessionId" in value ||
      "now" in value ||
      "customerId" in value ||
      "userId" in value)
  );
}

function cartFor(state: TemplateSessionState): CartDTO {
  return cartFromLines([...state.cartItems.values()], state.couponCode);
}

function cartFromLines(lines: readonly SessionCartItem[], couponCode?: string): CartDTO {
  const items = lines.map(cartLine).filter((line): line is CartLineDTO => Boolean(line));
  const subtotalAmount = items.reduce((sum, item) => sum + item.total.amount, 0);
  const discountAmount = couponCode ? Math.round(subtotalAmount * 0.1) : 0;
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);

  return {
    id: createCartId("cart_template"),
    status: "open",
    currency: defaultCurrency,
    items,
    coupon: couponCode
      ? {
          code: couponCode,
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
  const discountAmount =
    couponCode && !cart.discount
      ? Math.round(cart.subtotal.amount * 0.1)
      : (cart.discount?.amount ?? 0);
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
    items: [...state.wishlistItems.values()]
      .map(wishlistItem)
      .filter((item): item is WishlistItemDTO => Boolean(item)),
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
  sellableId?: SellableId,
  priceId?: PriceId,
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

function maxPerOrderFor(sellableId: SellableId): number | undefined {
  const max = availabilityFor(sellableId).maxPerOrder;
  return typeof max === "number" && max > 0 ? max : undefined;
}

function isCheckoutLineBlocked(line: SessionCartItem): boolean {
  const availability = availabilityFor(line.sellableId);
  if (availability.status === "out_of_stock") return true;
  const maxPerOrder = availability.maxPerOrder;
  return typeof maxPerOrder === "number" && maxPerOrder > 0 && line.quantity > maxPerOrder;
}

function checkoutMode(lines: readonly SessionCartItem[]): PurchaseMode {
  return lines.some(
    (line) => findVariantBySellable(line.sellableId, line.priceId)?.mode === "subscription",
  )
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
        title: state.subscriptionPriceId
          ? products().flatMap(productVariants).find((variant) => variant.priceId === state.subscriptionPriceId)?.label ?? "Buttonwood Sunday Strip Club"
          : "Buttonwood Sunday Strip Club",
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
        status: entitlementStatus(entry),
        source: "manual",
        expiresAt: maybeIso(ref["expiresAt"]),
      };
    }),
    downloads: downloads().map(downloadSummary),
    licenses: licenses().map(licenseSummary),
  };
}

function entitlementStatus(entry: SeedEntry): EntitlementDTO["status"] {
  const fixtureStatus = entry.data?.["fixture_status"];
  if (fixtureStatus === "revoked") return "revoked";
  if (fixtureStatus === "expired") return "expired";
  return "active";
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
    orderId: orderId ? createOrderId(orderId) : undefined,
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

function seededOrderIds(): Set<string> {
  return new Set(
    orders().map((entry) => {
      const ref = isRecord(entry.data?.["order_ref"]) ? entry.data["order_ref"] : {};
      return stringValue(ref["orderId"], entry.id);
    }),
  );
}

function orderSummary(entry: SeedEntry): OrderSummaryDTO {
  const ref = isRecord(entry.data?.["order_ref"]) ? entry.data["order_ref"] : {};
  const fixtureStatus = stringValue(entry.data?.["fixture_status"], "");
  const paymentStatus = stringValue(entry.data?.["payment_status"], "");
  return {
    id: createOrderId(stringValue(ref["orderId"], entry.id)),
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
  };
}

function checkoutOrderSummary(
  orderId: OrderId,
  lines: readonly SessionCartItem[],
  couponCode?: string,
): OrderSummaryDTO {
  const subtotalAmount = lines.reduce((sum, line) => {
    const variant = findVariantBySellable(line.sellableId, line.priceId);
    return sum + (variant?.amount ?? 0) * line.quantity;
  }, 0);
  const discountAmount = couponCode ? Math.round(subtotalAmount * 0.1) : 0;
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);

  return {
    id: orderId,
    orderNumber: orderId.replace(/^order_checkout_template_/, "TEMPLATE-").toUpperCase(),
    status: "pending",
    paymentStatus: "unpaid",
    total: money(totalAmount),
    createdAt: nowIso(),
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
  const orderId = stringValue(ref["orderId"], "");
  return {
    id: createCheckoutSessionId(stringValue(ref["checkoutId"], checkoutId)),
    status: paid ? "completed" : "pending",
    mode: "payment",
    provider: createProviderName(stringValue(ref["provider"], "template")),
    redirectUrl: stringValue(entry.data?.["redirect_url"], ""),
    ...(orderId ? { orderId: createOrderId(orderId) } : {}),
  };
}

function checkoutRedirectUrl(path: string, checkoutId: CheckoutSessionId, token: string): string {
  const separator = path.includes("?") ? "&" : "?";
  const search = new URLSearchParams({ checkoutId, token });

  return `${path}${separator}${search.toString()}`;
}

function checkoutLookupInput(
  ctxOrInput: unknown,
  input: unknown,
): { readonly checkoutId?: string; readonly token?: string } {
  if (typeof input === "string") return { checkoutId: input };
  if (isRecord(input)) {
    return {
      checkoutId: stringValue(input["checkoutId"], ""),
      token: stringValue(input["token"], ""),
    };
  }
  if (typeof ctxOrInput === "string") return { checkoutId: ctxOrInput };
  if (isRecord(ctxOrInput)) {
    return {
      checkoutId: stringValue(ctxOrInput["checkoutId"], ""),
      token: stringValue(ctxOrInput["token"], ""),
    };
  }

  return {};
}

async function completeCheckout(
  ctx: MikaRequestContext | undefined,
  state: TemplateSessionState,
  checkout: CheckoutSessionDTO,
): Promise<CheckoutSessionDTO> {
  if (
    checkout.status !== "redirected" &&
    checkout.status !== "pending" &&
    checkout.status !== "created"
  ) {
    return checkout;
  }

  const completed: CheckoutSessionDTO = { ...checkout, status: "completed" };
  state.checkouts.set(completed.id, completed);
  const order = completed.orderId ? state.checkoutOrders.get(completed.orderId) : undefined;
  if (order) state.checkoutOrders.set(order.id, { ...order, status: "paid", paymentStatus: "paid" });
  if (state.pendingCartCheckouts.delete(completed.id)) {
    state.cartItems.clear();
    state.couponCode = undefined;
  }
  if (ctx) await persistSessionState(ctx, state);

  return completed;
}

function cancelCheckout(
  state: TemplateSessionState,
  checkout: CheckoutSessionDTO,
): CheckoutSessionDTO {
  if (
    checkout.status === "completed" ||
    checkout.status === "cancelled" ||
    checkout.status === "expired" ||
    checkout.status === "failed"
  ) {
    return checkout;
  }

  if (checkout.orderId) state.checkoutOrders.delete(checkout.orderId);
  state.pendingCartCheckouts.delete(checkout.id);

  const cancelled: CheckoutSessionDTO = {
    id: checkout.id,
    status: "cancelled",
    mode: checkout.mode,
    provider: checkout.provider,
    redirectUrl: checkout.redirectUrl,
    statusToken: checkout.statusToken,
    expiresAt: checkout.expiresAt,
    paymentPending: checkout.paymentPending,
    errors: checkout.errors,
  };
  state.checkouts.set(cancelled.id, cancelled);

  return cancelled;
}

function findCheckoutState(
  checkoutId: string,
  token: string,
): { readonly state: TemplateSessionState; readonly checkout: CheckoutSessionDTO } | undefined {
  for (const state of sessionStates.values()) {
    const checkout = state.checkouts.get(checkoutId);
    if (checkout?.statusToken === token) return { state, checkout };
  }

  return undefined;
}

function resolveTemplateDownload(token: string): MikaApiResult<DownloadResolutionDTO> {
  const download = downloads().find((entry) => downloadRef(entry)["downloadRef"] === token);
  if (!download) return fail("TOKEN_INVALID", "Template download token not found.", 404);

  if (download.data?.["fixture_status"] === "expired") {
    return fail("TOKEN_EXPIRED", "Template download token has expired.", 410);
  }

  return ok({
    title: stringValue(download.data?.["title"], download.slug),
    redirectUrl: `/template-downloads/${encodeURIComponent(token)}.txt`,
    expiresAt: createISODateTime("2026-07-20T12:00:00.000Z"),
  } satisfies DownloadResolutionDTO);
}

function findVariantBySellable(
  sellableId: SellableId,
  priceId?: PriceId,
): ProductVariant | undefined {
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
  return min === max
    ? formatMoney(min, currency)
    : `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
}

function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
}

function money(amount: number, currency: CurrencyCode = defaultCurrency): MoneyDTO {
  return { amount, currency };
}

function cartLineId(sellableId: SellableId, priceId?: PriceId): string {
  return `line_${sellableId}_${priceId ?? "default"}`;
}

function wishlistItemId(sellableId: SellableId, priceId?: PriceId): string {
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

/** Exposes mutable session map and seed rows for unit tests. */
export function templateSeedForTests() {
  return {
    sessionStates,
    products: products(),
    stockItems: stockItems(),
  };
}
