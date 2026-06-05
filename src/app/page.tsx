import Image from "next/image";
import Link from "next/link";
import NavAuth from "@/components/layout/nav-auth";
import { ThemeToggle } from "@/context/theme-context";
import CartNavButton from "@/components/cart/cart-nav-button";
import FeaturedProducts from "@/components/home/featured-products";
import {
  SITE,
  ANNOUNCEMENT,
  HERO,
  OUR_STORY,
  NAVIGATION,
  PAYMENT_METHODS,
  RETURN_POLICY,
} from "@/lib/content";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-ambient">
      {/* Fixed Header Bar — banner + nav in single container, no overlap */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {ANNOUNCEMENT.active && (
          <div className="bg-gold text-white text-center text-sm py-2 px-4 font-medium">
            {ANNOUNCEMENT.text}
          </div>
        )}
        <nav className="nav-dock">
          <Link href="/" className="nav-dock-link active">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>Home</span>
          </Link>
          <Link href="/shop" className="nav-dock-link">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
            <span>Shop</span>
          </Link>
          <Link href="/customizer" className="nav-dock-link">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
            <span>Customizer</span>
          </Link>
          <Link href="/about" className="nav-dock-link">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>About</span>
          </Link>
          <Link href="/contact" className="nav-dock-link">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <span>Contact</span>
          </Link>
          <ThemeToggle />
          <NavAuth />
          <CartNavButton />
        </nav>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[70vh] sm:min-h-[85vh] flex items-center pt-12 sm:pt-16">
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
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight font-display mb-6 animate-fade-in-up animate-delay-100">
              {HERO.heading}
            </h1>
            <p className="text-lg text-teal/70 mb-10 max-w-lg mx-auto leading-relaxed animate-fade-in-up animate-delay-200">
              Design your own t-shirt, hoodie, bag, purse, ornament, coaster, dog
              scarf, long sleeve tee, print on wood, metal, jewelry and more!
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
                className="inline-flex items-center justify-center h-14 px-10 rounded-2xl border-2 border-teal/20 text-teal font-semibold hover:border-teal/40 transition-colors text-lg"
              >
                {HERO.cta_secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products — Live from Catalog */}
      <FeaturedProducts />

      {/* Our Story — Glass Card */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto w-full">
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
              <p className="text-teal/70 leading-relaxed">{OUR_STORY.body}</p>
              <div className="mt-4 text-sm text-teal/50">
                <p>{SITE.phone}</p>
                <p>{SITE.email}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Collections CTA */}
      <section className="py-20 px-6 text-center">
        <div className="glass-card max-w-2xl mx-auto p-10">
          <h2 className="text-3xl font-bold font-display mb-4">
            Snapshot of Our Collections
          </h2>
          <p className="text-teal/60 mb-8 max-w-md mx-auto">
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
      <footer className="bg-white border-t border-warm-sand py-12 px-6 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold font-display mb-3">{SITE.name}</h4>
            <p className="text-sm text-teal/60 leading-relaxed">{SITE.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              {NAVIGATION.footer.map((link) => (
                <Link key={link.href} href={link.href} className="text-teal/60 hover:text-gold transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-3">Policies</h4>
            <p className="text-sm text-teal/60 leading-relaxed">{RETURN_POLICY}</p>
            <p className="text-xs text-teal/40 mt-3">
              We accept: {PAYMENT_METHODS.join(", ")}
            </p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-warm-sand text-center text-sm text-teal/40">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name} &mdash; {SITE.location}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
