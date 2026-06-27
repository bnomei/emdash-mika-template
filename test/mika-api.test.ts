import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let api;
let templateProductFilters;
let templateProductSummaries;
let mikaTemplateCartCheckoutIssues;
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
  ({ api, templateProductFilters, templateProductSummaries } = await import("../src/lib/mika-api.ts"));
  ({ mikaTemplateCartCheckoutIssues } = await import("../src/lib/display.ts"));
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
      "buttonwood_panel_club",
    );
  });

  it("syncs product fixture state for entry-scoped provider sync", async () => {
    const result = await api.admin.providerSync({
      contentRef: {
        collection: "products",
        id: idBySlug("ec_products", "mira-field-clipboard"),
        locale: "en",
      },
      scope: "entry",
    });

    assertCompleted(result);
    assert.equal(result.data.affected.syncedEntries, 1);
    assert.equal(
      jsonBySlug("ec_products", "mira-field-clipboard", "commerce_ref").providerStatus,
      "synced",
    );
    assert.equal(
      jsonBySlug("ec_products", "mira-field-clipboard", "mika_catalog_sync").syncCount,
      1,
    );
  });

  it("adjusts stock and rejects negative stock mutations", async () => {
    const result = await api.admin.stockAdjust({
      quantityDelta: 5,
      reason: "fixture_adjustment",
      stockItemId: "stock_bw_clip_mini",
    });

    assertCompleted(result);
    assert.equal(
      jsonBySlug("ec_stock_items", "mira-clipboard-stock", "quantities").quantityOnHand,
      47,
    );

    const before = jsonBySlug("ec_stock_items", "junie-workshop-zine-stock", "quantities");
    const failed = await api.admin.stockAdjust({
      quantityDelta: -999,
      reason: "fixture_adjustment",
      stockItemId: "stock_bw_zine_workshop",
    });

    assert.equal(failed.ok, true);
    assert.equal(failed.data.status, "failed");
    assert.equal(
      jsonBySlug("ec_stock_items", "junie-workshop-zine-stock", "quantities").quantityOnHand,
      before.quantityOnHand,
    );
  });

  it("releases stock reservations across fixture rows", async () => {
    const result = await api.admin.releaseExpiredReservations();

    assertCompleted(result);
    assert.equal(result.data.affected.releasedReservations, 11);
    const clipboardQuantities = jsonBySlug(
      "ec_stock_items",
      "mira-clipboard-stock",
      "quantities",
    );
    assert.equal(clipboardQuantities.quantityReserved, 0);
    assert.equal(clipboardQuantities.availableQuantity, 47);
    assert.equal(
      jsonBySlug("ec_stock_items", "thirdbase-rain-pennant-stock", "quantities").quantityReserved,
      0,
    );
  });

  it("mutates webhook and order fixture statuses", async () => {
    assertCompleted(
      await api.admin.webhookReplay({ webhookId: "webhook_buttonwood_refund_failed_1002" }),
    );
    assert.equal(rowBySlug("ec_webhooks", "refund-failed-1002").fixture_status, "replayed");

    const overRefund = await api.admin.orderRefund({
      amount: 100000,
      orderId: "order_buttonwood_1001",
      reason: "fixture_refund",
    });
    assert.equal(overRefund.ok, true);
    assert.equal(overRefund.data.status, "failed");
    assert.notEqual(rowBySlug("ec_orders", "order-buttonwood-1001").payment_status, "refunded");

    const refund = await api.admin.orderRefund({
      amount: 499,
      orderId: "order_buttonwood_1001",
      reason: "fixture_refund",
    });
    assertCompleted(refund);
    assert.equal(rowBySlug("ec_orders", "order-buttonwood-1001").payment_status, "partially_refunded");

    assertCompleted(
      await api.admin.orderCancel({
        orderId: "order_buttonwood_1002",
        reason: "fixture_cancel",
      }),
    );
    assert.equal(rowBySlug("ec_orders", "order-buttonwood-1002").fixture_status, "cancelled");
  });

  it("mutates customer, entitlement, email, license, and download fixtures", async () => {
    const grant = await api.admin.entitlementGrant({
      customerId: "customer_mira_monday",
      entitlementKey: "buttonwood_panel_club",
    });
    assertCompleted(grant);
    assert.equal(grant.data.affected.entitlements, 1);
    assert.deepEqual(
      jsonBySlug("ec_customers", "mira-monday", "customer_ref").entitlementKeys,
      ["buttonwood_panel_club"],
    );
    assert.equal(jsonBySlug("ec_entitlements", "mira-panel-club", "entitlement_ref").grantCount, 1);

    assertCompleted(
      await api.admin.entitlementRevoke({
        entitlementId: "ent_buttonwood_dugout_theo",
        reason: "fixture_revoke",
      }),
    );
    assert.equal(
      rowBySlug("ec_entitlements", "theo-dugout-archive").fixture_status,
      "revoked",
    );

    assertCompleted(await api.admin.emailResend({ emailId: "email_buttonwood_download_1002" }));
    assert.equal(rowBySlug("ec_emails", "zine-download-email-1002").fixture_status, "queued");

    assertCompleted(
      await api.admin.licenseRevoke({
        licenseId: "license_buttonwood_dugout_theo",
        reason: "fixture_revoke",
      }),
    );
    assert.equal(rowBySlug("ec_licenses", "theo-dugout-license").fixture_status, "revoked");

    assertCompleted(
      await api.admin.downloadIssue({
        entitlementId: "ent_buttonwood_archive_nell",
        orderId: "order_buttonwood_1003",
        orderLineId: "line_bw_zine_workshop",
      }),
    );
    assert.equal(rowBySlug("ec_downloads", "nell-archive-download").fixture_status, "issued");
  });
});


