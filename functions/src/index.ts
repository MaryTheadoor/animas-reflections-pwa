import * as logger from "firebase-functions/logger";
import {
  HttpsError,
  onCall,
  onRequest,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { defineString } from "firebase-functions/params";
import {
  deriveOrder,
  type ClientLineItem,
  type PricingProduct,
  type SitePricingConfig,
} from "./pricing.js";

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

// ─── Admin Authorization ──────────────────────────────────────────
// The client-side RequireAdmin gate only hides UI. Every admin Cloud Function
// MUST call requireAdmin() — otherwise any signed-in user (or anonymous caller)
// could invoke it directly. Mirrors the client's admin detection: the
// config/admin doc and a bootstrap email.
//
// DO NOT reintroduce a domain rule (e.g. "any @animasreflections.com address").
// Email/password signup is public and unverified, so an attacker can register an
// address on a domain they do not own and inherit admin. Verified live 2026-10-06;
// recorded in docs/STATUS_SWEEP.md, section 0.

const bootstrapAdminEmail = defineString("BOOTSTRAP_ADMIN_EMAIL", {
  default: "mary.theadoor.doctor@gmail.com",
});

async function getAdminEmails(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection("config").doc("admin").get();
  const raw = snap.data()?.emails;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

async function requireAdmin(request: CallableRequest): Promise<void> {
  const email = request.auth?.token?.email;
  if (!request.auth?.uid || !email) {
    throw new HttpsError("permission-denied", "Authentication required");
  }
  const lowered = email.toLowerCase().trim();
  const allowed =
    lowered === bootstrapAdminEmail.value().toLowerCase().trim() ||
    (await getAdminEmails()).includes(lowered);
  if (!allowed) {
    logger.warn("Admin call denied", { uid: request.auth.uid, email });
    throw new HttpsError("permission-denied", "Admin access required");
  }
}

// ─── Admin custom claims ───────────────────────────────────────────
// Cloud Storage rules cannot read Cloud Firestore in this project:
// cross-service firestore.exists()/firestore.get() returns false for every
// path, so storage.rules used to deny every admin upload. storage.rules
// therefore authorizes admin writes with the `admin` custom claim, and these
// helpers keep that claim in step with config/admin — which stays the single
// source of truth for who is an admin.

/** Emails that always hold admin rights, mirroring requireAdmin(). */
function isAlwaysAdmin(email: string): boolean {
  const lowered = email.toLowerCase().trim();
  return (
    lowered === bootstrapAdminEmail.value().toLowerCase().trim()
  );
}

/** Grants or revokes `admin` on every known Auth user to match config/admin. */
async function applyAdminClaims(): Promise<{
  granted: string[];
  revoked: string[];
  missing: string[];
}> {
  const auth = getAuth();
  const granted: string[] = [];
  const revoked: string[] = [];
  const missing: string[] = [];

  const targets = new Set<string>(await getAdminEmails());
  const bootstrap = bootstrapAdminEmail.value().toLowerCase().trim();
  if (bootstrap) targets.add(bootstrap);

  for (const email of targets) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
      granted.push(email);
    } catch {
      // No Auth account for this email yet; syncMyAdminClaim covers them when
      // they first sign in.
      missing.push(email);
    }
  }

  // Revoke from known users who are no longer admins.
  const listed = await auth.listUsers(1000);
  for (const user of listed.users) {
    const email = (user.email ?? "").toLowerCase().trim();
    if (!email) continue;
    if (targets.has(email) || isAlwaysAdmin(email)) continue;
    if (user.customClaims?.admin === true) {
      const claims = { ...(user.customClaims ?? {}) };
      delete claims.admin;
      await auth.setCustomUserClaims(user.uid, claims);
      revoked.push(email);
    }
  }

  logger.info("applyAdminClaims complete", {
    granted: granted.length,
    revoked: revoked.length,
    missing: missing.length,
  });
  return { granted, revoked, missing };
}

// ─── Create Square Order & Process Payment ─────────────────────────

