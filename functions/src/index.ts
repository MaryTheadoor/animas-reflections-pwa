import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { defineString } from "firebase-functions/params";
// Genkit AI commented out â€” programmatic search used instead
// import { genkit, z } from "genkit";
// import { googleAI } from "@genkit-ai/googleai";
import { syncProductsFromSquare, getSyncStatus, importFromSquare } from "./sync.js";
import { runProductPipeline, getPipelineStatus } from "./product-pipeline.js";

initializeApp();

const squareAccessToken = defineString("SQUARE_ACCESS_TOKEN");
const squareEnvironment = defineString("SQUARE_ENVIRONMENT", { default: "sandbox" });
const squareLocationId = defineString("SQUARE_LOCATION_ID");

function getSquareClient(): SquareClient {
  return new SquareClient({
    token: squareAccessToken.value(),
    environment:
      squareEnvironment.value() === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

function cleanProductName(raw: string): string {
  return raw
    .replace(/\b(\d+(\.\d+)?\s*oz\.?)\b/gi, "")
    .replace(/\bSORRY SOLD OUT\b/gi, "")
    .replace(/\bOut of stock\b/gi, "")
    .replace(/\bOnly \d+ Available\b/gi, "")
    .replace(/\bLimited Edition\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function generateDescription(name: string, categories: { id: string }[]): string {
  const catNames = categories.map((c) => c.id).filter(Boolean);
  const typeHint = catNames.length > 0 ? ` | Category: ${catNames.join(", ")}` : "";
  return `Custom ${name}. Professionally printed in Durango, CO.${typeHint}`;
}

// â”€â”€â”€ Fetch Square Catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface CatalogObjectRaw {
  type: string;
  id: string;
  imageIds?: string[];
  itemData?: {
    name: string;
    description?: string;
    categoryId?: string;
    imageIds?: string[];
    categories?: { id: string }[];
    ecom_visibility?: string;
    ecom_available?: boolean;
    variations?: CatalogObjectRaw[];
  };
  itemVariationData?: {
    itemId: string;
    name: string;
    sku?: string;
    priceMoney?: { amount: bigint | number; currency: string };
  };
  imageData?: { id?: string; url?: string; name?: string };
  categoryData?: { name?: string };
}

interface CatalogCategory {
  id: string;
  name: string;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  image_url: string | null;
  variations: {
    id: string;
    name: string;
    price: number;
    sku: string;
  }[];
}

interface CatalogResponse {
  items: CatalogItem[];
  categories: CatalogCategory[];
}

export const fetchSquareCatalog = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    logger.info("fetchSquareCatalog invoked");

    try {
      const client = getSquareClient();

      let allItems: CatalogObjectRaw[] = [];
      let allRelated: CatalogObjectRaw[] = [];
      let cursor: string | undefined;

      do {
        const itemResponse = await client.catalog.search({
          objectTypes: ["ITEM"],
          includeRelatedObjects: true,
          limit: 1000,
          cursor,
        });

        const pageItems = (Array.isArray(itemResponse.objects) ? itemResponse.objects : []) as CatalogObjectRaw[];
        allItems = allItems.concat(pageItems);

        const pageRelated = (Array.isArray((itemResponse as Record<string, unknown>).relatedObjects)
          ? (itemResponse as Record<string, unknown>).relatedObjects
          : []) as CatalogObjectRaw[];
        allRelated = allRelated.concat(pageRelated);

        cursor = (itemResponse as Record<string, unknown>).cursor as string | undefined;
      } while (cursor);

      const rawItems = allItems.filter((o) => {
        return o.itemData?.ecom_visibility === "VISIBLE";
      });

      const related = allRelated;
      const images = related.filter((o) => o.type === "IMAGE");
      logger.info("Catalog items fetched", {
        total: allItems.length,
        visible: rawItems.length,
        imagesInRelated: images.length,
        itemsWithImageIds: rawItems.filter((o) => (o.itemData?.imageIds?.length ?? 0) > 0).length,
      });

      const imageMap = new Map<string, string>();
      for (const img of images) {
        const id = img.imageData?.id;
        const url = img.imageData?.url;
        if (id && url) imageMap.set(String(id), url);
      }
      logger.info("Image map built", { mappedImages: imageMap.size });

      // Fetch categories separately
      const catResponse = await client.catalog.search({
        objectTypes: ["CATEGORY"],
      });
      const rawCategories: CatalogObjectRaw[] =
        (Array.isArray(catResponse.objects) ? catResponse.objects : []) as CatalogObjectRaw[];
      const categories = rawCategories.map((c) => ({
        id: c.id,
        name: c.categoryData?.name ?? c.id,
      }));

      const catalog: CatalogItem[] = rawItems
        .map((item) => {
          const itemData = item.itemData;
          const itemImageIds = (itemData?.imageIds ?? []).map(String);
          const itemImage = images.find(
            (img) => img.imageData?.id && itemImageIds.includes(String(img.imageData.id))
          );

          const validVariations = (itemData?.variations ?? [])
            .filter((v) => {
              const vd = v.itemVariationData;
              const amount = vd?.priceMoney?.amount ?? BigInt(0);
              return Number(amount) >= 200; // Keep variations >= $2.00
            })
            .map((v: CatalogObjectRaw) => {
              const vd = v.itemVariationData;
              const rawAmount = vd?.priceMoney?.amount;
              const amount = typeof rawAmount === "bigint" ? Number(rawAmount) : (rawAmount ?? 0);
              return { id: v.id, name: vd?.name ?? "", price: amount / 100, sku: vd?.sku ?? "" };
            });

          if (validVariations.length === 0) return null;

          return {
            id: item.id,
            name: cleanProductName(itemData?.name ?? ""),
            description: itemData?.description || generateDescription(itemData?.name ?? "", itemData?.categories ?? []),
            categoryIds: (itemData?.categories ?? []).map((c) => c.id),
            image_url: itemImage?.imageData?.url ?? null,
            variations: validVariations,
          };
        })
        .filter((item): item is CatalogItem => item !== null);

      logger.info("Catalog fetched", { itemCount: catalog.length, catCount: categories.length });
      return { items: catalog, categories } as CatalogResponse;
    } catch (err) {
      if (err instanceof SquareError) {
        logger.error("Square API error", err);
        throw new Error(`Square API error: ${err.message}`);
      }
      logger.error("Unexpected error", err);
      throw new Error("Failed to fetch catalog");
    }
  }
);

// â”€â”€â”€ Create Square Order & Process Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OrderLineItem {
  catalogObjectId: string;
  quantity?: number;
  modifiers?: { catalogObjectId: string }[];
  note?: string;
}

interface CreateOrderRequest {
  lineItems: OrderLineItem[];
  shippingRate?: number;
  sourceId: string;
  idempotencyKey: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address: {
      addressLine1: string;
      locality: string;
      administrativeDistrictLevel1: string;
      postalCode: string;
    };
  };
}

