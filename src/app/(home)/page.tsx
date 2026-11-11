"use client";

import Image from "next/image";
import Link from "next/link";
import PageLayout from "@/components/layout/page-layout";
import FeaturedProducts from "@/components/home/featured-products";
import FundraisingTeaser from "@/components/home/fundraising-teaser";
import BandMerchTeaser from "@/components/home/band-merch-teaser";
import FaqTeaser from "@/components/home/faq-teaser";
import { SITE } from "@/lib/content";
import { useSiteContent } from "@/hooks/useSiteConfig";

export default function Home() {
  const c = useSiteContent();
  return (
    <PageLayout>
      {/* PageLayout supplies the skip link, the header and the #main-content
          focus target; this page only supplies its <main> landmark. */}
      <main className="flex flex-col flex-1">
        {/* Hero */}
      <section className="relative overflow-hidden min-h-[70vh] sm:min-h-[85vh] flex items-center">
        <Image
          src="/hero-bg.jpg"
          alt=""
          fill
          className="object-cover object-[20%_center] sm:object-center opacity-70"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cream/90 via-cream/30 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center w-full">
          <div className="mx-auto max-w-2xl">
            <Image
              src="/logo.png"
              alt={`${SITE.name} logo`}
              width={180}
              height={180}
              className="mx-auto mb-6 sm:mb-8 w-24 h-24 sm:w-[140px] sm:h-[140px] lg:w-[180px] lg:h-[180px] rounded-3xl animate-fade-in-up"
              priority
            />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight font-display mb-6 animate-fade-in-up animate-delay-100 text-foreground">
              {c.home.heroHeading}
            </h1>
            <p className="text-lg text-foreground mb-10 max-w-lg mx-auto leading-relaxed animate-fade-in-up animate-delay-200">
              {c.home.heroSubheading}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animate-delay-300">
              <Link
                href={c.home.heroCtaHref}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-on-gold font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-lg"
              >
                {c.home.heroCtaLabel}
              </Link>
              <Link
                href={c.home.heroCta2Href}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-light transition-colors btn-tactile btn-primary-tactile text-lg"
              >
                {c.home.heroCta2Label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products — Live from Catalog */}
      <FeaturedProducts />

      {/* Fundraising Teaser */}
      <FundraisingTeaser />

      {/* Band Merch Teaser */}
      <BandMerchTeaser />

      {/* Our Story — Glass Card */}
      <section className="section-tile">
        <div className="glass-card p-6 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center">
              <Image
                src="/logo-bw.webp"
                alt={SITE.name}
                width={280}
                height={280}
                className="rounded-2xl shadow-card opacity-90 w-48 sm:w-[280px] mx-auto"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-display mb-2">{c.home.aboutHeading}</h2>
              <p className="text-gold-deep font-semibold mb-4">{c.home.aboutSubheading}</p>
              <p className="text-foreground leading-relaxed">{c.home.aboutBody}</p>
              <div className="mt-4 text-sm text-foreground">
                <p>{c.global.phone}</p>
                <p>{c.global.email}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <FaqTeaser />
      </main>
    </PageLayout>
  );
}
