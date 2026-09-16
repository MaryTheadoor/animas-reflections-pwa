import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/checkout/");

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
