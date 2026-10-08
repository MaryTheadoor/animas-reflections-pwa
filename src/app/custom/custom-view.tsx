"use client";

import PageLayout from "@/components/layout/page-layout";
import { useSiteContent } from "@/hooks/useSiteConfig";

/** Editable body for /custom/. See about-view.tsx for the split rationale. */
export default function CustomView() {
  const c = useSiteContent();
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-6">{c.custom.heading}</h1>
        <p className="text-foreground leading-relaxed text-lg mb-8">{c.custom.body}</p>
        <a href={`mailto:${c.global.email}`}
          className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile">
          Email Your Design — {c.global.email}
        </a>
      </main>
    </PageLayout>
  );
}