export const createSquareOrderAndPay = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const data = request.data as CreateOrderRequest;
    logger.info("createSquareOrderAndPay invoked", {
      items: data.lineItems.length,
    });

    if (!data.lineItems.length) {
      throw new Error("Order must contain at least one line item");
    }
    if (!data.sourceId) {
      throw new Error("Payment source ID is required");
    }

    try {
      const client = getSquareClient();
      const locationId = squareLocationId.value();
      if (!locationId) {
        throw new Error("SQUARE_LOCATION_ID is not configured");
      }

      const shippingRate = data.shippingRate ?? 0;

      const lineItems = data.lineItems.map((item) => {
        const li: Record<string, unknown> = {
          catalogObjectId: item.catalogObjectId,
          quantity: String(item.quantity ?? 1),
        };
        if (item.modifiers?.length) {
          li.modifiers = item.modifiers.map((m) => ({
            catalogObjectId: m.catalogObjectId,
          }));
        }
        if (item.note) {
          li.note = item.note;
        }
        return li;
      });

      // Build order with customer and fulfillment data
      const orderData: Record<string, unknown> = {
        locationId,
        lineItems: lineItems as never,
      };

      if (data.customer) {
        // Add customer info as order-level note for Square dashboard visibility
        const c = data.customer;
        const customerNote = [
          `Customer: ${c.firstName} ${c.lastName}`,
          `Email: ${c.email}`,
          c.phone ? `Phone: ${c.phone}` : "",
          `Ship to: ${c.address.addressLine1}, ${c.address.locality}, ${c.address.administrativeDistrictLevel1} ${c.address.postalCode}`,
        ].filter(Boolean).join(" | ");

        // Attach to first line item as note if no specific note exists
        if (lineItems.length > 0 && !(lineItems[0] as Record<string, unknown>).note) {
          (lineItems[0] as Record<string, unknown>).note = customerNote;
        }

        orderData.fulfillments = [{
          type: "SHIPMENT",
          state: "PROPOSED",
          shipmentDetails: {
            recipient: {
              displayName: `${c.firstName} ${c.lastName}`.trim(),
              emailAddress: c.email,
              phoneNumber: c.phone || undefined,
              address: {
                addressLine1: c.address.addressLine1,
                locality: c.address.locality,
                administrativeDistrictLevel1: c.address.administrativeDistrictLevel1,
                postalCode: c.address.postalCode,
                country: "US",
              },
            },
          },
        }];
      }

      const orderResponse = await client.orders.create({
        order: orderData as never,
        idempotencyKey: `${data.idempotencyKey}-order`,
      });

      const order = orderResponse.order as Record<string, unknown> | undefined;
      if (!order?.id) {
        throw new Error("Order creation failed â€” no order ID returned");
      }

      logger.info("Order created", { orderId: order.id });

      const totalMoney = order.totalMoney as { amount: bigint } | undefined;
      const orderAmount = totalMoney?.amount ?? BigInt(0);
      const shipAmount = BigInt(Math.round(shippingRate * 100));
      const totalWithShipping = shipAmount > 0
        ? BigInt(Number(orderAmount) + Number(shipAmount))
        : orderAmount;

      const paymentResponse = await client.payments.create({
        sourceId: data.sourceId,
        idempotencyKey: `${data.idempotencyKey}-payment`,
        amountMoney: { amount: totalWithShipping, currency: "USD" },
        orderId: order.id as string,
        locationId,
        note: shippingRate > 0 ? `Includes $${shippingRate.toFixed(2)} shipping` : undefined,
      });

      const payment = paymentResponse.payment as Record<string, unknown> | undefined;
      logger.info("Payment processed", {
        paymentId: payment?.id,
        status: payment?.status,
      });

      // Mirror order to Firestore for customer account access
      try {
        const db = getFirestore();
        const customerEmail = data.customer?.email || "";
        const customerName = data.customer
          ? (data.customer.firstName + " " + data.customer.lastName).trim()
          : "";

        const orderItems = data.lineItems.map((li) => ({
          name: li.note?.split(" | ")[0]?.replace("Customer: ", "") || "Item",
          quantity: parseInt(String(li.quantity ?? 1), 10),
          price: 0, // Price comes from Square
        }));

        const firestoreOrder = {
          squareOrderId: order.id as string,
          customerEmail,
          customerName,
          status: "PENDING",
          items: orderItems,
          shipping: data.customer?.address ? {
            name: customerName,
            line1: data.customer.address.addressLine1,
            city: data.customer.address.locality,
            state: data.customer.address.administrativeDistrictLevel1,
            zip: data.customer.address.postalCode,
          } : null,
          totals: {
            subtotal: 0,
            shipping: shippingRate,
            tax: 0,
            grandTotal: Number(totalWithShipping) / 100,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const orderDocId = "order_" + (order.id as string);
        await db.collection("orders").doc(orderDocId).set(firestoreOrder);
        logger.info("Order mirrored to Firestore", { orderDocId });
      } catch (mirrorErr) {
        logger.error("Failed to mirror order to Firestore", mirrorErr);
        // Don't fail the payment — the order succeeded
      }

      return {
        success: true,
        orderId: order.id,
        paymentId: payment?.id,
        paymentStatus: payment?.status,
      };
    } catch (err) {
      if (err instanceof SquareError) {
        logger.error("Square API error", err);
        throw new Error(`Payment failed: ${err.message}`);
      }
      logger.error("Unexpected error", err);
      throw new Error(
        err instanceof Error ? err.message : "Order processing failed"
      );
    }
  }
);

