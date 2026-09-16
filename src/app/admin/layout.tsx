import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/admin/");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
