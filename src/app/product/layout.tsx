import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

// /product is a client component, so its metadata has to live in a layout.
// Its PAGE_SEO entry deliberately sets canonical:false — every product is served
// from this one static URL via ?id=, so a single canonical would collapse the
// entire catalog into one indexed page.
export const metadata: Metadata = metadataFor("/product/");

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