interface CreateOrderRequest {
  /** Client cart lines. Prices inside are VERIFIED against the Firestore
   *  catalog by deriveOrder() — they are never charged directly. */
  lineItems: ClientLineItem[];
  /** Client-computed grand total shown to the customer (dollars). The server
   *  re-derives the total and rejects the order if they diverge. */
  expectedTotal?: number;
  sourceId: string;
  idempotencyKey: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: {
      addressLine1?: string;
      locality?: string;
      administrativeDistrictLevel1?: string;
      postalCode?: string;
    };
  };
}

export const createSquareOrderAndPay = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const data = (request.data ?? {}) as CreateOrderRequest;
    logger.info("createSquareOrderAndPay invoked", {
      items: data.lineItems?.length ?? 0,
    });

    if (!Array.isArray(data.lineItems) || !data.lineItems.length) {
      throw new HttpsError("invalid-argument", "Order must contain at least one line item");
    }
    if (!data.sourceId) {
      throw new HttpsError("invalid-argument", "Payment source ID is required");
    }
    if (!data.idempotencyKey) {
      throw new HttpsError("invalid-argument", "Idempotency key is required");
    }

    try {
      const client = getSquareClient();
      const locationId = squareLocationId.value();
      if (!locationId) {
        throw new Error("SQUARE_LOCATION_ID is not configured");
      }

      const db = getFirestore();

      // Load the catalog once. Every price, add-on, and the shipping amount are
      // re-derived from Firestore by deriveOrder() — the client payload only
      // describes WHICH items are in the cart, never what they cost.
      const productIds = [
        ...new Set(data.lineItems.map((li) => li.product_id).filter(Boolean)),
      ];
      const productSnaps = await Promise.all(
        productIds.map((id) => db.collection("products").doc(id).get()),
      );
      const products = new Map<string, PricingProduct>();
      productSnaps.forEach((snap) => {
        if (snap.exists) products.set(snap.id, snap.data() as PricingProduct);
      });

      const siteSnap = await db.collection("config").doc("site").get();
      const siteConfig = (siteSnap.data() ?? {}) as SitePricingConfig;

      const derived = deriveOrder(products, siteConfig, data.lineItems);
      if (!derived.ok) {
        throw new HttpsError("failed-precondition", derived.error);
      }
      const totals = derived.order;

      // Refuse to charge a different amount than the customer was shown.
      if (data.expectedTotal !== undefined && Number.isFinite(data.expectedTotal)) {
        const expectedCents = Math.round(data.expectedTotal * 100);
        if (Math.abs(expectedCents - totals.totalCents) > 2) {
          logger.warn("Expected total diverged from catalog derivation", {
            expectedCents,
            derivedCents: totals.totalCents,
          });
          throw new HttpsError(
            "failed-precondition",
            "Your order total has changed — please review your cart and try again",
          );
        }
      }

      // Build Square line items. Catalog-linked variants keep the catalog path
      // (Square prices them); everything else is ad-hoc with server-computed
      // prices. Each add-on becomes its own ad-hoc line item.
      const squareLineItems: Record<string, unknown>[] = [];
      let allAdHoc = true;
      for (const line of totals.lines) {
        if (line.catalogPath && line.squareVariationId) {
          allAdHoc = false;
          squareLineItems.push({
            quantity: String(line.quantity),
            catalogObjectId: line.squareVariationId,
            ...(line.note ? { note: line.note } : {}),
          });
        } else {
          squareLineItems.push({
            quantity: String(line.quantity),
            name: line.name,
            basePriceMoney: { amount: BigInt(line.baseCents), currency: "USD" },
            ...(line.note ? { note: line.note } : {}),
          });
        }
        for (const addon of line.addons) {
          squareLineItems.push({
            quantity: String(line.quantity),
            name: `Add-on: ${addon.label}`,
            note: line.name,
            basePriceMoney: { amount: BigInt(addon.perUnitCents), currency: "USD" },
          });
        }
      }

      const orderData: Record<string, unknown> = {
        locationId,
        lineItems: squareLineItems as never,
      };

      if (data.customer) {
        const c = data.customer;
        const addr = c.address;
        const hasAddress = !!addr?.addressLine1;
        const customerNote = [
          c.firstName || c.lastName
            ? `Customer: ${[c.firstName, c.lastName].filter(Boolean).join(" ")}`
            : "",
          c.email ? `Email: ${c.email}` : "",
          c.phone ? `Phone: ${c.phone}` : "",
          hasAddress
            ? `Ship to: ${[addr?.addressLine1, addr?.locality, addr?.administrativeDistrictLevel1, addr?.postalCode].filter(Boolean).join(", ")}`
            : "",
        ].filter(Boolean).join(" | ");

        if (customerNote && squareLineItems.length > 0 && !squareLineItems[0].note) {
          squareLineItems[0].note = customerNote;
        }

        if (addr?.addressLine1) {
          orderData.fulfillments = [{
            type: "SHIPMENT",
            state: "PROPOSED",
            shipmentDetails: {
              recipient: {
                displayName: [c.firstName, c.lastName].filter(Boolean).join(" ").trim(),
                emailAddress: c.email,
                phoneNumber: c.phone || undefined,
                address: {
                  addressLine1: addr.addressLine1,
                  locality: addr.locality,
                  administrativeDistrictLevel1: addr.administrativeDistrictLevel1,
                  postalCode: addr.postalCode,
                  country: "US",
                },
              },
            },
          }];
        }
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

      const totalMoney = order.totalMoney as { amount?: bigint } | undefined;
      const squareOrderCents = Number(totalMoney?.amount ?? BigInt(0));
      const itemsCents = totals.subtotalCents + totals.addonsCents;

      // For fully ad-hoc orders Square's computed total must equal ours exactly
      // (every price came from this server). Catalog-path orders may drift from
      // Firestore prices after a manual edit — warn instead of blocking.
      if (allAdHoc && Math.abs(squareOrderCents - itemsCents) > 2) {
        logger.error("Square order total diverged from server derivation", {
          squareOrderCents,
          itemsCents,
        });
        throw new Error("Order total verification failed");
      }
      if (!allAdHoc && Math.abs(squareOrderCents - itemsCents) > 2) {
        logger.warn("Square catalog prices differ from Firestore prices", {
          squareOrderCents,
          itemsCents,
        });
      }

      const chargeCents = squareOrderCents + totals.shippingCents;

      const paymentResponse = await client.payments.create({
        sourceId: data.sourceId,
        idempotencyKey: `${data.idempotencyKey}-payment`,
        amountMoney: { amount: BigInt(chargeCents), currency: "USD" },
        orderId: order.id as string,
        locationId,
        note: totals.shippingCents > 0
          ? `Includes $${(totals.shippingCents / 100).toFixed(2)} shipping`
          : undefined,
      });

      const payment = paymentResponse.payment as Record<string, unknown> | undefined;
      logger.info("Payment processed", {
        paymentId: payment?.id,
        status: payment?.status,
      });

      // Mirror the order to Firestore so customers see it in /account and the
      // admin Orders tab. Uses the server-derived figures (real subtotal, add-on
      // line items, actual charged total), not the client payload.
      let mirrored = false;
      try {
        const customerEmail = data.customer?.email?.trim() || "";
        const customerEmailLower = customerEmail.toLowerCase();
        const customerName = data.customer
          ? [data.customer.firstName, data.customer.lastName].filter(Boolean).join(" ").trim()
          : "";

        const orderItems: Record<string, unknown>[] = totals.lines.flatMap((line) => {
          const base: Record<string, unknown> = {
            name: line.name,
            quantity: line.quantity,
            price: line.baseCents / 100,
            ...(line.designUrl ? { designUrl: line.designUrl } : {}),
            ...(line.note ? { note: line.note } : {}),
          };
          const addons = line.addons.map((a) => ({
            name: `Add-on: ${a.label}`,
            quantity: line.quantity,
            price: a.perUnitCents / 100,
          }));
          return [base, ...addons];
        });

        const firestoreOrder = {
          squareOrderId: order.id as string,
          customerEmail,
          // Normalized lookup key — email matching is case-insensitive end to end.
          customerEmailLower,
          customerName,
          status: "PENDING",
          items: orderItems,
          shipping: data.customer?.address?.addressLine1 ? {
            name: customerName,
            line1: data.customer.address.addressLine1,
            city: data.customer.address.locality,
            state: data.customer.address.administrativeDistrictLevel1,
            zip: data.customer.address.postalCode,
          } : null,
          totals: {
            subtotal: totals.subtotalCents / 100,
            shipping: totals.shippingCents / 100,
            tax: 0,
            grandTotal: chargeCents / 100,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const orderDocId = "order_" + (order.id as string);
        await db.collection("orders").doc(orderDocId).set(firestoreOrder);
        mirrored = true;
        logger.info("Order mirrored to Firestore", { orderDocId });
      } catch (mirrorErr) {
        logger.error("Failed to mirror order to Firestore", mirrorErr);
      }

      return {
        success: true,
        orderId: order.id,
        paymentId: payment?.id,
        paymentStatus: payment?.status,
        mirrored,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
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
    await requireAdmin(request);
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
    await requireAdmin(request);
    const data = request.data as { emails: string[] };
    if (!Array.isArray(data.emails)) {
      throw new HttpsError("invalid-argument", "emails must be an array");
    }
    // Normalize to lowercase so every admin check (functions, firestore.rules,
    // storage.rules, client) compares the same shape.
    const emails = data.emails
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.toLowerCase().trim())
      .filter(Boolean);
    logger.info("saveAdminEmails invoked", { count: emails.length });
    try {
      const db = getFirestore();
      await db.collection("config").doc("admin").set({ emails }, { merge: true });
      // Storage rules authorize admin uploads via the `admin` custom claim, so
      // keep Firebase Auth in step with the list that was just saved.
      const claims = await applyAdminClaims();
      return { success: true, claims };
    } catch (err) {
      logger.error("Failed to save admin emails", err);
      throw new Error("Failed to save admin emails");
    }
  }
);

/** Admin-only backfill: re-sync every user's `admin` claim with config/admin. */
export const syncAdminClaims = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    await requireAdmin(request);
    const claims = await applyAdminClaims();
    return { success: true, ...claims };
  }
);

