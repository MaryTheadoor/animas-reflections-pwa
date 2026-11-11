import { describe, expect, it } from "@jest/globals";
import { deleteField } from "firebase/firestore";
import { writeMatchesServer } from "../server-write";

describe("writeMatchesServer", () => {
  it("deep-equals nested objects", () => {
    expect(writeMatchesServer(
      { page: { title: "Shop", options: { enabled: true } } },
      { page: { title: "Shop", options: { enabled: true } } },
    )).toBe(true);
    expect(writeMatchesServer(
      { page: { title: "Shop", options: { enabled: false } } },
      { page: { title: "Shop", options: { enabled: true } } },
    )).toBe(false);
  });

  it("deep-equals arrays in order", () => {
    expect(writeMatchesServer(
      { items: [{ id: 1 }, { id: 2 }] },
      { items: [{ id: 1 }, { id: 2 }] },
    )).toBe(true);
    expect(writeMatchesServer(
      { items: [{ id: 2 }, { id: 1 }] },
      { items: [{ id: 1 }, { id: 2 }] },
    )).toBe(false);
  });

  it("allows extra server keys", () => {
    expect(writeMatchesServer(
      { name: "Tee", updatedAt: "now", serverOnly: true },
      { name: "Tee", updatedAt: "now" },
    )).toBe(true);
  });

  it("detects a changed value", () => {
    expect(writeMatchesServer({ name: "Old" }, { name: "New" })).toBe(false);
  });

  it("rejects a missing document", () => {
    expect(writeMatchesServer(undefined, { name: "Tee" })).toBe(false);
    expect(writeMatchesServer(undefined, {})).toBe(false);
  });

  it("excludes delete sentinels and requires those fields to be absent", () => {
    const expected = {
      pages: {
        "/shop/": { title: deleteField() },
        "/about/": deleteField(),
      },
      updatedAt: "now",
    };

    expect(writeMatchesServer(
      { pages: { "/shop/": { description: "Keep this" } }, updatedAt: "now" },
      expected,
    )).toBe(true);
    expect(writeMatchesServer(
      { pages: { "/shop/": { title: "Still here" } }, updatedAt: "now" },
      expected,
    )).toBe(false);
    expect(writeMatchesServer(
      { pages: { "/about/": { title: "Still here" } }, updatedAt: "now" },
      expected,
    )).toBe(false);
    expect(writeMatchesServer({ updatedAt: "now" }, expected)).toBe(true);
  });
});
