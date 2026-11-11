/* ─── Admin → Orders: the data model ──────────────────────────────────

   Two sources describe the same order, and they do not overlap cleanly:

   - `orders/{order_<squareOrderId>}` in Firestore is the shop's own record —
     items, customization notes, shipping address, totals, tracking, status.
   - `fetchRecentOrders` (Square) shares only the `COMPLETED`/`CANCELED` slice
     of the account, and only the newest 50 of those.

   So Firestore drives the list and Square is enrichment (F-11): an order the
   mirror knows about is visible even when Square's search does not return it,
   and, symmetrically, a Square order with no mirror is still money and stays
   visible. `mergeOrders` is the single place that decides how the two combine.

   Everything here is pure so the merge, the status/colour mapping and the
   packing slip can be tested without Firebase. */

export type AdminOrderItem = {
  name: string;
  quantity: number;
  /** Per-unit price, as the mirror stores it (`line.baseCents / 100`). */
  price?: number;
  /** The customization: design, colour, size, options, placement. */
  note?: string;
  designUrl?: string;
};

export type AdminOrderShipping = {
  name?: string;
  line1?: string;
  /** Optional: only orders mirrored after the address-line-2 change carry it. */
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export type AdminOrderTotals = {
  subtotal?: number;
  shipping?: number;
  tax?: number;
  grandTotal?: number;
};

/** An `orders/{id}` document as written by `createSquareOrderAndPay`. */
export type OrderMirror = {
  /** Firestore document id — needed to write tracking back. */
  docId: string;
  squareOrderId?: string;
  customerEmail?: string;
  customerName?: string;
  /** Stored verbatim: PAID / SHIPPED / REFUNDED / PENDING, plus legacy rows. */
  status?: string;
  items?: AdminOrderItem[];
  shipping?: AdminOrderShipping | null;
  totals?: AdminOrderTotals;
  trackingUrl?: string;
  trackingNumber?: string;
  paymentId?: string;
  paymentStatus?: string;
  createdAt?: unknown;
};

/** A row as the `fetchRecentOrders` callable returns it. */
export type SquareOrder = {
  id: string;
  state?: string;
  total?: number;
  createdAt?: unknown;
  customerEmail?: string;
  customerName?: string;
  trackingUrl?: string;
  trackingNumber?: string;
};

/** One row of the admin table: a mirror, optionally enriched from Square. */
export type AdminOrder = OrderMirror & {
  /** Display id: Square's when known, otherwise the document id. */
  id: string;
  /** Charged total — Square's when matched, else the mirror's grand total. */
  total: number;
  /** Display status: the stored status first, Square's state as a fallback. */
  status: string;
  squareState?: string;
  /** False when the mirror has no matching Square order. */
  inSquare: boolean;
  /** False when a Square order has no Firestore mirror. */
  hasMirror: boolean;
};

/** Firestore stores timestamps as Timestamp objects (with .toDate()); some
 *  older docs hold ISO strings. Normalize both to a Date, or null if invalid —
 *  calling `new Date()` on a raw Timestamp yields "Invalid Date". */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = typeof (value as { toDate?: () => Date }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: unknown): string | null {
  return toDate(value)?.toLocaleDateString() ?? null;
}

function timeOf(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseItems(value: unknown): AdminOrderItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((raw) => {
    const r = asRecord(raw);
    const price = asNumber(r.price);
    const note = asString(r.note);
    const designUrl = asString(r.designUrl);
    return {
      name: asString(r.name) ?? "Item",
      quantity: asNumber(r.quantity) ?? 1,
      ...(price !== undefined ? { price } : {}),
      ...(note ? { note } : {}),
      ...(designUrl ? { designUrl } : {}),
    };
  });
}

function parseShipping(value: unknown): AdminOrderShipping | null {
  const r = asRecord(value);
  const shipping: AdminOrderShipping = {
    name: asString(r.name),
    line1: asString(r.line1),
    line2: asString(r.line2),
    city: asString(r.city),
    state: asString(r.state),
    zip: asString(r.zip),
  };
  // A mirror writes `shipping: null` when the customer gave no address.
  return Object.values(shipping).some(Boolean) ? shipping : null;
}

function parseTotals(value: unknown): AdminOrderTotals | undefined {
  const r = asRecord(value);
  const totals: AdminOrderTotals = {
    subtotal: asNumber(r.subtotal),
    shipping: asNumber(r.shipping),
    tax: asNumber(r.tax),
    grandTotal: asNumber(r.grandTotal),
  };
  return Object.values(totals).some((v) => v !== undefined) ? totals : undefined;
}

/** Turn a raw `orders/{id}` document into the typed mirror the table renders. */
export function parseOrderMirror(docId: string, data: Record<string, unknown>): OrderMirror {
  return {
    docId,
    squareOrderId: asString(data.squareOrderId),
    customerEmail: asString(data.customerEmail),
    customerName: asString(data.customerName),
    status: asString(data.status),
    items: parseItems(data.items),
    shipping: parseShipping(data.shipping),
    totals: parseTotals(data.totals),
    trackingUrl: asString(data.trackingUrl),
    trackingNumber: asString(data.trackingNumber),
    paymentId: asString(data.paymentId),
    paymentStatus: asString(data.paymentStatus),
    createdAt: data.createdAt,
  };
}

/** `order_<squareOrderId>` → `<squareOrderId>`, for legacy docs without the field. */
function squareIdFromDocId(docId: string): string {
  return docId.startsWith("order_") ? docId.slice("order_".length) : docId;
}

function displayStatus(mirror: OrderMirror | undefined, square: SquareOrder | undefined): string {
  // F-04: the stored status is the truth (PAID/SHIPPED/REFUNDED); Square's
  // state only fills in for mirrors written before the status was real.
  const stored = mirror?.status?.trim();
  if (stored) return stored.toUpperCase();
  const state = square?.state?.trim();
  if (state) return state.toUpperCase();
  return "UNKNOWN";
}

function toAdminOrder(mirror: OrderMirror | undefined, square: SquareOrder | undefined, docId: string): AdminOrder {
  const squareTotal = square?.total;
  const mirrorTotal = mirror?.totals?.grandTotal;
  return {
    ...(mirror ?? { docId }),
    docId,
    id: mirror?.squareOrderId ?? square?.id ?? docId,
    customerEmail: mirror?.customerEmail ?? square?.customerEmail,
    customerName: mirror?.customerName ?? square?.customerName,
    trackingUrl: mirror?.trackingUrl ?? square?.trackingUrl,
    trackingNumber: mirror?.trackingNumber ?? square?.trackingNumber,
    createdAt: mirror?.createdAt ?? square?.createdAt,
    total: typeof squareTotal === "number" && Number.isFinite(squareTotal)
      ? squareTotal
      : typeof mirrorTotal === "number" && Number.isFinite(mirrorTotal) ? mirrorTotal : 0,
    status: displayStatus(mirror, square),
    squareState: square?.state,
    inSquare: Boolean(square),
    hasMirror: Boolean(mirror),
  };
}

/**
 * Combine both sources into one newest-first list.
 *
 * A mirror matches Square by `squareOrderId` (falling back to the doc id), and
 * an unmatched mirror is kept — that is the whole point of F-11. Square orders
 * with no mirror are kept too, so nothing that was visible before disappears.
 */
export function mergeOrders(mirrors: OrderMirror[], squareOrders: SquareOrder[]): AdminOrder[] {
  const squareById = new Map<string, SquareOrder>();
  for (const s of squareOrders) {
    if (s?.id) squareById.set(String(s.id), s);
  }

  const matched = new Set<string>();
  const rows: AdminOrder[] = [];

  for (const mirror of mirrors) {
    const squareId = mirror.squareOrderId ?? squareIdFromDocId(mirror.docId);
    const square = squareById.get(squareId);
    if (square) matched.add(String(square.id));
    rows.push(toAdminOrder(mirror, square, mirror.docId));
  }

  for (const s of squareOrders) {
    if (!s?.id || matched.has(String(s.id))) continue;
    rows.push(toAdminOrder(undefined, s, `order_${s.id}`));
  }

  return rows.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
}

const STATUS_CLASSES: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  FULFILLED: "bg-teal-100 text-teal-700",
  SHIPPED: "bg-teal-100 text-teal-700",
  DELIVERED: "bg-teal-100 text-teal-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  OPEN: "bg-yellow-100 text-yellow-700",
  REFUNDED: "bg-red-100 text-red-700",
  CANCELED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

export function statusClass(status: string): string {
  return STATUS_CLASSES[status.toUpperCase()] ?? "bg-gray-100 text-gray-600";
}

export function formatMoney(value?: number | null): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `$${n.toFixed(2)}`;
}

