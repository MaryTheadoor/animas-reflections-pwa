import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

// The home page is a client component, so it cannot export metadata itself and
// the root layout must not carry a per-page canonical (it wraps every route, so
// any canonical there is inherited by pages that declare none — that once
// pointed /product/ and every ?id= product URL at the home page). A route group
// gives "/" its own metadata, clamped to the SERP limits, without changing the
// URL.
export const metadata: Metadata = metadataFor("/");

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
