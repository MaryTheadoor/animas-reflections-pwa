import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/shop/");

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
