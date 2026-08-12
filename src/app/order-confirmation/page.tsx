"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/layout/page-layout";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const paymentStatus = searchParams.get("status") || "COMPLETED";

  return (
    <PageLayout>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-20 pb-16 text-center">
        {/* Success Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-green-600">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold font-display mb-4">
          Order Confirmed!
        </h1>
        <p className="text-foreground mb-8 max-w-md mx-auto leading-relaxed">
          Thank you for your order! We&apos;ve received it and will begin processing
          right away. You&apos;ll receive a confirmation email with your order details.
        </p>

        {orderId && (
          <div className="bg-warm-sand rounded-2xl p-6 mb-8 inline-block">
            <p className="text-xs text-foreground/80 mb-1">Order Reference</p>
            <p className="text-lg font-mono font-bold text-primary">{orderId}</p>
            {paymentStatus && (
              <p className="text-xs text-green-600 mt-2">
                Payment Status: {paymentStatus}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-14 px-10 rounded-2xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-12 text-sm text-foreground/80">
          <p>
            Questions about your order?{" "}
            <Link href="/contact" className="text-gold hover:underline">
              Contact us
            </Link>
          </p>
          <p className="mt-1">970-769-2779 &middot; AnimasReflections@gmail.com</p>
        </div>
      </main>
    </PageLayout>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex gap-3">
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
            <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
          </div>
        </div>
      </PageLayout>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