// â”€â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const health = onRequest(
  { cors: true, region: "us-central1" },
  (_req, res) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
      squareConfigured: !!squareAccessToken.value(),
    });
  }
);

// â”€â”€â”€ Fetch Site Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchSiteConfig = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    try {
      const db = getFirestore();
      const snap = await db.collection("config").doc("site").get();
      const data = snap.data() ?? {};
      return {
        announcement_text: data.announcement_text ?? "",
        announcement_active: data.announcement_active ?? true,
        primary_color: data.primary_color ?? "#1E4D4F",
        accent_color: data.accent_color ?? "#D97706",
        background_color: data.background_color ?? "#FAF6F0",
        shipping_tier_stickers: data.shipping_tier_stickers ?? 3.0,
        shipping_tier_apparel: data.shipping_tier_apparel ?? 7.5,
        free_shipping_threshold: data.free_shipping_threshold ?? 100.0,
        addon_price: data.addon_price ?? 5.0,
      };
    } catch (err) {
      logger.error("Failed to fetch site config", err);
      throw new Error("Failed to fetch site config");
    }
  }
);

export const saveSiteConfig = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const data = request.data as Record<string, unknown>;
    logger.info("saveSiteConfig invoked");
    try {
      const db = getFirestore();
      await db.collection("config").doc("site").set(data, { merge: true });
      return { success: true };
    } catch (err) {
      logger.error("Failed to save site config", err);
      throw new Error("Failed to save site config");
    }
  }
);

