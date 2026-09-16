"use client";

import { FAQ } from "@/lib/content";
import { SITE_URL, siteGraph } from "@/lib/seo";

interface JsonLdProps {
  type: "Organization" | "Product" | "WebSite" | "BreadcrumbList" | "FAQPage";
  data: Record<string, unknown>;
}

export default function JsonLd({ type, data }: JsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so admin-authored names/descriptions can't break out of the
      // script block into live DOM (Next.js docs prescribe exactly this).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
    />
  );
}

function GraphJsonLd({ graph }: { graph: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * The site-wide structured data: ONE @graph holding the WebSite and
 * LocalBusiness nodes, cross-referenced by stable @id — the shape the Nown
 * S.I.T.E.S framework emits (tools/seo.mjs buildJsonLd). Preferred over
 * separate flat nodes because a search engine can then resolve the two as one
 * entity. Render this once, in the root layout.
 */
export function SiteJsonLd() {
  return <GraphJsonLd graph={siteGraph()} />;
}

// FAQPage schema is rich-result eligible in Google Search. Built from the same
// FAQ items the /faq page renders so the two never drift.
export function FaqJsonLd() {
  return (
    <JsonLd
      type="FAQPage"
      data={{
        mainEntity: FAQ.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }}
    />
  );
}

// BreadcrumbList helps Google understand site structure. Pass the trail from
// Home to the current page; URLs are made absolute with SITE_URL.
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      type="BreadcrumbList"
      data={{
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: SITE_URL + item.path,
        })),
      }}
    />
  );
}
