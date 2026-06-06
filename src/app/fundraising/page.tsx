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
            How Our Fundraising Program Works
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

        {/* Who It's For + Products */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <section className="glass-card p-6">
            <h2 className="text-xl font-bold font-display text-center mb-4">
              Who It&apos;s Perfect For
            </h2>
            <p className="text-sm text-primary/60 mb-4 text-center">
              Whether you&apos;re raising money for uniforms, trips, equipment, programs, or events — we can help.
            </p>
            <div className="space-y-2">
              {FUNDRAISING.whoFor.map((item) => (
                <div key={item} className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-2.5">
                  <svg className="w-4 h-4 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <span className="text-sm text-primary/70">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-bold font-display text-center mb-4">
              Products That Sell
            </h2>
            <p className="text-sm text-primary/60 mb-4 text-center">
              Your catalog can include high-quality custom items such as:
            </p>
            <div className="space-y-2">
              {FUNDRAISING.products.map((item) => (
                <div key={item} className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-2.5">
                  <svg className="w-4 h-4 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
                  </svg>
                  <span className="text-sm text-primary/70">{item}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Why Fundraise With Us */}
        <section className="glass-card p-6 sm:p-10 mb-12">
          <h2 className="text-xl font-bold font-display text-center mb-6">
            Why Fundraise with Animas Reflections?
          </h2>
          <p className="text-primary/60 text-center mb-6 text-sm">
            This is fundraising made simple, transparent, and effective!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FUNDRAISING.whyUs.map((item) => (
              <div key={item} className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-3">
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
              Ready to start fundraising? Email us and we will get your fundraiser set up right away.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`mailto:${FUNDRAISING.cta.email}?subject=Fundraising%20Inquiry`}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-lg"
              >
                Email Us to Get Started
              </a>
              <a
                href={`tel:${FUNDRAISING.cta.phone}`}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-light transition-colors btn-tactile btn-primary-tactile text-lg"
              >
                Call {FUNDRAISING.cta.phone}
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
