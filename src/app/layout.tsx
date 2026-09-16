import type { Metadata, Viewport } from "next";
import { Vesper_Libre } from "next/font/google";
import ClientLayout from "@/components/layout/client-layout";
import { SiteJsonLd } from "@/components/layout/json-ld";
import "./globals.css";

const vesperLibre = Vesper_Libre({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-display",
});

// Production origin for the static export — the canonical host the site is
// deployed to. Absolute URLs are required in metadata because social scrapers
// do not resolve relative og:image / twitter:image paths.
const SITE_URL = "https://www.animasreflections.com";

export const viewport: Viewport = {
  themeColor: "#1E4D4F",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  // Lets Next resolve relative metadata URLs (canonicals, og images) to the
  // production origin instead of warning and falling back to localhost.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Animas Reflections | Custom Apparel & Merchandise — Durango, CO",
    template: "%s | Animas Reflections",
  },
  description:
    "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more! Based in Durango, Colorado.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Animas Reflections",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Animas Reflections | Custom Apparel & Merchandise",
    description:
      "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more!",
    url: SITE_URL,
    siteName: "Animas Reflections",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Animas Reflections — custom apparel & merchandise, Durango, CO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Animas Reflections | Custom Apparel & Merchandise",
    description:
      "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more!",
    images: [`${SITE_URL}/og-image.png`],
  },
  // Deliberately NO `alternates.canonical` here: the root layout wraps every
  // route, so a canonical set here is inherited by any page that does not
  // declare its own — that silently pointed /product/ (and every ?id= product
  // URL) at the home page. Per-route canonicals come from metadataFor().
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${vesperLibre.variable} h-full antialiased`}>
      <head>
        {/* One @graph holding the WebSite and LocalBusiness nodes, cross-linked
            by @id — see src/lib/seo.ts. Replaces two separate flat nodes. */}
        <SiteJsonLd />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-foreground">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
