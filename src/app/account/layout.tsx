import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/account/");

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
