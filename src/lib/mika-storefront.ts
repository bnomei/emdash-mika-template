import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createMikaStorefront, type MikaStorefrontOptions } from "@bnomei/emdash-mika/storefront";
import { createISODateTime, createMikaId } from "@bnomei/emdash-mika/types";
import type {
  CatalogItemDocument,
  CustomerDocument,
  StorefrontRunDocument,
} from "@bnomei/emdash-mika/types/documents";
import { api, fixtureDatabasePath } from "./mika-api.ts";
import {
  captureTemplateReview,
  templateCustomer,
  templateLicenseDocuments,
  templateProductBySlug,
  templateProductSummaries,
} from "./mika-fixture-storefront.ts";

interface RunDatabase {
  prepare(sql: string): {
    get(id: string): { document: string } | undefined;
    run(id: string, document: string): unknown;
  };
  transaction<T>(operation: () => T): { immediate(): T };
  pragma(statement: string): unknown;
  exec(sql: string): void;
  close(): void;
}

const Database = createRequire(import.meta.url)("better-sqlite3") as new (
  path: string,
  options: { fileMustExist: boolean },
) => RunDatabase;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Atomic durable run claims; stored beside the fixture, never in a module-local Map. */
export const storefrontRunStore: MikaStorefrontOptions["repositories"]["ops"] = {
  async findStorefrontRun(id) {
    return withRuns((db) => readRun(db, id));
  },
  async updateStorefrontRun(id, updater) {
    return withRuns((db) =>
      db
        .transaction(() => {
          const next = updater(readRun(db, id));
          if (next)
            db.prepare(
              "INSERT INTO mika_storefront_runs (id, document) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document",
            ).run(id, JSON.stringify(next));
          return next;
        })
        .immediate(),
    );
  },
};

function withRuns<T>(run: (db: RunDatabase) => T): T {
  const db = new Database(fixtureDatabasePath(), { fileMustExist: true });
  try {
    db.pragma("busy_timeout = 5000");
    db.exec(
      "CREATE TABLE IF NOT EXISTS mika_storefront_runs (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
    );
    return run(db);
  } finally {
    db.close();
  }
}

function readRun(db: RunDatabase, id: string): StorefrontRunDocument | null {
  const row = db.prepare("SELECT document FROM mika_storefront_runs WHERE id = ?").get(id);
  return row ? JSON.parse(row.document) : null;
}

function customerDocument(): CustomerDocument {
  const customer = templateCustomer();
  const timestamp = createISODateTime("2026-01-01T00:00:00.000Z");
  return {
    id: customer.id,
    customerId: customer.id,
    type: "customer",
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    emailHash: hash(customer.email),
    aggregate: {
      schemaVersion: 1,
      email: customer.email,
      name: customer.name,
      emailHash: hash(customer.email),
    },
  };
}

function catalogDocuments(): CatalogItemDocument[] {
  return templateProductSummaries().map((summary) => {
    const product = templateProductBySlug(summary.slug)!;
    const timestamp = createISODateTime("2026-01-01T00:00:00.000Z");
    return {
      id: createMikaId(product.id),
      type: "catalogItem",
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      contentCollection: "products",
      contentId: product.id,
      active: true,
      titleSnapshot: product.title,
      aggregate: {
        schemaVersion: 1,
        content: { collection: "products", id: product.id },
        titleSnapshot: product.title,
        sellables: product.sellables.map((sellable, index) => ({
          id: sellable.id,
          titleSnapshot: sellable.title,
          active: true,
          sortOrder: index,
          variantOptions: sellable.variantOptions ?? [],
          prices: sellable.prices.map((price) => ({ ...price, providerRefs: [], active: true })),
        })),
      },
    };
  });
}

/** Read projections use the very same seed as human forms; authentication comes from the session. */
export const storefrontOptions: MikaStorefrontOptions = {
  api,
  hash,
  now: () => new Date(),
  captureReview: captureTemplateReview,
  accountTools: { enabled: true },
  contentUrl: (content) => templateProductBySlug(content.id)?.href ?? "/",
  repositories: {
    ops: storefrontRunStore,
    account: {
      async findCustomerById(id) {
        const customer = customerDocument();
        return customer.customerId === id ? customer : null;
      },
      async findCustomerByUserId() {
        return null;
      },
      async findCustomerByEmailHash(emailHash) {
        const customer = customerDocument();
        return customer.emailHash === emailHash ? customer : null;
      },
      async listLicensesByCustomer(id) {
        return {
          items: templateLicenseDocuments(id).map((data) => ({ id: data.id, data })),
          hasMore: false,
        };
      },
    },
    catalog: {
      async listItems({ cursor, limit = 50 } = {}) {
        const all = catalogDocuments();
        const offset = Number(cursor ?? 0);
        const page = all.slice(offset, offset + limit);
        return {
          items: page.map((data) => ({ id: data.id, data })),
          hasMore: offset + limit < all.length,
          ...(offset + limit < all.length ? { cursor: String(offset + limit) } : {}),
        };
      },
      async findPriceById(id) {
        for (const catalog of catalogDocuments())
          for (const sellable of catalog.aggregate.sellables) {
            const price = sellable.prices.find((price) => price.id === id);
            if (price) return { catalog, sellable, price };
          }
        return null;
      },
    },
  },
};

export const storefront = createMikaStorefront(storefrontOptions);
