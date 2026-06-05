import Image from "next/image";
import Link from "next/link";
import NavAuth from "@/components/layout/nav-auth";
import {
  SITE,
  ANNOUNCEMENT,
  HERO,
  OUR_STORY,
  FEATURED_PRODUCTS,
  NAVIGATION,
  PAYMENT_METHODS,
  RETURN_POLICY,
} from "@/lib/content";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Announcement Bar */}
      {ANNOUNCEMENT.active && (
        <div className="bg-gold text-white text-center text-sm py-2 px-4 font-medium">
          {ANNOUNCEMENT.text}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={SITE.name}
              width={48}
              height={48}
              className="rounded-xl"
              priority
            />
            <span className="text-xl font-bold tracking-tight font-display hidden sm:inline">
              {SITE.name}
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            {NAVIGATION.primary.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-gold transition-colors">
                {link.label}
              </Link>
            ))}
            <NavAuth />
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-warm-sand">
        <Image
          src="/hero-bg.jpg"
          alt=""
          fill
          className="object-cover opacity-20"
          priority
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 sm:py-32 lg:py-40 text-center">
          <div className="mx-auto max-w-2xl">
            <Image
              src="/logo.png"
              alt={`${SITE.name} logo — guitar and moon over mountains`}
              width={120}
              height={120}
              className="mx-auto mb-8 rounded-2xl shadow-elevated"
              priority
            />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight font-display mb-6">
              {HERO.heading}
            </h1>
            <p className="text-lg text-teal/70 mb-10 max-w-lg mx-auto leading-relaxed">
              Design your own t-shirt, hoodie, bag, purse, ornament, coaster, dog
              scarf, long sleeve tee, print on wood, metal, jewelry and more!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={HERO.cta_primary.href}
                className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
              >
                {HERO.cta_primary.label}
              </Link>
              <Link
                href={HERO.cta_secondary.href}
                className="inline-flex items-center justify-center h-12 px-8 rounded-2xl border-2 border-teal/20 text-teal font-semibold hover:border-teal/40 transition-colors btn-tactile"
              >
                {HERO.cta_secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex justify-center">
            <Image
              src="/logo-bw.webp"
              alt={SITE.name}
              width={300}
              height={300}
              className="rounded-2xl shadow-card opacity-80"
            />
          </div>
          <div>
            <h2 className="text-3xl font-bold font-display mb-2">
              {OUR_STORY.heading}
            </h2>
            <p className="text-gold font-semibold mb-4">{OUR_STORY.subheading}</p>
            <p className="text-teal/70 leading-relaxed">{OUR_STORY.body}</p>
            <div className="mt-4 text-sm text-teal/50">
              <p>{SITE.phone}</p>
              <p>{SITE.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold font-display text-center mb-2">
            {FEATURED_PRODUCTS.heading}
          </h2>
          <p className="text-teal/60 text-center mb-12 max-w-md mx-auto">
            {FEATURED_PRODUCTS.subheading}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_PRODUCTS.items.map((item) => (
              <div
                key={item.name}
                className="p-6 rounded-2xl shadow-card border border-warm-sand hover:shadow-elevated transition-shadow"
              >
                <h3 className="font-bold font-display mb-2">{item.name}</h3>
                <p className="text-gold font-semibold">
                  {item.priceDisplay}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal text-white py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold font-display mb-4">
            Snapshot of Our Collections
          </h2>
          <p className="text-white/70 mb-8">
            Discover something extraordinary and one-of-a-kind. Let&apos;s discuss
            preserving your cherished memories!
          </p>
          <Link
            href="/custom"
            className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
          >
            Design Your Own
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-warm-sand py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold font-display mb-3">{SITE.name}</h4>
            <p className="text-sm text-teal/60 leading-relaxed">
              {SITE.description}
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              {NAVIGATION.footer.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-teal/60 hover:text-gold transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-3">Policies</h4>
            <p className="text-sm text-teal/60 leading-relaxed">
              {RETURN_POLICY}
            </p>
            <p className="text-xs text-teal/40 mt-3">
              We accept: {PAYMENT_METHODS.join(", ")}
            </p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-warm-sand text-center text-sm text-teal/40">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name} &mdash;{" "}
            {SITE.location}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