/** The slip's line total: `price` is per unit, so multiply by quantity. */
export function itemLineTotal(item: AdminOrderItem): number | undefined {
  if (typeof item.price !== "number" || !Number.isFinite(item.price)) return undefined;
  const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
  return item.price * qty;
}

/** Address as printable lines: name, line1, line2, "city, state zip". */
export function shippingLines(shipping?: AdminOrderShipping | null): string[] {
  if (!shipping) return [];
  const cityStateZip = [shipping.city, [shipping.state, shipping.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [shipping.name, shipping.line1, shipping.line2, cityStateZip].filter(
    (line): line is string => typeof line === "string" && line.trim().length > 0,
  );
}

/**
 * Plain-text packing slip for the clipboard: address, then each item with its
 * customization note, then whichever totals the mirror stored.
 */
export function packingSlipText(order: AdminOrder): string {
  const lines: string[] = ["ANIMAS REFLECTIONS — PACKING SLIP", ""];

  lines.push(`Order: ${order.squareOrderId ?? order.docId}`);
  if (order.squareOrderId && order.squareOrderId !== order.docId) {
    lines.push(`Record: ${order.docId}`);
  }
  lines.push(`Status: ${order.status}`);
  const created = toDate(order.createdAt);
  if (created) lines.push(`Date: ${created.toISOString().slice(0, 10)}`);
  const customer = order.customerName || order.customerEmail;
  if (customer) lines.push(`Customer: ${customer.trim()}`);
  if (order.customerName && order.customerEmail) lines.push(`Email: ${order.customerEmail}`);
  if (order.paymentId) lines.push(`Payment: ${order.paymentId}`);
  if (!order.inSquare) lines.push("Square: no matching Square order found");

  lines.push("", "SHIP TO");
  const address = shippingLines(order.shipping);
  if (address.length) lines.push(...address);
  else lines.push("(no shipping address on this record)");

  lines.push("", "ITEMS");
  const items = order.items ?? [];
  if (!items.length) {
    lines.push("(no items on this record)");
  } else {
    for (const item of items) {
      const lineTotal = itemLineTotal(item);
      lines.push(
        `${item.quantity} x ${item.name}${lineTotal !== undefined ? `  ${formatMoney(lineTotal)}` : ""}`,
      );
      if (item.designUrl) lines.push(`   file: ${item.designUrl}`);
      if (item.note) {
        for (const noteLine of item.note.split("\n")) lines.push(`   ${noteLine}`);
      }
    }
  }

  const totals = order.totals;
  if (totals) {
    const rows: string[] = [];
    if (totals.subtotal !== undefined) rows.push(`Subtotal: ${formatMoney(totals.subtotal)}`);
    if (totals.shipping !== undefined) rows.push(`Shipping: ${formatMoney(totals.shipping)}`);
    if (totals.tax) rows.push(`Tax: ${formatMoney(totals.tax)}`);
    rows.push(`Total: ${formatMoney(totals.grandTotal ?? order.total)}`);
    lines.push("", "TOTALS", ...rows);
  }

  if (order.trackingUrl || order.trackingNumber) {
    lines.push("", "TRACKING");
    if (order.trackingNumber) lines.push(order.trackingNumber);
    if (order.trackingUrl) lines.push(order.trackingUrl);
  }

  return lines.join("\n");
}
