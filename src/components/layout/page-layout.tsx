"use client";

import HeaderBar from "@/components/layout/header-bar";
import type { ReactNode } from "react";

const HEADER_FALLBACK = "88px";

export default function PageLayout({
  children,
}: {
  children: ReactNode;
}) {
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
    </div>
  );
}
