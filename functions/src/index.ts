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

// ─── Create Square Order & Process Payment ─────────────────────────

interface OrderLineItem {
  /** Managed variant ID (provider-agnostic) */
  variant_id: string;
  /** Square variation ID — used for Square checkout when available */
  squareVariationId?: string;
  /** Ad-hoc: item name for non-catalog orders */
  name?: string;
  /** Ad-hoc: item price in dollars for non-catalog orders */
  price?: number;
  quantity?: number;
  modifiers?: { squareModifierId?: string; catalogObjectId?: string }[];
  note?: string;
  /** Customer-uploaded design image URL (Firebase Storage). Needed by the admin
   *  for printing — must be persisted in the Firestore order. */
  designUrl?: string;
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

      const lineItems = data.lineItems.map((item, index) => {
        const catalogObjectId = item.squareVariationId || undefined;
        const li: Record<string, unknown> = {
          quantity: String(item.quantity ?? 1),
        };

        // Two paths: catalog-based (product has a squareVariationId from a
        // createSquareProduct push) vs ad-hoc (product was created manually in
        // admin, no Square catalog ID — we pass name + explicit price instead).
        if (catalogObjectId) {
          li.catalogObjectId = catalogObjectId;
        } else {
          li.name = item.name ?? `Item ${index + 1}`;
          li.basePriceMoney = {
            amount: BigInt(Math.round((item.price ?? 0) * 100)),
            currency: "USD",
          };
        }

        if (item.modifiers?.length) {
          li.modifiers = item.modifiers.map((m) => ({
            catalogObjectId: m.catalogObjectId ?? m.squareModifierId ?? "",
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
        const c = data.customer;
        const customerNote = [
          `Customer: ${c.firstName} ${c.lastName}`,
          `Email: ${c.email}`,
          c.phone ? `Phone: ${c.phone}` : "",
          `Ship to: ${c.address.addressLine1}, ${c.address.locality}, ${c.address.administrativeDistrictLevel1} ${c.address.postalCode}`,
        ].filter(Boolean).join(" | ");

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

      // Mirror order to Firestore so customers can view their orders in /account.
      try {
        const db = getFirestore();
        const customerEmail = data.customer?.email || "";
        const customerName = data.customer
          ? (data.customer.firstName + " " + data.customer.lastName).trim()
          : "";

        const orderItems = data.lineItems.map((li) => ({
          name: li.name || li.note?.split(" | ")[0]?.replace("Customer: ", "") || "Item",
          quantity: parseInt(String(li.quantity ?? 1), 10),
          price: li.price ?? 0,
          designUrl: li.designUrl,
          note: li.note,
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

// ─── Site Config ───────────────────────────────────────────────────

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

// ─── Fetch Recent Orders (Square) ──────────────────────────────────

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

// ─── Push Product to Square (optional catalog linkage) ─────────────

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

    const tempItemId = `#${productId}`;
    const objects: Array<Record<string, unknown>> = [];

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

      const tempToReal = new Map<string, string>();
      idMap.forEach((m) => {
        if (m.clientObjectId && m.objectId) {
          tempToReal.set(m.clientObjectId, m.objectId);
        }
      });

      const squareItemId = tempToReal.get(tempItemId) ?? "";
      const squareItemIds = squareItemId ? [squareItemId] : [];

      const updatedVariants = variants.map((v, i) => ({
        ...v,
        squareItemId,
        squareVariationId: tempToReal.get(`#var_${i}`) ?? String(v.id ?? ""),
      }));

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
