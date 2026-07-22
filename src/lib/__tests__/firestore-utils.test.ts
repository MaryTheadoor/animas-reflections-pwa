/**
 * Tests for stripUndefined — the guard that keeps the Firestore Web SDK from
 * rejecting writes that contain `undefined` field values. Models the real
 * product-save payloads that were failing before the fix. Pure function — no mocks.
 */
import { describe, it, expect } from "@jest/globals";
import { stripUndefined } from "@/lib/firestore-utils";
import type { ManagedProduct } from "@/types";

describe("stripUndefined", () => {
  it("removes top-level undefined optional fields", () => {
    const input = { id: "p1", name: "Tee", mockupImages: undefined, productAddons: undefined };
    const out = stripUndefined(input);
    expect(out).toEqual({ id: "p1", name: "Tee" });
    expect("mockupImages" in out).toBe(false);
    expect("productAddons" in out).toBe(false);
  });

  it("removes nested undefined fields (variant inventory / square ids)", () => {
    const input = {
      variants: [
        { id: "v1", name: "S", price: 10, sku: "", inventory: undefined, squareVariationId: undefined },
      ],
    };
    const out = stripUndefined(input);
    expect(out.variants[0]).toEqual({ id: "v1", name: "S", price: 10, sku: "" });
  });

  it("cleans the duplicated-product payload that previously failed to save", () => {
    // Mirrors handleDuplicate: square IDs and inventory are cleared to undefined.
    const duplicated = {
      id: "new-id",
      name: "Tee (Copy)",
      squareItemIds: undefined,
      variants: [
        { id: "v1", name: "S", price: 10, sku: "", squareItemId: undefined, squareVariationId: undefined, inventory: undefined },
      ],
      createdAt: "2026-07-22T00:00:00.000Z",
    };
    const out = stripUndefined(duplicated as unknown as ManagedProduct);
    expect(out).toEqual({
      id: "new-id",
      name: "Tee (Copy)",
      variants: [{ id: "v1", name: "S", price: 10, sku: "" }],
      createdAt: "2026-07-22T00:00:00.000Z",
    });
  });

  it("drops undefined array elements but keeps real ones", () => {
    const input = { images: ["a.png", undefined, "b.png"] };
    const out = stripUndefined(input);
    expect(out.images).toEqual(["a.png", "b.png"]);
  });

  it("preserves null, empty string, zero, and false (valid Firestore values)", () => {
    const input = { a: null, b: "", c: 0, d: false, e: undefined };
    const out = stripUndefined(input);
    expect(out).toEqual({ a: null, b: "", c: 0, d: false });
  });

  it("leaves fully-populated objects untouched", () => {
    const input = { id: "p1", tags: ["hockey"], mockupImages: { front: "https://x/f.png" } };
    const out = stripUndefined(input);
    expect(out).toEqual(input);
  });

  it("passes through primitives unchanged", () => {
    expect(stripUndefined("str")).toBe("str");
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined(null)).toBe(null);
  });
});
