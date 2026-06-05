import Image from "next/image";
import Link from "next/link";
import { OUR_STORY, SITE, NAVIGATION, PAYMENT_METHODS, RETURN_POLICY } from "@/lib/content";

export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-warm-sand">
        <nav className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt={SITE.name} width={48} height={48} className="rounded-xl" priority />
            <span className="text-xl font-bold tracking-tight font-display hidden sm:inline">{SITE.name}</span>
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-gold transition-colors">Back to Home</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="py-20 px-6 max-w-3xl mx-auto w-full">
          <h1 className="text-4xl font-bold font-display mb-2">{OUR_STORY.heading}</h1>
          <p className="text-gold font-semibold text-lg mb-8">{OUR_STORY.subheading}</p>
          <div className="prose prose-teal max-w-none">
            <p className="text-teal/80 leading-relaxed text-lg mb-8">{OUR_STORY.body}</p>
            <div className="bg-warm-sand p-6 rounded-2xl">
              <p className="text-teal/70">
                <strong>{SITE.name}</strong><br />
                {SITE.phone}<br />
                {SITE.email}<br />
                {SITE.location}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-warm-sand py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold font-display mb-3">{SITE.name}</h4>
            <p className="text-sm text-teal/60 leading-relaxed">{SITE.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              {NAVIGATION.footer.map((link) => (
                <Link key={link.href} href={link.href} className="text-teal/60 hover:text-gold transition-colors">{link.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-3">Policies</h4>
            <p className="text-sm text-teal/60 leading-relaxed">{RETURN_POLICY}</p>
            <p className="text-xs text-teal/40 mt-3">We accept: {PAYMENT_METHODS.join(", ")}</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-warm-sand text-center text-sm text-teal/40">
          <p>&copy; {new Date().getFullYear()} {SITE.name} &mdash; {SITE.location}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
