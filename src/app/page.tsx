"use client";

import Image from "next/image";
import Link from "next/link";
import HeaderBar from "@/components/layout/header-bar";
import FeaturedProducts from "@/components/home/featured-products";
import FundraisingTeaser from "@/components/home/fundraising-teaser";
import BandMerchTeaser from "@/components/home/band-merch-teaser";
import FaqTeaser from "@/components/home/faq-teaser";
import {
  SITE,
  HERO,
  OUR_STORY,
  NAVIGATION,
  PAYMENT_METHODS,
  RETURN_POLICY,
} from "@/lib/content";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function Home() {
  const siteConfig = useSiteConfig();
  return (
    <div
      className="flex flex-col flex-1 bg-ambient"
      style={{ paddingTop: "var(--header-height, 88px)" }}
    >
      <HeaderBar />

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
              width={140}
              height={140}
              className="mx-auto mb-6 sm:mb-8 w-24 h-24 sm:w-[140px] sm:h-[140px] rounded-3xl shadow-float animate-fade-in-up"
              priority
            />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight font-display mb-6 animate-fade-in-up animate-delay-100 text-foreground">
              {siteConfig.hero_heading || HERO.heading}
            </h1>
            <p className="text-lg text-foreground/70 mb-10 max-w-lg mx-auto leading-relaxed animate-fade-in-up animate-delay-200">
              {siteConfig.hero_subheading || "Design your own t-shirt, hoodie, bag, purse, ornament, coaster, dog scarf, long sleeve tee, print on wood, metal, jewelry and more!"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animate-delay-300">
              <Link
                href={HERO.cta_primary.href}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-lg"
              >
                {HERO.cta_primary.label}
              </Link>
              <Link
                href={HERO.cta_secondary.href}
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-light transition-colors btn-tactile btn-primary-tactile text-lg"
              >
                {HERO.cta_secondary.label}
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
              <h2 className="text-3xl font-bold font-display mb-2">{OUR_STORY.heading}</h2>
              <p className="text-gold font-semibold mb-4">{OUR_STORY.subheading}</p>
              <p className="text-primary/70 leading-relaxed">{siteConfig.about_body || OUR_STORY.body}</p>
              <div className="mt-4 text-sm text-primary/50">
                <p>{SITE.phone}</p>
                <p>{SITE.email}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <FaqTeaser />

      {/* Footer */}
      <footer className="bg-white border-t border-warm-sand py-12 px-6 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold font-display mb-3">{SITE.name}</h4>
            <p className="text-sm text-primary/60 leading-relaxed">{SITE.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              {NAVIGATION.footer.map((link) => (
                <Link key={link.href} href={link.href} className="text-primary/60 hover:text-gold transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-3">Policies</h4>
            <p className="text-sm text-primary/60 leading-relaxed">{RETURN_POLICY}</p>
            <p className="text-xs text-primary/40 mt-3">
              We accept: {PAYMENT_METHODS.join(", ")}
            </p>
            <div className="flex gap-3 mt-3">
              <a
                href={SITE.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/40 hover:text-gold transition-colors"
                aria-label="Instagram"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-warm-sand text-center text-sm text-primary/40">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name} &mdash; {SITE.location}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
