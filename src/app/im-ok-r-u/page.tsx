"use client";

import PageLayout from "@/components/layout/page-layout";
import { useSiteContent } from "@/hooks/useSiteConfig";

export default function ImOkRuPage() {
  const c = useSiteContent();
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{c.imOkRU.heading}</h1>
        <p className="text-gold-deep font-semibold text-lg mb-8">{c.imOkRU.subheading}</p>
        <p className="text-foreground leading-relaxed text-lg">{c.imOkRU.body}</p>
      </main>
    </PageLayout>
  );
}
