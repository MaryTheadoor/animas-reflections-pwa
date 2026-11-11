import { describe, it, expect } from "@jest/globals";
import { parseCart, serializeCart } from "../cart-storage";
import type { CartItem } from "@/types";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "line_1",
    product_id: "p1",
    variant_id: "v1",
    name: "Test Tee",
    variant_name: "Large / Black",
    base_price: 25,
    productType: "apparel",
    quantity: 2,
    selected_view: "front",
    addons: [{ type: "back_print", label: "Back Print", price: 5, priceType: "fixed" }],
    ...overrides,
  };
}

describe("parseCart", () => {
  it("returns an empty cart for missing or unparseable storage", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("")).toEqual([]);
    expect(parseCart("{not json")).toEqual([]);
    expect(parseCart('{"items":[]}')).toEqual([]);
  });

  it("round-trips a valid cart, keeping the inputs a fulfilment needs", () => {
    const cart = [item({ design_url: "https://example.com/a.png", selectedOptions: [{ optionId: "size", optionName: "Size", value: "L" }] })];
    const parsed = parseCart(serializeCart(cart));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "line_1",
      product_id: "p1",
      variant_id: "v1",
      quantity: 2,
      base_price: 25,
      design_url: "https://example.com/a.png",
      selected_view: "front",
    });
    expect(parsed[0].addons[0]).toMatchObject({ type: "back_print", price: 5 });
  });

  it("drops a line that is missing its product or variant instead of throwing", () => {
    const raw = JSON.stringify([item(), { id: "x", name: "no ids" }, null, 42]);
    const parsed = parseCart(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("line_1");
  });

  it("clamps quantity into 1..99 and defaults an unknown view", () => {
    const parsed = parseCart(
      JSON.stringify([
        item({ id: "a", quantity: 0 }),
        item({ id: "b", quantity: 500 }),
        item({ id: "c", selected_view: "sideways" as CartItem["selected_view"] }),
      ]),
    );
    expect(parsed.map((i) => i.quantity)).toEqual([1, 99, 2]);
    expect(parsed[2].selected_view).toBe("front");
  });

  it("never lets a corrupt add-on list break the cart", () => {
    const parsed = parseCart(JSON.stringify([item({ addons: [{ type: "back_print" } as never, { price: 5 } as never] })]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].addons).toEqual([]);
  });
});

describe("serializeCart", () => {
  it("writes a JSON array", () => {
    expect(JSON.parse(serializeCart([item()]))).toHaveLength(1);
  });
});
