/**
 * Tests for the rich-text description sanitizer/stripper used across the
 * storefront (product page render, cards, search). Covers the formatting-
 * preserving behavior plus the XSS guards.
 */
import { describe, it, expect } from "@jest/globals";
import { sanitizeHTML, stripTags } from "@/lib/html-utils";

describe("sanitizeHTML", () => {
  it("preserves formatting tags produced by the admin toolbar", () => {
    const html = "<p><b>Bold</b> and <i>italic</i> text</p><ul><li>One</li><li>Two</li></ul>";
    expect(sanitizeHTML(html)).toBe(html);
  });

  it("removes script and iframe elements entirely (with content)", () => {
    const html = 'Hello<script>alert(1)</script>World<iframe src="x"></iframe>';
    expect(sanitizeHTML(html)).toBe("HelloWorld");
  });

  it("strips event handlers from remaining tags", () => {
    expect(sanitizeHTML('<p onclick="alert(1)">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("neutralizes javascript: URLs in both double- and single-quoted attributes", () => {
    expect(sanitizeHTML('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#alert(1)">x</a>');
    expect(sanitizeHTML("<a href='javascript:alert(1)'>x</a>")).toBe("<a href='#alert(1)'>x</a>");
  });

  it("strips unquoted event handlers (fallback)", () => {
    expect(sanitizeHTML("<img src=x onerror=alert(1)>")).not.toContain("onerror");
  });

  it("removes style, meta, and form elements (fallback)", () => {
    expect(sanitizeHTML('<style>body{}</style>Hello<form action="x"></form>')).toBe("Hello");
  });
});

describe("stripTags", () => {
  it("converts HTML to plain text with word separators", () => {
    expect(stripTags("<ul><li>One</li><li>Two</li></ul>")).toBe("One Two");
    expect(stripTags("<p><b>Hello</b> world</p>")).toBe("Hello world");
  });

  it("collapses whitespace and trims", () => {
    expect(stripTags("<p>  Hello   <br>  world  </p>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(stripTags("")).toBe("");
  });
});
