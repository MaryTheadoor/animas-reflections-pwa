import type { Metadata } from "next";
import Link from "next/link";
import { metadataFor } from "@/lib/seo";
import PageLayout from "@/components/layout/page-layout";
import { SITE } from "@/lib/content";

// Plain-language version of the Terms of Sale, section 7. The Terms remain the
// legal document; this page exists so a shopper can read the rule without
// hunting through a contract, and so the footer has one place to point at.
export const metadata: Metadata = metadataFor("/returns/");

export default function ReturnsPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-10 sm:pt-14 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3">Returns &amp; Exchanges</h1>
        <p className="text-foreground mb-8">
          Almost everything we sell is printed or embroidered to order, so we cannot resell a
          returned item. That shapes the policy below — and it is why we ask you to check sizes
          carefully before ordering.
        </p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="font-bold font-display text-lg mb-2">Before returning anything</h2>
            <p>
              Contact us first and we will authorize the return. Unauthorized returns cannot be
              accepted. Email{" "}
              <a className="text-gold-deep underline" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>{" "}
              or call{" "}
              <a className="text-gold-deep underline" href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`}>
                {SITE.phone}
              </a>
              , with your order reference and a photo if the item is damaged or incorrect.
            </p>
          </section>

          <section>
            <h2 className="font-bold font-display text-lg mb-2">What can be returned</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Items must be unused, in their original condition and packaging.</li>
              <li>Proof of purchase is required.</li>
              <li>
                Custom, personalized and digital products are <strong>not returnable</strong>,
                except where there is a documented defect or we shipped the wrong item.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold font-display text-lg mb-2">Return shipping</h2>
            <p>
              Return shipping is your responsibility unless the item was defective or we shipped
              it in error — in that case we cover it.
            </p>
          </section>

          <section>
            <h2 className="font-bold font-display text-lg mb-2">Refunds</h2>
            <p>
              Approved refunds go back to the original payment method after we have inspected the
              returned item. We will confirm by email when the refund is issued.
            </p>
          </section>

          <section>
            <h2 className="font-bold font-display text-lg mb-2">If something is wrong</h2>
            <p>
              Wrong size on a garment we printed, a defect, or the wrong item: contact us as soon
              as the order arrives and we will make it right. Orders are photographed before they
              leave the shop, which usually settles what happened quickly.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-foreground/80">
          The full legal wording is in the{" "}
          <Link href="/terms" className="text-gold-deep underline">
            Terms of Sale
          </Link>
          , section 7. Shipping rates and timing are on the{" "}
          <Link href="/shipping" className="text-gold-deep underline">
            Shipping
          </Link>{" "}
          page.
        </p>
      </main>
    </PageLayout>
  );
}