/**
 * Self-service claim minting. Any signed-in user may call it, but a claim is
 * only granted when the caller's own email is already an admin (config/admin or
 * the bootstrap email) — so an admin
 * added through the Admin UI gets Storage access on their next sign-in without
 * anyone running a backfill.
 */
export const syncMyAdminClaim = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email;
    if (!uid || !email) {
      throw new HttpsError("permission-denied", "Authentication required");
    }
    // Require a verified address: eligibility here is decided purely on the
    // email, so an unverified account claiming a listed address must not be able
    // to mint the admin claim for itself. Both founder accounts are Google
    // sign-ins and are verified.
    if (request.auth?.token?.email_verified !== true) {
      logger.warn("syncMyAdminClaim refused: email not verified", { uid, email });
      return { success: true, admin: false };
    }
    const lowered = email.toLowerCase().trim();
    const eligible = isAlwaysAdmin(lowered) || (await getAdminEmails()).includes(lowered);
    if (!eligible) return { success: true, admin: false };

    const auth = getAuth();
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), admin: true });
    logger.info("syncMyAdminClaim granted", { uid, email: lowered });
    return { success: true, admin: true };
  }
);

// ─── Fetch Recent Orders (Square) ──────────────────────────────────

export const fetchRecentOrders = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    await requireAdmin(request);
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
    await requireAdmin(request);
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
        // A missing Square ID mapping must NOT fall back to the managed variant
        // id: a bogus squareVariationId makes checkout treat the variant as a
        // Square catalog item (catalogPath=true) and fail the payment. Empty
        // string keeps it on the ad-hoc, server-priced path.
        squareVariationId: tempToReal.get(`#var_${i}`) ?? "",
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
    const userEmail = ((userDoc.data()?.email as string) || "").toLowerCase().trim();

    // Match on the normalized key (post-batch-1 orders) AND on the legacy
    // exact-case field so older orders don't disappear. Merged by doc id and
    // sorted client-side (where-only queries avoid extra composite indexes).
    const [lowerSnap, legacySnap] = await Promise.all([
      db.collection("orders").where("customerEmailLower", "==", userEmail).limit(50).get(),
      db.collection("orders").where("customerEmail", "==", userEmail).limit(50).get(),
    ]);

    const byId = new Map<string, Record<string, unknown>>();
    for (const snap of [lowerSnap, legacySnap]) {
      snap.forEach((doc) => {
        if (!byId.has(doc.id)) byId.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }
    const orders = [...byId.values()]
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 50);

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
    await requireAdmin(request);

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

// ─── SEO Publishing (Admin) ────────────────────────────────────────
// The marketing pages are a Next.js static export, so their SEO copy is baked
// into HTML at build time. Saving it in Admin → SEO changes Firestore only —
// crawlers keep reading the old <title>/<meta>/JSON-LD until the site is
// rebuilt and out/ is redeployed. savePublishToken stores the fine-grained
// GitHub PAT that authorizes that rebuild; publishSite fires the
// workflow_dispatch event for .github/workflows/rebuild.yml.
//
// The token is server-only: firestore.rules denies every client read and write
// on secrets/{docId}, only the Admin SDK touches it here, and it is never
// logged, echoed back, or returned to the caller.

const GITHUB_PUBLISH_REPO = "MaryTheadoor/animas-reflections-pwa";
const GITHUB_PUBLISH_REF = "development";
const GITHUB_PUBLISH_WORKFLOW = "rebuild.yml";

// 401 = the PAT is invalid/expired/revoked · 403 = the PAT lacks Actions: write
// · 404 = the PAT cannot see the repo, or rebuild.yml is missing on the branch.
function dispatchFailureMessage(status: number): string {
  if (status === 401) {
    return "GitHub rejected the token (401). It is invalid, expired, or revoked — save a new one in Admin → SEO → Publish settings.";
  }
  if (status === 403) {
    return "GitHub refused the request (403). The token is missing Actions: write access to this repository.";
  }
  if (status === 404) {
    return "GitHub could not find the workflow (404). The token may not have access to MaryTheadoor/animas-reflections-pwa, or rebuild.yml is missing on the development branch.";
  }
  return `GitHub returned ${status} instead of 204, so the rebuild did not start.`;
}

export const savePublishToken = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    await requireAdmin(request);

    const { token } = request.data as { token?: unknown };
    if (typeof token !== "string" || token.trim() === "") {
      throw new HttpsError("invalid-argument", "A GitHub token is required");
    }

    try {
      const db = getFirestore();
      await db.collection("secrets").doc("githubPublish").set({
        token: token.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: request.auth?.token?.email ?? "",
      });
      // Log that a token was stored — never the token itself.
      logger.info("savePublishToken stored a GitHub token", {
        updatedBy: request.auth?.token?.email ?? "",
      });
      return { success: true };
    } catch (err) {
      logger.error("Failed to save publish token", err);
      throw new Error("Failed to save publish token");
    }
  }
);