describe("Mika template storefront overrides", { concurrency: false }, () => {
  it("returns sellables and stock availability from the seed", async () => {
    const result = await api.catalog.sellables({
      contentRef: {
        collection: "products",
        id: "products:mira-field-clipboard:en",
        locale: "en",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.length, 3);
    assert.equal(result.data[0].prices[0].amount, 499);

    const availability = await api.stock.availability({ sellableId: "sellable_bw_clip_mini" });
    assert.equal(availability.ok, true);
    assert.equal(availability.data.availableQuantity, 39);
    assert.equal(availability.data.status, "available");
  });

  it("returns showcase price modes, fulfillment kinds, and stock states", async () => {
    const result = await api.catalog.sellables({
      contentRef: {
        collection: "products",
        id: "products:buttonwood-creator-bundle:en",
        locale: "en",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.length, 3);
    assert.equal(result.data[0].variantGroups?.[0]?.label, "Format");
    assert.equal(result.data[0].variantOptions[0]?.option, "fulfillment");

    const prices = new Map(result.data.flatMap((sellable) => sellable.prices.map((price) => [price.id, price])));
    assert.equal(prices.get("price_bw_panel_pack")?.mode, "payment");
    assert.equal(prices.get("price_bw_panel_pack")?.fulfillmentKind, "download");
    assert.equal(prices.get("price_bw_sunday_club")?.mode, "subscription");
    assert.equal(prices.get("price_bw_sunday_club")?.fulfillmentKind, "entitlement");
    assert.equal(prices.get("price_bw_sunday_club")?.interval, "month");
    assert.equal(prices.get("price_bw_sunday_club")?.intervalCount, 1);
    assert.equal(prices.get("price_bw_lettering_license")?.mode, "payment");
    assert.equal(prices.get("price_bw_lettering_license")?.fulfillmentKind, "license");

    const availability = new Map(result.data.map((sellable) => [sellable.id, sellable.availability]));
    assert.equal(availability.get("sellable_bw_panel_pack")?.status, "available");
    assert.equal(availability.get("sellable_bw_panel_pack")?.availableQuantity, 12);
    assert.equal(availability.get("sellable_bw_sunday_club")?.status, "low_stock");
    assert.equal(availability.get("sellable_bw_sunday_club")?.availableQuantity, 1);
    assert.equal(availability.get("sellable_bw_lettering_license")?.status, "out_of_stock");
    assert.equal(availability.get("sellable_bw_lettering_license")?.availableQuantity, 0);
  });

  it("projects product categories and tags for storefront filters", () => {
    const filters = templateProductFilters();

    assert.equal(filters.totalCount, 4);
    assert.deepEqual(
      filters.categories.map((category) => [category.slug, category.label, category.count]),
      [
        ["paper-goods", "Paper Goods", 2],
        ["maker-kits", "Maker Kits", 1],
        ["creator-tools", "Creator Tools", 1],
      ],
    );
    assert.equal(filters.tags.find((tag) => tag.slug === "downloads")?.label, "Downloads");

    const creatorTools = templateProductSummaries({ category: "creator-tools" });
    assert.deepEqual(creatorTools.map((product) => product.slug), ["buttonwood-creator-bundle"]);
    assert.deepEqual(creatorTools[0].tags.map((tag) => tag.slug), ["downloads", "membership", "licenses"]);

    const paperPrintables = templateProductSummaries({ category: "paper-goods", tag: "printables" });
    assert.deepEqual(paperPrintables, []);
  });

  it("runs cart and coupon flows with session-scoped fixture state", async () => {
    const ctx = storefrontCtx("cart-flow");
    const add = await api.cart.add(ctx, {
      sellableId: "sellable_bw_clip_mini",
      priceId: "price_bw_clip_mini",
      quantity: 2,
    });

    assert.equal(add.ok, true);
    assert.equal(add.data.items.length, 1);
    assert.equal(add.data.items[0].title, "Mira Field Clipboard - Pocket checklist");
    assert.equal(add.data.total.amount, 998);

    const lineId = add.data.items[0].id;
    const update = await api.cart.update(ctx, { lineId, quantity: 3 });
    assert.equal(update.ok, true);
    assert.equal(update.data.items[0].quantity, 3);

    const coupon = await api.cart.applyCoupon(ctx, { code: "BUTTONWOOD10" });
    assert.equal(coupon.ok, true);
    assert.equal(coupon.data.coupon.code, "BUTTONWOOD10");
    assert.equal(coupon.data.total.amount, 1347);

    const remove = await api.cart.remove(ctx, { lineId });
    assert.equal(remove.ok, true);
    assert.equal(remove.data.items.length, 0);
  });

  it("keeps anonymous cart state across Astro action and page contexts", async () => {
    // A single browser carries the same Astro session id across action and page requests.
    const actionCtx = astroCtx("astro-shared-session");
    const pageCtx = astroCtx("astro-shared-session");
    const add = await api.cart.add(actionCtx, {
      sellableId: "sellable_bw_panel_pack",
      priceId: "price_bw_panel_pack",
      quantity: 1,
    });

    assert.equal(add.ok, true);
    assert.equal(add.data.items.length, 1);

    const pageCart = await api.cart.get(pageCtx);
    assert.equal(pageCart.ok, true);
    assert.equal(pageCart.data.items.length, 1);
    assert.equal(pageCart.data.items[0].title, "Buttonwood Creator Bundle - Panel Pack Download");

    await api.cart.remove(pageCtx, { lineId: pageCart.data.items[0].id });
  });

  it("isolates anonymous cart state between distinct browser sessions", async () => {
    const visitorA = astroCtx("astro-visitor-a");
    const visitorB = astroCtx("astro-visitor-b");
    const add = await api.cart.add(visitorA, {
      sellableId: "sellable_bw_panel_pack",
      priceId: "price_bw_panel_pack",
      quantity: 1,
    });

    assert.equal(add.ok, true);
    assert.equal(add.data.items.length, 1);

    const visitorBCart = await api.cart.get(visitorB);
    assert.equal(visitorBCart.ok, true);
    assert.equal(visitorBCart.data.items.length, 0);

    await api.cart.remove(visitorA, { lineId: add.data.items[0].id });
  });

  it("reports cart checkout blockers for unavailable lines", async () => {
    const ctx = storefrontCtx("checkout-blockers");
    const add = await api.cart.add(ctx, {
      sellableId: "sellable_bw_lettering_license",
      priceId: "price_bw_lettering_license",
      quantity: 1,
    });

    assert.equal(add.ok, true);
    assert.deepEqual(mikaTemplateCartCheckoutIssues(add.data), [
      "Buttonwood Creator Bundle - Lettering Brush Pro License is no longer available.",
    ]);
  });

  it("runs wishlist, save-for-later, and move-to-cart flows", async () => {
    const ctx = storefrontCtx("wishlist-flow");
    const wishlist = await api.wishlist.add(ctx, {
      sellableId: "sellable_bw_pennant_rain",
      priceId: "price_bw_pennant_rain",
    });

    assert.equal(wishlist.ok, true);
    assert.equal(wishlist.data.items.length, 1);
    assert.equal(wishlist.data.items[0].title, "Thirdbase Team Pennants - Rain-delay");

    const moved = await api.wishlist.moveToCart(ctx, {
      itemId: wishlist.data.items[0].id,
      quantity: 2,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.data.items.length, 1);
    assert.equal(moved.data.items[0].quantity, 2);

    const saved = await api.wishlist.saveForLater(ctx, { lineId: moved.data.items[0].id });
    assert.equal(saved.ok, true);
    assert.equal(saved.data.items.length, 1);
  });

  it("merges moveToCart quantity into an existing cart line", async () => {
    const ctx = storefrontCtx("movetocart-merge");
    const added = await api.cart.add(ctx, {
      sellableId: "sellable_bw_pennant_rain",
      priceId: "price_bw_pennant_rain",
      quantity: 5,
    });
    assert.equal(added.ok, true);
    assert.equal(added.data.items[0].quantity, 5);

    const wishlist = await api.wishlist.add(ctx, {
      sellableId: "sellable_bw_pennant_rain",
      priceId: "price_bw_pennant_rain",
    });
    assert.equal(wishlist.ok, true);

    const moved = await api.wishlist.moveToCart(ctx, {
      itemId: wishlist.data.items[0].id,
      quantity: 2,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.data.items.length, 1);
    assert.equal(moved.data.items[0].quantity, 7);
  });

  it("starts and resolves fixture checkout sessions", async () => {
    const ctx = storefrontCtx("checkout-flow");
    await api.cart.add(ctx, {
      sellableId: "sellable_bw_zine_workshop",
      priceId: "price_bw_zine_workshop",
      quantity: 1,
    });

    const checkout = await api.checkout.start(ctx, {
      successPath: "/checkout/success",
      cancelPath: "/checkout/cancel",
    });

    assert.equal(checkout.ok, true);
    assert.equal(checkout.data.status, "redirected");
    assert.equal(checkout.data.mode, "payment");
    assert.match(checkout.data.redirectUrl, /^\/checkout\/success\?checkoutId=/);

    const checkoutId = new URL("http://template.test" + checkout.data.redirectUrl).searchParams.get("checkoutId");

    // A dynamic checkout id is session-scoped: a bare lookup without the creating session's context
    // must not resolve it (no process-global fallback).
    const unscoped = await api.checkout.status({ checkoutId });
    assert.equal(unscoped.ok, false);
    assert.equal(unscoped.status, 404);

    // Starting a full-cart checkout must not empty the cart: a buyer who abandons before payment
    // keeps their lines, matching the /checkout/cancel page promise.
    const cartAfterStart = await api.cart.get(ctx);
    assert.equal(cartAfterStart.ok, true);
    assert.equal(cartAfterStart.data.items.length, 1);

    // The success page confirms completion with the request context, which clears the cart.
    const confirmed = await api.checkout.status(ctx, { checkoutId });
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.data.status, "completed");
    assert.ok(confirmed.data.orderId);

    const cartAfterCheckout = await api.cart.get(ctx);
    assert.equal(cartAfterCheckout.ok, true);
    assert.equal(cartAfterCheckout.data.items.length, 0);

    const accountAfterCheckout = await api.account.get(ctx);
    assert.equal(accountAfterCheckout.ok, true);
    assert.equal(accountAfterCheckout.data.orders[0].id, confirmed.data.orderId);

    const seeded = await api.checkout.status({ checkoutId: "checkout_buttonwood_1001" });
    assert.equal(seeded.ok, true);
    assert.equal(seeded.data.status, "completed");
    assert.equal(seeded.data.orderId, "order_buttonwood_1001");

    const seededSecondOrder = await api.checkout.status({ checkoutId: "checkout_buttonwood_1002" });
    assert.equal(seededSecondOrder.ok, true);
    assert.equal(seededSecondOrder.data.orderId, "order_buttonwood_1002");

    const seededSecondOrderByString = await api.checkout.status("checkout_buttonwood_1002");
    assert.equal(seededSecondOrderByString.ok, true);
    assert.equal(seededSecondOrderByString.data.orderId, "order_buttonwood_1002");

    const subscriptionCheckout = await api.checkout.start(storefrontCtx("subscription-checkout"), {
      sellableId: "sellable_bw_sunday_club",
      priceId: "price_bw_sunday_club",
      quantity: 1,
      successPath: "/checkout/success",
    });
    assert.equal(subscriptionCheckout.ok, true);
    assert.equal(subscriptionCheckout.data.mode, "subscription");
  });

  it("does not resolve a dynamic checkout id across unrelated sessions", async () => {
    const sessionA = storefrontCtx("checkout-owner");
    await api.cart.add(sessionA, {
      sellableId: "sellable_bw_panel_pack",
      priceId: "price_bw_panel_pack",
      quantity: 1,
    });
    const checkout = await api.checkout.start(sessionA, { successPath: "/checkout/success" });
    assert.equal(checkout.ok, true);
    const checkoutId = new URL("http://template.test" + checkout.data.redirectUrl).searchParams.get(
      "checkoutId",
    );

    // Session B holds the leaked checkoutId but lacks session A's context.
    const sessionB = storefrontCtx("checkout-stranger");
    const leaked = await api.checkout.status(sessionB, { checkoutId });
    assert.equal(leaked.ok, false);
    assert.equal(leaked.status, 404);

    // The owning session still resolves it.
    const owner = await api.checkout.status(sessionA, { checkoutId });
    assert.equal(owner.ok, true);
    assert.equal(owner.data.status, "completed");
  });

  it("rejects checkout when a cart line is out of stock", async () => {
    const ctx = storefrontCtx("checkout-oos");
    const add = await api.cart.add(ctx, {
      sellableId: "sellable_bw_lettering_license",
      priceId: "price_bw_lettering_license",
      quantity: 1,
    });
    assert.equal(add.ok, true);
    assert.ok(mikaTemplateCartCheckoutIssues(add.data).length > 0);

    const checkout = await api.checkout.start(ctx, { successPath: "/checkout/success" });
    assert.equal(checkout.ok, false);
    assert.equal(checkout.status, 409);

    const account = await api.account.get(ctx);
    assert.equal(account.ok, true);
    assert.equal(account.data.orders.some((order) => order.total.amount === 0), false);
  });

  it("rejects buy-now checkout for mismatched sellable/price pairs", async () => {
    const ctx = storefrontCtx("checkout-invalid-pair");
    const checkout = await api.checkout.start(ctx, {
      sellableId: "sellable_bw_clip_mini",
      priceId: "price_bw_clip_standard",
      successPath: "/checkout/success",
    });
    assert.equal(checkout.ok, false);
    assert.equal(checkout.status, 404);

    const account = await api.account.get(ctx);
    assert.equal(account.ok, true);
    assert.equal(
      account.data.orders.some((order) => order.total.amount === 0),
      false,
    );
  });

  it("persists checkout order total including the applied coupon discount", async () => {
    const ctx = storefrontCtx("coupon-order-total");
    await api.cart.add(ctx, {
      sellableId: "sellable_bw_clip_mini",
      priceId: "price_bw_clip_mini",
      quantity: 3,
    });
    const coupon = await api.cart.applyCoupon(ctx, { code: "BUTTONWOOD10" });
    assert.equal(coupon.ok, true);
    const discountedCartTotal = coupon.data.total.amount;
    assert.ok(coupon.data.coupon, "coupon should be applied");
    assert.ok(discountedCartTotal < coupon.data.subtotal.amount, "coupon should reduce total");

    const checkout = await api.checkout.start(ctx, { successPath: "/checkout/success" });
    assert.equal(checkout.ok, true);

    const account = await api.account.get(ctx);
    assert.equal(account.ok, true);
    const order = account.data.orders.find((item) => item.id === checkout.data.orderId);
    assert.ok(order, "checkout order should be in account");
    assert.equal(order.total.amount, discountedCartTotal);
  });

  it("serves account, download, order, and webhook fixture surfaces", async () => {
    const ctx = storefrontCtx("account-flow");
    assert.equal((await api.magicLink.request(ctx, { email: "mira.monday@example.test" })).ok, true);
    assert.equal((await api.magicLink.verify(ctx, { token: "template-login" })).ok, true);

    const account = await api.account.get(ctx);
    assert.equal(account.ok, true);
    assert.equal(account.data.customer.email, "mira.monday@example.test");
    assert.ok(account.data.orders.length >= 3);
    assert.ok(account.data.downloads.length >= 3);
    assert.ok(account.data.licenses.length >= 3);
    const pendingOrder = account.data.orders.find((item) => item.id === "order_buttonwood_1003");
    assert.equal(pendingOrder.status, "pending");
    assert.equal(pendingOrder.paymentStatus, "unpaid");
    const expiredDownload = account.data.downloads.find((item) => item.id === "download_archive_nell");
    assert.equal(expiredDownload.status, "expired");
    assert.equal(expiredDownload.expiresAt, "2026-06-01T12:00:00.000Z");
    const expiredEntitlement = account.data.entitlements.find(
      (item) => item.key === "buttonwood_notebook_archive",
    );
    assert.equal(expiredEntitlement.status, "expired");
    const license = account.data.licenses.find((item) => item.id === "license_buttonwood_panel_mira");
    assert.equal(license.status, "active");
    assert.equal(license.displayKeySuffix, "MIRA");
    assert.equal(license.orderId, "order_buttonwood_1001");
    assert.equal(license.downloadHref, "/download/download_panel_pack_mira");
    assert.equal("key" in license, false);

    const cancelSubscription = await api.subscription.cancel(ctx, {
      subscriptionId: "sub_template_buttonwood_club",
    });
    assert.equal(cancelSubscription.ok, true);
    assert.equal(cancelSubscription.data.subscriptions[0].status, "cancel_at_period_end");

    const accountAfterCancel = await api.account.get(ctx);
    assert.equal(accountAfterCancel.ok, true);
    assert.equal(accountAfterCancel.data.subscriptions[0].status, "cancel_at_period_end");

    const renewSubscription = await api.subscription.renew(ctx, {
      subscriptionId: "sub_template_buttonwood_club",
    });
    assert.equal(renewSubscription.ok, true);
    assert.equal(renewSubscription.data.subscriptions[0].status, "active");

    for (const { token, expired } of seededDownloadTokens()) {
      const download = await api.download.resolve({ token });
      if (expired) {
        assert.equal(download.ok, false);
        assert.equal(download.status, 410);
        continue;
      }
      assert.equal(download.ok, true);
      assert.equal(download.data.redirectUrl, `/template-downloads/${token}.txt`);
      assert.equal(existsSync(join(root, "public", download.data.redirectUrl.replace(/^\//, ""))), true);
    }

    const invoice = await api.order.invoice({ orderId: "order_buttonwood_1001" });
    assert.equal(invoice.ok, true);
    assert.equal(invoice.data.href, "/account/orders?invoice=order_buttonwood_1001");

    const invoiceByString = await api.order.invoice("order_buttonwood_1001");
    assert.equal(invoiceByString.ok, true);
    assert.equal(invoiceByString.data.href, "/account/orders?invoice=order_buttonwood_1001");

    const webhook = await api.webhook.receive(ctx, {
      provider: "stripe_test",
      eventType: "fixture.test",
      payloadHash: "sha256:fixture",
      providerEventId: "evt_template_test",
      rawBodyLength: 17,
      signatureHeaderPresent: true,
    });
    assert.equal(webhook.ok, true);
    assert.equal(webhook.data.status, "received");
    assert.equal(webhook.data.fixture.provider, "stripe_test");
    assert.equal(webhook.data.fixture.providerEventId, "evt_template_test");
    assert.equal(webhook.data.fixture.eventType, "fixture.test");
    assert.equal(webhook.data.fixture.rawBodyHash, "sha256:fixture");
    assert.equal(webhook.data.fixture.rawBodyLength, 17);
    assert.equal(webhook.data.fixture.signatureHeaderPresent, true);
    assert.equal(webhook.data.fixture.signedWebhookMockBoundary, true);
  });
});

function storefrontCtx(label) {
  return {
    sessionId: "template-test-" + label,
    now: "2026-06-20T12:00:00.000Z",
  };
}

function astroCtx(sessionId) {
  return {
    sessionId,
    now: "2026-06-20T12:00:00.000Z",
  };
}

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

function seededDownloadTokens() {
  const seed = JSON.parse(readFileSync(join(root, "seed/mika-actions.seed.json"), "utf8"));
  return seed.content.downloads.map((entry) => ({
    token: entry.data.download_ref.downloadRef,
    expired: entry.data.fixture_status === "expired",
  }));
}
