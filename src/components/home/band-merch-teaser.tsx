import Link from "next/link";
import { BAND_MERCH } from "@/lib/content";

export default function BandMerchTeaser() {
  return (
    <section className="section-tile">
      <div className="glass-card p-6 sm:p-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-plum/10 rounded-full text-plum text-xs font-semibold mb-4">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          For Bands & Musicians
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
          {BAND_MERCH.heading}
        </h2>
        <p className="text-primary/60 max-w-xl mx-auto mb-6 leading-relaxed">
          {BAND_MERCH.intro}
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {BAND_MERCH.highlights.map((item) => (
            <span
              key={item}
              className="px-4 py-2 bg-warm-sand/50 rounded-full text-sm text-primary/70 font-medium"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={BAND_MERCH.ctaBrowse.href}
            className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-plum text-white font-semibold hover:bg-plum-light transition-colors btn-tactile text-lg"
            style={{
              backgroundColor: "#935B8A",
              borderColor: "#7A4A72",
              borderBottomColor: "#5C3856",
              borderBottomWidth: "4px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.25)",
            }}
          >
            {BAND_MERCH.ctaBrowse.label}
          </Link>
          <Link
            href={BAND_MERCH.cta.href}
            className="inline-flex items-center justify-center h-14 px-10 rounded-2xl border-2 border-plum/30 text-plum font-semibold hover:border-plum/60 transition-colors text-lg"
          >
            {BAND_MERCH.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
