import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, it } from "node:test";
import { api } from "../src/lib/mika-api.ts";
import { captureTemplateReview, simulateTemplatePayment, templateProductBySlug } from "../src/lib/mika-fixture-storefront.ts";
import { storefront, storefrontRunStore } from "../src/lib/mika-storefront.ts";
import { mikaActionResult } from "../src/components/mikaActionResult.ts";

const directory = mkdtempSync(join(tmpdir(), "mika-browser-tools-"));
before(() => {
  process.env.EMDASH_MIKA_TEMPLATE_DB = join(directory, "fixture.sqlite");
  const Database = createRequire(import.meta.url)("better-sqlite3");
  new Database(process.env.EMDASH_MIKA_TEMPLATE_DB).close();
});
after(() => { delete process.env.EMDASH_MIKA_TEMPLATE_DB; rmSync(directory, { recursive: true }); });

function context() {
  const values = new Map();
  const sessionId = randomUUID();
  return { sessionId, now: new Date().toISOString(), session: {
    sessionID: sessionId,
    get: async (key) => structuredClone(values.get(key)),
    set: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))); },
    delete: async (key) => { values.delete(key); },
  } };
}

const product = templateProductBySlug("mira-field-clipboard");
const line = { sellableId: product.sellables[0].id, priceId: product.sellables[0].prices[0].id, quantity: 2 };

it("shares human/tool cart state, persists retry identity, and isolates a second session", async () => {
  const ctx = context();
  await api.cart.add(ctx, line);
  const request = { tool: "cart.add", input: { ...line, quantity: 1 }, requestId: randomUUID() };
  const added = await storefront.invoke(ctx, request);
  assert.equal(added.status, "completed");
  assert.equal((await api.cart.get(ctx)).data.items[0].quantity, 3);
  assert.ok(await storefrontRunStore.findStorefrontRun(added.recoveryReference));
  assert.equal((await storefront.invoke(ctx, request)).status, "completed");
  assert.equal((await api.cart.get(ctx)).data.items[0].quantity, 3);
  assert.equal((await api.cart.get(context())).data.items.length, 0);
});

it("rejects stale checkout review at the mutation boundary, accepts unchanged serialized terms", async () => {
  const ctx = context();
  await api.cart.add(ctx, line);
  const approved = JSON.parse(JSON.stringify(await captureTemplateReview(ctx, "checkout.start", {})));
  await api.cart.applyCoupon(ctx, { code: "BUTTONWOOD10" });
  const stale = await api.checkout.start({ ...ctx, storefrontReview: approved }, {});
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "REVIEW_CHANGED");
  const current = await captureTemplateReview(ctx, "checkout.start", {});
  assert.equal((await api.checkout.start({ ...ctx, storefrontReview: current }, {})).ok, true);
});

it("keeps confirmation separate and rejects review after a human edits cart", async () => {
  const ctx = context();
  await api.cart.add(ctx, line);
  const response = await storefront.invoke(ctx, { tool: "checkout.start", input: {}, requestId: randomUUID() });
  assert.equal(response.status, "requires_confirmation");
  assert.ok(response.review.id);
  await api.cart.add(ctx, { ...line, quantity: 1 });
  assert.equal((await storefront.confirm(ctx, response.review.id)).status, "rejected");
});

it("enables account tools only after explicit fixture sign-in in the same session", async () => {
  const ctx = context();
  assert.equal((await storefront.describe(ctx)).some((tool) => tool.name === "account.get"), false);
  const signIn = await storefront.invoke(ctx, { tool: "signIn.request", input: {}, requestId: randomUUID() });
  assert.equal(signIn.status, "requires_confirmation");
  const handoff = await storefront.confirm(ctx, signIn.review.id);
  assert.equal(handoff.status, "handoff");
  assert.equal(handoff.handoff.url, "/account");
  assert.equal((await storefront.describe(ctx)).some((tool) => tool.name === "account.get"), false);
  await api.magicLink.request(ctx, { email: "mira.monday@example.test" });
  await api.magicLink.verify(ctx, { token: "template-login" });
  assert.equal((await storefront.describe(ctx)).some((tool) => tool.name === "account.get"), true);
  assert.equal((await storefront.invoke(ctx, { tool: "account.get", input: {} })).status, "completed");
  assert.equal((await storefront.describe(context())).some((tool) => tool.name === "account.get"), false);
});

