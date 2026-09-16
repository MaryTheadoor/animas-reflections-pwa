import PageLayout from "@/components/layout/page-layout";
import { DESIGN_YOUR_OWN, SITE } from "@/lib/content";
import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/custom/");

export default function CustomPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-6">{DESIGN_YOUR_OWN.heading}</h1>
        <p className="text-foreground leading-relaxed text-lg mb-8">{DESIGN_YOUR_OWN.body}</p>
        <a href={`mailto:${SITE.email}`}
          className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile">
          Email Your Design — {SITE.email}
        </a>
      </main>
    </PageLayout>
  );
}