export const publishSite = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    await requireAdmin(request);

    const db = getFirestore();
    const snap = await db.collection("secrets").doc("githubPublish").get();
    const token = snap.data()?.token;
    if (typeof token !== "string" || token === "") {
      // Not an error state: the admin just has not stored a token yet.
      return {
        success: false,
        configured: false,
        message:
          "No GitHub token configured. Save one in Admin, SEO tab, Publish settings.",
      };
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_PUBLISH_REPO}/actions/workflows/${GITHUB_PUBLISH_WORKFLOW}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "animas-reflections-pwa",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: GITHUB_PUBLISH_REF }),
        }
      );

      if (response.status === 204) {
        logger.info("GitHub rebuild dispatched", { status: response.status });
        return {
          success: true,
          configured: true,
          message: "Rebuild started. The site updates in about 2 minutes.",
        };
      }

      // GitHub-side failures are reported, not thrown, so the admin UI can
      // show what is wrong with the token.
      const body = await response.text().catch(() => "");
      logger.error("GitHub rejected the workflow dispatch", {
        status: response.status,
        body: body.slice(0, 500),
      });
      return {
        success: false,
        configured: true,
        message: dispatchFailureMessage(response.status),
      };
    } catch (err) {
      logger.error("GitHub workflow dispatch could not be sent", err);
      return {
        success: false,
        configured: true,
        message:
          "Could not reach GitHub to start the rebuild. Check the connection and try again.",
      };
    }
  }
);
