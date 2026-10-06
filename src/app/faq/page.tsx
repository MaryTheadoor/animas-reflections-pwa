import PageLayout from "@/components/layout/page-layout";
import { FaqJsonLd } from "@/components/layout/json-ld";
import { FAQ } from "@/lib/content";
import Link from "next/link";
import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/faq/");

export default function FaqPage() {
  return (
    <PageLayout>
      <FaqJsonLd />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center pt-8 sm:pt-12 mb-12">
          <h1 className="text-4xl font-bold font-display mb-3">{FAQ.heading}</h1>
          <p className="text-foreground max-w-xl mx-auto">{FAQ.subheading}</p>
        </div>

        <div className="space-y-4">
          {FAQ.items.map((item, i) => (
            <details
              key={i}
              className="glass-card group"
            >
              <summary className="p-5 sm:p-6 cursor-pointer flex items-center justify-between gap-4 font-bold text-primary list-none">
                <span>{item.q}</span>
                <svg
                  className="w-5 h-5 shrink-0 text-gold-deep transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-2">
                <p className="text-foreground leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-foreground/80 text-sm mb-4">
            Don&apos;t see your question? We&apos;re happy to help.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
          >
            Contact Us
          </Link>
        </div>
      </main>
    </PageLayout>
  );
}
