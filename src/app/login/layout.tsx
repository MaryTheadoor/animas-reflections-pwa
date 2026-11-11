import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/login/");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