export const saveAdminEmails = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const data = request.data as { emails: string[] };
    logger.info("saveAdminEmails invoked");
    try {
      const db = getFirestore();
      await db.collection("config").doc("admin").set({ emails: data.emails }, { merge: true });
      return { success: true };
    } catch (err) {
      logger.error("Failed to save admin emails", err);
      throw new Error("Failed to save admin emails");
    }
  }
);

// â”€â”€â”€ Fetch Recent Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchRecentOrders = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    logger.info("fetchRecentOrders invoked");
    try {
      const client = getSquareClient();
      const locationId = squareLocationId.value();

      const response = await client.orders.search({
        locationIds: [locationId],
        returnEntries: true,
        query: {
          filter: {
            stateFilter: { states: ["COMPLETED", "CANCELED"] },
          },
          sort: {
            sortField: "CLOSED_AT",
            sortOrder: "DESC",
          },
        },
        limit: 50,
      });

      const orders = (response.orders ?? []).map((o) => {
        const order = o as unknown as Record<string, unknown>;
        const totalMoney = order.totalMoney as { amount?: bigint } | undefined;
        return {
          id: order.id,
          state: order.state ?? "UNKNOWN",
          total: totalMoney?.amount ? Number(totalMoney.amount) / 100 : 0,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };
      });

      logger.info("Orders fetched", { count: orders.length });
      return { orders };
    } catch (err) {
      if (err instanceof SquareError) {
        logger.error("Square API error fetching orders", err);
        throw new Error(`Square API error: ${err.message}`);
      }
      logger.error("Unexpected error fetching orders", err);
      throw new Error("Failed to fetch orders");
    }
  }
);

// â”€â”€â”€ Catalog Sync (Composite Products) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const syncProducts = onCall(
  { cors: true, region: "us-central1", timeoutSeconds: 300 },
  async () => {
    logger.info("syncProducts invoked");
    try {
      const client = getSquareClient();
      const db = getFirestore();
      return await syncProductsFromSquare(client, db);
    } catch (err) {
      logger.error("Sync failed", err);
      throw new Error(
        err instanceof Error ? err.message : "Catalog sync failed"
      );
    }
  }
);

export const fetchSyncStatus = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    const db = getFirestore();
    return await getSyncStatus(db);
  }
);

export const importProducts = onCall(
  { cors: true, region: "us-central1", timeoutSeconds: 600 },
  async () => {
    logger.info("importProducts invoked");
    try {
      const client = getSquareClient();
      const db = getFirestore();
      return await importFromSquare(client, db);
    } catch (err) {
      logger.error("Import failed", err);
      throw new Error(err instanceof Error ? err.message : "Import failed");
    }
  }
);

export const clearProducts = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    logger.info("clearProducts invoked");
    const db = getFirestore();
    const batchSize = 400;

    for (const colName of ["products", "categories", "baseProducts", "designs", "productInstances"]) {
      let deleted = 0;
      do {
        const snap = await db.collection(colName).limit(batchSize).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
        logger.info(`Deleted ${deleted} from ${colName}`);
      } while (true);
    }

    await db.collection("config").doc("sync_status").delete();
    await db.collection("config").doc("import_status").delete();
    await db.collection("config").doc("pipeline_status").delete();

    return { success: true, message: "All products, categories, designs, and instances cleared" };
  }
);

