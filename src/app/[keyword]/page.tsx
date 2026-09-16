import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/page-layout";
import { BreadcrumbJsonLd } from "@/components/layout/json-ld";
import { SITE } from "@/lib/content";
import {
  keywordMetadata,
  keywordPageBySlug,
  keywordParagraphs,
  publishedKeywordPages,
} from "@/lib/seo";

// Static export: every keyword page is emitted at build time from the CMS
// config, so the routes are known up front and nothing is rendered per request.
// This is why keyword edits need the publish step (Admin -> SEO -> Publish).
export function generateStaticParams() {
  return publishedKeywordPages().map((page) => ({ keyword: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  // Next 16: route params are a Promise.
  params: Promise<{ keyword: string }>;
}): Promise<Metadata> {
  const { keyword } = await params;
  const page = keywordPageBySlug(keyword);
  return page ? keywordMetadata(page) : {};
}

export default async function KeywordLandingPage({
  params,
}: {
  params: Promise<{ keyword: string }>;
}) {
  const { keyword } = await params;
  const page = keywordPageBySlug(keyword);
  if (!page) notFound();

  const headline = page.headline || page.keyword;
  const paragraphs = keywordParagraphs(page.body);
  const ctaHref = page.ctaHref || "/custom";
  const ctaLabel = page.ctaLabel || "Start your order";

  return (
    <PageLayout>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Services", path: "/services/" },
          { name: headline, path: "/" + page.slug + "/" },
        ]}
      />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-6">{headline}</h1>

        {paragraphs.map((text, i) => (
          <p key={i} className="text-foreground leading-relaxed text-lg mb-6">
            {text}
          </p>
        ))}

        <div className="glass-card p-6 mt-8">
          <Link
            href={ctaHref}
            className="inline-block rounded-full bg-primary text-white font-semibold px-6 py-3 hover:opacity-90"
          >
            {ctaLabel}
          </Link>
          <p className="text-foreground mt-4 text-sm">
            Questions first? Call {SITE.phone} or email {SITE.email}.
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
