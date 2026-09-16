import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/components/layout/page-layout";
import { SITE } from "@/lib/content";
import { keywordParagraphs, metadataFor, publishedKeywordPages } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/services/");

// Hub for the CMS keyword landing pages. Generated pages that nothing links to
// are orphans a crawler may never find, so every published keyword is listed
// here and this page is in sitemap.xml.
export default function ServicesPage() {
  const pages = publishedKeywordPages();

  return (
    <PageLayout>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-4">What we do</h1>
        <p className="text-foreground leading-relaxed text-lg mb-10 max-w-2xl">
          Custom screen printing, embroidery and sublimation from {SITE.location}. Browse what
          we make most, or start with your own idea.
        </p>

        {pages.length === 0 ? (
          <p className="text-foreground">
            Nothing published yet — add a keyword page in Admin → SEO.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {pages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={"/" + page.slug + "/"}
                  className="glass-card block h-full p-6 hover:shadow-card"
                >
                  <h2 className="text-xl font-bold font-display mb-2 text-primary">
                    {page.headline || page.keyword}
                  </h2>
                  <p className="text-foreground text-sm leading-relaxed">
                    {keywordParagraphs(page.body)[0]?.slice(0, 180) || ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageLayout>
  );
}
