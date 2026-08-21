/**
 * HTML sanitization for rich-text product descriptions.
 *
 * In the browser (the path customers actually render) this delegates to
 * DOMPurify — a DOM-based sanitizer that safely removes scripts, event
 * handlers, javascript: URLs, and the rest regardless of quoting/encoding
 * tricks. A regex chain cannot provide that guarantee, which is why it is
 * only kept as a fallback for environments without a DOM (static prerender
 * and the Node test environment).
 */
import DOMPurify from "dompurify";

/** Conservative regex fallback for non-DOM environments. */
function fallbackSanitize(html: string): string {
  return html
    // Remove dangerous elements entirely (with content where they can hold it).
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/<(meta|link|base)\b[^>]*>/gi, "")
    // Strip quoted event handlers from any remaining tag.
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    // Then unquoted ones (e.g. onclick=alert(1)).
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    // Neutralize javascript: protocol from href/src attributes.
    .replace(/(\shref\s*=\s*["'])\s*javascript\s*:/gi, '$1#')
    .replace(/(\ssrc\s*=\s*["'])\s*javascript\s*:/gi, '$1#');
}

/** Sanitize admin-authored rich text for rendering. */
export function sanitizeHTML(html: string): string {
  if (!html) return "";
  // DOMPurify requires a DOM. During static prerender and in the Node test
  // environment, window is undefined — fall back to the regex chain. Every
  // real customer render happens in the browser and uses DOMPurify.
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(html);
  }
  return fallbackSanitize(html);
}

/** Strip all HTML tags for plain-text contexts (cards, search, OG meta, etc.) */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
