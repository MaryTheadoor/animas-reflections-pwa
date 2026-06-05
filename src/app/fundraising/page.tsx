"use client";

import { useCatalog } from "@/hooks/useCatalog";
import ProductCard from "@/components/product/product-card";
import PageLayout from "@/components/layout/page-layout";
import { FUNDRAISING } from "@/lib/content";

export default function FundraisingPage() {
  const { items } = useCatalog();
  const fundraiserProducts = items.filter((item) =>
    FUNDRAISING.featuredCategories.some((catId) =>
      item.categoryIds.includes(catId)
    )
  );

  return (
    <PageLayout>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center pt-8 sm:pt-12 mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-3">
            {FUNDRAISING.heading}
          </h1>
          <p className="text-gold font-semibold text-lg mb-6">
            {FUNDRAISING.subheading}
          </p>
          <p className="text-primary/70 max-w-2xl mx-auto leading-relaxed">
            {FUNDRAISING.intro}
          </p>
        </div>

        {/* How It Works */}
        <section className="glass-card p-6 sm:p-10 mb-12">
          <h2 className="text-2xl font-bold font-display text-center mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FUNDRAISING.howItWorks.map((step) => (
              <div key={step.title} className="bg-warm-sand/30 rounded-2xl p-5">
                <h3 className="font-bold text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-primary/60 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What We Offer */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold font-display text-center mb-6">
            What We Offer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FUNDRAISING.whatWeOffer.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-3"
              >
                <svg className="w-5 h-5 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span className="text-sm text-primary/70">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Active Fundraisers */}
        {fundraiserProducts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold font-display text-center mb-6">
              Active Fundraisers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fundraiserProducts.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="text-center">
          <div className="glass-card p-8 sm:p-12 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold font-display mb-4">
              {FUNDRAISING.cta.text}
            </h2>
            <p className="text-primary/60 mb-8 max-w-md mx-auto">
              We would love to help you turn custom merchandise into funding for your
              cause. Reach out to get started — no commitment required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`mailto:${FUNDRAISING.cta.email}?subject=Fundraising%20Inquiry`}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-lg"
              >
                Email Us
              </a>
              <a
                href={`tel:${FUNDRAISING.cta.phone}`}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl border-2 border-primary/20 text-primary font-semibold hover:border-primary/40 transition-colors text-lg"
              >
                {FUNDRAISING.cta.phone}
              </a>
            </div>
            <p className="text-xs text-primary/30 mt-6">
              {FUNDRAISING.cta.email}
            </p>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
