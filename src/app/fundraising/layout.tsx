import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/fundraising/");

export default function FundraisingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
