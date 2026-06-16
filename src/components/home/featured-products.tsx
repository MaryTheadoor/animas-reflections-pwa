"use client";

import { useCatalog } from "@/hooks/useCatalog";
import Link from "next/link";
import ProductCard from "@/components/product/product-card";

export default function FeaturedProducts() {
  const { products, loading } = useCatalog();

  const featured = products.slice(0, 6);

  if (loading || featured.length === 0) {
    return (
      <section className="section-tile">
        <h2 className="text-3xl font-bold font-display text-center mb-2">Featured Products</h2>
        <p className="text-primary/60 text-center mb-12 max-w-md mx-auto">
          Discover our diverse collection now and find your perfect style
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-3">
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-primary/50">Products coming soon.</div>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="section-tile">
        <h2 className="text-3xl font-bold font-display text-center mb-2">Featured Products</h2>
        <p className="text-primary/60 text-center mb-12 max-w-md mx-auto">
          Discover our diverse collection now and find your perfect style
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {featured.map((product, i) => (
            <div
              key={product.id}
              style={{ animationDelay: `${i * 0.1}s` }}
              className={`animate-fade-in-up ${i >= 4 ? "hidden lg:block" : ""}`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
          >
            Browse All {products.length} Products
          </Link>
        </div>
      </section>
    </>
  );
}