it("rejects stale subscription terms at the overridden mutation boundary", async () => {
  const ctx = context();
  const input = { subscriptionId: "sub_template_buttonwood_club" };
  const approved = await captureTemplateReview(ctx, "subscription.renew", input);
  await api.subscription.cancel(ctx, input);
  const result = await api.subscription.renew({ ...ctx, storefrontReview: approved }, input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "REVIEW_CHANGED");
});

it("unwraps commerce errors without treating a truthy envelope as success", () => {
  assert.deepEqual(mikaActionResult({ data: { ok: false, error: { code: "OUT_OF_STOCK", message: "Unavailable" } } }),
    { error: { code: "OUT_OF_STOCK", message: "Unavailable" } });
  assert.deepEqual(mikaActionResult({ data: { ok: true, data: { redirectUrl: "/cart" } } }), { data: { redirectUrl: "/cart" } });
});

it("status reads and cancellation preparation never complete payment or clear the cart", async () => {
  const ctx = context();
  await api.cart.add(ctx, line);
  const checkout = await api.checkout.start(ctx, {});
  const input = { checkoutId: checkout.data.id };
  for (let i = 0; i < 2; i++) {
    const result = await storefront.invoke(ctx, { tool: "checkout.status", input });
    assert.equal(result.result.data.status, "redirected");
  }
  const cancel = await storefront.invoke(ctx, { tool: "checkout.cancel", input, requestId: randomUUID() });
  assert.equal(cancel.status, "requires_confirmation");
  assert.equal((await api.checkout.status(ctx, input)).data.status, "redirected");
  assert.equal((await api.cart.get(ctx)).data.items[0].quantity, 2);
  const pendingOrder = (await api.account.get(ctx)).data.orders.find((order) => order.id === checkout.data.orderId);
  assert.equal(pendingOrder.status, "pending");
  assert.equal(pendingOrder.paymentStatus, "unpaid");
  assert.equal((await simulateTemplatePayment(context(), checkout.data.id)).ok, false);
  assert.equal((await simulateTemplatePayment(ctx, checkout.data.id)).data.status, "completed");
  assert.equal((await api.cart.get(ctx)).data.items.length, 0);
  const paidOrder = (await api.account.get(ctx)).data.orders.find((order) => order.id === checkout.data.orderId);
  assert.equal(paidOrder.status, "paid");
  assert.equal(paidOrder.paymentStatus, "paid");
});

it("unsupported fixture exports never return ready status or a download", async () => {
  const signedIn = context();
  await api.magicLink.request(signedIn, { email: "mira.monday@example.test" });
  await api.magicLink.verify(signedIn, { token: "template-login" });
  for (const ctx of [context(), signedIn]) {
    const results = [
      await api.account.export(ctx, {}),
      await api.account.exportStatus(ctx, { exportId: "unknown-export" }),
      await api.account.exportDownload(ctx, { exportId: "unknown-export", token: "invalid" }),
    ];
    for (const result of results) {
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "NOT_IMPLEMENTED");
      assert.equal(result.status, 501);
      assert.equal(result.data, undefined);
    }
  }
});

it("subscription plan change persists in human and agent account state", async () => {
  const ctx = context();
  const product = templateProductBySlug("buttonwood-creator-bundle");
  const sellable = product.sellables.find((item) => item.prices.some((price) => price.mode === "subscription"));
  const input = { subscriptionId: "sub_template_buttonwood_club", priceId: sellable.prices.find((price) => price.mode === "subscription").id };
  const review = await captureTemplateReview(ctx, "subscription.change", input);
  const changed = await api.subscription.change({ ...ctx, storefrontReview: review }, input);
  assert.equal(changed.ok, true);
  const next = await captureTemplateReview(ctx, "subscription.cancel", { subscriptionId: input.subscriptionId });
  assert.equal(next.subscription.sellable.priceId, input.priceId);
  assert.notEqual((await api.account.get(ctx)).data.subscriptions[0].title, "Buttonwood Sunday Strip Club");
});
