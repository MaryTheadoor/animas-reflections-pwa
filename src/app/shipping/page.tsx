import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";
import ShippingView from "./shipping-view";

// Rates come from config/site at runtime, so the figures on this page cannot
// drift from what checkout charges. That makes the view a client component; the
// metadata stays here because it must be baked at build time.
export const metadata: Metadata = metadataFor("/shipping/");

export default function ShippingPage() {
  return <ShippingView />;
}
