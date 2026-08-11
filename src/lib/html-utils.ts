/**
 * Zero-dependency lightweight HTML sanitizer for product descriptions.
 * Strips dangerous tags/attributes (script, iframe, event handlers) while
 * preserving formatting tags produced by the admin contentEditable toolbar.
 */
export function sanitizeHTML(html: string): string {
  return html
    // Remove dangerous elements entirely (with content)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    // Strip all event handlers from any remaining tag
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    // Strip javascript: protocol from href/src attributes
    .replace(/(\shref\s*=\s*["'])\s*javascript\s*:/gi, '$1#')
    .replace(/(\ssrc\s*=\s*["'])\s*javascript\s*:/gi, '$1#');
}

/** Strip all HTML tags for plain-text contexts (cards, search, OG meta, etc.) */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
