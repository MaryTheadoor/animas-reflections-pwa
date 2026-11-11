import { describe, expect, it } from "@jest/globals";
import {
  formatMoney,
  mergeOrders,
  packingSlipText,
  parseOrderMirror,
  shippingLines,
  statusClass,
  type OrderMirror,
  type SquareOrder,
} from "../order-model";

const mirror = (over: Partial<OrderMirror> = {}): OrderMirror => ({
  docId: "order_sq-1",
  squareOrderId: "sq-1",
  customerEmail: "buyer@example.com",
  customerName: "Ada Byron",
  status: "PAID",
  items: [{ name: "Hoodie", quantity: 2, price: 45, note: "Colour: Black | Size: L" }],
  shipping: { name: "Ada Byron", line1: "12 Main St", line2: "Apt 4", city: "Durango", state: "CO", zip: "81301" },
  totals: { subtotal: 90, shipping: 7.5, tax: 2.25, grandTotal: 99.75 },
  createdAt: "2026-01-02T10:00:00.000Z",
  ...over,
});

const squareOrder = (over: Partial<SquareOrder> = {}): SquareOrder => ({
  id: "sq-1",
  state: "COMPLETED",
  total: 99.75,
  createdAt: "2026-01-02T10:00:00.000Z",
  ...over,
});

describe("parseOrderMirror", () => {
  it("keeps items, notes, prices and the second address line", () => {
    const parsed = parseOrderMirror("order_sq-1", {
      squareOrderId: "sq-1",
      status: "PAID",
      items: [{ name: "Tee", quantity: 1, price: 24, note: "Front design", designUrl: "https://x/design.png" }],
      shipping: { name: "Ada", line1: "12 Main St", line2: "Apt 4", city: "Durango", state: "CO", zip: "81301" },
      totals: { subtotal: 24, shipping: 7.5, tax: 0, grandTotal: 31.5 },
      paymentId: "pay_123",
    });

    expect(parsed.items).toEqual([
      { name: "Tee", quantity: 1, price: 24, note: "Front design", designUrl: "https://x/design.png" },
    ]);
    expect(parsed.shipping?.line2).toBe("Apt 4");
    expect(parsed.totals?.grandTotal).toBe(31.5);
    expect(parsed.paymentId).toBe("pay_123");
  });

  it("treats an empty shipping object as no address", () => {
    expect(parseOrderMirror("order_x", { shipping: null }).shipping).toBeNull();
    expect(parseOrderMirror("order_x", { shipping: {} }).shipping).toBeNull();
  });
});

describe("mergeOrders", () => {
  it("keeps a mirror that Square does not list (F-11)", () => {
    const [row] = mergeOrders([mirror({ squareOrderId: "sq-missing", docId: "order_sq-missing" })], []);
    expect(row.inSquare).toBe(false);
    expect(row.hasMirror).toBe(true);
    expect(row.id).toBe("sq-missing");
    expect(row.total).toBe(99.75);
  });

  it("matches on squareOrderId and takes Square's total", () => {
    const [row] = mergeOrders([mirror()], [squareOrder({ total: 101.5 })]);
    expect(row.inSquare).toBe(true);
    expect(row.total).toBe(101.5);
    expect(row.squareState).toBe("COMPLETED");
  });

  it("prefers the stored status over Square's state", () => {
    const [row] = mergeOrders([mirror({ status: "SHIPPED" })], [squareOrder()]);
    expect(row.status).toBe("SHIPPED");
  });

  it("falls back to Square's state when the mirror has no status", () => {
    const [row] = mergeOrders([mirror({ status: undefined })], [squareOrder()]);
    expect(row.status).toBe("COMPLETED");
  });

  it("matches a legacy mirror through the document id", () => {
    const [row] = mergeOrders([mirror({ squareOrderId: undefined })], [squareOrder()]);
    expect(row.inSquare).toBe(true);
  });

  it("keeps a Square order that has no mirror, without duplicating matched ones", () => {
    const rows = mergeOrders([mirror()], [squareOrder(), squareOrder({ id: "sq-2", total: 5 })]);
    expect(rows).toHaveLength(2);
    const orphan = rows.find((r) => r.id === "sq-2");
    expect(orphan?.hasMirror).toBe(false);
    expect(orphan?.docId).toBe("order_sq-2");
    expect(rows.filter((r) => r.id === "sq-1")).toHaveLength(1);
  });

  it("orders newest first across both sources", () => {
    const rows = mergeOrders(
      [mirror({ squareOrderId: "a", docId: "order_a", createdAt: "2026-01-01T00:00:00.000Z" })],
      [squareOrder({ id: "b", createdAt: "2026-03-01T00:00:00.000Z" })],
    );
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("statusClass", () => {
  it("gives each stored status its own colour", () => {
    expect(statusClass("PAID")).toContain("green");
    expect(statusClass("SHIPPED")).toContain("teal");
    expect(statusClass("REFUNDED")).toContain("red");
    expect(statusClass("PENDING")).toContain("yellow");
    expect(statusClass("SOMETHING_NEW")).toContain("gray");
  });
});

describe("formatMoney", () => {
  it("formats numbers and tolerates gaps", () => {
    expect(formatMoney(99.7)).toBe("$99.70");
    expect(formatMoney(undefined)).toBe("$0.00");
    expect(formatMoney(Number.NaN)).toBe("$0.00");
  });
});

describe("shippingLines", () => {
  it("prints name, both address lines and city/state/zip", () => {
    expect(shippingLines(mirror().shipping)).toEqual([
      "Ada Byron",
      "12 Main St",
      "Apt 4",
      "Durango, CO 81301",
    ]);
  });

  it("skips what the record does not have", () => {
    expect(shippingLines({ line1: "12 Main St", city: "Durango", zip: "81301" })).toEqual([
      "12 Main St",
      "Durango, 81301",
    ]);
    expect(shippingLines(null)).toEqual([]);
  });
});

describe("packingSlipText", () => {
  it("carries the address, the item note and the totals", () => {
    const [row] = mergeOrders([mirror()], [squareOrder()]);
    const slip = packingSlipText(row);

    expect(slip).toContain("PACKING SLIP");
    expect(slip).toContain("Order: sq-1");
    expect(slip).toContain("Status: PAID");
    expect(slip).toContain("Date: 2026-01-02");
    expect(slip).toContain("SHIP TO");
    expect(slip).toContain("Apt 4");
    expect(slip).toContain("Durango, CO 81301");
    expect(slip).toContain("2 x Hoodie  $90.00");
    expect(slip).toContain("Colour: Black | Size: L");
    expect(slip).toContain("Tax: $2.25");
    expect(slip).toContain("Total: $99.75");
    expect(slip).not.toContain("no matching Square order");
  });

  it("omits a zero tax row and flags a Square-less order", () => {
    const [row] = mergeOrders(
      [mirror({ squareOrderId: "gone", docId: "order_gone", totals: { subtotal: 90, tax: 0, grandTotal: 90 } })],
      [],
    );
    const slip = packingSlipText(row);
    expect(slip).not.toContain("Tax:");
    expect(slip).toContain("no matching Square order found");
  });
});
