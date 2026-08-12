import Link from "next/link";

const HIGHLIGHTS = [
  "50/50 profit split",
  "No upfront costs",
  "No minimum orders",
  "We handle printing & shipping",
];

export default function FundraisingTeaser() {
  return (
    <section className="section-tile">
      <div className="glass-card p-6 sm:p-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 rounded-full text-gold text-xs font-semibold mb-4">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
          </svg>
          Fundraising
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
          Fundraising Made Easy
        </h2>
        <p className="text-foreground max-w-xl mx-auto mb-6 leading-relaxed">
          Raise money for your team, school, or cause with custom merchandise.
          We build your catalog, handle orders, print and ship — you earn 50% of
          the profit. No inventory, no minimums, no stress.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {HIGHLIGHTS.map((item) => (
            <span
              key={item}
              className="px-4 py-2 bg-warm-sand/50 rounded-full text-sm text-foreground font-medium"
            >
              {item}
            </span>
          ))}
        </div>
        <Link
          href="/fundraising"
          className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-lg"
        >
          Learn More About Fundraising
        </Link>
      </div>
    </section>
  );
}
