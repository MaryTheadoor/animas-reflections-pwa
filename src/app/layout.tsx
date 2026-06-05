import type { Metadata, Viewport } from "next";
import { Vesper_Libre } from "next/font/google";
import ClientLayout from "@/components/layout/client-layout";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/layout/json-ld";
import "./globals.css";

const vesperLibre = Vesper_Libre({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-display",
});

export const viewport: Viewport = {
  themeColor: "#1E4D4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
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
    url: "https://www.animasreflections.com",
    siteName: "Animas Reflections",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Animas Reflections | Custom Apparel & Merchandise",
    description:
      "Custom designs. Create your own t-shirt, hoodie, bag, ornament, coaster, dog scarf, print on wood, glass, metal, jewelry and more!",
  },
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
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-teal">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
