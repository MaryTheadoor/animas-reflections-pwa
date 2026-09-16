import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/search/");

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
