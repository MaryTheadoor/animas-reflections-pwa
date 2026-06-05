import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
            image_url: itemImage?.imageData?.url ?? images[0]?.imageData?.url ?? null,
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

// ─── AI-Powered Catalog Sync ──────────────────────────────────────

interface VirtualProduct {
  id: string;
  name: string;
  description: string;
  squareItemIds: string[];
  categoryIds: string[];
  imageUrls: string[];
  minPrice: number;
  variations: { name: string; price: number; squareItemId: string }[];
  updatedAt: string;
}

export const syncCatalog = onCall(
  { cors: true, region: "us-central1", timeoutSeconds: 300 },
  async () => {
    logger.info("syncCatalog invoked");
    try {
      const client = getSquareClient();
      const db = getFirestore();

      const response = await client.catalog.search({ objectTypes: ["ITEM"] });
      const rawItems = ((response.objects || []) as CatalogObjectRaw[])
        .filter((o) => o.itemData?.ecom_visibility === "VISIBLE");

      const aiItems = rawItems.flatMap((item) => {
        const d = item.itemData;
        if (!d?.variations?.length) return [];
        return d.variations.map((v) => ({
          id: item.id,
          name: d.name ?? "",
          description: d.description ?? "",
          categoryIds: (d.categories ?? []).map((c) => c.id),
          imageUrl: d.imageIds?.length ? d.imageIds[0] : null,
          price: Number(v.itemVariationData?.priceMoney?.amount ?? 0) / 100,
        }));
      });

      // Group items by simple name matching (AI grouping for small catalogs is unreliable)
      const groupMap = new Map<string, typeof aiItems>();
      aiItems.forEach((item) => {
        const baseName = item.name.split(" - ")[0]?.split(" | ")[0]?.trim() ?? item.name;
        const existing = groupMap.get(baseName);
        if (existing) existing.push(item);
        else groupMap.set(baseName, [item]);
      });

      const batch = db.batch();
      let count = 0;

      groupMap.forEach((members, name) => {
        const docId = `vp_${count}_${Date.now()}`;
        const uniqueIds = [...new Set(members.map((m) => m.id))];
        const vp: VirtualProduct = {
          id: docId,
          name,
          description: members[0].description?.substring(0, 500) ?? "",
          squareItemIds: uniqueIds,
          categoryIds: [...new Set(members.flatMap((m) => m.categoryIds))],
          imageUrls: [...new Set(members.map((m) => m.imageUrl).filter(Boolean))].slice(0, 5) as string[],
          minPrice: Math.min(...members.map((i) => i.price)),
          variations: members.map((i) => ({ name: i.name, price: i.price, squareItemId: i.id })),
          updatedAt: new Date().toISOString(),
        };
        batch.set(db.collection("virtual_products").doc(docId), vp);
        count++;
      });

      await batch.commit();
      logger.info("Catalog sync complete", { virtualProducts: count });
      return { success: true, virtualProducts: count, originalItems: aiItems.length };
    } catch (err) {
      logger.error("Catalog sync failed", err);
      throw new Error(err instanceof Error ? err.message : "Catalog sync failed");
    }
  }
);