export const runPipeline = onCall(
  { cors: true, region: "us-central1", timeoutSeconds: 600 },
  async () => {
    logger.info("runPipeline invoked");
    try {
      const client = getSquareClient();
      const db = getFirestore();
      return await runProductPipeline(client, db);
    } catch (err) {
      logger.error("Pipeline failed", err);
      throw new Error(err instanceof Error ? err.message : "Pipeline failed");
    }
  }
);

export const fetchPipelineStatus = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    const db = getFirestore();
    return await getPipelineStatus(db);
  }
);

export const scheduledSync = onSchedule(
  "0 4 * * *",
  async () => {
    logger.info("Scheduled sync triggered");
    try {
      const client = getSquareClient();
      const db = getFirestore();
      await runProductPipeline(client, db);
    } catch (err) {
      logger.error("Scheduled sync failed", err);
    }
  }
);

// â”€â”€â”€ AI-Powered Catalog Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Programmatic Product Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Replaces the Genkit AI search with fast client-side-style text matching.
// The frontend /search page already uses fuzzyScore in useSearch.ts;
// this Cloud Function mirrors that logic for API-based search.

function fuzzyScore(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 60;
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(q)) return 40;
  }
  if (lower.includes(q.slice(0, Math.ceil(q.length * 0.6)))) return 20;
  return 0;
}


// ─── Programmatic Product Search (replaces Genkit AI) ────────────

