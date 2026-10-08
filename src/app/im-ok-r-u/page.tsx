import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";
import ImOkRuView from "./im-ok-r-u-view";

// Per-page <title>/<meta> are baked here (server component) so crawlers and
// social scrapers get them; the editable copy lives in the client view.
export const metadata: Metadata = metadataFor("/im-ok-r-u/");

export default function ImOkRuPage() {
  return <ImOkRuView />;
}
