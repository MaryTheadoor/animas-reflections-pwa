import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/customizer/");

export default function CustomizerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
