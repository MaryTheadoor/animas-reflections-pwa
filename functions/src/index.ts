import * as logger from "firebase-functions/logger";
import {
  HttpsError,
  onCall,
  onRequest,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import type { Square } from "square";
import { defineString } from "firebase-functions/params";
import {
  deriveOrder,
  type ClientLineItem,
  type PricingProduct,
  type SitePricingConfig,
} from "./pricing.js";

initializeApp();

// Credential diagnostic for the checkout card-form failure — see the file.
export { squareDiagnostics } from "./diagnostics.js";

const squareAccessToken = defineString("SQUARE_ACCESS_TOKEN");
const squareEnvironment = defineString("SQUARE_ENVIRONMENT", { default: "sandbox" });
const squareLocationId = defineString("SQUARE_LOCATION_ID");

/** The Square SDK costs ~7 s to load, and the deploy analyzer allows the WHOLE
 *  codebase 10 s. A static import here made `firebase deploy --only functions`
 *  fail intermittently ("Cannot determine backend specification. Timeout after
 *  10000") and slowed every cold start. Load it on first use; never hoist it. */
async function getSquareClient(): Promise<import("square").SquareClient> {
  const { SquareClient, SquareEnvironment } = await import("square");
  return new SquareClient({
    token: squareAccessToken.value(),
    environment:
      squareEnvironment.value().trim().toLowerCase() === "production"
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
    // An unverified address proves nothing: email/password signup is public, so
    // an attacker can register a listed admin address before its owner does and
    // inherit every admin callable (syncMyAdminClaim already refuses this).
    if (request.auth.token.email_verified !== true) {
      logger.warn("Admin call denied — email not verified", { uid: request.auth.uid, email });
      throw new HttpsError(
        "permission-denied",
        "Verify your email address before using the admin tools",
      );
    }
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
  unverified: string[];
}> {
  const auth = getAuth();
  const granted: string[] = [];
  const revoked: string[] = [];
  const missing: string[] = [];
  const unverified: string[] = [];

  const targets = new Set<string>(await getAdminEmails());
  const bootstrap = bootstrapAdminEmail.value().toLowerCase().trim();
  if (bootstrap) targets.add(bootstrap);

  for (const email of targets) {
    try {
      const user = await auth.getUserByEmail(email);
      // Never mint a claim for an unverified address: email/password signup is
      // public, so the account could belong to an impostor. storage.rules trusts
      // this claim, so report the address instead of granting it.
      if (!user.emailVerified) {
        unverified.push(email);
        continue;
      }
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
      granted.push(email);
    } catch {
      // No Auth account for this email yet; syncMyAdminClaim covers them when
      // they first sign in.
      missing.push(email);
    }
  }

  // Revoke from known users who are no longer admins.
  // Paged: an unpaged listUsers(1000) stops at the first 1000 accounts, so a
  // removed admin beyond that page would keep the claim forever.
  const allUsers: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    allUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  for (const user of allUsers) {
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
    unverified: unverified.length,
  });
  return { granted, revoked, missing, unverified };
}

// ─── Create Square Order & Process Payment ─────────────────────────

/** Square limits the length of a line-item note; the composed customization note
 *  (design URL + text + options + placement) can exceed that on a fully
 *  customised item. The authoritative design URL is stored separately in the
 *  order mirror, so clipping the tail cannot lose the artwork. */
const MAX_SQUARE_NOTE = 250;
function clampNote(note?: string): string | undefined {
  if (!note) return undefined;
  return note.length <= MAX_SQUARE_NOTE
    ? note
    : `${note.slice(0, MAX_SQUARE_NOTE - 1)}…`;
}

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
      addressLine2?: string;
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
    // Bound the work per call: this endpoint is unauthenticated and each line
    // costs a Firestore read plus a Square order line. A customer cart never
    // approaches this many lines.
    if (data.lineItems.length > 50) {
      throw new HttpsError("invalid-argument", "Too many line items in one order (50 max)");
    }
    if (!data.sourceId) {
      throw new HttpsError("invalid-argument", "Payment source ID is required");
    }
    if (!data.idempotencyKey) {
      throw new HttpsError("invalid-argument", "Idempotency key is required");
    }

    try {
      const client = await getSquareClient();
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
        // A $0.00 modifier (size, colour) is an OPTION, not a product: keep it out
        // of the Square line list and put it in the parent line's note, so the
        // picking list shows the garment the customer actually bought.
        const freeOptions = line.addons.filter((a) => a.perUnitCents <= 0).map((a) => a.label);
        const lineNote = clampNote(
          [line.note, freeOptions.length ? `Options: ${freeOptions.join(", ")}` : ""]
            .filter(Boolean)
            .join(" | "),
        );
        if (line.catalogPath && line.squareVariationId) {
          allAdHoc = false;
          squareLineItems.push({
            quantity: String(line.quantity),
            catalogObjectId: line.squareVariationId,
            ...(lineNote ? { note: lineNote } : {}),
          });
        } else {
          squareLineItems.push({
            quantity: String(line.quantity),
            name: line.name,
            basePriceMoney: { amount: BigInt(line.baseCents), currency: "USD" },
            ...(lineNote ? { note: lineNote } : {}),
          });
        }
        for (const addon of line.addons) {
          // $0.00 options were folded into the note above.
          if (addon.perUnitCents <= 0) continue;
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

      // Shipping is part of what the customer owes, so it must live on the
      // Square order too. Without it Square's order total (and the mirrored
      // order the admin reads) understates the charge, and a payment attached
      // to an order can be rejected when its amount does not match the total.
      if (totals.shippingCents > 0) {
        orderData.serviceCharges = [
          {
            name: "Shipping",
            amountMoney: { amount: BigInt(totals.shippingCents), currency: "USD" },
            calculationPhase: "SUBTOTAL_PHASE",
          },
        ];
      }

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
          squareLineItems[0].note = clampNote(customerNote);
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
                  addressLine2: addr.addressLine2,
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
      // Sales tax is the one amount we do NOT derive — Square applies the
      // location's configured taxes to the order. Compare on the PRE-TAX total
      // and charge Square's total (which includes tax).
      const taxCents = Number(
        (order.totalTaxMoney as { amount?: bigint } | undefined)?.amount ?? BigInt(0),
      );
      const squarePreTaxCents = squareOrderCents - taxCents;
      // Square's total includes the shipping service charge added above, so the
      // full amount the customer approved is the derived grand total.
      const approvedCents = totals.totalCents;

      // For fully ad-hoc orders Square's computed total must equal ours exactly
      // (every price came from this server). Catalog-path orders may drift from
      // Firestore prices after a manual edit — never charge more than approved.
      if (allAdHoc && Math.abs(squarePreTaxCents - approvedCents) > 2) {
        logger.error("Square order total diverged from server derivation", {
          squareOrderCents,
          approvedCents,
        });
        throw new Error("Order total verification failed");
      }
      // Catalog-path lines are priced by Square's own catalog, which can lag the
      // Firestore price. Never charge more than the customer approved; a lower
      // charge is logged and allowed.
      if (!allAdHoc && squarePreTaxCents - approvedCents > 2) {
        logger.error("Square catalog price exceeds the approved total", {
          squareOrderCents,
          approvedCents,
        });
        throw new Error("Order total verification failed — catalog price is out of date");
      }
      if (!allAdHoc && Math.abs(squarePreTaxCents - approvedCents) > 2) {
        logger.warn("Square catalog prices differ from Firestore prices", {
          squareOrderCents,
          approvedCents,
        });
      }

      // Shipping rides on the Square order as a service charge, so Square's total
      // is already the full amount — adding shipping again would double-bill.
      const chargeCents = squareOrderCents;

      const paymentResponse = await client.payments.create({
        sourceId: data.sourceId,
        // Ask Square to email the receipt. It only sends when receipts are
        // enabled on the location, so this is a no-op there — but it means the
        // customer's proof of purchase does not depend on us running an email
        // service on day one.
        buyerEmailAddress: data.customer?.email?.trim() || undefined,
        idempotencyKey: `${data.idempotencyKey}-payment`,
        amountMoney: { amount: BigInt(chargeCents), currency: "USD" },
        orderId: order.id as string,
        locationId,
        note: totals.shippingCents > 0
          ? `Includes $${(totals.shippingCents / 100).toFixed(2)} shipping`
          : undefined,
      });

      const payment = paymentResponse.payment as Record<string, unknown> | undefined;
      const paymentStatus = String(payment?.status ?? "");
      const paymentId = typeof payment?.id === "string" ? payment.id : "";
      // Never mirror a payment that Square says did not go through.
      if (paymentStatus === "FAILED" || paymentStatus === "CANCELED") {
        logger.error("Payment did not complete", { paymentId, paymentStatus });
        throw new HttpsError(
          "failed-precondition",
          "The card payment did not complete — you have not been charged. Please try again.",
        );
      }
      logger.info("Payment processed", {
        paymentId: payment?.id,
        status: payment?.status,
      });

      // Decrement inventory only AFTER a successful payment, inside a transaction,
      // so two buyers cannot both take the last unit. Untracked variants (no
      // inventory field) are left alone. Best-effort: never fail a customer's
      // completed payment over a stock bookkeeping write.
      try {
        const byProduct = new Map<string, Map<string, number>>();
        for (const line of totals.lines) {
          const variants = byProduct.get(line.productId) ?? new Map<string, number>();
          variants.set(line.variantId, (variants.get(line.variantId) ?? 0) + line.quantity);
          byProduct.set(line.productId, variants);
        }
        for (const [productId, quantities] of byProduct) {
          const productRef = db.collection("products").doc(productId);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(productRef);
            if (!snap.exists) return;
            const product = snap.data() as PricingProduct;
            if (!Array.isArray(product.variants)) return;
            let changed = false;
            const variants = product.variants.map((variant) => {
              const sold = quantities.get(variant.id);
              if (!sold || typeof variant.inventory !== "number") return variant;
              changed = true;
              return { ...variant, inventory: Math.max(0, variant.inventory - sold) };
            });
            if (changed) tx.update(productRef, { variants });
          });
        }
      } catch (stockErr) {
        logger.error("Failed to decrement inventory after payment", stockErr);
      }

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
          status: paymentStatus === "COMPLETED" ? "PAID" : (paymentStatus || "PENDING"),
          paymentId,
          paymentStatus,
          squarePaymentId: paymentId,
          items: orderItems,
          shipping: data.customer?.address?.addressLine1 ? {
            name: customerName,
            line1: data.customer.address.addressLine1,
            line2: data.customer.address.addressLine2,
            city: data.customer.address.locality,
            state: data.customer.address.administrativeDistrictLevel1,
            zip: data.customer.address.postalCode,
          } : null,
          totals: {
            subtotal: totals.subtotalCents / 100,
            shipping: totals.shippingCents / 100,
            tax: taxCents / 100,
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
      // Square's SDK is loaded lazily, so `instanceof SquareError` is not
      // available here. Its errors always carry an `errors[]` array.
      if (err && typeof err === "object" && "errors" in err) {
        logger.error("Square API error", err);
        throw new Error(`Payment failed: ${(err as { message?: string }).message ?? "unknown Square error"}`);
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
      // Which Square environment the backend actually talks to. Not a secret, and the
      // one fact worth confirming before trusting any Square data (sandbox items, prices
      // and modifier lists are a different universe from production).
      squareEnvironment: squareEnvironment.value(),
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
      const client = await getSquareClient();
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
      // Square's SDK is loaded lazily, so `instanceof SquareError` is not
      // available here. Its errors always carry an `errors[]` array.
      if (err && typeof err === "object" && "errors" in err) {
        logger.error("Square API error fetching orders", err);
        throw new Error(`Square API error: ${(err as { message?: string }).message ?? "unknown Square error"}`);
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

    const client = await getSquareClient();

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

// ─── Square modifier lists ─────────────────────────────────────────

/**
 * Read-only: the Square modifier lists (add-on sets) with each choice's price.
 *
 * Square keeps modifier lists separate from items and offers no CSV export for them, which
 * is why they need the API. The item -> list *associations* are already in the item export
 * as the "Modifier Set - <name>" Y/N columns; this supplies the *contents* (the choices and
 * what each costs), which the export cannot carry.
 */
export const fetchSquareModifiers = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    await requireAdmin(request);
    const client = await getSquareClient();

    type ModifierDto = { id: string; name: string; price: number; onByDefault: boolean; hiddenOnline: boolean };
    type ListDto = {
      id: string;
      name: string;
      modifierType: string;
      minSelected: number | null;
      maxSelected: number | null;
      modifiers: ModifierDto[];
    };

    const lists: ListDto[] = [];
    let cursor: string | undefined;

    do {
      const page = await client.catalog.search({
        objectTypes: ["MODIFIER_LIST"],
        cursor,
        limit: 200,
      });

      for (const object of page.objects ?? []) {
        // CatalogObject is a discriminated union on `type`, so narrow before reaching
        // for the modifier-list payload.
        if (object.type !== "MODIFIER_LIST") continue;
        const data = object.modifierListData;
        if (!data) continue;
        lists.push({
          id: object.id ?? "",
          name: data.name ?? "",
          modifierType: data.modifierType ?? "LIST",
          // These are BigInt too — convert before they cross the callable boundary.
          minSelected: data.minSelectedModifiers == null ? null : Number(data.minSelectedModifiers),
          maxSelected: data.maxSelectedModifiers == null ? null : Number(data.maxSelectedModifiers),
          // flatMap rather than map so the union can be narrowed inside the callback.
          modifiers: (data.modifiers ?? []).flatMap((m: Square.CatalogObject) => {
            if (m.type !== "MODIFIER" || !m.modifierData) return [];
            const md = m.modifierData;
            const amount = md.priceMoney?.amount;
            return [{
              id: m.id ?? "",
              name: md.name ?? "",
              // priceMoney.amount is a BigInt in cents; our prices are dollars.
              price: amount == null ? 0 : Number(amount) / 100,
              onByDefault: md.onByDefault === true,
              hiddenOnline: md.hiddenOnline === true,
            }];
          }),
        });
      }
      cursor = page.cursor ?? undefined;
    } while (cursor);

    logger.info("fetchSquareModifiers", {
      lists: lists.length,
      environment: squareEnvironment.value(),
    });
    // The environment is returned so the caller can tell production data from sandbox at a
    // glance rather than wondering why nothing matches.
    return { environment: squareEnvironment.value(), lists };
  }
);

// ─── Customer Orders ───────────────────────────────────────────────

export const fetchCustomerOrders = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

    const db = getFirestore();
    // The token email is the only trustworthy identity here: users/{uid} is
    // client-writable (firestore.rules), so trusting its `email` field let any
    // account read another customer's orders through the Admin SDK.
    const tokenEmail = (auth.token.email ?? "").trim();
    if (!tokenEmail) {
      throw new HttpsError("permission-denied", "Your account has no email address");
    }
    const userEmail = tokenEmail.toLowerCase();
    const legacyEmail = tokenEmail;

    // Match on the normalized key (post-batch-1 orders) AND on the legacy
    // exact-case field so older orders don't disappear. Merged by doc id and
    // sorted client-side (where-only queries avoid extra composite indexes).
    const [lowerSnap, legacySnap] = await Promise.all([
      db.collection("orders").where("customerEmailLower", "==", userEmail).limit(50).get(),
      db.collection("orders").where("customerEmail", "==", legacyEmail).limit(50).get(),
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
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

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
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

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
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

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
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

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
    if (!auth?.uid) throw new HttpsError("permission-denied", "Authentication required");

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
