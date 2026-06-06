import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { defineString } from "firebase-functions/params";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { syncProductsFromSquare, getSyncStatus, importFromSquare } from "./sync.js";

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

// ─── Fetch Square Catalog ─────────────────────────────────────────

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

      // Fetch items with related objects
      const itemResponse = await client.catalog.search({
        objectTypes: ["ITEM"],
        includeRelatedObjects: true,
      });

      const rawItems: CatalogObjectRaw[] =
        (Array.isArray(itemResponse.objects) ? itemResponse.objects : []).filter(
          (o) => {
            const raw = o as CatalogObjectRaw;
            return raw.itemData?.ecom_visibility === "VISIBLE";
          }
        ) as CatalogObjectRaw[];

      const related: CatalogObjectRaw[] =
        (Array.isArray((itemResponse as Record<string, unknown>).relatedObjects)
          ? (itemResponse as Record<string, unknown>).relatedObjects
          : []) as CatalogObjectRaw[];

      const images = related.filter((o) => o.type === "IMAGE");

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
            name: itemData?.name ?? "",
            description: itemData?.description ?? "",
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

// ─── Create Square Order & Process Payment ─────────────────────────

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
        throw new Error("Order creation failed — no order ID returned");
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

// ─── Health Check ──────────────────────────────────────────────────

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

// ─── Fetch Site Config ─────────────────────────────────────────────

export const fetchSiteConfig = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    try {
      const { getFirestore } = await import("firebase-admin/firestore");
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

// ─── Fetch Recent Orders ───────────────────────────────────────────

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
            stateFilter: { states: ["COMPLETED", "OPEN"] },
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

// ─── Catalog Sync (Composite Products) ───────────────────────────

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
      const bucket = getStorage().bucket();
      return await importFromSquare(client, db, bucket);
    } catch (err) {
      logger.error("Import failed", err);
      throw new Error(err instanceof Error ? err.message : "Import failed");
    }
  }
);

export const scheduledSync = onSchedule(
  "0 4 * * *",
  async () => {
    logger.info("Scheduled sync triggered");
    try {
      const client = getSquareClient();
      const db = getFirestore();
      await syncProductsFromSquare(client, db);
    } catch (err) {
      logger.error("Scheduled sync failed", err);
    }
  }
);

// ─── AI-Powered Catalog Sync ──────────────────────────────────────

// ─── AI-Powered Product Search ──────────────────────────────────

const ai = genkit({
  plugins: [googleAI()],
});

const aiSearchSchema = z.object({
  query: z.string().describe("The user's natural language search query"),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    categoryNames: z.array(z.string()),
    colors: z.array(z.string()).optional(),
    minPrice: z.number(),
  })).describe("The catalog of products to search through"),
});

const aiSearchFlow = ai.defineFlow(
  {
    name: "aiProductSearch",
    inputSchema: aiSearchSchema,
    outputSchema: z.object({
      matchedIds: z.array(z.string()),
      explanation: z.string(),
    }),
  },
  async ({ query, products }) => {
    const productList = products
      .map((p) => {
        const parts: string[] = [`ID:${p.id}`, p.name];
        if (p.description) parts.push(`— ${p.description.substring(0, 150)}`);
        if (p.colors?.length) parts.push(`colors: ${p.colors.join(", ")}`);
        if (p.categoryNames.length) parts.push(`categories: ${p.categoryNames.join(", ")}`);
        parts.push(`from $${p.minPrice.toFixed(2)}`);
        return parts.join(" | ");
      })
      .join("\n");

    const prompt = `You are a helpful product search assistant for Animas Reflections, a custom apparel and merchandise store in Durango, Colorado.

Given a customer's search query, identify which products from the catalog below best match the intent. Consider:
- Product names and descriptions (semantic meaning)
- Colors mentioned (e.g., "red", "blue", "navy")
- Product types (e.g., "t-shirt", "hoodie", "hat", "sticker", "jewelry")
- Price ranges (e.g., "under $30", "cheap", "premium")
- Use cases (e.g., "gift", "team", "hockey", "music")
- Categories

Customer query: "${query}"

Catalog:
${productList}

Return ONLY the IDs of the matching products as a comma-separated list, followed by a newline and a brief (1-2 sentence) friendly explanation of what you found. If nothing matches, explain why and suggest alternatives.
Format: 
MATCHED_IDS: id1,id2,id3
EXPLANATION: your explanation here`;

    const result = await ai.generate({
      model: "googleai/gemini-2.0-flash",
      prompt,
      config: { temperature: 0.3, maxOutputTokens: 500 },
    });

    const text = result.text.trim();
    const idMatch = text.match(/MATCHED_IDS:\s*(.*)/);
    const explanationMatch = text.match(/EXPLANATION:\s*([\s\S]*)/);

    const matchedIds = idMatch
      ? idMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const validIds = new Set(products.map((p) => p.id));
    const filteredIds = matchedIds.filter((id) => validIds.has(id));

    const explanation = explanationMatch
      ? explanationMatch[1].trim()
      : `Found ${filteredIds.length} product(s) matching "${query}".`;

    return { matchedIds: filteredIds, explanation };
  }
);

export const aiSearch = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const { query } = request.data as { query: string };
    if (!query?.trim()) {
      throw new Error("Query is required");
    }

    logger.info("AI search invoked", { query: query.substring(0, 80) });

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

      try {
        const result = await aiSearchFlow({ query, products });
        return result;
      } catch (aiError) {
        logger.warn("Genkit AI unavailable", aiError);
        return {
          matchedIds: [],
          explanation: "AI search is not configured. Set up a GEMINI_API_KEY secret to enable AI-powered search.",
        };
      }
    } catch (err) {
      logger.error("AI search error", err);
      throw new Error(
        err instanceof Error ? `AI search failed: ${err.message}` : "AI search unavailable"
      );
    }
  }
);
