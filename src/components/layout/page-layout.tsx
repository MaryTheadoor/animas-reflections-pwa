"use client";

import Link from "next/link";
import HeaderBar from "@/components/layout/header-bar";
import { PAYMENT_METHODS, RETURN_POLICY, SITE } from "@/lib/content";
import { useSiteContent } from "@/hooks/useSiteConfig";
import type { ReactNode } from "react";

const HEADER_FALLBACK = "88px";

export default function PageLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Footer copy is CMS-managed, so it reads the same site-content hook the
  // admin edits write to.
  const c = useSiteContent();
  return (
    <div
      className="flex flex-col flex-1 min-h-screen bg-ambient"
      style={{
        paddingTop: `var(--header-height, ${HEADER_FALLBACK})`,
      }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <HeaderBar />
      {/* tabIndex={-1} so the skip link actually MOVES focus here; a plain
          wrapper div is not a focus target and the browser would only scroll.
          Stays a div, not <main>: every view rendered inside it supplies its own
          <main> landmark (faq-view.tsx, about-view.tsx, …) and nesting two
          would be invalid HTML. */}
      <div id="main-content" tabIndex={-1} className="flex flex-col flex-1">
        {children}
      </div>

      {/* Site footer. Lives here rather than on the home page so every route
          gets the return policy, payment methods and the Terms/Privacy links —
          previously 13 of 14 routes had none of them. */}
      <footer className="bg-white border-t border-warm-sand py-12 px-6 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold font-display mb-3">{c.global.name}</h4>
            <p className="text-sm text-foreground leading-relaxed">{c.global.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              {c.navigation.footer.map((link) => (
                <Link key={link.href} href={link.href} className="text-foreground hover:text-gold-deep transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-3">Policies</h4>
            <p className="text-sm text-foreground leading-relaxed">{RETURN_POLICY}</p>
            <p className="text-xs text-foreground/80 mt-3">
              We accept: {PAYMENT_METHODS.join(", ")}
            </p>
            <div className="flex gap-3 mt-3">
              <a
                href={SITE.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/80 hover:text-gold-deep transition-colors"
                aria-label="Instagram"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-warm-sand text-center text-sm text-foreground/80">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name} &mdash; {SITE.location}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
