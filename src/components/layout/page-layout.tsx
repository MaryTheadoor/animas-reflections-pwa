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
      <div id="main-content" className="flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
}
