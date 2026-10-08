"use client";

import PageLayout from "@/components/layout/page-layout";
import { useSiteContent } from "@/hooks/useSiteConfig";

/**
 * Editable body for /about/. A client component because the copy comes from
 * config/site.content at runtime; the route's <title>/<meta> stay in the server
 * page.tsx so crawlers get baked, per-page metadata.
 */
export default function AboutView() {
  const c = useSiteContent();
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{c.about.heading}</h1>
        <p className="text-gold-deep font-semibold text-lg mb-8">{c.about.subheading}</p>
        <p className="text-foreground leading-relaxed text-lg mb-8">{c.about.body}</p>
        <div className="glass-card p-6">
          <p className="text-foreground">
            <strong>{c.global.name}</strong><br />
            {c.global.phone}<br />
            {c.global.email}<br />
            {c.global.location}
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
