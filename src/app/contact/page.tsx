"use client";

import PageLayout from "@/components/layout/page-layout";
import { useSiteContent } from "@/hooks/useSiteConfig";
import Link from "next/link";

export default function ContactPage() {
  const c = useSiteContent();
  return (
    <PageLayout>
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{c.contact.heading}</h1>
        <p className="text-foreground text-lg mb-10">{c.contact.subheading}</p>
        <div className="glass-card p-8 space-y-4">
          <p className="text-foreground"><strong>Phone:</strong> <a href={`tel:${c.contact.phone}`} className="hover:text-gold">{c.contact.phone}</a></p>
          <p className="text-foreground"><strong>Email:</strong> <a href={`mailto:${c.contact.email}`} className="hover:text-gold">{c.contact.email}</a></p>
          <p className="text-foreground"><strong>Location:</strong> {c.contact.location}</p>
          <p className="text-xs text-foreground/80 mt-4">
            {c.contact.privacyNote}{" "}
            <Link href="/privacy" className="underline hover:text-gold-deep">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
