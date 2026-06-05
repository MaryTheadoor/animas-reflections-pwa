"use client";

interface JsonLdProps {
  type: "Organization" | "Product" | "WebSite" | "BreadcrumbList";
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
        url: "https://www.animasreflections.com",
        logo: "https://www.animasreflections.com/logo.png",
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
        sameAs: [],
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
        url: "https://www.animasreflections.com",
        description:
          "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more!",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://www.animasreflections.com/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}