export const aiSearch = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const { query } = request.data as { query: string };
    if (!query?.trim()) {
      throw new Error("Query is required");
    }

    logger.info("Programmatic search invoked", { query: query.substring(0, 80) });

    try {
      const client = getSquareClient();
      const response = await client.catalog.search({
        objectTypes: ["ITEM"],
        includeRelatedObjects: true,
      });

      const rawItems = ((response.objects || []) as unknown[]).filter((o) => {
        const raw = o as Record<string, unknown>;
        const data = raw.itemData as Record<string, unknown> | undefined;
        return data?.ecom_visibility === "VISIBLE";
      }) as Array<Record<string, unknown>>;

      const products = rawItems.map((item) => {
        const data = (item.itemData || {}) as Record<string, unknown>;
        const variations = (data.variations || []) as Array<Record<string, unknown>>;
        const prices = variations
          .map((v) => {
            const vd = (v.itemVariationData || {}) as Record<string, unknown>;
            const pm = vd.priceMoney as { amount?: bigint } | undefined;
            return pm?.amount ? Number(pm.amount) / 100 : 0;
          })
          .filter((p) => p > 0);

        const categories = ((data.categories || []) as Array<{ id?: string }>)
          .map((c) => c.id ?? "");

        return {
          id: item.id as string,
          name: (data.name as string) ?? "",
          description: (data.description as string) ?? "",
          categoryNames: categories,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        };
      });

      if (products.length === 0) {
        return { matchedIds: [], explanation: "No products are currently available in the catalog." };
      }

      // Fuzzy text search - same algorithm as frontend useSearch.ts
      const scored = products
        .map((p) => {
          const score = fuzzyScore(p.name, query) * 3
            + fuzzyScore(p.description, query)
            + (p.categoryNames ?? []).reduce((s, c) => s + fuzzyScore(c, query) * 2, 0);
          return { id: p.id, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      const matchedIds = scored.map((s) => s.id);
      const explanation = matchedIds.length > 0
        ? `Found ${matchedIds.length} product(s) matching "${query}". Results sorted by relevance.`
        : `No products matched "${query}". Try different keywords or browse the catalog.`;

      return { matchedIds, explanation };
    } catch (err) {
      logger.error("Search error", err);
      throw new Error(
        err instanceof Error ? `Search failed: ${err.message}` : "Search unavailable"
      );
    }
  }
);


// â”€â”€â”€ Create Square Product from Firestore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Called by admin UI when saving a locally-created product.
// Creates matching Square Catalog ITEM + ITEM_VARIATIONs and stores
// the returned Square IDs back in Firestore for payment processing.

export const createSquareProduct = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const { productId } = request.data as { productId: string };
    if (!productId) throw new Error("productId is required");

    logger.info("createSquareProduct invoked", { productId });

    const db = getFirestore();
    const snap = await db.collection("products").doc(productId).get();
    if (!snap.exists) throw new Error(`Product ${productId} not found`);

    const product = snap.data() as Record<string, unknown>;
    const variants = (product.variants ?? []) as Array<Record<string, unknown>>;
    if (!variants.length) throw new Error("Product has no variants");

    const client = getSquareClient();

    // Build temp IDs that Square will replace with real IDs
    const tempItemId = `#${productId}`;
    const objects: Array<Record<string, unknown>> = [];

    // ITEM
    objects.push({
      type: "ITEM",
      id: tempItemId,
      presentAtAllLocations: true,
      itemData: {
        name: String(product.name ?? "Untitled"),
        description: String(product.description ?? "").substring(0, 1024),
        productType: "REGULAR",
        variations: variants.map((_, i) => ({
          type: "ITEM_VARIATION",
          id: `#var_${i}`,
        })),
      },
    });

    // ITEM_VARIATIONs
    variants.forEach((v, i) => {
      const priceCents = Math.round((typeof v.price === "number" ? v.price : 0) * 100);
      objects.push({
        type: "ITEM_VARIATION",
        id: `#var_${i}`,
        presentAtAllLocations: true,
        itemVariationData: {
          itemId: tempItemId,
          name: String(v.name ?? `Size/Color ${i + 1}`),
          sku: String(v.sku ?? ""),
          pricingType: "FIXED_PRICING",
          priceMoney: {
            amount: BigInt(Math.round(priceCents)),
            currency: "USD",
          },
        },
      });
    });

    try {
      const response = await client.catalog.batchUpsert({
        idempotencyKey: `create-${productId}-${Date.now()}`,
        batches: [{ objects: objects as never }],
      });

      const idMap = (response as Record<string, unknown>).idMappings as
        | Array<{ clientObjectId?: string; objectId?: string }>
        | undefined;

      if (!idMap?.length) {
        throw new Error("Square returned no ID mappings");
      }

      // Build maps from temp IDs â†’ real Square IDs
      const tempToReal = new Map<string, string>();
      idMap.forEach((m) => {
        if (m.clientObjectId && m.objectId) {
          tempToReal.set(m.clientObjectId, m.objectId);
        }
      });

      const squareItemId = tempToReal.get(tempItemId) ?? "";
      const squareItemIds = squareItemId ? [squareItemId] : [];

      // Update variants with real Square IDs
      const updatedVariants = variants.map((v, i) => ({
        ...v,
        squareItemId,
        squareVariationId: tempToReal.get(`#var_${i}`) ?? String(v.id ?? ""),
      }));

      // Write back to Firestore
      await db.collection("products").doc(productId).set(
        {
          squareItemIds,
          variants: updatedVariants,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      logger.info("createSquareProduct success", {
        productId,
        squareItemId,
        variationCount: updatedVariants.length,
      });

      return {
        success: true,
        squareItemIds,
        squareItemId,
        variants: updatedVariants,
      };
    } catch (err) {
      logger.error("createSquareProduct failed", err);
      throw new Error(
        err instanceof Error ? `Square API error: ${err.message}` : "Failed to create Square product"
      );
    }
  }
);


interface InventoryCount {
  catalogObjectId: string;
  quantity: string;
}

export const fetchInventoryCounts = onCall(
  { cors: true, region: "us-central1", timeoutSeconds: 300 },
  async () => {
    logger.info("fetchInventoryCounts invoked");

    const db = getFirestore();
    const client = getSquareClient();
    const locationId = squareLocationId.value();

    const productsSnap = await db.collection("products").get();
    const variationIds: string[] = [];

    productsSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const variants = (data.variants ?? []) as Array<Record<string, unknown>>;
      variants.forEach((v) => {
        const svId = v.squareVariationId as string | undefined;
        if (svId && !svId.startsWith("#")) {
          variationIds.push(svId);
        }
      });
    });

    if (variationIds.length === 0) {
      return { success: true, updated: 0, message: "No Square variation IDs found" };
    }

    const BATCH_SIZE = 100;
    const allCounts = [];

    for (let i = 0; i < variationIds.length; i += BATCH_SIZE) {
      const batch = variationIds.slice(i, i + BATCH_SIZE);
      const response = await client.inventory.batchRetrieveCounts({
        catalogObjectIds: batch,
        locationIds: [locationId],
      });
      allCounts.push(...(response.counts ?? []));
    }

    const quantityMap = new Map();
    allCounts.forEach((c) => {
      const qty = parseInt(c.quantity ?? "0", 10);
      quantityMap.set(c.catalogObjectId, isNaN(qty) ? 0 : qty);
    });

    const now = new Date().toISOString();
    let updated = 0;
    const batchWrite = db.batch();

    productsSnap.forEach((doc) => {
      const data = doc.data();
      const variants = (data.variants ?? []);
      let changed = false;
      const updatedVariants = variants.map((v) => {
        const svId = v.squareVariationId;
        if (svId && quantityMap.has(svId)) {
          changed = true;
          return { ...v, inventory: quantityMap.get(svId), inventoryUpdatedAt: now };
        }
        return v;
      });
      if (changed) {
        batchWrite.update(doc.ref, { variants: updatedVariants, updatedAt: now });
        updated++;
      }
    });

    await batchWrite.commit();

    await db.collection("config").doc("inventory_sync_status").set({
      lastSync: now,
      variationCount: variationIds.length,
      updatedProductCount: updated,
      countsReturned: allCounts.length,
    });

    return {
      success: true,
      updated,
      totalVariations: variationIds.length,
      countsReturned: allCounts.length,
    };
  }
);

