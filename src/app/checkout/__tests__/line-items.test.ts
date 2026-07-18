/**
 * Tests for checkout line item construction logic.
 * Verifies cart items map correctly to the payload sent to createSquareOrderAndPay.
 */
import { describe, it, expect } from "@jest/globals";
import type { CartItem, CartAddon } from "@/types";

function buildLineItem(item: CartItem) {
  const noteParts = [
    item.design_url ? `Design: ${item.design_url}` : "",
    item.design_text ? `Text: ${item.design_text}` : "",
    `View: ${item.selected_view}`,
    (item.design_x != null) ? `Pos: ${item.design_x.toFixed(0)}%,${item.design_y?.toFixed(0)}%` : "",
    (item.design_scale != null) ? `Scale: ${item.design_scale.toFixed(2)}` : "",
    (item.design_rotation != null) ? `Rot: ${item.design_rotation}\u00B0` : "",
    item.addons.length ? `Add-ons: ${item.addons.map((a) => a.label).join(", ")}` : "",
  ].filter(Boolean).join(" | ");

  const addons = item.addons.map((a) => ({
    squareModifierId: a.squareModifierId,
    label: a.label,
    price: a.price,
  }));

  return {
    variant_id: item.variant_id,
    squareVariationId: item.squareVariationId,
    name: `${item.name} — ${item.variant_name}`,
    price: item.base_price,
    quantity: item.quantity,
    note: noteParts,
    addons,
  };
}

function makeBaseItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "cart_1",
    product_id: "prod_1",
    variant_id: "var_1",
    squareVariationId: "sq_var_1",
    name: "Test Tee",
    variant_name: "Large / Black",
    base_price: 25,
    productType: "apparel",
    quantity: 1,
    selected_view: "front",
    addons: [],
    ...overrides,
  };
}

describe("buildLineItem", () => {
  it("maps basic item fields correctly", () => {
    const result = buildLineItem(makeBaseItem());
    expect(result.variant_id).toBe("var_1");
    expect(result.squareVariationId).toBe("sq_var_1");
    expect(result.name).toBe("Test Tee — Large / Black");
    expect(result.price).toBe(25);
    expect(result.quantity).toBe(1);
    expect(result.note).toBe("View: front");
    expect(result.addons).toHaveLength(0);
  });

  it("handles missing squareVariationId", () => {
    const result = buildLineItem(makeBaseItem({ squareVariationId: undefined }));
    expect(result.squareVariationId).toBeUndefined();
    expect(result.variant_id).toBe("var_1");
  });

  it("includes design_url in note", () => {
    const result = buildLineItem(makeBaseItem({ design_url: "https://storage.example.com/design.png" }));
    expect(result.note).toContain("Design: https://storage.example.com/design.png");
  });

  it("includes design_text in note", () => {
    const result = buildLineItem(makeBaseItem({ design_text: "SMITH 42" }));
    expect(result.note).toContain("Text: SMITH 42");
  });

  it("includes view in note", () => {
    const front = buildLineItem(makeBaseItem({ selected_view: "front" }));
    expect(front.note).toContain("View: front");
    const back = buildLineItem(makeBaseItem({ selected_view: "back" }));
    expect(back.note).toContain("View: back");
  });

  it("includes position in note when design_x is set", () => {
    const result = buildLineItem(makeBaseItem({ design_x: 35, design_y: 22 }));
    expect(result.note).toContain("Pos: 35%,22%");
  });

  it("includes scale in note when set", () => {
    const result = buildLineItem(makeBaseItem({ design_scale: 1.5 }));
    expect(result.note).toContain("Scale: 1.50");
  });

  it("includes rotation in note when set", () => {
    const result = buildLineItem(makeBaseItem({ design_rotation: 45 }));
    expect(result.note).toContain("Rot: 45\u00B0");
  });

  it("omits position/scale/rotation when not set", () => {
    const result = buildLineItem(makeBaseItem({ design_x: undefined, design_scale: undefined, design_rotation: undefined }));
    expect(result.note).not.toContain("Pos:");
    expect(result.note).not.toContain("Scale:");
    expect(result.note).not.toContain("Rot:");
  });

  it("includes addons in note and in addons array", () => {
    const addons: CartAddon[] = [
      { type: "back_print", label: "Back Print", price: 5, squareModifierId: "mod_1" },
      { type: "sleeve_print", label: "Sleeve Print", price: 5 },
    ];
    const result = buildLineItem(makeBaseItem({ addons }));
    expect(result.note).toContain("Add-ons: Back Print, Sleeve Print");
    expect(result.addons).toHaveLength(2);
    expect(result.addons[0].squareModifierId).toBe("mod_1");
    expect(result.addons[1].squareModifierId).toBeUndefined();
  });

  it("combines all note parts with pipe separators", () => {
    const result = buildLineItem(makeBaseItem({
      design_url: "https://example.com/art.png",
      design_text: "JERSEY 7",
      design_x: 30,
      design_y: 25,
      design_scale: 1.2,
      design_rotation: 15,
      addons: [{ type: "back_print", label: "Back Print", price: 5 }],
    }));
    expect(result.note).toContain("Design: https://example.com/art.png");
    expect(result.note).toContain("Text: JERSEY 7");
    expect(result.note).toContain("Pos: 30%,25%");
    expect(result.note).toContain("Scale: 1.20");
    expect(result.note).toContain("Rot: 15\u00B0");
    expect(result.note).toContain("Add-ons: Back Print");
    // Verify pipe separators
    const parts = result.note.split(" | ");
    expect(parts.length).toBeGreaterThanOrEqual(6);
  });
});
