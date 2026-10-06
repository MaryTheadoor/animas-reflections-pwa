import PageLayout from "@/components/layout/page-layout";
import { CONTACT } from "@/lib/content";
import Link from "next/link";
import type { Metadata } from "next";
import { metadataFor } from "@/lib/seo";

export const metadata: Metadata = metadataFor("/contact/");

export default function ContactPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{CONTACT.heading}</h1>
        <p className="text-foreground text-lg mb-10">{CONTACT.subheading}</p>
        <div className="glass-card p-8 space-y-4">
          <p className="text-foreground"><strong>Phone:</strong> <a href={`tel:${CONTACT.phone}`} className="hover:text-gold-deep">{CONTACT.phone}</a></p>
          <p className="text-foreground"><strong>Email:</strong> <a href={`mailto:${CONTACT.email}`} className="hover:text-gold-deep">{CONTACT.email}</a></p>
          <p className="text-foreground"><strong>Location:</strong> {CONTACT.location}</p>
          <p className="text-xs text-foreground/80 mt-4">
            {CONTACT.privacy_note}{" "}
            <Link href="/privacy" className="underline hover:text-gold-deep">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
