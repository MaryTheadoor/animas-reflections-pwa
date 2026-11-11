import { describe, it, expect } from "@jest/globals";
import {
  productSaveIssues,
  productSaveIssueMessage,
  saveConfirmedByServer,
} from "../product-save";

describe("productSaveIssues", () => {
  it("requires a name", () => {
    expect(productSaveIssues({ name: "  ", variants: [{}] })).toEqual(["a product name"]);
  });

  it("requires at least one variant", () => {
    expect(productSaveIssues({ name: "Tee", variants: [] })).toEqual(["at least one variant"]);
    expect(productSaveIssues({ name: "Tee" })).toEqual(["at least one variant"]);
  });

  it("does NOT require a category — 254 live products have none", () => {
    expect(productSaveIssues({ name: "Tee", variants: [{}] })).toEqual([]);
  });

  it("reports both when both are missing", () => {
    expect(productSaveIssueMessage({ variants: [] })).toBe(
      "Cannot save yet — add a product name and at least one variant.",
    );
  });

  it("says nothing when the product is saveable", () => {
    expect(productSaveIssueMessage({ name: "Tee", variants: [{}] })).toBeNull();
  });
});

describe("saveConfirmedByServer", () => {
  it("confirms when the server echoes the updatedAt we wrote", () => {
    expect(saveConfirmedByServer("2026-11-04T19:22:10.000Z", "2026-11-04T19:22:10.000Z")).toBe(true);
  });

  it("refuses when the server still holds an older document", () => {
    expect(saveConfirmedByServer("2026-05-01T00:00:00.000Z", "2026-11-04T19:22:10.000Z")).toBe(false);
    expect(saveConfirmedByServer(undefined, "2026-11-04T19:22:10.000Z")).toBe(false);
    expect(saveConfirmedByServer(null, "2026-11-04T19:22:10.000Z")).toBe(false);
  });
});
