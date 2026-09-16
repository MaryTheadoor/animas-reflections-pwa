import PageLayout from "@/components/layout/page-layout";
import { PRIVACY_POLICY } from "@/lib/content";
import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/privacy/");

export default function PrivacyPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-1">{PRIVACY_POLICY.heading}</h1>
        <p className="text-gold-deep font-semibold mb-10">{PRIVACY_POLICY.subheading}</p>
        <div className="space-y-8">
          {PRIVACY_POLICY.sections.map((section) => (
            <div key={section.title}>
              <h2 className="font-bold font-display text-lg mb-2">{section.title}</h2>
              <p className="text-foreground leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </main>
    </PageLayout>
  );
}
