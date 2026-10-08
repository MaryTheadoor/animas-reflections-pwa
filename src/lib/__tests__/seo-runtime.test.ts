/**
 * Tests for the runtime SEO head resolver — the client-side half of the
 * "Firebase is the source of truth for SEO" contract. Pure functions: no DOM,
 * no Firestore. The DOM writer (applyRuntimeHead) is exercised in the browser.
 */
import { describe, it, expect } from "@jest/globals";
import { findPageSeo, normalizeSeoPath, runtimeHeadFor } from "@/lib/seo-runtime";
import { pageTitle } from "@/lib/seo";
import type { SeoConfig } from "@/lib/seo-config";

const EMPTY: SeoConfig = { pages: {}, keywords: [] };

describe("normalizeSeoPath", () => {
  it("leaves the root alone", () => {
    expect(normalizeSeoPath("/")).toBe("/");
    expect(normalizeSeoPath("")).toBe("/");
  });

  it("adds a leading and trailing slash to match PAGE_SEO keys", () => {
    expect(normalizeSeoPath("/shop")).toBe("/shop/");
    expect(normalizeSeoPath("shop/")).toBe("/shop/");
    expect(normalizeSeoPath("/shop/")).toBe("/shop/");
  });

  it("strips query strings and hashes (the ?id= product URL)", () => {
    expect(normalizeSeoPath("/product/?id=abc")).toBe("/product/");
    expect(normalizeSeoPath("/shop/#top")).toBe("/shop/");
  });

  it("does not collapse a nested path", () => {
    expect(normalizeSeoPath("/admin/login")).toBe("/admin/login/");
  });
});

describe("findPageSeo", () => {
  it("finds a real route by its normalized key", () => {
    expect(findPageSeo("/shop/")?.path).toBe("/shop/");
  });

  it("returns undefined instead of throwing for an unknown path", () => {
    expect(findPageSeo("/no-such-page/")).toBeUndefined();
  });
});

describe("runtimeHeadFor", () => {
  it("falls back to the committed default when the document is empty", () => {
    const head = runtimeHeadFor("/shop/", EMPTY);
    const page = findPageSeo("/shop/")!;
    expect(head).toEqual({
      title: pageTitle(page.title),
      description: page.description,
    });
  });

  it("prefers a live override for the exact path", () => {
    const head = runtimeHeadFor("/shop/", {
      pages: { "/shop/": { title: "Fresh Local Title", description: "Fresh description." } },
    });
    expect(head?.title).toBe(pageTitle("Fresh Local Title"));
    expect(head?.description).toBe("Fresh description.");
  });

  it("ignores an override keyed for a different route", () => {
    const head = runtimeHeadFor("/about/", {
      pages: { "/shop/": { title: "Wrong Page" } },
    });
    expect(head?.title).toBe(pageTitle(findPageSeo("/about/")!.title));
  });

  it("treats a blank override as absent (never publishes an empty tag)", () => {
    const head = runtimeHeadFor("/shop/", { pages: { "/shop/": { title: "   " } } });
    expect(head?.title).toBe(pageTitle(findPageSeo("/shop/")!.title));
  });

  it("resolves a published keyword page by slug", () => {
    const head = runtimeHeadFor("/custom-hoodies-durango/", {
      keywords: [
        {
          slug: "custom-hoodies-durango",
          keyword: "custom hoodies durango",
          body: "We print hoodies.",
          published: true,
        },
      ],
    });
    expect(head?.title).toBe(pageTitle("custom hoodies durango"));
    expect(head?.description).toBe("We print hoodies.");
  });

  it("ignores an unpublished keyword", () => {
    expect(
      runtimeHeadFor("/custom-hoodies-durango/", {
        keywords: [
          { slug: "custom-hoodies-durango", keyword: "x", body: "", published: false },
        ],
      })
    ).toBeNull();
  });

  it("returns null for an unknown path so the baked tags are left alone", () => {
    expect(runtimeHeadFor("/totally-unknown/", EMPTY)).toBeNull();
    expect(runtimeHeadFor("/admin/login/", EMPTY)?.title).toContain("Admin Sign In");
  });
});
