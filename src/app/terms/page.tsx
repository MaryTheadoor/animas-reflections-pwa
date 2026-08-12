import PageLayout from "@/components/layout/page-layout";
import { TERMS_OF_SALE } from "@/lib/content";

export default function TermsPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-1">{TERMS_OF_SALE.heading}</h1>
        <p className="text-gold font-semibold mb-10">{TERMS_OF_SALE.subheading}</p>
        <div className="space-y-8">
          {TERMS_OF_SALE.sections.map((section) => (
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
