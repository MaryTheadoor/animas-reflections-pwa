import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { defineString } from "firebase-functions/params";

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
    variations?: CatalogObjectRaw[];
  };
  itemVariationData?: {
    itemId: string;
    name: string;
    sku?: string;
    priceMoney?: { amount: bigint | number; currency: string };
  };
  imageData?: { id?: string; url?: string; name?: string };
}

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  image_url: string | null;
  variations: {
    id: string;
    name: string;
    price: number;
    sku: string;
  }[];
}

export const fetchSquareCatalog = onCall(
  { cors: true, region: "us-central1" },
  async () => {
    logger.info("fetchSquareCatalog invoked");

    try {
      const client = getSquareClient();
      const response = await client.catalog.search({
        objectTypes: ["ITEM"],
        includeRelatedObjects: true,
      });

      const rawItems: CatalogObjectRaw[] =
        (Array.isArray(response.objects) ? response.objects : []) as CatalogObjectRaw[];

      const related: CatalogObjectRaw[] =
        (Array.isArray(
          (response as Record<string, unknown>).relatedObjects
        )
          ? (response as Record<string, unknown>).relatedObjects
          : []) as CatalogObjectRaw[];

      const images = related.filter((o) => o.type === "IMAGE");

      const catalog: CatalogItem[] = rawItems.map((item) => {
        const itemData = item.itemData;

        const itemImageIds = (itemData?.imageIds ?? []).map(String);
        const itemImage = images.find(
          (img) => img.imageData?.id && itemImageIds.includes(String(img.imageData.id))
        );

        return {
          id: item.id,
          name: itemData?.name ?? "",
          description: itemData?.description ?? "",
          categoryId: itemData?.categoryId ?? null,
          image_url: itemImage?.imageData?.url ?? images[0]?.imageData?.url ?? null,
          variations: (itemData?.variations ?? []).map(
            (v: CatalogObjectRaw) => {
              const vd = v.itemVariationData;
              const rawAmount = vd?.priceMoney?.amount;
              const amount = typeof rawAmount === "bigint" ? Number(rawAmount) : (rawAmount ?? 0);
              return {
                id: v.id,
                name: vd?.name ?? "",
                price: amount / 100,
                sku: vd?.sku ?? "",
              };
            }
          ),
        };
      });

      logger.info("Catalog fetched", { itemCount: catalog.length });
      return { items: catalog };
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

      const orderResponse = await client.orders.create({
        order: {
          locationId,
          lineItems: lineItems as never,
        },
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
      const totalWithShipping =
        shipAmount > 0
          ? BigInt(Number(orderAmount) + Number(shipAmount))
          : orderAmount;

      const paymentResponse = await client.payments.create({
        sourceId: data.sourceId,
        idempotencyKey: `${data.idempotencyKey}-payment`,
        amountMoney: {
          amount: totalWithShipping,
          currency: "USD",
        },
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
