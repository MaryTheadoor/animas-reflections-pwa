"use client";

import Link from "next/link";
import PageLayout from "@/components/layout/page-layout";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { SITE } from "@/lib/content";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function ShippingView() {
  const siteConfig = useSiteConfig();
  const stickers = siteConfig.shipping_tier_stickers;
  const apparel = siteConfig.shipping_tier_apparel;
  const threshold = siteConfig.free_shipping_threshold;

  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-10 sm:pt-14 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3">Shipping</h1>
        <p className="text-foreground mb-8">
          We print and ship from Durango, Colorado. The rates below are the ones checkout applies —
          they are read from the same settings, so what you see here is what you are charged.
        </p>

        <section className="bg-white rounded-2xl border border-warm-sand p-6 mb-6">
          <h2 className="font-bold font-display text-lg mb-3">Rates</h2>
          <dl className="space-y-2 text-foreground">
            <div className="flex justify-between gap-4">
              <dt>Sticker-only orders</dt>
              <dd className="font-medium">{money(stickers)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Apparel, drinkware, signs and everything else</dt>
              <dd className="font-medium">{money(apparel)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-warm-sand pt-2">
              <dt>Free shipping</dt>
              <dd className="font-medium">Orders of {money(threshold)} or more</dd>
            </div>
          </dl>
          <p className="text-sm text-foreground/80 mt-3">
            Some items carry their own flat rate; where that is higher than the rate above, the
            higher one applies. Any discount or change to a rate is shown in the cart before you
            pay.
          </p>
        </section>

        <section className="space-y-4 text-foreground">
          <div>
            <h2 className="font-bold font-display text-lg mb-1">Where we ship</h2>
            <p>
              Within the United States. If you need an order sent elsewhere,{" "}
              <Link href="/contact" className="text-gold-deep underline">
                contact us
              </Link>{" "}
              and we will see what we can do.
            </p>
          </div>
          <div>
            <h2 className="font-bold font-display text-lg mb-1">When it ships</h2>
            <p>
              Custom items are produced to order rather than pulled from a shelf, so your order
              enters production after it is placed. We email you when it ships, and the tracking
              link appears in your account. If you need something by a particular date, tell us
              before ordering — production time depends on the item and the quantity.
            </p>
          </div>
          <div>
            <h2 className="font-bold font-display text-lg mb-1">Tracking</h2>
            <p>
              Tracking is attached to your order once it ships. Sign in to{" "}
              <Link href="/account" className="text-gold-deep underline">
                your account
              </Link>{" "}
              to see it, or use the order reference from your confirmation.
            </p>
          </div>
          <div>
            <h2 className="font-bold font-display text-lg mb-1">Local pickup</h2>
            <p>
              In Durango and would rather collect it? Call {SITE.phone} before ordering and we will
              arrange it.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm text-foreground/80">
          Returns and exchanges are covered on the{" "}
          <Link href="/returns" className="text-gold-deep underline">
            Returns
          </Link>{" "}
          page.
        </p>
      </main>
    </PageLayout>
  );
}