// ─── Customer Orders ───────────────────────────────────────────────

export const fetchCustomerOrders = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userEmail = (userDoc.data()?.email as string) || "";

    const ordersSnap = await db
      .collection("orders")
      .where("customerEmail", "==", userEmail)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const orders: Array<Record<string, unknown>> = [];
    ordersSnap.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    return { orders };
  }
);

// ─── Customer Addresses ────────────────────────────────────────────

export const getCustomerAddresses = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const db = getFirestore();
    const snap = await db
      .collection("customers")
      .doc(auth.uid)
      .collection("addresses")
      .get();

    const addresses: Array<Record<string, unknown>> = [];
    snap.forEach((doc) => {
      addresses.push({ id: doc.id, ...doc.data() });
    });

    return { addresses };
  }
);

export const saveCustomerAddress = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const data = request.data as {
      id?: string;
      label: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      zip: string;
      isDefault?: boolean;
    };

    const db = getFirestore();
    const addressId = data.id || crypto.randomUUID();

    // If setting as default, unset other defaults
    if (data.isDefault) {
      const existing = await db
        .collection("customers")
        .doc(auth.uid)
        .collection("addresses")
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      existing.forEach((doc) => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    await db
      .collection("customers")
      .doc(auth.uid)
      .collection("addresses")
      .doc(addressId)
      .set({
        label: data.label,
        line1: data.line1,
        line2: data.line2 || "",
        city: data.city,
        state: data.state,
        zip: data.zip,
        isDefault: data.isDefault ?? false,
        updatedAt: new Date().toISOString(),
      });

    return { success: true, addressId };
  }
);

export const deleteCustomerAddress = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const { addressId } = request.data as { addressId: string };
    if (!addressId) throw new Error("addressId is required");

    const db = getFirestore();
    await db
      .collection("customers")
      .doc(auth.uid)
      .collection("addresses")
      .doc(addressId)
      .delete();

    return { success: true };
  }
);

// ─── Customer Profile ──────────────────────────────────────────────

export const getCustomerProfile = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const db = getFirestore();
    const snap = await db.collection("customers").doc(auth.uid).get();

    return {
      profile: snap.exists ? snap.data() : { firstName: "", lastName: "" },
    };
  }
);

export const saveCustomerProfile = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const data = request.data as {
      firstName: string;
      lastName: string;
      phone?: string;
    };

    const db = getFirestore();
    await db.collection("customers").doc(auth.uid).set(
      {
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phone: data.phone || "",
        email: auth.token?.email || "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true };
  }
);

// ─── Order Tracking (Admin) ────────────────────────────────────────

export const updateOrderTracking = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new Error("Authentication required");

    const { orderId, trackingUrl, trackingNumber } = request.data as {
      orderId: string;
      trackingUrl?: string;
      trackingNumber?: string;
    };

    if (!orderId) throw new Error("orderId is required");

    const db = getFirestore();
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (trackingUrl !== undefined) update.trackingUrl = trackingUrl;
    if (trackingNumber !== undefined) update.trackingNumber = trackingNumber;
    if (trackingUrl || trackingNumber) update.status = "SHIPPED";

    await db.collection("orders").doc(orderId).set(update, { merge: true });

    return { success: true };
  }
);

