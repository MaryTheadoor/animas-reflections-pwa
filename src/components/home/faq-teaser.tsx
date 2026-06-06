import Link from "next/link";

const QUESTIONS = [
  { q: "Can I use my own design?", a: "Yes! Upload your image or artwork directly." },
  { q: "How long does shipping take?", a: "5-10 business days for production plus shipping." },
  { q: "What is your return policy?", a: "All sales final, but we'll fix any issues." },
  { q: "How do I start a fundraiser?", a: "Email us — no fees, no minimums." },
];

export default function FaqTeaser() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-3xl mx-auto w-full">
      <div className="glass-card p-6 sm:p-10">
        <h2 className="text-3xl font-bold font-display text-center mb-2">
          Frequently Asked Questions
        </h2>
        <p className="text-primary/50 text-center text-sm mb-8">
          Quick answers to common questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="bg-warm-sand/30 rounded-2xl p-4">
              <p className="font-semibold text-sm text-primary mb-1">{item.q}</p>
              <p className="text-xs text-primary/60 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/faq"
            className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
          >
            View All FAQs
          </Link>
        </div>
      </div>
    </section>
  );
}
