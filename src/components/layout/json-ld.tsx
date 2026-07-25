"use client";

import { FAQ } from "@/lib/content";

const SITE_URL = "https://www.animasreflections.com";

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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      type="Organization"
      data={{
        name: "Animas Reflections",
        url: SITE_URL,
        logo: SITE_URL + "/logo.png",
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+1-970-769-2779",
          contactType: "customer service",
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Durango",
          addressRegion: "CO",
          addressCountry: "US",
        },
        sameAs: [
          "https://www.instagram.com/cjfuss.animasreflections/",
        ],
      }}
    />
  );
}

export function WebsiteJsonLd() {
  return (
    <JsonLd
      type="WebSite"
      data={{
        name: "Animas Reflections",
        url: SITE_URL,
        description:
          "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more!",
        potentialAction: {
          "@type": "SearchAction",
          target: SITE_URL + "/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
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
