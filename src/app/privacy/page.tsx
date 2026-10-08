import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";
import PrivacyView from "./privacy-view";

// Per-page <title>/<meta> are baked here (server component) so crawlers and
// social scrapers get them; the editable copy lives in the client view.
export const metadata: Metadata = metadataFor("/privacy/");

export default function PrivacyPage() {
  return <PrivacyView />;
}
